import { and, eq, inArray, lt, sql } from "drizzle-orm";
import { inventoryUnits, orders } from "@/db/schema";

export class OutOfStockError extends Error {
  constructor(public variantId: string) {
    super("OUT_OF_STOCK");
    this.name = "OutOfStockError";
  }
}

export async function reserveUnits(
  tx: any,
  variantId: string,
  qty: number,
  ctx: { orderId: string; userId: string },
): Promise<string[]> {
  const rows = await tx
    .select({ id: inventoryUnits.id })
    .from(inventoryUnits)
    .where(and(eq(inventoryUnits.variantId, variantId), eq(inventoryUnits.status, "AVAILABLE")))
    .for("update", { skipLocked: true })
    .limit(qty);

  if (rows.length < qty) throw new OutOfStockError(variantId);

  const ids = rows.map((r: { id: string }) => r.id);

  await tx
    .update(inventoryUnits)
    .set({
      status: "RESERVED",
      reservedAt: sql`now()`,
      orderId: ctx.orderId,
      userId: ctx.userId,
    })
    .where(inArray(inventoryUnits.id, ids));

  return ids;
}

export async function sellReservedUnits(tx: any, orderId: string): Promise<void> {
  await tx
    .update(inventoryUnits)
    .set({ status: "SOLD", soldAt: sql`now()` })
    .where(and(eq(inventoryUnits.orderId, orderId), eq(inventoryUnits.status, "RESERVED")));
}

export async function releaseUnits(tx: any, orderId: string): Promise<void> {
  await tx
    .update(inventoryUnits)
    .set({
      status: "AVAILABLE",
      reservedAt: null,
      orderId: null,
      userId: null,
    })
    .where(and(eq(inventoryUnits.orderId, orderId), eq(inventoryUnits.status, "RESERVED")));
}

export async function releaseExpiredReservations(tx: any, ttlMinutes = 30): Promise<string[]> {
  const stale = await tx
    .select({ id: orders.id })
    .from(orders)
    .where(
      and(
        eq(orders.status, "PENDING"),
        eq(orders.paymentStatus, "UNPAID"),
        lt(orders.createdAt, sql`now() - ${`${ttlMinutes} minutes`}::interval`),
      ),
    );

  for (const o of stale) {
    await releaseUnits(tx, o.id);
    await tx.update(orders).set({ status: "CANCELLED" }).where(eq(orders.id, o.id));
  }

  return stale.map((o: { id: string }) => o.id);
}
