import "server-only";

import { and, eq, lte, sql } from "drizzle-orm";

import {
  orderItems,
  orders,
  payments,
  subscriptionInvoices,
  subscriptions,
  wallets,
  walletTransactions,
} from "@/db/schema";
import { notify } from "@/lib/comms/dispatch";
import { getDb } from "@/lib/db";
import { decimalToNumber, formatToman } from "@/lib/format";
import { generateOrderNumber } from "@/lib/orders/order-number";
import { getSettingBool, getSettingNumber } from "@/lib/settings";
import { addInterval, faDate } from "@/lib/variant-options";
import { applyRenewalPayment } from "./create";

export type BillingTickResult = {
  invoicesCreated: number;
  remindersSent: number;
  autoRenewed: number;
  markedPastDue: number;
  expired: number;
};

type SubRow = typeof subscriptions.$inferSelect;
type InvoiceRow = typeof subscriptionInvoices.$inferSelect;

function planFromSnapshot(sub: SubRow): {
  unit: string;
  count: number;
  graceDays: number;
  termCount: number | null;
} {
  const snap = (sub.planSnapshot ?? {}) as {
    intervalUnit?: string;
    intervalCount?: number;
    gracePeriodDays?: number;
    termCount?: number | null;
  };
  return {
    unit: snap.intervalUnit ?? "MONTH",
    count: snap.intervalCount ?? 1,
    graceDays: snap.gracePeriodDays ?? 3,
    termCount: snap.termCount ?? null,
  };
}

/** Idempotently create the PENDING invoice for a subscription's upcoming period. */
export async function ensureUpcomingInvoice(sub: SubRow): Promise<InvoiceRow | null> {
  const db = getDb();
  const plan = planFromSnapshot(sub);
  const periodStart = sub.currentPeriodEnd;
  const periodEnd = addInterval(periodStart, plan.unit, plan.count);

  const [row] = await db
    .insert(subscriptionInvoices)
    .values({
      subscriptionId: sub.id,
      periodStart,
      periodEnd,
      amount: sub.priceAmount,
      currency: sub.currency,
      status: "PENDING",
      dueAt: periodStart,
    })
    .onConflictDoNothing({
      target: [subscriptionInvoices.subscriptionId, subscriptionInvoices.periodStart],
    })
    .returning();

  if (row) return row;
  // Conflict — fetch the existing one.
  return (
    (await db.query.subscriptionInvoices.findFirst({
      where: (inv, { eq: e, and: a }) =>
        a(e(inv.subscriptionId, sub.id), e(inv.periodStart, periodStart)),
    })) ?? null
  );
}

/** Attempt to auto-renew from the user's wallet. Returns true when settled. */
export async function autoRenewViaWallet(sub: SubRow, invoice: InvoiceRow): Promise<boolean> {
  const db = getDb();
  const wallet = await db.query.wallets.findFirst({
    where: (w, { eq: e }) => e(w.userId, sub.userId),
  });
  const amount = decimalToNumber(invoice.amount);
  if (!wallet || decimalToNumber(wallet.balanceAmount) < amount) return false;

  const variant = sub.variantId
    ? await db.query.productVariants.findFirst({
        where: (v, { eq: e }) => e(v.id, sub.variantId as string),
        with: { product: { columns: { fulfillmentType: true } } },
      })
    : null;

  const orderId = await db.transaction(async (tx) => {
    const [order] = await tx
      .insert(orders)
      .values({
        orderNumber: generateOrderNumber(),
        userId: sub.userId,
        status: "DELIVERED",
        paymentStatus: "PAID",
        currency: sub.currency,
        subtotalAmount: invoice.amount,
        totalAmount: invoice.amount,
      })
      .returning({ id: orders.id });

    await tx.insert(orderItems).values({
      orderId: order.id,
      variantId: sub.variantId,
      titleFa: sub.titleFa,
      sku: variant?.sku ?? sub.titleFa,
      quantity: 1,
      unitPrice: invoice.amount,
      totalPrice: invoice.amount,
      fulfillmentType: variant?.product?.fulfillmentType ?? "SERVICE",
      subscriptionId: sub.id,
    });

    await tx.insert(payments).values({
      userId: sub.userId,
      orderId: order.id,
      status: "PAID",
      provider: "WALLET",
      amount: invoice.amount,
      currency: sub.currency,
      paidAt: new Date(),
    });

    const balanceAfter = decimalToNumber(wallet.balanceAmount) - amount;
    await tx
      .update(wallets)
      .set({ balanceAmount: String(balanceAfter) })
      .where(eq(wallets.id, wallet.id));
    await tx.insert(walletTransactions).values({
      walletId: wallet.id,
      direction: "DEBIT",
      reason: "PURCHASE",
      amount: invoice.amount,
      balanceAfter: String(balanceAfter),
      orderId: order.id,
      note: `تمدید اشتراک ${sub.titleFa}`,
    });

    await tx
      .update(subscriptionInvoices)
      .set({ orderId: order.id })
      .where(eq(subscriptionInvoices.id, invoice.id));

    return order.id;
  });

  // Advances the subscription period, marks the invoice PAID, notifies RENEWED.
  await applyRenewalPayment(orderId);
  return true;
}

