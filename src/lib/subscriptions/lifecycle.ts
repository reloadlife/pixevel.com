import "server-only";

import { eq } from "drizzle-orm";

import { orderItems, orders, payments, subscriptionInvoices, subscriptions } from "@/db/schema";
import { notify } from "@/lib/comms/dispatch";
import { getDb } from "@/lib/db";
import { generateOrderNumber } from "@/lib/orders/order-number";
import { isPaymentMethod } from "@/lib/payments/methods";
import { getProvider, type PaymentMethod } from "@/lib/payments/provider";
import "@/lib/payments/register";
import { faDate } from "@/lib/variant-options";
import { autoRenewViaWallet, ensureUpcomingInvoice } from "./billing";

export class SubscriptionError extends Error {
  constructor(
    public readonly code: string,
    message?: string,
  ) {
    super(message ?? code);
    this.name = "SubscriptionError";
  }
}

async function loadOwned(subId: string, userId: string) {
  const sub = await getDb().query.subscriptions.findFirst({
    where: (s, { eq: e }) => e(s.id, subId),
    with: { variant: { with: { product: { columns: { fulfillmentType: true } } } } },
  });
  if (!sub || sub.userId !== userId) {
    throw new SubscriptionError("NOT_FOUND", "اشتراک یافت نشد.");
  }
  return sub;
}

/** Cancel a subscription. By default it stays active until the period ends. */
export async function cancelSubscription(
  subId: string,
  userId: string,
  opts: { immediate?: boolean } = {},
): Promise<void> {
  const sub = await loadOwned(subId, userId);
  const db = getDb();
  const now = new Date();

  if (opts.immediate) {
    await db
      .update(subscriptions)
      .set({ status: "CANCELED", canceledAt: now, nextBillingAt: null, autoRenew: false })
      .where(eq(subscriptions.id, sub.id));
  } else {
    await db
      .update(subscriptions)
      .set({ cancelAtPeriodEnd: true, canceledAt: now, autoRenew: false })
      .where(eq(subscriptions.id, sub.id));
  }

  await notify(
    "SUBSCRIPTION_CANCELED",
    { userId },
    {
      plan_name: sub.titleFa,
      expires_at: faDate(sub.currentPeriodEnd),
      href: "/account/subscriptions",
    },
  );
}

/** Toggle auto-renew (and clear a pending cancel when re-enabling). */
export async function setAutoRenew(
  subId: string,
  userId: string,
  autoRenew: boolean,
): Promise<void> {
  const sub = await loadOwned(subId, userId);
  await getDb()
    .update(subscriptions)
    .set({ autoRenew, ...(autoRenew ? { cancelAtPeriodEnd: false, canceledAt: null } : {}) })
    .where(eq(subscriptions.id, sub.id));
}

export type RenewNowResult = {
  paid: boolean;
  orderId?: string;
  redirectUrl?: string;
  instructions?: unknown;
};

/**
 * Start a renewal payment now. WALLET settles instantly when funded; any gateway
 * method builds a renewal order + payment and returns the gateway redirect, which
 * advances the subscription on the payment callback (via applyRenewalPayment).
 */
export type RenewMethod = PaymentMethod | "WALLET";

export async function renewNow(
  subId: string,
  userId: string,
  method: RenewMethod,
): Promise<RenewNowResult> {
  const sub = await loadOwned(subId, userId);
  if (sub.status === "EXPIRED" || sub.status === "CANCELED") {
    throw new SubscriptionError("NOT_RENEWABLE", "این اشتراک قابل تمدید نیست.");
  }

  const invoice = await ensureUpcomingInvoice(sub);
  if (!invoice) throw new SubscriptionError("NO_INVOICE", "صورتحساب تمدید ساخته نشد.");
  if (invoice.status !== "PENDING") {
    return { paid: true };
  }

  if (method === "WALLET") {
    const ok = await autoRenewViaWallet(sub, invoice);
    if (!ok) throw new SubscriptionError("WALLET_INSUFFICIENT", "موجودی کیف پول کافی نیست.");
    return { paid: true };
  }

  if (!isPaymentMethod(method)) {
    throw new SubscriptionError("INVALID_METHOD", "روش پرداخت معتبر نیست.");
  }

  const db = getDb();
  const buyer = await db.query.users.findFirst({
    where: (u, { eq: e }) => e(u.id, userId),
    columns: { phone: true, email: true },
  });

  const { orderId, paymentRow } = await db.transaction(async (tx) => {
    const [order] = await tx
      .insert(orders)
      .values({
        orderNumber: generateOrderNumber(),
        userId,
        status: "PENDING",
        paymentStatus: "UNPAID",
        currency: sub.currency,
        subtotalAmount: invoice.amount,
        totalAmount: invoice.amount,
        customerPhone: buyer?.phone ?? null,
        customerEmail: buyer?.email ?? null,
      })
      .returning();

    await tx.insert(orderItems).values({
      orderId: order.id,
      variantId: sub.variantId,
      titleFa: sub.titleFa,
      sku: sub.variant?.sku ?? sub.titleFa,
      quantity: 1,
      unitPrice: invoice.amount,
      totalPrice: invoice.amount,
      fulfillmentType: sub.variant?.product?.fulfillmentType ?? "SERVICE",
      subscriptionId: sub.id,
    });

    const [payment] = await tx
      .insert(payments)
      .values({
        userId,
        orderId: order.id,
        status: "UNPAID",
        provider: method,
        amount: invoice.amount,
        currency: sub.currency,
      })
      .returning();

    await tx
      .update(subscriptionInvoices)
      .set({ orderId: order.id, attemptCount: invoice.attemptCount + 1, lastAttemptAt: new Date() })
      .where(eq(subscriptionInvoices.id, invoice.id));

    return { orderId: order.id, paymentRow: payment };
  });

  const orderRow = await db.query.orders.findFirst({ where: (o, { eq: e }) => e(o.id, orderId) });
  if (!orderRow) throw new SubscriptionError("ORDER_NOT_FOUND", "سفارش تمدید یافت نشد.");

  const provider = getProvider(method);
  const initiateResult = await provider.initiate(orderRow, paymentRow);
  return { paid: false, orderId, ...initiateResult };
}
