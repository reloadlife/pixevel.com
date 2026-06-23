import "server-only";

import { eq } from "drizzle-orm";

import {
  domainRegistrations,
  orderItems,
  serverInstances,
  subscriptionInvoices,
  subscriptions,
} from "@/db/schema";
import { notify } from "@/lib/comms/dispatch";
import { getDb } from "@/lib/db";
import { formatToman } from "@/lib/format";
import { addInterval, billingIntervalLabelFa, faDate } from "@/lib/variant-options";

/**
 * After an order is paid, create a Subscription (+ a first PAID invoice) for
 * every order line whose variant carries a SubscriptionPlan. Idempotent: order
 * lines that already carry a subscriptionId are skipped (those are renewals,
 * handled by {@link applyRenewalPayment}). Never throws — best-effort side effect
 * called after `confirmPayment` commits.
 */
export async function createSubscriptionsForOrder(orderId: string): Promise<void> {
  const db = getDb();
  const order = await db.query.orders.findFirst({
    where: (o, { eq: e }) => e(o.id, orderId),
    with: {
      items: {
        with: {
          variant: {
            with: {
              subscriptionPlan: true,
              product: { columns: { id: true, titleFa: true } },
            },
          },
        },
      },
    },
  });
  if (!order || !order.userId) return;

  for (const item of order.items) {
    if (item.subscriptionId) continue; // renewal line, not a new subscription
    const variant = item.variant;
    const plan = variant?.subscriptionPlan;
    if (!variant || !plan) continue;

    const now = new Date();
    const trialEndsAt = plan.trialDays > 0 ? addInterval(now, "DAY", plan.trialDays) : null;
    const periodStart = now;
    const periodEnd = trialEndsAt ?? addInterval(now, plan.intervalUnit, plan.intervalCount);
    const planLabel = billingIntervalLabelFa(plan.intervalUnit, plan.intervalCount);
    const titleFa = `${item.titleFa} (${planLabel})`;

    await db.transaction(async (tx) => {
      const [sub] = await tx
        .insert(subscriptions)
        .values({
          userId: order.userId as string,
          productId: variant.product?.id ?? null,
          variantId: variant.id,
          titleFa,
          planSnapshot: {
            intervalUnit: plan.intervalUnit,
            intervalCount: plan.intervalCount,
            trialDays: plan.trialDays,
            termCount: plan.termCount,
            gracePeriodDays: plan.gracePeriodDays,
          },
          status: trialEndsAt ? "TRIALING" : "ACTIVE",
          currentPeriodStart: periodStart,
          currentPeriodEnd: periodEnd,
          nextBillingAt: periodEnd,
          trialEndsAt,
          autoRenew: plan.autoRenewDefault,
          cyclesBilled: 1,
          priceAmount: item.unitPrice,
          currency: order.currency,
          createdFromOrderId: order.id,
        })
        .returning();

      // First cycle is already paid by this order.
      await tx.insert(subscriptionInvoices).values({
        subscriptionId: sub.id,
        orderId: order.id,
        periodStart,
        periodEnd,
        amount: item.unitPrice,
        currency: order.currency,
        status: "PAID",
        dueAt: periodStart,
        paidAt: now,
        attemptCount: 1,
        lastAttemptAt: now,
      });

      // Link the order line + any provisioned resource to the subscription.
      await tx.update(orderItems).set({ subscriptionId: sub.id }).where(eq(orderItems.id, item.id));
      await tx
        .update(serverInstances)
        .set({ subscriptionId: sub.id, expiresAt: periodEnd })
        .where(eq(serverInstances.orderItemId, item.id));
      await tx
        .update(domainRegistrations)
        .set({ subscriptionId: sub.id })
        .where(eq(domainRegistrations.orderItemId, item.id));
    });

    await notify(
      "SUBSCRIPTION_STARTED",
      {
        userId: order.userId,
        email: order.customerEmail,
        phone: order.customerPhone,
        orderId: order.id,
      },
      {
        plan_name: titleFa,
        customer_name: order.customerName ?? "",
        amount: formatToman(item.unitPrice),
        next_billing_date: faDate(periodEnd),
        order_number: order.orderNumber,
        href: "/account/subscriptions",
      },
    );
  }
}

/**
 * When a RENEWAL order (whose line already carries a subscriptionId and whose
 * SubscriptionInvoice references it) is paid, advance the subscription period and
 * settle the invoice. Idempotent: a subscription whose invoice is already PAID is
 * left untouched.
 */
export async function applyRenewalPayment(orderId: string): Promise<void> {
  const db = getDb();

  const invoices = await db.query.subscriptionInvoices.findMany({
    where: (inv, { eq: e, and: a }) => a(e(inv.orderId, orderId), e(inv.status, "PENDING")),
    with: { subscription: true },
  });

  for (const invoice of invoices) {
    const sub = invoice.subscription;
    if (!sub) continue;
    const now = new Date();
    const planSnap = (sub.planSnapshot ?? {}) as {
      intervalUnit?: string;
      intervalCount?: number;
    };
    const unit = planSnap.intervalUnit ?? "MONTH";
    const count = planSnap.intervalCount ?? 1;
    const nextPeriodEnd = addInterval(invoice.periodEnd, unit, count);

    await db.transaction(async (tx) => {
      await tx
        .update(subscriptionInvoices)
        .set({ status: "PAID", paidAt: now, lastAttemptAt: now })
        .where(eq(subscriptionInvoices.id, invoice.id));

      await tx
        .update(subscriptions)
        .set({
          status: "ACTIVE",
          currentPeriodStart: invoice.periodStart,
          currentPeriodEnd: invoice.periodEnd,
          nextBillingAt: invoice.periodEnd,
          cyclesBilled: sub.cyclesBilled + 1,
        })
        .where(eq(subscriptions.id, sub.id));

      // Extend any provisioned resource to the new period end.
      await tx
        .update(serverInstances)
        .set({ status: "ACTIVE", expiresAt: invoice.periodEnd })
        .where(eq(serverInstances.subscriptionId, sub.id));
      await tx
        .update(domainRegistrations)
        .set({ expiresAt: invoice.periodEnd })
        .where(eq(domainRegistrations.subscriptionId, sub.id));
    });

    const order = await db.query.orders.findFirst({
      where: (o, { eq: e }) => e(o.id, orderId),
      columns: { userId: true, customerEmail: true, customerPhone: true, orderNumber: true },
    });

    await notify(
      "SUBSCRIPTION_RENEWED",
      {
        userId: sub.userId,
        email: order?.customerEmail ?? null,
        phone: order?.customerPhone ?? null,
        orderId,
      },
      {
        plan_name: sub.titleFa,
        amount: formatToman(invoice.amount),
        next_billing_date: faDate(nextPeriodEnd),
        order_number: order?.orderNumber ?? "",
        href: "/account/subscriptions",
      },
    );
  }
}
