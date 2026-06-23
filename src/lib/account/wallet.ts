import { and, desc, eq, ilike } from "drizzle-orm";

import { giftCards, wallets, walletTransactions, type walletTxnReason } from "@/db/schema";
import { getDb } from "@/lib/db";

// ─── Types ──────────────────────────────────────────────────────────────────

type Db = ReturnType<typeof getDb>;
/** Either the singleton client or an in-flight transaction handle. */
type DbOrTx = Db | Parameters<Parameters<Db["transaction"]>[0]>[0];

export type Wallet = typeof wallets.$inferSelect;
export type WalletTransaction = typeof walletTransactions.$inferSelect;
export type GiftCard = typeof giftCards.$inferSelect;
export type WalletTxnReason = (typeof walletTxnReason.enumValues)[number];

export interface CreditWalletInput {
  userId: string;
  /** Positive amount as a numeric string or number (Toman). */
  amount: string | number;
  reason: WalletTxnReason;
  note?: string;
  orderId?: string;
  giftCardId?: string;
}

export interface DebitWalletInput {
  userId: string;
  amount: string | number;
  reason: WalletTxnReason;
  note?: string;
  orderId?: string;
}

/**
 * Raised by wallet operations so callers (API routes) can map to a stable,
 * Persian, client-facing message without leaking internals.
 */
export class WalletError extends Error {
  constructor(
    public code:
      | "INVALID_AMOUNT"
      | "INSUFFICIENT_FUNDS"
      | "GIFT_CARD_NOT_FOUND"
      | "GIFT_CARD_NOT_ACTIVE"
      | "GIFT_CARD_EXPIRED",
    message: string,
  ) {
    super(message);
    this.name = "WalletError";
  }
}

// ─── Persian labels (shared by the page + any future surface) ─────────────────

const REASON_LABELS: Record<WalletTxnReason, string> = {
  TOPUP: "افزایش موجودی",
  PURCHASE: "پرداخت خرید",
  REFUND: "بازگشت وجه",
  GIFT_CARD: "کارت هدیه",
  REFERRAL_REWARD: "پاداش معرفی",
  LOYALTY_REDEEM: "تبدیل امتیاز",
  ADJUSTMENT: "اصلاح حساب",
};

/** Persian label for a wallet transaction reason. */
export function walletReasonLabel(reason: WalletTxnReason): string {
  return REASON_LABELS[reason] ?? reason;
}

// ─── Money helpers (integer-cent math; never float-add numeric strings) ───────

// `numeric(price)` is precision 12 / scale 2. We do all arithmetic in integer
// cents (smallest unit) so additions/subtractions are exact, then format back
// to a 2-decimal string for storage and the API contract.

// `BigInt(...)` constructors instead of `n` literals so the file does not require
// an ES2020 compile target.
const ZERO = BigInt(0);
const HUNDRED = BigInt(100);

function toCents(value: string | number): bigint {
  const str = typeof value === "number" ? value.toString() : value.trim();
  if (str === "" || !/^-?\d+(\.\d+)?$/.test(str)) {
    throw new WalletError("INVALID_AMOUNT", "مبلغ نامعتبر است.");
  }
  const negative = str.startsWith("-");
  const [intPart, fracPartRaw = ""] = (negative ? str.slice(1) : str).split(".");
  const fracPart = `${fracPartRaw}00`.slice(0, 2);
  const cents = BigInt(intPart || "0") * HUNDRED + BigInt(fracPart || "0");
  return negative ? -cents : cents;
}

function fromCents(cents: bigint): string {
  const negative = cents < ZERO;
  const abs = negative ? -cents : cents;
  const intPart = abs / HUNDRED;
  const fracPart = (abs % HUNDRED).toString().padStart(2, "0");
  return `${negative ? "-" : ""}${intPart}.${fracPart}`;
}

// ─── Core operations (all mutations atomic via a transaction) ─────────────────

/**
 * Fetch the user's wallet, creating it lazily on first access. Safe to call
 * inside or outside a transaction. The (userId) unique constraint plus an
 * ON CONFLICT DO NOTHING insert makes this race-safe.
 */
