import { asc, eq } from "drizzle-orm";

import type { CurrencyCode, ShippingMethodKind } from "@/db/schema";
import { shippingMethods } from "@/db/schema";
import { getDb } from "@/lib/db";

// ─── Types ──────────────────────────────────────────────────────────────────

export type ShippingMethodInput = {
  code: string;
  titleFa: string;
  kind: ShippingMethodKind;
  flatAmount?: number | string;
  freeThresholdAmount?: number | string | null;
  minDays?: number | string | null;
  maxDays?: number | string | null;
  currency?: CurrencyCode;
  isActive?: boolean;
  sortOrder?: number | string;
};

export type ShippingMethodPatchInput = Partial<ShippingMethodInput>;

/**
 * Domain errors thrown by this module. The API layer maps each `code` to an
 * HTTP status + Persian message so implementation details never leak to clients.
 */
export class ShippingMethodError extends Error {
  constructor(public code: string) {
    super(code);
    this.name = "ShippingMethodError";
  }
}

const KINDS: readonly ShippingMethodKind[] = ["FLAT", "FREE"];
const CURRENCIES: readonly CurrencyCode[] = ["IRT", "USD", "EUR"];

// ─── Coercion helpers ─────────────────────────────────────────────────────────

function normalizeCode(value: unknown): string {
  const code = String(value ?? "")
    .trim()
    .toUpperCase();
  if (!code) throw new ShippingMethodError("CODE_REQUIRED");
  return code;
}

function normalizeTitleFa(value: unknown): string {
  const title = String(value ?? "").trim();
  if (!title) throw new ShippingMethodError("TITLE_REQUIRED");
  return title;
}

function normalizeKind(value: unknown): ShippingMethodKind {
  const kind = String(value ?? "").toUpperCase() as ShippingMethodKind;
  if (!KINDS.includes(kind)) throw new ShippingMethodError("INVALID_KIND");
  return kind;
}

function normalizeCurrency(value: unknown): CurrencyCode {
  const currency = String(value ?? "").toUpperCase() as CurrencyCode;
  if (!CURRENCIES.includes(currency)) throw new ShippingMethodError("INVALID_CURRENCY");
  return currency;
}

function toMoneyString(value: unknown): string {
  const n = Math.trunc(Number(value));
  if (!Number.isFinite(n) || n < 0) throw new ShippingMethodError("INVALID_AMOUNT");
  return String(n);
}

function toOptionalMoneyString(value: unknown): string | null {
  if (value == null || value === "") return null;
  return toMoneyString(value);
}

function toOptionalInt(value: unknown): number | null {
  if (value == null || value === "") return null;
  const n = Math.trunc(Number(value));
  if (!Number.isFinite(n) || n < 0) throw new ShippingMethodError("INVALID_DAYS");
  return n;
}

function toInt(value: unknown, fallback = 0): number {
  const n = Math.trunc(Number(value));
  return Number.isFinite(n) ? n : fallback;
}

function isUniqueViolation(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;
  const code = (error as { code?: unknown }).code;
  if (code === "23505") return true;
  const message = (error as { message?: unknown }).message;
  return typeof message === "string" && message.toLowerCase().includes("unique");
}

// ─── Read ──────────────────────────────────────────────────────────────────

/** Lists all shipping methods ordered by sortOrder, then by code. */
export async function listShippingMethods() {
  return getDb()
    .select()
    .from(shippingMethods)
    .orderBy(asc(shippingMethods.sortOrder), asc(shippingMethods.code));
}

export type AdminShippingMethodRecord = Awaited<ReturnType<typeof listShippingMethods>>[number];

/** Serializes a shipping method row to a stable, client-safe shape. */
export function toAdminShippingMethodOption(row: AdminShippingMethodRecord) {
  return {
    id: row.id,
    code: row.code,
    titleFa: row.titleFa,
    kind: row.kind,
    flatAmount: row.flatAmount,
    freeThresholdAmount: row.freeThresholdAmount ?? null,
    minDays: row.minDays ?? null,
    maxDays: row.maxDays ?? null,
    currency: row.currency,
    isActive: row.isActive,
    sortOrder: row.sortOrder,
    createdAt: row.createdAt ? row.createdAt.toISOString() : null,
    updatedAt: row.updatedAt ? row.updatedAt.toISOString() : null,
  };
}

export type AdminShippingMethodOption = ReturnType<typeof toAdminShippingMethodOption>;

// ─── Write ─────────────────────────────────────────────────────────────────

export async function createShippingMethod(input: ShippingMethodInput) {
  const code = normalizeCode(input.code);
  const titleFa = normalizeTitleFa(input.titleFa);
  const kind = normalizeKind(input.kind);
  const currency = input.currency ? normalizeCurrency(input.currency) : ("IRT" as CurrencyCode);

  try {
    const [row] = await getDb()
      .insert(shippingMethods)
      .values({
        code,
        titleFa,
        kind,
        flatAmount: toMoneyString(input.flatAmount ?? 0),
        freeThresholdAmount: toOptionalMoneyString(input.freeThresholdAmount),
        minDays: toOptionalInt(input.minDays),
        maxDays: toOptionalInt(input.maxDays),
        currency,
        isActive: input.isActive ?? true,
        sortOrder: toInt(input.sortOrder, 0),
      })
      .returning();
    return row;
  } catch (error) {
    if (isUniqueViolation(error)) throw new ShippingMethodError("CODE_TAKEN");
    throw error;
  }
}

export async function updateShippingMethod(id: string, input: ShippingMethodPatchInput) {
  const current = await getDb().query.shippingMethods.findFirst({
    where: (t, { eq: eqOp }) => eqOp(t.id, id),
  });

  if (!current) throw new ShippingMethodError("NOT_FOUND");

  const patch: Partial<typeof shippingMethods.$inferInsert> = {};

  if (input.code !== undefined) patch.code = normalizeCode(input.code);
  if (input.titleFa !== undefined) patch.titleFa = normalizeTitleFa(input.titleFa);
  if (input.kind !== undefined) patch.kind = normalizeKind(input.kind);
  if (input.currency !== undefined) patch.currency = normalizeCurrency(input.currency);
  if (input.flatAmount !== undefined) patch.flatAmount = toMoneyString(input.flatAmount);
  if (input.freeThresholdAmount !== undefined)
    patch.freeThresholdAmount = toOptionalMoneyString(input.freeThresholdAmount);
  if (input.minDays !== undefined) patch.minDays = toOptionalInt(input.minDays);
  if (input.maxDays !== undefined) patch.maxDays = toOptionalInt(input.maxDays);
  if (input.isActive !== undefined) patch.isActive = Boolean(input.isActive);
  if (input.sortOrder !== undefined) patch.sortOrder = toInt(input.sortOrder, 0);

  patch.updatedAt = new Date();

  try {
    const [row] = await getDb()
      .update(shippingMethods)
      .set(patch)
      .where(eq(shippingMethods.id, id))
      .returning();
    return row;
  } catch (error) {
    if (isUniqueViolation(error)) throw new ShippingMethodError("CODE_TAKEN");
    throw error;
  }
}

export async function deleteShippingMethod(id: string) {
  const [deleted] = await getDb()
    .delete(shippingMethods)
    .where(eq(shippingMethods.id, id))
    .returning({ id: shippingMethods.id });

  if (!deleted) throw new ShippingMethodError("NOT_FOUND");

  return deleted;
}
