import { desc, eq, sql } from "drizzle-orm";

import { loyaltyAccounts, loyaltyTransactions } from "@/db/schema";
import { creditWallet } from "@/lib/account/wallet";
import { getDb } from "@/lib/db";

// ─── Business rules (placeholders — tune here, single source of truth) ─────────
// Earn: 1 point per 10,000 Toman of PAID order subtotal.
// Redeem: 1 point = 100 Toman of wallet credit; minimum 100 points per redeem.
// Tiers by lifetime points: BRONZE 0+, SILVER 5,000+, GOLD 20,000+.

/** Toman of PAID subtotal that earns a single loyalty point. */
export const LOYALTY_EARN_RATE = 10_000;
/** Toman of wallet credit granted per redeemed point. */
export const LOYALTY_POINT_VALUE_TOMAN = 100;
/** Minimum number of points that can be redeemed in one operation. */
export const LOYALTY_MIN_REDEEM = 100;

export type LoyaltyTier = "BRONZE" | "SILVER" | "GOLD";

/** Lifetime-points thresholds for each tier (ascending). */
export const LOYALTY_TIERS: { tier: LoyaltyTier; min: number }[] = [
  { tier: "BRONZE", min: 0 },
  { tier: "SILVER", min: 5_000 },
  { tier: "GOLD", min: 20_000 },
];

// ─── Types ─────────────────────────────────────────────────────────────────────

export type LoyaltyAccountRow = typeof loyaltyAccounts.$inferSelect;
export type LoyaltyTransactionRow = typeof loyaltyTransactions.$inferSelect;

/**
 * Accepts either the base Drizzle client or a transaction handle so loyalty
 * mutations can join a caller-owned transaction (e.g. redeem → wallet credit).
 */
type DbLike = ReturnType<typeof getDb>;
type Tx = Parameters<Parameters<DbLike["transaction"]>[0]>[0];
export type DbOrTx = DbLike | Tx;

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Resolves the loyalty tier for a given lifetime-points total. */
export function computeTier(lifetimePoints: number): LoyaltyTier {
  let tier: LoyaltyTier = "BRONZE";
  for (const t of LOYALTY_TIERS) {
    if (lifetimePoints >= t.min) {
      tier = t.tier;
    }
  }
  return tier;
}

/** Persian label for a tier. */
export function tierLabel(tier: string): string {
  const map: Record<string, string> = {
    BRONZE: "برنزی",
    SILVER: "نقره‌ای",
    GOLD: "طلایی",
  };
  return map[tier] ?? tier;
}

/** Points still required to reach the next tier; null when already GOLD. */
export function pointsToNextTier(
  lifetimePoints: number,
): { tier: LoyaltyTier; remaining: number } | null {
  for (const t of LOYALTY_TIERS) {
    if (lifetimePoints < t.min) {
      return { tier: t.tier, remaining: t.min - lifetimePoints };
    }
  }
  return null;
}

/**
 * Returns the user's loyalty account, creating a zeroed BRONZE account on first
 * access. Pass a transaction handle to keep creation inside an outer tx.
 */
export async function getOrCreateLoyalty(
  userId: string,
  db: DbOrTx = getDb(),
): Promise<LoyaltyAccountRow> {
  const existing = await db.query.loyaltyAccounts.findFirst({
    where: eq(loyaltyAccounts.userId, userId),
  });
  if (existing) {
    return existing;
  }

  const [created] = await db
    .insert(loyaltyAccounts)
    .values({ userId })
    .onConflictDoNothing({ target: loyaltyAccounts.userId })
    .returning();

  if (created) {
    return created;
  }

  // Lost the race: another writer created it concurrently.
  const row = await db.query.loyaltyAccounts.findFirst({
    where: eq(loyaltyAccounts.userId, userId),
  });
  if (!row) {
    throw new Error("Failed to create loyalty account.");
  }
  return row;
}

// ─── Errors ─────────────────────────────────────────────────────────────────

export type LoyaltyErrorCode = "MIN_REDEEM" | "INSUFFICIENT_POINTS" | "INVALID_POINTS";

export class LoyaltyError extends Error {
  code: LoyaltyErrorCode;
  constructor(code: LoyaltyErrorCode, message: string) {
    super(message);
    this.name = "LoyaltyError";
    this.code = code;
  }
}

// ─── Mutations ─────────────────────────────────────────────────────────────────

/**
 * Credits loyalty points (EARN by default) and bumps lifetimePoints + tier in a
 * single transaction. Writes a signed `loyaltyTransactions` row.
 */
