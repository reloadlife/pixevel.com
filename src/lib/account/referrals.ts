import { randomBytes } from "node:crypto";

import { desc, eq } from "drizzle-orm";

import { referrals, users } from "@/db/schema";
import { getDb } from "@/lib/db";

type Db = ReturnType<typeof getDb>;

// ─── Reward constants (placeholders — tune later) ───────────────────────────────
// Centralised so the program economics are trivially adjustable.
/** Points the referrer earns once a referee's first order reaches PAID. */
export const REFERRAL_REFERRER_POINTS = 500;
/** Welcome points granted to a referee who signs up via a referral code. */
export const REFERRAL_REFEREE_WELCOME_POINTS = 200;

type ReferralRow = typeof referrals.$inferSelect;

export type ReferralListEntry = {
  id: string;
  status: ReferralRow["status"];
  rewardPoints: number;
  rewardedAt: Date | null;
  createdAt: Date;
  /** Display name of the invited user, masked phone, or null when unknown. */
  inviteeName: string | null;
  inviteePhone: string | null;
};

export type ReferralSummary = {
  code: string;
  totalInvited: number;
  qualifiedCount: number;
  rewardedCount: number;
  pendingCount: number;
  totalRewardPoints: number;
  referrals: ReferralListEntry[];
};

/**
 * Generates a short, URL-safe base36 referral code. Combines a slice of the
 * user id with a random suffix to keep collisions vanishingly unlikely while
 * staying readable/typeable.
 */
function generateCode(userId: string): string {
  const idPart = userId.replace(/-/g, "").slice(0, 4).toUpperCase();
  // Crypto-random suffix so codes aren't predictable/enumerable.
  const randPart = randomBytes(4).toString("hex").toUpperCase().slice(0, 6);
  return `${idPart}${randPart}`;
}

/**
 * Ensures the user has a stable `referralCode`, generating and persisting a
 * unique one when missing. Returns the code. Safe to call repeatedly.
 */
export async function ensureReferralCode(userId: string, db: Db = getDb()): Promise<string> {
  const existing = await db.query.users.findFirst({
    where: eq(users.id, userId),
    columns: { referralCode: true },
  });

  if (existing?.referralCode) {
    return existing.referralCode;
  }

  // Retry on the (extremely rare) unique-constraint collision.
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateCode(userId);
    try {
      const [updated] = await db
        .update(users)
        .set({ referralCode: code })
        .where(eq(users.id, userId))
        .returning({ referralCode: users.referralCode });
      if (updated?.referralCode) {
        return updated.referralCode;
      }
    } catch {
      // collision — loop and try a fresh code
    }
  }

  throw new Error("REFERRAL_CODE_GENERATION_FAILED");
}

/** Masks a phone for display: keeps the suffix, hides the middle. */
function maskPhone(phone: string | null): string | null {
  if (!phone) {
    return null;
  }
  if (phone.length <= 4) {
    return phone;
  }
  const tail = phone.slice(-4);
  return `${"•".repeat(Math.max(0, phone.length - 4))}${tail}`;
}

/**
 * Returns the people this user has invited (referrals where referrerUserId = me)
 * with each invitee's display name / masked phone and reward status.
 */
export async function listReferrals(
  userId: string,
  db: Db = getDb(),
): Promise<ReferralListEntry[]> {
  const rows = await db.query.referrals.findMany({
    where: eq(referrals.referrerUserId, userId),
    orderBy: [desc(referrals.createdAt)],
    with: {
      referee: { columns: { fullName: true, phone: true } },
    },
  });

  return rows.map((row) => ({
    id: row.id,
    status: row.status,
    rewardPoints: row.rewardPoints,
    rewardedAt: row.rewardedAt,
    createdAt: row.createdAt,
    inviteeName: row.referee?.fullName ?? null,
    inviteePhone: maskPhone(row.referee?.phone ?? row.refereePhone ?? null),
  }));
}

/**
 * Builds the full referral summary used by the page and API: ensures a code,
 * lists invitees, and aggregates reward totals.
 */
export async function getReferralSummary(
  userId: string,
  db: Db = getDb(),
): Promise<ReferralSummary> {
  const [code, list] = await Promise.all([
    ensureReferralCode(userId, db),
    listReferrals(userId, db),
  ]);

  let qualifiedCount = 0;
  let rewardedCount = 0;
  let pendingCount = 0;
  let totalRewardPoints = 0;

  for (const entry of list) {
    if (entry.status === "QUALIFIED") {
      qualifiedCount++;
    } else if (entry.status === "REWARDED") {
      rewardedCount++;
    } else {
      pendingCount++;
    }
    totalRewardPoints += entry.rewardPoints;
  }

  return {
    code,
    totalInvited: list.length,
    qualifiedCount,
    rewardedCount,
    pendingCount,
    totalRewardPoints,
    referrals: list,
  };
}
