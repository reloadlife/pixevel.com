import { and, desc, eq, ilike, or, sql } from "drizzle-orm";

import {
  loyaltyAccounts,
  loyaltyTransactions,
  users,
  wallets,
  walletTransactions,
} from "@/db/schema";
import { getOrCreateLoyalty, type LoyaltyTransactionRow, tierLabel } from "@/lib/account/loyalty";
import {
  creditWallet,
  debitWallet,
  getOrCreateWallet,
  WalletError,
  type WalletTransaction,
  walletReasonLabel,
} from "@/lib/account/wallet";
import { getDb } from "@/lib/db";

// ─── Pagination helpers (mirrors lib/admin/users.ts) ──────────────────────────

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

function clampPageSize(value: number | undefined) {
  if (!value || Number.isNaN(value)) return DEFAULT_PAGE_SIZE;
  return Math.min(Math.max(1, Math.trunc(value)), MAX_PAGE_SIZE);
}

function clampPage(value: number | undefined) {
  if (!value || Number.isNaN(value)) return 1;
  return Math.max(1, Math.trunc(value));
}

// ─── List: users + wallet balance + loyalty points/tier ───────────────────────

export type BalanceListFilter = {
  q?: string;
  page?: number;
  pageSize?: number;
};

/**
 * Paginated user list joined with each user's wallet balance and loyalty
 * points/tier. LEFT JOINs so users without a wallet/loyalty account still show
 * (treated as zero) — accounts are created lazily on first adjustment.
 */
export async function listUserBalances(filter: BalanceListFilter = {}) {
  const db = getDb();

  const page = clampPage(filter.page);
  const pageSize = clampPageSize(filter.pageSize);
  const offset = (page - 1) * pageSize;

  const conditions = [];
  if (filter.q) {
    const term = `%${filter.q}%`;
    conditions.push(
      or(ilike(users.phone, term), ilike(users.fullName, term), ilike(users.email, term)),
    );
  }
  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const [rows, totalResult] = await Promise.all([
    db
      .select({
        id: users.id,
        email: users.email,
        phone: users.phone,
        fullName: users.fullName,
        isPremium: users.isPremium,
        createdAt: users.createdAt,
        walletBalance: sql<string>`coalesce(${wallets.balanceAmount}, '0')`,
        walletCurrency: sql<string>`coalesce(${wallets.currency}, 'IRR')`,
        pointsBalance: sql<number>`coalesce(${loyaltyAccounts.pointsBalance}, 0)`,
        lifetimePoints: sql<number>`coalesce(${loyaltyAccounts.lifetimePoints}, 0)`,
        tier: sql<string>`coalesce(${loyaltyAccounts.tier}, 'BRONZE')`,
      })
      .from(users)
      .leftJoin(wallets, eq(wallets.userId, users.id))
      .leftJoin(loyaltyAccounts, eq(loyaltyAccounts.userId, users.id))
      .where(where)
      .orderBy(desc(users.createdAt))
      .limit(pageSize)
      .offset(offset),
    db.select({ count: sql<number>`count(*)::int` }).from(users).where(where),
  ]);

  const total = totalResult[0]?.count ?? 0;

  return {
    rows,
    page,
    pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}

export type BalanceListResult = Awaited<ReturnType<typeof listUserBalances>>;
export type BalanceListRow = BalanceListResult["rows"][number];

/** API-safe serialiser for a balance list row. */
export function toBalanceRow(row: BalanceListRow) {
  return {
    id: row.id,
    email: row.email,
    phone: row.phone,
    fullName: row.fullName,
    isPremium: row.isPremium,
    createdAt: row.createdAt.toISOString(),
    walletBalance: String(row.walletBalance ?? "0"),
    walletCurrency: String(row.walletCurrency ?? "IRT"),
    pointsBalance: Number(row.pointsBalance ?? 0),
    lifetimePoints: Number(row.lifetimePoints ?? 0),
    tier: String(row.tier ?? "BRONZE"),
    tierLabel: tierLabel(String(row.tier ?? "BRONZE")),
  };
}

// ─── Ledger for a single user (wallet + loyalty, newest first) ─────────────────

/**
 * Loads a user's current balances plus combined ledger (wallet transactions and
 * loyalty transactions, each newest-first) for the detail view. Creates the
 * wallet/loyalty account lazily so a never-touched user still resolves cleanly.
 * Returns null when the user does not exist.
 */
export async function getUserLedger(userId: string) {
  const db = getDb();

  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
    columns: {
      id: true,
      email: true,
      phone: true,
      fullName: true,
      isPremium: true,
      createdAt: true,
    },
  });

  if (!user) {
    return null;
  }

  const [wallet, loyalty] = await Promise.all([
    getOrCreateWallet(userId, db),
    getOrCreateLoyalty(userId, db),
  ]);

  const [walletTxns, loyaltyTxns] = await Promise.all([
    db
      .select()
      .from(walletTransactions)
      .where(eq(walletTransactions.walletId, wallet.id))
      .orderBy(desc(walletTransactions.createdAt))
      .limit(100),
    db
      .select()
      .from(loyaltyTransactions)
      .where(eq(loyaltyTransactions.userId, userId))
      .orderBy(desc(loyaltyTransactions.createdAt))
      .limit(100),
  ]);

  return { user, wallet, loyalty, walletTxns, loyaltyTxns };
}