export async function earnPoints(input: {
  userId: string;
  points: number;
  reason?: "EARN" | "REFERRAL" | "ADJUST";
  orderId?: string | null;
  note?: string | null;
  db?: DbOrTx;
}): Promise<LoyaltyAccountRow> {
  const points = Math.floor(input.points);
  if (points <= 0) {
    throw new LoyaltyError("INVALID_POINTS", "تعداد امتیاز نامعتبر است.");
  }

  const run = async (tx: DbOrTx): Promise<LoyaltyAccountRow> => {
    const account = await getOrCreateLoyalty(input.userId, tx);
    const lifetime = account.lifetimePoints + points;

    const [updated] = await tx
      .update(loyaltyAccounts)
      .set({
        pointsBalance: account.pointsBalance + points,
        lifetimePoints: lifetime,
        tier: computeTier(lifetime),
        updatedAt: new Date(),
      })
      .where(eq(loyaltyAccounts.id, account.id))
      .returning();

    await tx.insert(loyaltyTransactions).values({
      userId: input.userId,
      points,
      reason: input.reason ?? "EARN",
      orderId: input.orderId ?? null,
      note: input.note ?? null,
    });

    return updated;
  };

  if (input.db) {
    return run(input.db);
  }
  return getDb().transaction(run);
}

/**
 * Computes the points earned for a PAID order subtotal (Toman). Floored to whole
 * points. Caller decides when an order qualifies (status === PAID).
 */
export function pointsForSubtotal(subtotalToman: number | string): number {
  return Math.floor(Number(subtotalToman ?? 0) / LOYALTY_EARN_RATE);
}

export type RedeemResult = {
  account: LoyaltyAccountRow;
  pointsRedeemed: number;
  walletCreditToman: number;
};

/**
 * Converts points to wallet credit atomically: decrements pointsBalance, writes
 * a REDEEM `loyaltyTransactions` row, and credits the wallet (reason
 * LOYALTY_REDEEM) via the wallet lib — all inside one transaction.
 */
export async function redeemPoints(input: {
  userId: string;
  points: number;
}): Promise<RedeemResult> {
  const points = Math.floor(input.points);
  if (!Number.isFinite(points) || points <= 0) {
    throw new LoyaltyError("INVALID_POINTS", "تعداد امتیاز نامعتبر است.");
  }
  if (points < LOYALTY_MIN_REDEEM) {
    throw new LoyaltyError("MIN_REDEEM", `حداقل ${LOYALTY_MIN_REDEEM} امتیاز برای تبدیل لازم است.`);
  }

  const walletCreditToman = points * LOYALTY_POINT_VALUE_TOMAN;

  return getDb().transaction(async (tx) => {
    const account = await getOrCreateLoyalty(input.userId, tx);
    // Lock the row so two concurrent redeems can't both pass the balance check
    // and drive points negative / double-credit the wallet.
    const [locked] = await tx
      .select()
      .from(loyaltyAccounts)
      .where(eq(loyaltyAccounts.id, account.id))
      .for("update");
    if ((locked ?? account).pointsBalance < points) {
      throw new LoyaltyError("INSUFFICIENT_POINTS", "امتیاز کافی ندارید.");
    }

    const [updated] = await tx
      .update(loyaltyAccounts)
      .set({
        pointsBalance: sql`${loyaltyAccounts.pointsBalance} - ${points}`,
        updatedAt: new Date(),
      })
      .where(eq(loyaltyAccounts.id, account.id))
      .returning();

    await tx.insert(loyaltyTransactions).values({
      userId: input.userId,
      points: -points,
      reason: "REDEEM",
      note: `تبدیل ${points} امتیاز به اعتبار کیف پول`,
    });

    await creditWallet(
      {
        userId: input.userId,
        amount: walletCreditToman.toString(),
        reason: "LOYALTY_REDEEM",
        note: `اعتبار حاصل از تبدیل ${points} امتیاز باشگاه مشتریان`,
      },
      tx,
    );

    return { account: updated, pointsRedeemed: points, walletCreditToman };
  });
}

// ─── Read model ─────────────────────────────────────────────────────────────

export type LoyaltyOverview = {
  account: LoyaltyAccountRow;
  tier: LoyaltyTier;
  nextTier: { tier: LoyaltyTier; remaining: number } | null;
  transactions: LoyaltyTransactionRow[];
};

/** Loads the account (creating it if needed) plus recent transaction history. */
export async function getLoyaltyOverview(
  userId: string,
  historyLimit = 50,
): Promise<LoyaltyOverview> {
  const db = getDb();
  const account = await getOrCreateLoyalty(userId, db);
  const transactions = await db.query.loyaltyTransactions.findMany({
    where: eq(loyaltyTransactions.userId, userId),
    orderBy: [desc(loyaltyTransactions.createdAt)],
    limit: historyLimit,
  });

  return {
    account,
    tier: computeTier(account.lifetimePoints),
    nextTier: pointsToNextTier(account.lifetimePoints),
    transactions,
  };
}
