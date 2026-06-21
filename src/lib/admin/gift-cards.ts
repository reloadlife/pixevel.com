import { randomInt } from "node:crypto";

import { and, count, desc, eq, ilike, type SQL } from "drizzle-orm";

import type { GiftCardStatus } from "@/db/schema";
import { giftCards } from "@/db/schema";
import { getDb } from "@/lib/db";

// ─── Types ──────────────────────────────────────────────────────────────────

export type GiftCardListInput = {
  status?: GiftCardStatus | null;
  q?: string | null;
  page?: number | null;
  pageSize?: number | null;
};

export type GenerateGiftCardsInput = {
  count: number | string;
  amount: number | string;
  currency?: string | null;
  expiresAt?: string | Date | null;
};

/**
 * Domain errors thrown by this module. The API layer maps each `code` to an
 * HTTP status + Persian message, so messages never leak ORM/DB details.
 */
export class GiftCardError extends Error {
  constructor(public code: string) {
    super(code);
    this.name = "GiftCardError";
  }
}

const STATUSES: readonly GiftCardStatus[] = ["ACTIVE", "REDEEMED", "DISABLED", "EXPIRED"];

// Operators can only flip cards between ACTIVE and DISABLED. A REDEEMED card
// must never be re-activated (its balance is already spent), and EXPIRED is a
// system-derived terminal state — neither is a manual target.
const SETTABLE_STATUSES: readonly GiftCardStatus[] = ["ACTIVE", "DISABLED"];

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;
const MAX_GENERATE_COUNT = 1000;

// Code shape: GC-XXXX-XXXX-XXXX with an unambiguous uppercase alphabet
// (no 0/O/1/I) so codes are easy to read and type back.
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const CODE_GROUPS = 3;
const CODE_GROUP_LEN = 4;
const MAX_CODE_ATTEMPTS = 5;

// ─── Coercion helpers ─────────────────────────────────────────────────────────

/**
 * Money in this app is stored as integer-toman strings (matching the coupon
 * flow). We normalize to a positive integer string here; `formatToman` renders
 * it for display and the wallet redeem path parses it back as a numeric.
 */
function toMoneyString(value: unknown): string {
  const n = Math.trunc(Number(value));
  if (!Number.isFinite(n) || n <= 0) {
    throw new GiftCardError("INVALID_AMOUNT");
  }
  return String(n);
}

function toCount(value: unknown): number {
  const n = Math.trunc(Number(value));
  if (!Number.isFinite(n) || n < 1 || n > MAX_GENERATE_COUNT) {
    throw new GiftCardError("INVALID_COUNT");
  }
  return n;
}

function toOptionalDate(value: unknown): Date | null {
  if (value == null || value === "") {
    return null;
  }
  const date = value instanceof Date ? value : new Date(String(value));
  if (Number.isNaN(date.getTime())) {
    throw new GiftCardError("INVALID_DATE");
  }
  return date;
}

function normalizeCurrency(value: unknown): string {
  const currency = String(value ?? "")
    .trim()
    .toUpperCase();
  return currency || "IRR";
}

function normalizeStatus(value: unknown): GiftCardStatus {
  const status = String(value ?? "").toUpperCase() as GiftCardStatus;
  if (!STATUSES.includes(status)) {
    throw new GiftCardError("INVALID_STATUS");
  }
  return status;
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

/** Cryptographically-random code group, e.g. "A7K2". */
function randomGroup(): string {
  let out = "";
  for (let i = 0; i < CODE_GROUP_LEN; i++) {
    out += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
  }
  return out;
}

/** A full code like "GC-A7K2-9MQX-RT4P". */
function randomCode(): string {
  const groups: string[] = [];
  for (let i = 0; i < CODE_GROUPS; i++) {
    groups.push(randomGroup());
  }
  return `GC-${groups.join("-")}`;
}

// ─── Read ──────────────────────────────────────────────────────────────────

/**
 * Paginated gift-card list, newest first. Optional status filter and a
 * case-insensitive code search. Returns the page rows plus pagination metadata.
 */
export async function listGiftCards(input: GiftCardListInput = {}) {
  const db = getDb();

  const page = Math.max(1, Math.trunc(Number(input.page ?? 1)) || 1);
  const pageSizeRaw = Math.trunc(Number(input.pageSize ?? DEFAULT_PAGE_SIZE)) || DEFAULT_PAGE_SIZE;
  const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, pageSizeRaw));

  const filters: SQL[] = [];
  if (input.status) {
    filters.push(eq(giftCards.status, normalizeStatus(input.status)));
  }
  const q = input.q?.trim();
  if (q) {
    filters.push(ilike(giftCards.code, `%${q}%`));
  }
  const where = filters.length ? and(...filters) : undefined;

  const [{ total }] = await db.select({ total: count() }).from(giftCards).where(where);

  const rows = await db
    .select()
    .from(giftCards)
    .where(where)
    .orderBy(desc(giftCards.createdAt))
    .limit(pageSize)
    .offset((page - 1) * pageSize);

  return {
    rows,
    page,
    pageSize,
    total: Number(total),
    totalPages: Math.max(1, Math.ceil(Number(total) / pageSize)),
  };
}

