import { desc, eq } from "drizzle-orm";

import { couponRedemptions, orders, users } from "@/db/schema";
import { getDb } from "@/lib/db";

// ─── Types ───────────────────────────────────────────────────────────────────

export type CouponRedemptionRow = {
  id: string;
  userPhone: string | null;
  orderNumber: string | null;
  amount: string;
  createdAt: string | null;
};

// ─── Query ────────────────────────────────────────────────────────────────────

/**
 * Returns all redemptions for a given coupon, newest first.
 * Joins user phone and order number for display.
 */
export async function listCouponRedemptions(couponId: string): Promise<CouponRedemptionRow[]> {
  const db = getDb();

  const rows = await db
    .select({
      id: couponRedemptions.id,
      userPhone: users.phone,
      orderNumber: orders.orderNumber,
      amount: couponRedemptions.amount,
      createdAt: couponRedemptions.createdAt,
    })
    .from(couponRedemptions)
    .leftJoin(users, eq(couponRedemptions.userId, users.id))
    .leftJoin(orders, eq(couponRedemptions.orderId, orders.id))
    .where(eq(couponRedemptions.couponId, couponId))
    .orderBy(desc(couponRedemptions.createdAt));

  return rows.map((r) => ({
    id: r.id,
    userPhone: r.userPhone ?? null,
    orderNumber: r.orderNumber ?? null,
    amount: r.amount,
    createdAt: r.createdAt ? r.createdAt.toISOString() : null,
  }));
}
