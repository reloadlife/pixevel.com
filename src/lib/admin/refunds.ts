import { and, eq, inArray, sum } from "drizzle-orm";
import type { CurrencyCode } from "@/db/schema";
import { inventoryUnits, orders, payments, refundItems, refunds } from "@/db/schema";
import { getDb } from "@/lib/db";
import { emitOrderEvent } from "@/lib/orders/events";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CreateRefundItem {
  orderItemId: string;
  quantity: number;
  amount: string;
  /** When true, released SOLD inventory units belonging to this line are returned to AVAILABLE. */
  restock: boolean;
}

export interface CreateRefundInput {
  orderId: string;
  amount: string;
  reason?: string;
  paymentId?: string;
  items?: CreateRefundItem[];
  createdByUserId: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function ensureValidOrder(order: { paymentStatus: string } | undefined, _orderId: string): void {
  if (!order) throw new Error("ORDER_NOT_FOUND");
  if (order.paymentStatus !== "PAID" && order.paymentStatus !== "REFUNDED") {
    throw new Error("ORDER_NOT_REFUNDABLE");
  }
}

// ─── List ─────────────────────────────────────────────────────────────────────

export async function listOrderRefunds(orderId: string) {
  const db = getDb();
  const rows = await db.query.refunds.findMany({
    where: (r, { eq: e }) => e(r.orderId, orderId),
    with: {
      items: true,
      createdBy: {
        columns: { id: true, fullName: true, phone: true },
      },
      payment: {
        columns: { id: true, provider: true, amount: true },
      },
    },
    orderBy: (r, { desc }) => [desc(r.createdAt)],
  });
  return rows;
}

export type AdminRefundListItem = Awaited<ReturnType<typeof listOrderRefunds>>[number];

// ─── Create ───────────────────────────────────────────────────────────────────

/**
 * Create a ledger refund row (+ optional per-line RefundItem rows).
 * - If items are provided and restock=true for any, releases those SOLD units back to AVAILABLE.
 * - Emits an ORDER_EVENT of type REFUND atomically inside the transaction.
 * - After the tx, checks the total refunded amount vs. order total to decide whether to
 *   flip the order/payment status to REFUNDED.
 */
export async function createRefund(input: CreateRefundInput) {
  const db = getDb();

  // Guard: order must be PAID (or already partially REFUNDED).
  const order = await db.query.orders.findFirst({
    where: (o, { eq: e }) => e(o.id, input.orderId),
    columns: {
      id: true,
      paymentStatus: true,
      totalAmount: true,
      currency: true,
    },
  });
  ensureValidOrder(order, input.orderId);

  // If no explicit paymentId supplied, use the latest PAID payment on the order.
  let resolvedPaymentId = input.paymentId ?? null;
  if (!resolvedPaymentId) {
    const latestPayment = await db.query.payments.findFirst({
      where: (p, { and: a, eq: e }) => a(e(p.orderId, input.orderId), e(p.status, "PAID")),
      orderBy: (p, { desc }) => [desc(p.createdAt)],
      columns: { id: true },
    });
    resolvedPaymentId = latestPayment?.id ?? null;
  }

  // Collect SOLD unit ids to restock (if requested).
  const restockItemIds = (input.items ?? []).filter((i) => i.restock).map((i) => i.orderItemId);

  let refundId: string;

  await db.transaction(async (tx) => {
    // Insert the Refund row.
    const [refund] = await tx
      .insert(refunds)
      .values({
        orderId: input.orderId,
        paymentId: resolvedPaymentId,
        amount: input.amount,
        currency: (order?.currency ?? "IRT") as CurrencyCode,
        reason: input.reason ?? null,
        status: "COMPLETED",
        processedAt: new Date(),
        createdByUserId: input.createdByUserId,
      })
      .returning({ id: refunds.id });

    refundId = refund.id;

    // Insert per-line items.
    if (input.items && input.items.length > 0) {
      await tx.insert(refundItems).values(
        input.items.map((item) => ({
          refundId: refund.id,
          orderItemId: item.orderItemId,
          quantity: item.quantity,
          amount: item.amount,
          restock: item.restock,
        })),
      );
    }

    // Restock: for each restocked orderItem, return SOLD units on that item's variantId
    // back to AVAILABLE, clearing orderId/userId (up to the refund item quantity).
    if (restockItemIds.length > 0) {
      // Fetch orderItems to get their variantIds.
      const { orderItems } = await import("@/db/schema");
      const itemRows = await tx
        .select({ id: orderItems.id, variantId: orderItems.variantId })
        .from(orderItems)
        .where(and(inArray(orderItems.id, restockItemIds), eq(orderItems.orderId, input.orderId)));

      for (const itemRow of itemRows) {
        if (!itemRow.variantId) continue;
        const inputItem = (input.items ?? []).find((i) => i.orderItemId === itemRow.id);
        if (!inputItem) continue;

        // Find SOLD units for this variant+order and return them (up to quantity).
        const soldUnits = await tx
          .select({ id: inventoryUnits.id })
          .from(inventoryUnits)
          .where(
            and(
              eq(inventoryUnits.variantId, itemRow.variantId),
              eq(inventoryUnits.orderId, input.orderId),
              eq(inventoryUnits.status, "SOLD"),
            ),
          )
          .limit(inputItem.quantity);

        if (soldUnits.length > 0) {
          await tx
            .update(inventoryUnits)
            .set({
              status: "AVAILABLE",
              orderId: null,
              userId: null,
              soldAt: null,
            })
            .where(
              inArray(
                inventoryUnits.id,
                soldUnits.map((u) => u.id),
              ),
            );
        }
      }
    }

    // Emit audit event.
    await emitOrderEvent(tx, {
      orderId: input.orderId,
      type: "REFUND",
      noteFa: `استرداد ${input.amount} تومان${input.reason ? `: ${input.reason}` : ""}`,
      isCustomerVisible: false,
      authorUserId: input.createdByUserId,
    });
  });

  // After tx: check total refunded vs. order total.
  const [{ totalRefunded }] = await db
    .select({ totalRefunded: sum(refunds.amount) })
    .from(refunds)
    .where(and(eq(refunds.orderId, input.orderId), eq(refunds.status, "COMPLETED")));

  const orderTotal = Number(order?.totalAmount ?? 0);
  const refundedSoFar = Number(totalRefunded ?? 0);

  if (refundedSoFar >= orderTotal) {
    await db
      .update(orders)
      .set({ status: "REFUNDED", paymentStatus: "REFUNDED" })
      .where(eq(orders.id, input.orderId));
    await db
      .update(payments)
      .set({ status: "REFUNDED" })
      .where(eq(payments.orderId, input.orderId));
  }

  return refundId!;
}