/**
 * The renewal tick. Run daily by the cron route. Idempotent end-to-end:
 *  1. For subs due within the lead window: ensure a PENDING invoice, then either
 *     auto-renew from wallet (if enabled + funded) or send a reminder to pay.
 *  2. Mark subs whose invoice passed its due date PAST_DUE (one notice).
 *  3. Expire subs past the grace window; suspend provisioning.
 */
export async function runBillingTick(now: Date): Promise<BillingTickResult> {
  const db = getDb();
  const result: BillingTickResult = {
    invoicesCreated: 0,
    remindersSent: 0,
    autoRenewed: 0,
    markedPastDue: 0,
    expired: 0,
  };

  const leadDays = await getSettingNumber("SUBSCRIPTION_RENEWAL_LEAD_DAYS", 14);
  const walletAuto = await getSettingBool("SUBSCRIPTION_WALLET_AUTORENEW", true);
  const leadCutoff = addInterval(now, "DAY", leadDays);

  // ── 1. Due-soon subscriptions ───────────────────────────────────────────────
  const dueSoon = await db.query.subscriptions.findMany({
    where: (s, { and: a, or: o, eq: e, lte: l, isNotNull }) =>
      a(
        o(e(s.status, "ACTIVE"), e(s.status, "TRIALING")),
        e(s.autoRenew, true),
        e(s.cancelAtPeriodEnd, false),
        isNotNull(s.nextBillingAt),
        l(s.nextBillingAt, leadCutoff),
      ),
  });

  for (const sub of dueSoon) {
    const plan = planFromSnapshot(sub);
    // Respect a fixed term: stop renewing once all cycles are billed.
    if (plan.termCount != null && sub.cyclesBilled >= plan.termCount) continue;

    const invoice = await ensureUpcomingInvoice(sub);
    if (!invoice) continue;
    if (invoice.status !== "PENDING") continue;

    if (invoice.reminderSentAt == null && invoice.orderId == null) {
      result.invoicesCreated += 1;
    }

    if (walletAuto) {
      const renewed = await autoRenewViaWallet(sub, invoice).catch(() => false);
      if (renewed) {
        result.autoRenewed += 1;
        continue;
      }
    }

    // Send a single reminder per invoice.
    if (invoice.reminderSentAt == null) {
      const order = sub.createdFromOrderId
        ? await db.query.orders.findFirst({
            where: (o, { eq: e }) => e(o.id, sub.createdFromOrderId as string),
            columns: { customerEmail: true, customerPhone: true, customerName: true },
          })
        : null;

      await notify(
        "SUBSCRIPTION_RENEWAL_REMINDER",
        {
          userId: sub.userId,
          email: order?.customerEmail ?? null,
          phone: order?.customerPhone ?? null,
        },
        {
          plan_name: sub.titleFa,
          customer_name: order?.customerName ?? "",
          amount: formatToman(invoice.amount),
          next_billing_date: faDate(invoice.periodStart),
          href: "/account/subscriptions",
        },
      );
      await db
        .update(subscriptionInvoices)
        .set({ reminderSentAt: now })
        .where(eq(subscriptionInvoices.id, invoice.id));
      result.remindersSent += 1;
    }
  }

  // ── 2. Past-due: invoice due date elapsed, still unpaid ─────────────────────
  const overdue = await db
    .select({ sub: subscriptions, invoice: subscriptionInvoices })
    .from(subscriptionInvoices)
    .innerJoin(subscriptions, eq(subscriptionInvoices.subscriptionId, subscriptions.id))
    .where(
      and(
        eq(subscriptionInvoices.status, "PENDING"),
        lte(subscriptionInvoices.dueAt, now),
        sql`${subscriptions.status} in ('ACTIVE','TRIALING')`,
      ),
    );

  for (const { sub } of overdue) {
    await db.update(subscriptions).set({ status: "PAST_DUE" }).where(eq(subscriptions.id, sub.id));
    await notify(
      "SUBSCRIPTION_PAYMENT_FAILED",
      { userId: sub.userId },
      { plan_name: sub.titleFa, href: "/account/subscriptions" },
    );
    result.markedPastDue += 1;
  }

  // ── 3. Expire past the grace window ─────────────────────────────────────────
  const pastDue = await db.query.subscriptions.findMany({
    where: (s, { eq: e }) => e(s.status, "PAST_DUE"),
  });

  for (const sub of pastDue) {
    const plan = planFromSnapshot(sub);
    const expiryDeadline = addInterval(sub.currentPeriodEnd, "DAY", plan.graceDays);
    if (now < expiryDeadline) continue;

    await db.transaction(async (tx) => {
      await tx
        .update(subscriptions)
        .set({ status: "EXPIRED", nextBillingAt: null })
        .where(eq(subscriptions.id, sub.id));
      await tx
        .update(subscriptionInvoices)
        .set({ status: "CANCELED" })
        .where(
          and(
            eq(subscriptionInvoices.subscriptionId, sub.id),
            eq(subscriptionInvoices.status, "PENDING"),
          ),
        );
    });
    await notify(
      "SUBSCRIPTION_EXPIRED",
      { userId: sub.userId },
      { plan_name: sub.titleFa, href: "/account/subscriptions" },
    );
    result.expired += 1;
  }

  return result;
}
