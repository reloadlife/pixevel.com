import { eq } from "drizzle-orm";
import { expect, test } from "vitest";
import { inventoryUnits, orders, products, productVariants, users } from "@/db/schema";
import { withRollback } from "../../../test/db";
import {
  OutOfStockError,
  releaseExpiredReservations,
  releaseUnits,
  reserveUnits,
  sellReservedUnits,
} from "./inventory";

// Helper: seed a real user inside the given tx (FK required on inventoryUnits.userId).
async function seedUser(tx: any): Promise<string> {
  const [user] = await tx
    .insert(users)
    .values({
      phone: `+98${Math.floor(9_000_000_000 + Math.random() * 999_999_999)}`,
    })
    .returning({ id: users.id });
  return user.id;
}

// Helper: seed a product + variant + N inventory units inside the given tx.
async function seedVariantWithUnits(
  tx: any,
  qty: number,
): Promise<{ variantId: string; unitIds: string[] }> {
  const [product] = await tx
    .insert(products)
    .values({
      slug: `test-product-${crypto.randomUUID()}`,
      titleFa: "محصول تست",
      status: "DRAFT",
      fulfillmentType: "DIGITAL",
    })
    .returning({ id: products.id });

  const [variant] = await tx
    .insert(productVariants)
    .values({
      productId: product.id,
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

  const unitIds: string[] = [];
  for (let i = 0; i < qty; i++) {
    const [unit] = await tx
      .insert(inventoryUnits)
      .values({
        variantId: variant.id,
        code: `UNIT-${crypto.randomUUID()}`,
        status: "AVAILABLE",
      })
      .returning({ id: inventoryUnits.id });
    unitIds.push(unit.id);
  }

  return { variantId: variant.id, unitIds };
}

// Helper: seed a PENDING/UNPAID order with createdAt set to N minutes ago.
async function seedOrder(tx: any, minutesAgo = 0): Promise<string> {
  const past = new Date(Date.now() - minutesAgo * 60 * 1000);
  const [order] = await tx
    .insert(orders)
    .values({
      orderNumber: `ORD-${crypto.randomUUID()}`,
      status: "PENDING",
      paymentStatus: "UNPAID",
      subtotalAmount: "0",
      totalAmount: "0",
      createdAt: past,
      updatedAt: past,
    })
    .returning({ id: orders.id });
  return order.id;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

test("reserveUnits: flips exactly N rows to RESERVED with orderId", async () => {
  await withRollback(async (tx) => {
    const userId = await seedUser(tx);
    const { variantId } = await seedVariantWithUnits(tx, 3);
    const orderId = await seedOrder(tx);

    const reserved = await reserveUnits(tx, variantId, 2, { orderId, userId });
    expect(reserved).toHaveLength(2);

    const allRows = await tx
      .select()
      .from(inventoryUnits)
      .where(eq(inventoryUnits.variantId, variantId));

    const reservedByOrder = allRows.filter(
      (r: (typeof allRows)[0]) => r.status === "RESERVED" && r.orderId === orderId,
    );
    expect(reservedByOrder).toHaveLength(2);

    const available = allRows.filter((r: (typeof allRows)[0]) => r.status === "AVAILABLE");
    expect(available).toHaveLength(1);
  });
});

test("reserveUnits: throws OutOfStockError when qty > available", async () => {
  await withRollback(async (tx) => {
    const userId = await seedUser(tx);
    const { variantId } = await seedVariantWithUnits(tx, 2);
    const orderId = await seedOrder(tx);

    await expect(reserveUnits(tx, variantId, 3, { orderId, userId })).rejects.toThrow(
      OutOfStockError,
    );
  });
});

test("reserveUnits: OutOfStockError carries variantId", async () => {
  await withRollback(async (tx) => {
    const userId = await seedUser(tx);
    const { variantId } = await seedVariantWithUnits(tx, 1);
    const orderId = await seedOrder(tx);

    try {
      await reserveUnits(tx, variantId, 2, { orderId, userId });
      expect.fail("expected OutOfStockError");
    } catch (err) {
      expect(err).toBeInstanceOf(OutOfStockError);
      expect((err as OutOfStockError).variantId).toBe(variantId);
    }
  });
});

test("reserveUnits: concurrent last-unit — reserve all then 1 more throws", async () => {
  await withRollback(async (tx) => {
    const userId = await seedUser(tx);
    const { variantId } = await seedVariantWithUnits(tx, 2);
    const orderId = await seedOrder(tx);

    // Reserve all available units.
    await reserveUnits(tx, variantId, 2, { orderId, userId });

    // A second reserve for even 1 more must throw.
    const orderId2 = await seedOrder(tx);
    await expect(reserveUnits(tx, variantId, 1, { orderId: orderId2, userId })).rejects.toThrow(
      OutOfStockError,
    );
  });
});

test("sellReservedUnits: flips RESERVED → SOLD and sets soldAt", async () => {
  await withRollback(async (tx) => {
    const userId = await seedUser(tx);
    const { variantId } = await seedVariantWithUnits(tx, 2);
    const orderId = await seedOrder(tx);

    await reserveUnits(tx, variantId, 2, { orderId, userId });
    await sellReservedUnits(tx, orderId);

    const rows = await tx
      .select()
      .from(inventoryUnits)
      .where(eq(inventoryUnits.variantId, variantId));

    expect(rows.every((r: (typeof rows)[0]) => r.status === "SOLD")).toBe(true);
    expect(rows.every((r: (typeof rows)[0]) => r.soldAt !== null)).toBe(true);
  });
});

test("releaseUnits: flips RESERVED → AVAILABLE and clears orderId/userId/reservedAt", async () => {
  await withRollback(async (tx) => {
    const userId = await seedUser(tx);
    const { variantId } = await seedVariantWithUnits(tx, 2);
    const orderId = await seedOrder(tx);

    await reserveUnits(tx, variantId, 2, { orderId, userId });
    await releaseUnits(tx, orderId);

    const rows = await tx
      .select()
      .from(inventoryUnits)
      .where(eq(inventoryUnits.variantId, variantId));

    expect(rows.every((r: (typeof rows)[0]) => r.status === "AVAILABLE")).toBe(true);
    expect(rows.every((r: (typeof rows)[0]) => r.orderId === null)).toBe(true);
    expect(rows.every((r: (typeof rows)[0]) => r.userId === null)).toBe(true);
    expect(rows.every((r: (typeof rows)[0]) => r.reservedAt === null)).toBe(true);
  });
});

test("releaseExpiredReservations: cancels stale PENDING orders and releases units", async () => {
  await withRollback(async (tx) => {
    const userId = await seedUser(tx);
    const { variantId } = await seedVariantWithUnits(tx, 2);

    // Create a stale order (35 minutes old, TTL is 30 minutes).
    const staleOrderId = await seedOrder(tx, 35);

    await reserveUnits(tx, variantId, 2, { orderId: staleOrderId, userId });

    const cancelled = await releaseExpiredReservations(tx, 30);

    expect(cancelled).toContain(staleOrderId);

    // Units should be back to AVAILABLE.
    const rows = await tx
      .select()
      .from(inventoryUnits)
      .where(eq(inventoryUnits.variantId, variantId));

    expect(rows.every((r: (typeof rows)[0]) => r.status === "AVAILABLE")).toBe(true);

    // Order should be CANCELLED.
    const [ord] = await tx
      .select({ status: orders.status })
      .from(orders)
      .where(eq(orders.id, staleOrderId));

    expect(ord.status).toBe("CANCELLED");
  });
});
