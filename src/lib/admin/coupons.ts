import { desc, eq } from "drizzle-orm";

import type { CouponKind } from "@/db/schema";
import { coupons } from "@/db/schema";
import { getDb } from "@/lib/db";

// ─── Types ──────────────────────────────────────────────────────────────────

export type CouponInput = {
  code: string;
  kind: CouponKind;
  value: number | string;
  isActive?: boolean;
  minSubtotalAmount?: number | string | null;
  maxDiscountAmount?: number | string | null;
  usageLimit?: number | string | null;
  startsAt?: string | Date | null;
  expiresAt?: string | Date | null;
  // ── Depth / scope fields ─────────────────────────────────────────────────
  perUserLimit?: number | string | null;
  individualUse?: boolean;
  excludeSaleItems?: boolean;
  freeShipping?: boolean;
  emailRestrictions?: string[] | null;
  includeProductIds?: string[] | null;
  excludeProductIds?: string[] | null;
  includeCategoryIds?: string[] | null;
  excludeCategoryIds?: string[] | null;
};

export type CouponPatchInput = Partial<CouponInput>;

/**
 * Domain errors thrown by this module. The API layer maps each `code` to an
 * HTTP status + Persian message, so messages never leak ORM/DB details.
 */
export class CouponError extends Error {
  constructor(public code: string) {
    super(code);
    this.name = "CouponError";
  }
}

const KINDS: readonly CouponKind[] = ["PERCENT", "FIXED"];

// ─── Coercion helpers ─────────────────────────────────────────────────────────

/**
 * Money in this app is stored as integer-toman strings (the checkout flow in
 * `src/lib/coupons.ts` treats coupon amounts as whole toman). We therefore
 * normalize every money field to a non-negative integer string here.
 */
function toMoneyString(value: unknown): string {
  const n = Math.trunc(Number(value));
  if (!Number.isFinite(n) || n < 0) {
    throw new CouponError("INVALID_AMOUNT");
  }
  return String(n);
}

function toOptionalMoneyString(value: unknown): string | null {
  if (value == null || value === "") {
    return null;
  }
  return toMoneyString(value);
}

function toOptionalInt(value: unknown): number | null {
  if (value == null || value === "") {
    return null;
  }
  const n = Math.trunc(Number(value));
  if (!Number.isFinite(n) || n < 0) {
    throw new CouponError("INVALID_USAGE_LIMIT");
  }
  return n;
}

/**
 * Normalises a jsonb string[] field coming from either the API body
 * (already parsed as string[]) or as a raw unknown value.
 * Returns null when the input is nullish or an empty array.
 */
function toOptionalStringArray(value: unknown): string[] | null {
  if (value == null) return null;
  const arr = Array.isArray(value) ? value : [];
  const clean = arr.map((s: unknown) => String(s ?? "").trim()).filter(Boolean);
  return clean.length > 0 ? clean : null;
}

function toOptionalDate(value: unknown): Date | null {
  if (value == null || value === "") {
    return null;
  }
  const date = value instanceof Date ? value : new Date(String(value));
  if (Number.isNaN(date.getTime())) {
    throw new CouponError("INVALID_DATE");
  }
  return date;
}

function normalizeCode(value: unknown): string {
  const code = String(value ?? "")
    .trim()
    .toUpperCase();
  if (!code) {
    throw new CouponError("CODE_REQUIRED");
  }
  return code;
}

function normalizeKind(value: unknown): CouponKind {
  const kind = String(value ?? "").toUpperCase() as CouponKind;
  if (!KINDS.includes(kind)) {
    throw new CouponError("INVALID_KIND");
  }
  return kind;
}

/**
 * Validates the raw coupon value against its kind and returns a clean number.
 * Percent must be in (0, 100]; fixed must be a positive integer toman amount.
 */
function normalizeValue(value: unknown, kind: CouponKind): string {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) {
    throw new CouponError("INVALID_VALUE");
  }
  if (kind === "PERCENT") {
    if (n > 100) {
      throw new CouponError("PERCENT_TOO_HIGH");
    }
    // Percent is a plain number; keep up to 2 decimals to match numeric(12,2).
    return String(Math.round(n * 100) / 100);
  }
  // FIXED: a whole-toman amount.
  return toMoneyString(n);
}

function isUniqueViolation(error: unknown): boolean {
  if (typeof error !== "object" || error === null) {
    return false;
  }
  const code = (error as { code?: unknown }).code;
  if (code === "23505") {
    return true;
  }
  const message = (error as { message?: unknown }).message;
  return typeof message === "string" && message.toLowerCase().includes("unique");
}

// ─── Read ──────────────────────────────────────────────────────────────────

/** Lists every coupon, newest first, with usage already on the row. */
export async function listCoupons() {
  return getDb().select().from(coupons).orderBy(desc(coupons.createdAt));
}

export type AdminCouponRecord = Awaited<ReturnType<typeof listCoupons>>[number];

/** Serializes a coupon row into a stable, client-safe shape. */
export function toAdminCouponOption(coupon: AdminCouponRecord) {
  return {
    id: coupon.id,
    code: coupon.code,
    kind: coupon.kind,
    value: coupon.value,
    isActive: coupon.isActive,
    minSubtotalAmount: coupon.minSubtotalAmount,
    maxDiscountAmount: coupon.maxDiscountAmount,
    usageLimit: coupon.usageLimit,
    usedCount: coupon.usedCount,
    startsAt: coupon.startsAt ? coupon.startsAt.toISOString() : null,
    expiresAt: coupon.expiresAt ? coupon.expiresAt.toISOString() : null,
    createdAt: coupon.createdAt ? coupon.createdAt.toISOString() : null,
    updatedAt: coupon.updatedAt ? coupon.updatedAt.toISOString() : null,
    // ── Depth / scope fields ────────────────────────────────────────────────
    perUserLimit: coupon.perUserLimit,
    individualUse: coupon.individualUse,
    excludeSaleItems: coupon.excludeSaleItems,
    freeShipping: coupon.freeShipping,
    emailRestrictions: (coupon.emailRestrictions as string[] | null) ?? null,
    includeProductIds: (coupon.includeProductIds as string[] | null) ?? null,
    excludeProductIds: (coupon.excludeProductIds as string[] | null) ?? null,
    includeCategoryIds: (coupon.includeCategoryIds as string[] | null) ?? null,
    excludeCategoryIds: (coupon.excludeCategoryIds as string[] | null) ?? null,
  };
}