export async function getOrCreateWallet(userId: string, db: DbOrTx = getDb()): Promise<Wallet> {
  const existing = await db.query.wallets.findFirst({
    where: (w, { eq: eqOp }) => eqOp(w.userId, userId),
  });
  if (existing) {
    return existing;
  }

  await db
    .insert(wallets)
    .values({ userId, balanceAmount: "0", currency: "IRT" })
    .onConflictDoNothing({ target: wallets.userId });

  const created = await db.query.wallets.findFirst({
    where: (w, { eq: eqOp }) => eqOp(w.userId, userId),
  });
  // Guaranteed to exist after the insert/conflict; assert for the type system.
  if (!created) {
    throw new WalletError("INVALID_AMOUNT", "ایجاد کیف پول ممکن نشد.");
  }
  return created;
}

/**
 * Credit (increase) the wallet balance and append a CREDIT ledger row with the
 * resulting `balanceAfter`. Atomic: balance update + ledger insert run in one
 * transaction. Accepts an injected tx so callers (orders, loyalty, referrals)
 * can compose this inside their own flow.
 */
export async function creditWallet(
  input: CreditWalletInput,
  db: DbOrTx = getDb(),
): Promise<{ wallet: Wallet; transaction: WalletTransaction }> {
  const amountCents = toCents(input.amount);
  if (amountCents <= ZERO) {
    throw new WalletError("INVALID_AMOUNT", "مبلغ باید بزرگ‌تر از صفر باشد.");
  }

  const run = async (tx: DbOrTx) => {
    const wallet = await getOrCreateWallet(input.userId, tx);
    // Lock the row so concurrent credits/debits serialize (no lost updates).
    const [locked] = await tx.select().from(wallets).where(eq(wallets.id, wallet.id)).for("update");
    const nextBalance = fromCents(toCents((locked ?? wallet).balanceAmount) + amountCents);

    const [updated] = await tx
      .update(wallets)
      .set({ balanceAmount: nextBalance, updatedAt: new Date() })
      .where(eq(wallets.id, wallet.id))
      .returning();

    const [transaction] = await tx
      .insert(walletTransactions)
      .values({
        walletId: wallet.id,
        direction: "CREDIT",
        reason: input.reason,
        amount: fromCents(amountCents),
        balanceAfter: nextBalance,
        orderId: input.orderId ?? null,
        giftCardId: input.giftCardId ?? null,
        note: input.note ?? null,
      })
      .returning();

    return { wallet: updated, transaction };
  };

  return isTx(db) ? run(db) : db.transaction(run);
}

/**
 * Debit (decrease) the wallet balance and append a DEBIT ledger row. Throws
 * INSUFFICIENT_FUNDS if the balance would go negative. Atomic.
 */
export async function debitWallet(
  input: DebitWalletInput,
  db: DbOrTx = getDb(),
): Promise<{ wallet: Wallet; transaction: WalletTransaction }> {
  const amountCents = toCents(input.amount);
  if (amountCents <= ZERO) {
    throw new WalletError("INVALID_AMOUNT", "مبلغ باید بزرگ‌تر از صفر باشد.");
  }

  const run = async (tx: DbOrTx) => {
    const wallet = await getOrCreateWallet(input.userId, tx);
    // Lock the row before the funds check so two concurrent debits can't both
    // pass and overspend.
    const [locked] = await tx.select().from(wallets).where(eq(wallets.id, wallet.id)).for("update");
    const currentCents = toCents((locked ?? wallet).balanceAmount);
    if (currentCents < amountCents) {
      throw new WalletError("INSUFFICIENT_FUNDS", "موجودی کیف پول کافی نیست.");
    }
    const nextBalance = fromCents(currentCents - amountCents);

    const [updated] = await tx
      .update(wallets)
      .set({ balanceAmount: nextBalance, updatedAt: new Date() })
      .where(eq(wallets.id, wallet.id))
      .returning();

    const [transaction] = await tx
      .insert(walletTransactions)
      .values({
        walletId: wallet.id,
        direction: "DEBIT",
        reason: input.reason,
        amount: fromCents(amountCents),
        balanceAfter: nextBalance,
        orderId: input.orderId ?? null,
        note: input.note ?? null,
      })
      .returning();

    return { wallet: updated, transaction };
  };

  return isTx(db) ? run(db) : db.transaction(run);
}

