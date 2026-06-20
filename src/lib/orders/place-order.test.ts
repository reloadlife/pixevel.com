import { eq } from "drizzle-orm";
import { expect, test } from "vitest";
import {
  cartItems,
  carts,
  inventoryUnits,
  orderItems,
  orders,
  payments,
  products,
  productVariants,
  users,
} from "@/db/schema";
import { withRollback } from "../../../test/db";
import { placeOrder } from "./place-order";

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
  opts: { fulfillment?: "DIGITAL" | "PHYSICAL"; status?: "ACTIVE" | "DRAFT" | "DISABLED" } = {},
): Promise<string> {
  const { fulfillment = "DIGITAL", status = "ACTIVE" } = opts;
  const [product] = await tx
    .insert(products)
    .values({
      slug: `test-product-${crypto.randomUUID()}`,
      titleFa: "محصول تست",
      status,
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
      colorNameFa: "قرمز",
      colorSlug: "red",
      materialNameFa: "چرم",
      materialSlug: "leather",
      size: "M",
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

async function seedCart(tx: any, userId: string): Promise<string> {
  const [cart] = await tx
    .insert(carts)
    .values({ userId, status: "ACTIVE" })
    .returning({ id: carts.id });
  return cart.id;
}

async function seedCartItem(
  tx: any,
  cartId: string,
  variantId: string,
  quantity = 1,
): Promise<void> {
  await tx.insert(cartItems).values({
    cartId,
    variantId,
    quantity,
    unitPrice: "100000",
  });
}

// ─── Tests ────────────────────────────────────────────────────────────────────

test("placeOrder: happy path — DIGITAL item, card-to-card payment → order PENDING/UNPAID, unit RESERVED, orderItems + payment inserted, cart ORDERED", async () => {
  await withRollback(async (tx) => {
    const userId = await seedUser(tx);
    const productId = await seedProduct(tx, { fulfillment: "DIGITAL" });
    const variantId = await seedVariant(tx, productId);
    await seedInventoryUnit(tx, variantId);
    const cartId = await seedCart(tx, userId);
    await seedCartItem(tx, cartId, variantId, 1);

    const result = await placeOrder(userId, { paymentMethod: "CARD_TO_CARD" }, { tx });

    expect(result.orderId).toBeDefined();
    expect(result.orderNumber).toMatch(/^PX-/);
    expect(result.payment).toBeDefined();
    expect(result.payment.method).toBe("CARD_TO_CARD");

    // Order should be PENDING / UNPAID
    const [order] = await tx
      .select({ status: orders.status, paymentStatus: orders.paymentStatus })
      .from(orders)
      .where(eq(orders.id, result.orderId));
    expect(order.status).toBe("PENDING");
    expect(order.paymentStatus).toBe("UNPAID");

    // Inventory unit should be RESERVED with orderId set
    const units = await tx
      .select({ status: inventoryUnits.status, orderId: inventoryUnits.orderId })
      .from(inventoryUnits)
      .where(eq(inventoryUnits.variantId, variantId));
    expect(units).toHaveLength(1);
    expect(units[0].status).toBe("RESERVED");
    expect(units[0].orderId).toBe(result.orderId);

    // orderItems inserted
    const items = await tx
      .select({ orderId: orderItems.orderId, quantity: orderItems.quantity })
      .from(orderItems)
      .where(eq(orderItems.orderId, result.orderId));
    expect(items).toHaveLength(1);
    expect(items[0].quantity).toBe(1);

    // Payment inserted with card-to-card provider and UNPAID status
    const pmts = await tx
      .select({ status: payments.status, provider: payments.provider })
      .from(payments)
      .where(eq(payments.orderId, result.orderId));
    expect(pmts).toHaveLength(1);
    expect(pmts[0].status).toBe("UNPAID");
    expect(pmts[0].provider).toBe("CARD_TO_CARD");

    // Cart should be ORDERED
    const [cart] = await tx
      .select({ status: carts.status })
      .from(carts)
      .where(eq(carts.id, cartId));
    expect(cart.status).toBe("ORDERED");
  });
});

test("placeOrder: PHYSICAL product with no shipping → throws SHIPPING_REQUIRED", async () => {
  await withRollback(async (tx) => {
    const userId = await seedUser(tx);
    const productId = await seedProduct(tx, { fulfillment: "PHYSICAL" });
    const variantId = await seedVariant(tx, productId);
    await seedInventoryUnit(tx, variantId);
    const cartId = await seedCart(tx, userId);
    await seedCartItem(tx, cartId, variantId, 1);

    await expect(placeOrder(userId, { paymentMethod: "CARD_TO_CARD" }, { tx })).rejects.toMatchObject({
      code: "SHIPPING_REQUIRED",
    });
  });
});

test("placeOrder: out-of-stock variant → throws OUT_OF_STOCK", async () => {
  await withRollback(async (tx) => {
    const userId = await seedUser(tx);
    const productId = await seedProduct(tx, { fulfillment: "DIGITAL" });
    const variantId = await seedVariant(tx, productId);
    // No inventory unit seeded — stock = 0
    const cartId = await seedCart(tx, userId);
    await seedCartItem(tx, cartId, variantId, 1);

    await expect(placeOrder(userId, { paymentMethod: "CARD_TO_CARD" }, { tx })).rejects.toMatchObject({
      code: "OUT_OF_STOCK",
    });
  });
});

test("placeOrder: empty cart → throws CART_EMPTY", async () => {
  await withRollback(async (tx) => {
    const userId = await seedUser(tx);
    await seedCart(tx, userId);
    // No cart items seeded

    await expect(placeOrder(userId, { paymentMethod: "CARD_TO_CARD" }, { tx })).rejects.toMatchObject({
      code: "CART_EMPTY",
    });
  });
});

test("placeOrder: no cart at all → throws CART_EMPTY", async () => {
  await withRollback(async (tx) => {
    const userId = await seedUser(tx);
    // No cart seeded at all

    await expect(placeOrder(userId, { paymentMethod: "CARD_TO_CARD" }, { tx })).rejects.toMatchObject({
      code: "CART_EMPTY",
    });
  });
});

test("placeOrder: DISABLED product → throws PRODUCT_UNAVAILABLE", async () => {
  await withRollback(async (tx) => {
    const userId = await seedUser(tx);
    const productId = await seedProduct(tx, { fulfillment: "DIGITAL", status: "DISABLED" });
    const variantId = await seedVariant(tx, productId);
    await seedInventoryUnit(tx, variantId);
    const cartId = await seedCart(tx, userId);
    await seedCartItem(tx, cartId, variantId, 1);

    await expect(placeOrder(userId, { paymentMethod: "CARD_TO_CARD" }, { tx })).rejects.toMatchObject({
      code: "PRODUCT_UNAVAILABLE",
    });
  });
});