export type AdminGiftCardRecord = typeof giftCards.$inferSelect;

/** Counts per status (for filter chips / summary), independent of the page. */
export async function giftCardStatusCounts(): Promise<Record<GiftCardStatus, number>> {
  const rows = await getDb()
    .select({ status: giftCards.status, total: count() })
    .from(giftCards)
    .groupBy(giftCards.status);

  const counts: Record<GiftCardStatus, number> = {
    ACTIVE: 0,
    REDEEMED: 0,
    DISABLED: 0,
    EXPIRED: 0,
  };
  for (const row of rows) {
    counts[row.status] = Number(row.total);
  }
  return counts;
}

/** Serializes a gift-card row into a stable, client-safe shape. */
export function toAdminGiftCardOption(card: AdminGiftCardRecord) {
  return {
    id: card.id,
    code: card.code,
    initialAmount: card.initialAmount,
    balanceAmount: card.balanceAmount,
    currency: card.currency,
    status: card.status,
    issuedToUserId: card.issuedToUserId,
    redeemedByUserId: card.redeemedByUserId,
    redeemedAt: card.redeemedAt ? card.redeemedAt.toISOString() : null,
    expiresAt: card.expiresAt ? card.expiresAt.toISOString() : null,
    createdAt: card.createdAt ? card.createdAt.toISOString() : null,
    updatedAt: card.updatedAt ? card.updatedAt.toISOString() : null,
  };
}

export type AdminGiftCardOption = ReturnType<typeof toAdminGiftCardOption>;

// ─── Write ─────────────────────────────────────────────────────────────────

/**
 * Generates `count` fresh ACTIVE gift cards, each worth `amount` (integer
 * toman). Codes are cryptographically random and unique; on the rare unique
 * collision we retry the single card a few times before giving up.
 *
 * Returns the created rows so the caller can show the codes once for copying —
 * the only time the full plaintext code list is surfaced.
 */
export async function generateGiftCards(input: GenerateGiftCardsInput) {
  const count = toCount(input.count);
  const amount = toMoneyString(input.amount);
  const currency = normalizeCurrency(input.currency);
  const expiresAt = toOptionalDate(input.expiresAt);

  const db = getDb();
  const created: AdminGiftCardRecord[] = [];

  for (let i = 0; i < count; i++) {
    let inserted: AdminGiftCardRecord | undefined;

    for (let attempt = 0; attempt < MAX_CODE_ATTEMPTS && !inserted; attempt++) {
      try {
        const [row] = await db
          .insert(giftCards)
          .values({
            code: randomCode(),
            initialAmount: amount,
            balanceAmount: amount,
            currency,
            status: "ACTIVE",
            expiresAt,
          })
          .returning();
        inserted = row;
      } catch (error) {
        if (isUniqueViolation(error)) {
          continue;
        }
        throw error;
      }
    }

    if (!inserted) {
      throw new GiftCardError("CODE_GENERATION_FAILED");
    }
    created.push(inserted);
  }

  return created;
}

/**
 * Sets a gift card's status. Only ACTIVE ⇄ DISABLED transitions are allowed:
 * a REDEEMED card can never be re-activated (its funds are already spent), and
 * EXPIRED is a system-derived terminal state.
 */
export async function setGiftCardStatus(id: string, status: GiftCardStatus) {
  const target = normalizeStatus(status);
  if (!SETTABLE_STATUSES.includes(target)) {
    throw new GiftCardError("STATUS_NOT_SETTABLE");
  }

  const current = await getDb().query.giftCards.findFirst({
    where: (c, { eq: eqOp }) => eqOp(c.id, id),
  });

  if (!current) {
    throw new GiftCardError("NOT_FOUND");
  }

  // Guard: a spent (REDEEMED) or expired card must not be flipped back to ACTIVE.
  if (current.status === "REDEEMED") {
    throw new GiftCardError("CARD_REDEEMED");
  }
  if (current.status === "EXPIRED") {
    throw new GiftCardError("CARD_EXPIRED");
  }

  if (current.status === target) {
    return current;
  }

  const [updated] = await getDb()
    .update(giftCards)
    .set({ status: target, updatedAt: new Date() })
    .where(eq(giftCards.id, id))
    .returning();

  return updated;
}