export type UserLedger = NonNullable<Awaited<ReturnType<typeof getUserLedger>>>;

/** API-safe serialiser for the user ledger. */
export function toUserLedger(ledger: UserLedger) {
  return {
    user: {
      id: ledger.user.id,
      email: ledger.user.email,
      phone: ledger.user.phone,
      fullName: ledger.user.fullName,
      isPremium: ledger.user.isPremium,
      createdAt: ledger.user.createdAt.toISOString(),
    },
    wallet: {
      balance: ledger.wallet.balanceAmount,
      currency: ledger.wallet.currency,
    },
    loyalty: {
      pointsBalance: ledger.loyalty.pointsBalance,
      lifetimePoints: ledger.loyalty.lifetimePoints,
      tier: ledger.loyalty.tier,
      tierLabel: tierLabel(ledger.loyalty.tier),
    },
    walletTransactions: ledger.walletTxns.map(toWalletTxn),
    loyaltyTransactions: ledger.loyaltyTxns.map(toLoyaltyTxn),
  };
}

function toWalletTxn(txn: WalletTransaction) {
  return {
    id: txn.id,
    direction: txn.direction,
    reason: txn.reason,
    reasonLabel: walletReasonLabel(txn.reason),
    amount: txn.amount,
    balanceAfter: txn.balanceAfter,
    note: txn.note,
    createdAt: txn.createdAt.toISOString(),
  };
}

function toLoyaltyTxn(txn: LoyaltyTransactionRow) {
  return {
    id: txn.id,
    points: txn.points,
    reason: txn.reason,
    note: txn.note,
    createdAt: txn.createdAt.toISOString(),
  };
}

// ─── Adjustments (atomic — reuse the wallet/loyalty lib helpers) ───────────────

/** Audit note for a manual adjustment, recording the acting admin's id. */
function adjustmentNote(adminUserId: string, note?: string): string {
  const base = `اصلاح دستی توسط مدیر (${adminUserId})`;
  return note?.trim() ? `${base} — ${note.trim()}` : base;
}

/**
 * Raised by adjustment helpers so the API route can map to a stable Persian,
 * client-facing message without leaking internals.
 */
export class BalanceAdjustError extends Error {
  constructor(
    public code: "INVALID_AMOUNT" | "INVALID_POINTS" | "INSUFFICIENT_POINTS" | "USER_NOT_FOUND",
    message: string,
  ) {
    super(message);
    this.name = "BalanceAdjustError";
  }
}

