import { expect, test } from "vitest";
import { coupons, users } from "@/db/schema";
import { withRollback } from "../../test/db";
import { recordCouponRedemption, validateCoupon } from "./coupons";

async function seedUser(tx: any): Promise<string> {
  const [u] = await tx
    .insert(users)
    .values({ phone: `+98${Math.floor(9_000_000_000 + Math.random() * 999_999_999)}` })
    .returning({ id: users.id });
  return u.id;
}

async function seedCoupon(tx: any, overrides: Record<string, unknown> = {}): Promise<string> {
  const [c] = await tx
    .insert(coupons)
    .values({
      code: `T-${crypto.randomUUID().slice(0, 8)}`,
      kind: "FIXED",
      value: "10000",
      isActive: true,
      ...overrides,
    })
    .returning({ id: coupons.id, code: coupons.code });
  return c.code;
}

test("validateCoupon allows a fresh per-user-limited coupon", async () => {
  await withRollback(async (tx) => {
    const userId = await seedUser(tx);
    const code = await seedCoupon(tx, { perUserLimit: 1 });
    const result = await validateCoupon(code, 100_000, tx, { userId });
    expect(result.ok).toBe(true);
  });
});

test("validateCoupon rejects once the per-user limit is reached", async () => {
  await withRollback(async (tx) => {
    const userId = await seedUser(tx);
    const code = await seedCoupon(tx, { perUserLimit: 1 });
    const ok = await validateCoupon(code, 100_000, tx, { userId });
    expect(ok.ok).toBe(true);
    if (!ok.ok) return;

    // Record one redemption for this user, then it must be exhausted.
    await recordCouponRedemption(tx, {
      couponId: ok.couponId,
      userId,
      orderId: null as unknown as string, // no order needed for this unit
      amount: ok.discountAmount,
    });

    const again = await validateCoupon(code, 100_000, tx, { userId });
    expect(again.ok).toBe(false);
    if (!again.ok) expect(again.reason).toBe("USAGE_LIMIT");
  });
});

test("per-user limit does not affect a different user", async () => {
  await withRollback(async (tx) => {
    const userA = await seedUser(tx);
    const userB = await seedUser(tx);
    const code = await seedCoupon(tx, { perUserLimit: 1 });
    const ok = await validateCoupon(code, 100_000, tx, { userId: userA });
    if (!ok.ok) throw new Error("expected ok");
    await recordCouponRedemption(tx, {
      couponId: ok.couponId,
      userId: userA,
      orderId: null as unknown as string,
      amount: ok.discountAmount,
    });
    const forB = await validateCoupon(code, 100_000, tx, { userId: userB });
    expect(forB.ok).toBe(true);
  });
});
