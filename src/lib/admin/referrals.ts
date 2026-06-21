import { and, count, desc, eq, ilike, inArray, or, type SQL, sum } from "drizzle-orm";

import type { ReferralStatus } from "@/db/schema";
import { referrals, users } from "@/db/schema";
import { getDb } from "@/lib/db";

// ─── Types ──────────────────────────────────────────────────────────────────

export type ListReferralsParams = {
  status?: ReferralStatus;
  q?: string;
  page?: number;
  pageSize?: number;
};

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

function clampPageSize(value: number | undefined) {
  if (!value || !Number.isFinite(value) || value < 1) {
    return DEFAULT_PAGE_SIZE;
  }
  return Math.min(Math.floor(value), MAX_PAGE_SIZE);
}

function clampPage(value: number | undefined) {
  if (!value || !Number.isFinite(value) || value < 1) {
    return 1;
  }
  return Math.floor(value);
}

// ─── List ─────────────────────────────────────────────────────────────────────

/**
 * Lists referrals newest-first with both parties' phones/names, optionally
 * filtered by status, with pagination metadata. The optional `q` filter matches
 * either party's phone or name, plus the stored `refereePhone` for invitees who
 * have not registered yet.
 *
 * Referrer/referee rows are batch-loaded and stitched in JS rather than via an
 * aliased self-join (the self-join's partial select trips Drizzle's type
 * inference into `never`).
 */
export async function listReferrals(params: ListReferralsParams = {}) {
  const db = getDb();

  const page = clampPage(params.page);
  const pageSize = clampPageSize(params.pageSize);
  const offset = (page - 1) * pageSize;
  const q = params.q?.trim();

  // When searching, first resolve the user ids whose name/phone match.
  let matchedUserIds: string[] = [];
  if (q) {
    const term = `%${q}%`;
    const matched = await db
      .select({ id: users.id })
      .from(users)
      .where(or(ilike(users.phone, term), ilike(users.fullName, term)));
    matchedUserIds = matched.map((m) => m.id);
  }

  const filters: SQL[] = [];
  if (params.status) {
    filters.push(eq(referrals.status, params.status));
  }
  if (q) {
    const term = `%${q}%`;
    const ors: SQL[] = [ilike(referrals.refereePhone, term)];
    if (matchedUserIds.length > 0) {
      ors.push(inArray(referrals.referrerUserId, matchedUserIds));
      ors.push(inArray(referrals.refereeUserId, matchedUserIds));
    }
    const search = or(...ors);
    if (search) {
      filters.push(search);
    }
  }
  const where = filters.length > 0 ? and(...filters) : undefined;

  const rows = await db
    .select()
    .from(referrals)
    .where(where)
    .orderBy(desc(referrals.createdAt))
    .limit(pageSize)
    .offset(offset);

  // Batch-load the referrer + referee user rows referenced on this page.
  const ids = [
    ...new Set(
      rows.flatMap((r) => [r.referrerUserId, r.refereeUserId]).filter((id): id is string => !!id),
    ),
  ];
  const userRows = ids.length
    ? await db
        .select({ id: users.id, fullName: users.fullName, phone: users.phone })
        .from(users)
        .where(inArray(users.id, ids))
    : [];
  const userMap = new Map(userRows.map((u) => [u.id, u]));

  const items = rows.map((row) => {
    const ref = userMap.get(row.referrerUserId);
    const ree = row.refereeUserId ? userMap.get(row.refereeUserId) : undefined;
    return {
      id: row.id,
      status: row.status,
      rewardPoints: row.rewardPoints,
      rewardedAt: row.rewardedAt?.toISOString() ?? null,
      createdAt: row.createdAt.toISOString(),
      referrer: ref?.fullName?.trim() || ref?.phone || "کاربر",
      referrerPhone: ref?.phone ?? null,
      referee: ree?.fullName?.trim() || ree?.phone || row.refereePhone || null,
      refereePhone: ree?.phone ?? row.refereePhone,
    };
  });

  const [{ value: total }] = await db.select({ value: count() }).from(referrals).where(where);

  return {
    referrals: items,
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    },
  };
}

export type AdminReferralRow = Awaited<ReturnType<typeof listReferrals>>["referrals"][number];

// ─── Stats ────────────────────────────────────────────────────────────────────

export type ReferralStats = {
  total: number;
  pending: number;
  qualified: number;
  rewarded: number;
  totalRewardPoints: number;
};

/** Aggregate program activity: counts by status and total reward points paid. */
export async function getReferralStats(): Promise<ReferralStats> {
  const db = getDb();

  const [byStatus, [points]] = await Promise.all([
    db
      .select({ status: referrals.status, value: count() })
      .from(referrals)
      .groupBy(referrals.status),
    db.select({ value: sum(referrals.rewardPoints) }).from(referrals),
  ]);

  const stats: ReferralStats = {
    total: 0,
    pending: 0,
    qualified: 0,
    rewarded: 0,
    totalRewardPoints: Number(points?.value ?? 0),
  };

  for (const row of byStatus) {
    stats.total += row.value;
    if (row.status === "PENDING") {
      stats.pending = row.value;
    } else if (row.status === "QUALIFIED") {
      stats.qualified = row.value;
    } else if (row.status === "REWARDED") {
      stats.rewarded = row.value;
    }
  }

  return stats;
}
