import { eq } from "drizzle-orm";
import { expect, test } from "vitest";
import {
  inventoryUnits,
  orderItems,
  orders,
  payments,
  products,
  productVariants,
  users,
} from "@/db/schema";
import { withRollback } from "../../../test/db";
import { reserveUnits } from "./inventory";
import { confirmPayment, failPayment } from "./payments";

// ─── Seed helpers ─────────────────────────────────────────────────────────────

async function seedUser(tx: any): Promise<string> {
  const [user] = await tx
    .insert(users)
    .values({
      phone: `+98${Math.floor(9_000_000_000 + Math.random() * 999_999_999)}`,
    })
    .returning({ id: users.id });
  return user.id;
}

async function seedProduct(
  tx: any,
  fulfillment: "DIGITAL" | "PHYSICAL" = "DIGITAL",
): Promise<string> {
  const [product] = await tx
    .insert(products)
    .values({
      slug: `test-product-${crypto.randomUUID()}`,
      titleFa: "محصول تست",
      status: "DRAFT",
      fulfillmentType: fulfillment,
    })
    .returning({ id: products.id });
  return product.id;
}

async function seedVariant(tx: any, productId: string): Promise<string> {
  const [variant] = await tx
    .insert(productVariants)
    .values({
      productId,
      sku: `sku-${crypto.randomUUID()}`,
      titleFa: "واریانت تست",
      publicPriceAmount: "100000",
    })
    .returning({ id: productVariants.id });
  return variant.id;
}

async function seedInventoryUnit(tx: any, variantId: string): Promise<string> {
  const [unit] = await tx
    .insert(inventoryUnits)
    .values({
      variantId,
      code: `UNIT-${crypto.randomUUID()}`,
      status: "AVAILABLE",
    })
    .returning({ id: inventoryUnits.id });
  return unit.id;
}

async function seedOrder(tx: any): Promise<string> {
  const [order] = await tx
    .insert(orders)
    .values({
      orderNumber: `ORD-${crypto.randomUUID()}`,
      status: "PENDING",
      paymentStatus: "UNPAID",
      subtotalAmount: "100000",
      totalAmount: "100000",
    })
    .returning({ id: orders.id });
  return order.id;
}

async function seedOrderItem(tx: any, orderId: string, variantId: string): Promise<void> {
  await tx.insert(orderItems).values({
    orderId,
    variantId,
    titleFa: "محصول تست",
    sku: `sku-${crypto.randomUUID()}`,
    optionsSummaryFa: "رنگ: قرمز · جنس: چرم · سایز: M",
    quantity: 1,
    unitPrice: "100000",
    totalPrice: "100000",
  });
}

async function seedPayment(tx: any, orderId: string, userId: string): Promise<string> {
  const [payment] = await tx
    .insert(payments)
    .values({
      orderId,
      userId,
      status: "UNPAID",
      provider: "MANUAL",
      amount: "100000",
    })
    .returning({ id: payments.id });
  return payment.id;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

test("confirmPayment: all-digital order → DELIVERED, units SOLD, payment PAID", async () => {
  await withRollback(async (tx) => {
    const userId = await seedUser(tx);
    const productId = await seedProduct(tx, "DIGITAL");
    const variantId = await seedVariant(tx, productId);
    await seedInventoryUnit(tx, variantId);

    const orderId = await seedOrder(tx);
    await seedOrderItem(tx, orderId, variantId);
    const paymentId = await seedPayment(tx, orderId, userId);

    // Reserve 1 unit for the order
    await reserveUnits(tx, variantId, 1, { orderId, userId });

    await confirmPayment(orderId, { tx, reference: "REF-001" });

    // Order should be DELIVERED with PAID paymentStatus
    const [order] = await tx
      .select({ status: orders.status, paymentStatus: orders.paymentStatus })
      .from(orders)
      .where(eq(orders.id, orderId));
    expect(order.status).toBe("DELIVERED");
    expect(order.paymentStatus).toBe("PAID");

    // Payment should be PAID with paidAt set and reference stored
    const [payment] = await tx
      .select({ status: payments.status, paidAt: payments.paidAt, reference: payments.reference })
      .from(payments)
      .where(eq(payments.id, paymentId));
    expect(payment.status).toBe("PAID");
    expect(payment.paidAt).not.toBeNull();
    expect(payment.reference).toBe("REF-001");

    // Units should be SOLD
    const units = await tx
      .select({ status: inventoryUnits.status })
      .from(inventoryUnits)
      .where(eq(inventoryUnits.orderId, orderId));
    expect(units.every((u: (typeof units)[0]) => u.status === "SOLD")).toBe(true);
  });
});

test("confirmPayment: order with physical item → PROCESSING", async () => {
  await withRollback(async (tx) => {
    const userId = await seedUser(tx);
    const digitalProductId = await seedProduct(tx, "DIGITAL");
    const physicalProductId = await seedProduct(tx, "PHYSICAL");
    const digitalVariantId = await seedVariant(tx, digitalProductId);
    const physicalVariantId = await seedVariant(tx, physicalProductId);
    await seedInventoryUnit(tx, digitalVariantId);
    await seedInventoryUnit(tx, physicalVariantId);

    const orderId = await seedOrder(tx);
    await seedOrderItem(tx, orderId, digitalVariantId);
    await seedOrderItem(tx, orderId, physicalVariantId);
    await seedPayment(tx, orderId, userId);

    await reserveUnits(tx, digitalVariantId, 1, { orderId, userId });
    await reserveUnits(tx, physicalVariantId, 1, { orderId, userId });

    await confirmPayment(orderId, { tx });

    const [order] = await tx
      .select({ status: orders.status })
      .from(orders)
      .where(eq(orders.id, orderId));
    expect(order.status).toBe("PROCESSING");
  });
});

test("failPayment: releases units → AVAILABLE, order CANCELLED, payment FAILED", async () => {
  await withRollback(async (tx) => {
    const userId = await seedUser(tx);
    const productId = await seedProduct(tx, "DIGITAL");
    const variantId = await seedVariant(tx, productId);
    await seedInventoryUnit(tx, variantId);

    const orderId = await seedOrder(tx);
    await seedOrderItem(tx, orderId, variantId);
    const paymentId = await seedPayment(tx, orderId, userId);

    await reserveUnits(tx, variantId, 1, { orderId, userId });

    await failPayment(orderId, { tx });

    // Order should be CANCELLED
    const [order] = await tx
      .select({ status: orders.status })
      .from(orders)
      .where(eq(orders.id, orderId));
    expect(order.status).toBe("CANCELLED");

    // Payment should be FAILED
    const [payment] = await tx
      .select({ status: payments.status })
      .from(payments)
      .where(eq(payments.id, paymentId));
    expect(payment.status).toBe("FAILED");

    // Units should be AVAILABLE again
    const units = await tx
      .select({ status: inventoryUnits.status, orderId: inventoryUnits.orderId })
      .from(inventoryUnits)
      .where(eq(inventoryUnits.variantId, variantId));
    expect(units.every((u: (typeof units)[0]) => u.status === "AVAILABLE")).toBe(true);
    expect(units.every((u: (typeof units)[0]) => u.orderId === null)).toBe(true);
  });
});
