import { eq, sql } from "drizzle-orm";
import { orderItems, orders, payments, products, productVariants } from "@/db/schema";
import { getDb } from "@/lib/db";
import { releaseUnits, sellReservedUnits } from "./inventory";

// ─── Types ────────────────────────────────────────────────────────────────────

interface TransactionOptions {
  /** Inject an existing transaction (used in tests / composed flows). */
  tx?: any;
}

interface ConfirmOptions extends TransactionOptions {
  /** Optional gateway or manual reference to store on the payment row. */
  reference?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Determine whether every item in an order maps to a DIGITAL product.
 *
 * Query path: orderItems → productVariants → products.fulfillmentType
 * We join orderItems to productVariants to products and check that no
 * PHYSICAL fulfillmentType exists for this orderId.
 */
async function isAllDigital(tx: any, orderId: string): Promise<boolean> {
  const rows = await tx
    .select({ fulfillmentType: products.fulfillmentType })
    .from(orderItems)
    .innerJoin(productVariants, eq(orderItems.variantId, productVariants.id))
    .innerJoin(products, eq(productVariants.productId, products.id))
    .where(eq(orderItems.orderId, orderId));

  if (rows.length === 0) {
    // No items — treat as all-digital (edge case; order should have items).
    return true;
  }

  return rows.every((r: { fulfillmentType: string }) => r.fulfillmentType === "DIGITAL");
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Confirm a payment for an order.
 *
 * In ONE transaction:
 *  1. Set the order's payment row → status PAID, paidAt = now(), reference if provided.
 *  2. Set order.paymentStatus → PAID.
 *  3. Sell all RESERVED inventory units for the order.
 *  4. Set order.status → DELIVERED (all items DIGITAL) or PROCESSING (any PHYSICAL).
 */
export async function confirmPayment(orderId: string, opts: ConfirmOptions = {}): Promise<void> {
  const { reference } = opts;

  const run = async (tx: any) => {
    // 1. Update the payment row.
    await tx
      .update(payments)
      .set({
        status: "PAID",
        paidAt: sql`now()`,
        ...(reference !== undefined ? { reference } : {}),
      })
      .where(eq(payments.orderId, orderId));

    // 2. Flip order payment status.
    await tx.update(orders).set({ paymentStatus: "PAID" }).where(eq(orders.id, orderId));

    // 3. Sell reserved inventory units.
    await sellReservedUnits(tx, orderId);

    // 4. Determine fulfillment status.
    const allDigital = await isAllDigital(tx, orderId);
    const newStatus = allDigital ? "DELIVERED" : "PROCESSING";

    await tx.update(orders).set({ status: newStatus }).where(eq(orders.id, orderId));
  };

  if (opts.tx) {
    await run(opts.tx);
  } else {
    const db = getDb();
    await db.transaction(run);
  }
}

/**
 * Fail a payment for an order.
 *
 * In ONE transaction:
 *  1. Set the order's payment row → status FAILED.
 *  2. Release all RESERVED inventory units back to AVAILABLE.
 *  3. Set order.status → CANCELLED.
 */
export async function failPayment(orderId: string, opts: TransactionOptions = {}): Promise<void> {
  const run = async (tx: any) => {
    // 1. Mark payment as FAILED.
    await tx.update(payments).set({ status: "FAILED" }).where(eq(payments.orderId, orderId));

    // 2. Release reserved units.
    await releaseUnits(tx, orderId);

    // 3. Cancel the order.
    await tx.update(orders).set({ status: "CANCELLED" }).where(eq(orders.id, orderId));
  };

  if (opts.tx) {
    await run(opts.tx);
  } else {
    const db = getDb();
    await db.transaction(run);
  }
}
