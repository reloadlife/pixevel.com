import { eq, sql } from "drizzle-orm";
import { orderItems, orders, payments, products, productVariants } from "@/db/schema";
import { getDb } from "@/lib/db";
import { sendEmail } from "@/lib/email/client";
import {
  type DigitalCodeGroup,
  digitalCodesEmail,
  type OrderEmailItem,
  type OrderEmailSummary,
  orderReceiptEmail,
} from "@/lib/email/templates";
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

  // Best-effort transactional email delivery. Runs AFTER the payment is fully
  // committed and never throws — a missing email config or provider failure
  // must not affect the payment outcome (codes remain visible in the account).
  // We only attempt this on the standalone (non-composed) confirm path so we
  // don't fire mail mid-transaction when callers inject their own `tx`.
  if (!opts.tx) {
    await sendOrderEmails(orderId).catch((err) => {
      console.error("[payments] order email delivery error:", err);
    });
  }
}

/**
 * Build and send the receipt + digital-codes emails for a freshly paid order.
 *
 * Best-effort: swallows all failures (logs them) and returns void. Reads the
 * order, its items (with variant → product for titles) and the SOLD inventory
 * units assigned to it.
 *
 * Exported so admin tooling can re-send the codes/receipt for an already-paid
 * order (see {@link resendOrderCodes}).
 */
export async function sendOrderEmails(orderId: string): Promise<void> {
  const db = getDb();

  const order = await db.query.orders.findFirst({
    where: (o, { eq: eqOp }) => eqOp(o.id, orderId),
    with: {
      items: true,
      inventoryUnits: {
        where: (u, { eq: eqOp }) => eqOp(u.status, "SOLD"),
        columns: { id: true, variantId: true, code: true },
      },
    },
  });

  if (!order) {
    return;
  }

  const summary: OrderEmailSummary = {
    orderNumber: order.orderNumber,
    customerName: order.customerName,
    subtotalAmount: order.subtotalAmount,
    shippingAmount: order.shippingAmount,
    discountAmount: order.discountAmount,
    totalAmount: order.totalAmount,
    couponCode: order.couponCode,
    giftMessage: order.giftMessage,
  };

  // (a) Receipt → customerEmail.
  if (order.customerEmail) {
    const items: OrderEmailItem[] = order.items.map((item) => ({
      titleFa: item.titleFa,
      variantFa: [item.colorNameFa, item.materialNameFa, item.size ? `سایز ${item.size}` : null]
        .filter(Boolean)
        .join(" / "),
      quantity: item.quantity,
      totalPrice: item.totalPrice,
    }));

    const receipt = orderReceiptEmail(summary, items);
    const res = await sendEmail({
      to: order.customerEmail,
      subject: receipt.subject,
      html: receipt.html,
      text: receipt.text,
    });
    if (res.status === "failed") {
      console.error(`[payments] receipt email failed for ${order.orderNumber}: ${res.message}`);
    }
  }

  // (b) Digital codes → recipientEmail ?? customerEmail.
  const codesTo = order.recipientEmail ?? order.customerEmail;
  if (codesTo && order.inventoryUnits.length > 0) {
    // Map variantId → product/item title via the order's own line items.
    const titleByVariant = new Map<string, string>();
    for (const item of order.items) {
      if (item.variantId) {
        titleByVariant.set(item.variantId, item.titleFa);
      }
    }

    // Group sold codes by variant, preserving an "گروه" per product line.
    const codesByVariant = new Map<string, string[]>();
    for (const unit of order.inventoryUnits) {
      const existing = codesByVariant.get(unit.variantId) ?? [];
      existing.push(unit.code);
      codesByVariant.set(unit.variantId, existing);
    }

    const groups: DigitalCodeGroup[] = [];
    for (const [variantId, codes] of codesByVariant) {
      groups.push({
        titleFa: titleByVariant.get(variantId) ?? "محصول دیجیتال",
        codes,
      });
    }

    if (groups.length > 0) {
      const codesMail = digitalCodesEmail({ order: summary, codes: groups });
      const res = await sendEmail({
        to: codesTo,
        subject: codesMail.subject,
        html: codesMail.html,
        text: codesMail.text,
      });
      if (res.status === "failed") {
        console.error(`[payments] codes email failed for ${order.orderNumber}: ${res.message}`);
      }
    }
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

/**
 * Re-send the digital-codes (and receipt) email for an already-PAID order.
 *
 * Reuses {@link sendOrderEmails}. Throws `ORDER_NOT_PAID` if the order is not
 * in a PAID payment state, so the admin layer can surface a clear message.
 * Email delivery itself is best-effort and never throws.
 */
export async function resendOrderCodes(orderId: string): Promise<void> {
  const db = getDb();

  const order = await db.query.orders.findFirst({
    where: (o, { eq: eqOp }) => eqOp(o.id, orderId),
    columns: { id: true, paymentStatus: true },
  });

  if (!order) {
    throw new Error("ORDER_NOT_FOUND");
  }

  if (order.paymentStatus !== "PAID") {
    throw new Error("ORDER_NOT_PAID");
  }

  await sendOrderEmails(orderId);
}