export type AdminCouponOption = ReturnType<typeof toAdminCouponOption>;

// ─── Write ─────────────────────────────────────────────────────────────────

export async function createCoupon(input: CouponInput) {
  const code = normalizeCode(input.code);
  const kind = normalizeKind(input.kind);
  const value = normalizeValue(input.value, kind);

  try {
    const [coupon] = await getDb()
      .insert(coupons)
      .values({
        code,
        kind,
        value,
        isActive: input.isActive ?? true,
        minSubtotalAmount: toOptionalMoneyString(input.minSubtotalAmount),
        maxDiscountAmount: toOptionalMoneyString(input.maxDiscountAmount),
        usageLimit: toOptionalInt(input.usageLimit),
        startsAt: toOptionalDate(input.startsAt),
        expiresAt: toOptionalDate(input.expiresAt),
        perUserLimit: toOptionalInt(input.perUserLimit),
        individualUse: input.individualUse ?? false,
        excludeSaleItems: input.excludeSaleItems ?? false,
        freeShipping: input.freeShipping ?? false,
        emailRestrictions: toOptionalStringArray(input.emailRestrictions),
        includeProductIds: toOptionalStringArray(input.includeProductIds),
        excludeProductIds: toOptionalStringArray(input.excludeProductIds),
        includeCategoryIds: toOptionalStringArray(input.includeCategoryIds),
        excludeCategoryIds: toOptionalStringArray(input.excludeCategoryIds),
      })
      .returning();

    return coupon;
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new CouponError("CODE_TAKEN");
    }
    throw error;
  }
}

export async function updateCoupon(id: string, input: CouponPatchInput) {
  const current = await getDb().query.coupons.findFirst({
    where: (c, { eq: eqOp }) => eqOp(c.id, id),
  });

  if (!current) {
    throw new CouponError("NOT_FOUND");
  }

  const nextKind = input.kind !== undefined ? normalizeKind(input.kind) : current.kind;

  const patch: Partial<typeof coupons.$inferInsert> = {};

  if (input.code !== undefined) {
    patch.code = normalizeCode(input.code);
  }
  if (input.kind !== undefined) {
    patch.kind = nextKind;
  }
  // A value re-validation is required whenever value OR kind changes, because
  // the percent ≤ 100 rule depends on the (possibly new) kind.
  if (input.value !== undefined || input.kind !== undefined) {
    const rawValue = input.value !== undefined ? input.value : current.value;
    patch.value = normalizeValue(rawValue, nextKind);
  }
  if (input.isActive !== undefined) {
    patch.isActive = Boolean(input.isActive);
  }
  if (input.minSubtotalAmount !== undefined) {
    patch.minSubtotalAmount = toOptionalMoneyString(input.minSubtotalAmount);
  }
  if (input.maxDiscountAmount !== undefined) {
    patch.maxDiscountAmount = toOptionalMoneyString(input.maxDiscountAmount);
  }
  if (input.usageLimit !== undefined) {
    patch.usageLimit = toOptionalInt(input.usageLimit);
  }
  if (input.startsAt !== undefined) {
    patch.startsAt = toOptionalDate(input.startsAt);
  }
  if (input.expiresAt !== undefined) {
    patch.expiresAt = toOptionalDate(input.expiresAt);
  }
  if (input.perUserLimit !== undefined) {
    patch.perUserLimit = toOptionalInt(input.perUserLimit);
  }
  if (input.individualUse !== undefined) {
    patch.individualUse = Boolean(input.individualUse);
  }
  if (input.excludeSaleItems !== undefined) {
    patch.excludeSaleItems = Boolean(input.excludeSaleItems);
  }
  if (input.freeShipping !== undefined) {
    patch.freeShipping = Boolean(input.freeShipping);
  }
  if (input.emailRestrictions !== undefined) {
    patch.emailRestrictions = toOptionalStringArray(input.emailRestrictions);
  }
  if (input.includeProductIds !== undefined) {
    patch.includeProductIds = toOptionalStringArray(input.includeProductIds);
  }
  if (input.excludeProductIds !== undefined) {
    patch.excludeProductIds = toOptionalStringArray(input.excludeProductIds);
  }
  if (input.includeCategoryIds !== undefined) {
    patch.includeCategoryIds = toOptionalStringArray(input.includeCategoryIds);
  }
  if (input.excludeCategoryIds !== undefined) {
    patch.excludeCategoryIds = toOptionalStringArray(input.excludeCategoryIds);
  }

  patch.updatedAt = new Date();

  try {
    const [coupon] = await getDb().update(coupons).set(patch).where(eq(coupons.id, id)).returning();

    return coupon;
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new CouponError("CODE_TAKEN");
    }
    throw error;
  }
}

export async function deleteCoupon(id: string) {
  const [deleted] = await getDb()
    .delete(coupons)
    .where(eq(coupons.id, id))
    .returning({ id: coupons.id });

  if (!deleted) {
    throw new CouponError("NOT_FOUND");
  }

  return deleted;
}