/**
 * Redeem a gift card code into the user's wallet.
 *
 * In ONE transaction:
 *  1. Lock & validate the gift card row: must exist, be ACTIVE, and not expired.
 *  2. Credit the wallet for the card's remaining balance (reason GIFT_CARD).
 *  3. Mark the card REDEEMED + redeemedByUserId + redeemedAt, balance → 0.
 *
 * We keep it simple per contract: a full redeem to wallet (no partial spends).
 */
export async function redeemGiftCard(
  userId: string,
  code: string,
  db: DbOrTx = getDb(),
): Promise<{ wallet: Wallet; transaction: WalletTransaction; amount: string }> {
  const normalized = code.trim().toUpperCase();
  if (!normalized) {
    throw new WalletError("GIFT_CARD_NOT_FOUND", "کد کارت هدیه نامعتبر است.");
  }

  const run = async (tx: DbOrTx) => {
    // Lock the gift card row for the duration of the transaction so two
    // concurrent redeems of the same code cannot both succeed.
    const [card] = await tx
      .select()
      .from(giftCards)
      .where(ilike(giftCards.code, normalized))
      .for("update");

    if (!card) {
      throw new WalletError("GIFT_CARD_NOT_FOUND", "کارت هدیه‌ای با این کد یافت نشد.");
    }

    const now = new Date();
    if (card.expiresAt && card.expiresAt.getTime() <= now.getTime()) {
      // Surface the real state and mark it expired so it can't be retried.
      if (card.status === "ACTIVE") {
        await tx
          .update(giftCards)
          .set({ status: "EXPIRED", updatedAt: now })
          .where(eq(giftCards.id, card.id));
      }
      throw new WalletError("GIFT_CARD_EXPIRED", "این کارت هدیه منقضی شده است.");
    }

    if (card.status !== "ACTIVE") {
      throw new WalletError(
        "GIFT_CARD_NOT_ACTIVE",
        card.status === "REDEEMED"
          ? "این کارت هدیه قبلاً استفاده شده است."
          : "این کارت هدیه فعال نیست.",
      );
    }

    const amountCents = toCents(card.balanceAmount);
    if (amountCents <= ZERO) {
      throw new WalletError("GIFT_CARD_NOT_ACTIVE", "موجودی این کارت هدیه صفر است.");
    }
    const amount = fromCents(amountCents);

    const credit = await creditWallet(
      {
        userId,
        amount,
        reason: "GIFT_CARD",
        giftCardId: card.id,
        note: `کارت هدیه ${card.code}`,
      },
      tx,
    );

    await tx
      .update(giftCards)
      .set({
        status: "REDEEMED",
        balanceAmount: "0",
        redeemedByUserId: userId,
        redeemedAt: now,
        updatedAt: now,
      })
      .where(and(eq(giftCards.id, card.id), eq(giftCards.status, "ACTIVE")));

    return { wallet: credit.wallet, transaction: credit.transaction, amount };
  };

  return isTx(db) ? run(db) : db.transaction(run);
}

// ─── Read helpers (for the page + API) ────────────────────────────────────────

/** Wallet + ledger (newest first), creating the wallet on first access. */
export async function getWalletWithLedger(
  userId: string,
  limit = 100,
): Promise<{ wallet: Wallet; transactions: WalletTransaction[] }> {
  const db = getDb();
  const wallet = await getOrCreateWallet(userId, db);

  const transactions = await db
    .select()
    .from(walletTransactions)
    .where(eq(walletTransactions.walletId, wallet.id))
    .orderBy(desc(walletTransactions.createdAt))
    .limit(limit);

  return { wallet, transactions };
}

// ─── Internal ─────────────────────────────────────────────────────────────────

/**
 * Discriminates an in-flight transaction handle from the top-level client. The
 * `rollback` helper is only present on `PgTransaction`, so its presence means we
 * are already inside a transaction and must run inline (not open a new one).
 */
function isTx(db: DbOrTx): boolean {
  return "rollback" in db;
}
