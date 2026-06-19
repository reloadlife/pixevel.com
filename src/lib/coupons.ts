import { and, eq, sql } from "drizzle-orm";

import type { CouponKind } from "@/db/schema";
import { coupons } from "@/db/schema";
import { getDb } from "@/lib/db";

// ─── Types ──────────────────────────────────────────────────────────────────

export type CouponErrorReason =
  | "NOT_FOUND"
  | "INACTIVE"
  | "NOT_STARTED"
  | "EXPIRED"
  | "USAGE_LIMIT"
  | "MIN_SUBTOTAL"
  | "NO_DISCOUNT";

export type CouponValidation =
  | {
      ok: true;
      /** Canonical (stored) coupon code. */
      code: string;
      kind: CouponKind;
      /** Raw coupon value (percent or fixed toman), as a number. */
      value: number;
      /** Discount to apply, in integer toman, never exceeding the subtotal. */
      discountAmount: number;
      message: string;
    }
  | {
      ok: false;
      reason: CouponErrorReason;
      message: string;
    };

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Money in this app is stored as integer-toman strings (no decimals in the
 * checkout flow). Coupon math therefore rounds to whole toman.
 */
function toToman(value: unknown): number {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

const REASON_MESSAGES: Record<CouponErrorReason, string> = {
  NOT_FOUND: "کد تخفیف معتبر نیست.",
  INACTIVE: "این کد تخفیف غیرفعال است.",
  NOT_STARTED: "این کد تخفیف هنوز فعال نشده است.",
  EXPIRED: "این کد تخفیف منقضی شده است.",
  USAGE_LIMIT: "ظرفیت استفاده از این کد تخفیف به پایان رسیده است.",
  MIN_SUBTOTAL: "مبلغ سبد خرید برای استفاده از این کد کافی نیست.",
  NO_DISCOUNT: "این کد تخفیف برای سبد فعلی تخفیفی ایجاد نمی‌کند.",
};

function fail(reason: CouponErrorReason): CouponValidation {
  return { ok: false, reason, message: REASON_MESSAGES[reason] };
}

/**
 * Computes the discount (integer toman) a coupon yields for a given subtotal.
 * Clamps to [0, subtotal] and applies maxDiscountAmount for PERCENT coupons.
 */
export function computeCouponDiscount(
  coupon: { kind: CouponKind; value: unknown; maxDiscountAmount?: unknown },
  subtotal: number,
): number {
  const base = Math.max(0, Math.trunc(subtotal));
  const value = toToman(coupon.value);

  let discount: number;
  if (coupon.kind === "PERCENT") {
    discount = Math.round((base * value) / 100);
    const cap = coupon.maxDiscountAmount != null ? toToman(coupon.maxDiscountAmount) : null;
    if (cap != null && cap > 0) {
      discount = Math.min(discount, cap);
    }
  } else {
    // FIXED: flat toman amount.
    discount = Math.round(value);
  }

  // Never discount more than the subtotal, never go negative.
  return Math.max(0, Math.min(discount, base));
}

// ─── Validation ─────────────────────────────────────────────────────────────

type DbLike = Pick<ReturnType<typeof getDb>, "query">;

/**
 * Looks up an active coupon by code (case-insensitive) and validates it against
 * the supplied subtotal (integer toman). Returns a typed result with the
 * computed discount, or a typed error reason with a Persian message.
 *
 * This is the single source of truth for coupon eligibility — both the preview
 * API and the order-placement transaction call it so the client can never force
 * a discount the server would not grant.
 */
export async function validateCoupon(
  code: string,
  subtotal: number,
  db: DbLike = getDb(),
): Promise<CouponValidation> {
  const normalized = code.trim();

  if (!normalized) {
    return fail("NOT_FOUND");
  }

  const coupon = await db.query.coupons.findFirst({
    where: (c) => sql`lower(${c.code}) = lower(${normalized})`,
  });

  if (!coupon) {
    return fail("NOT_FOUND");
  }

  if (!coupon.isActive) {
    return fail("INACTIVE");
  }

  const now = new Date();

  if (coupon.startsAt && coupon.startsAt.getTime() > now.getTime()) {
    return fail("NOT_STARTED");
  }

  if (coupon.expiresAt && coupon.expiresAt.getTime() <= now.getTime()) {
    return fail("EXPIRED");
  }

  if (coupon.usageLimit != null && coupon.usedCount >= coupon.usageLimit) {
    return fail("USAGE_LIMIT");
  }

  const subtotalToman = Math.max(0, Math.trunc(subtotal));

  if (coupon.minSubtotalAmount != null) {
    const min = toToman(coupon.minSubtotalAmount);
    if (subtotalToman < min) {
      return fail("MIN_SUBTOTAL");
    }
  }

  const discountAmount = computeCouponDiscount(coupon, subtotalToman);

  if (discountAmount <= 0) {
    return fail("NO_DISCOUNT");
  }

  return {
    ok: true,
    code: coupon.code,
    kind: coupon.kind,
    value: toToman(coupon.value),
    discountAmount,
    message: "کد تخفیف اعمال شد.",
  };
}

// ─── Usage accounting ─────────────────────────────────────────────────────────

/**
 * Atomically increments a coupon's `usedCount` by its canonical code
 * (case-insensitive). Intended to be called inside the order transaction so the
 * bump is committed together with the order. Re-checks `usageLimit` in the same
 * statement so two concurrent orders can never push usedCount past the limit.
 *
 * Returns true when a row was updated (limit not exceeded), false otherwise.
 */
export async function incrementCouponUsage(
  tx: { update: ReturnType<typeof getDb>["update"] },
  code: string,
): Promise<boolean> {
  const normalized = code.trim();
  if (!normalized) {
    return false;
  }

  const updated = await tx
    .update(coupons)
    .set({ usedCount: sql`${coupons.usedCount} + 1` })
    .where(
      and(
        sql`lower(${coupons.code}) = lower(${normalized})`,
        eq(coupons.isActive, true),
        sql`(${coupons.usageLimit} IS NULL OR ${coupons.usedCount} < ${coupons.usageLimit})`,
      ),
    )
    .returning({ id: coupons.id });

  return updated.length > 0;
}