export type WalletAdjustInput = {
  direction: "CREDIT" | "DEBIT";
  /** Positive integer-string Toman. */
  amount: string;
  note?: string;
};

export type LoyaltyAdjustInput = {
  /** Non-zero integer; negative subtracts points. */
  points: number;
  note?: string;
};

function assertUserExists(userId: string, db = getDb()) {
  return db.query.users
    .findFirst({ where: eq(users.id, userId), columns: { id: true } })
    .then((row) => {
      if (!row) {
        throw new BalanceAdjustError("USER_NOT_FOUND", "کاربر پیدا نشد.");
      }
    });
}

/**
 * Manually credit/debit a user's wallet with reason ADJUSTMENT. Delegates to the
 * atomic wallet helpers (transaction + FOR UPDATE row lock + balanceAfter ledger
 * row) so concurrent operations serialise and the balance can never drift.
 */
export async function adjustWallet(adminUserId: string, userId: string, input: WalletAdjustInput) {
  const amount = input.amount.trim();
  if (amount === "" || !/^\d+$/.test(amount) || amount === "0") {
    throw new BalanceAdjustError("INVALID_AMOUNT", "مبلغ باید عددی بزرگ‌تر از صفر باشد.");
  }

  await assertUserExists(userId);

  // Audit note: record the acting admin's id so a manual change is traceable.
  const note = adjustmentNote(adminUserId, input.note);

  try {
    return input.direction === "CREDIT"
      ? await creditWallet({ userId, amount, reason: "ADJUSTMENT", note })
      : await debitWallet({ userId, amount, reason: "ADJUSTMENT", note });
  } catch (error) {
    // Surface the wallet lib's already-Persian message (e.g. insufficient funds
    // on a debit) without leaking internals; everything maps to INVALID_AMOUNT.
    if (error instanceof WalletError) {
      throw new BalanceAdjustError("INVALID_AMOUNT", error.message);
    }
    throw error;
  }
}

/**
 * Manually add/subtract a user's loyalty points with reason ADJUST. Atomic:
 * locks the loyalty row, guards against a negative resulting balance, updates
 * the balance and writes a signed ADJUST `loyaltyTransactions` row — all in one
 * transaction.
 */
export async function adjustLoyalty(
  adminUserId: string,
  userId: string,
  input: LoyaltyAdjustInput,
) {
  const points = Math.trunc(input.points);
  if (!Number.isFinite(points) || points === 0) {
    throw new BalanceAdjustError("INVALID_POINTS", "تعداد امتیاز باید عددی غیر صفر باشد.");
  }

  await assertUserExists(userId);

  const note = adjustmentNote(adminUserId, input.note);

  return getDb().transaction(async (tx) => {
    const account = await getOrCreateLoyalty(userId, tx);
    // Lock the row so concurrent adjustments cannot both pass the balance check
    // and drive points negative.
    const [locked] = await tx
      .select()
      .from(loyaltyAccounts)
      .where(eq(loyaltyAccounts.id, account.id))
      .for("update");

    const current = (locked ?? account).pointsBalance;
    const nextBalance = current + points;
    if (nextBalance < 0) {
      throw new BalanceAdjustError("INSUFFICIENT_POINTS", "امتیاز کافی برای کسر وجود ندارد.");
    }

    // Lifetime points only ever increase (track total earned, not net balance);
    // a negative adjustment must not reduce the tier history.
    const lifetime = (locked ?? account).lifetimePoints;
    const nextLifetime = points > 0 ? lifetime + points : lifetime;

    const [updated] = await tx
      .update(loyaltyAccounts)
      .set({
        pointsBalance: nextBalance,
        lifetimePoints: nextLifetime,
        updatedAt: new Date(),
      })
      .where(eq(loyaltyAccounts.id, account.id))
      .returning();

    const [transaction] = await tx
      .insert(loyaltyTransactions)
      .values({
        userId,
        points,
        reason: "ADJUST",
        note,
      })
      .returning();

    return { account: updated, transaction };
  });
}
