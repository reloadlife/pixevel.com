import { and, count, desc, eq, inArray, type SQL } from "drizzle-orm";

import type { ReviewStatus } from "@/db/schema";
import { orderItems, orders, productReviews, products, productVariants } from "@/db/schema";
import { getDb } from "@/lib/db";

// ─── Types ──────────────────────────────────────────────────────────────────

export type ListReviewsParams = {
  status?: ReviewStatus;
  productId?: string;
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
 * List product reviews newest-first, joined to the product title and resolved
 * author label, with pagination metadata and per-status counts for the
 * moderation queue.
 */
export async function listReviews(params: ListReviewsParams = {}) {
  const db = getDb();

  const page = clampPage(params.page);
  const pageSize = clampPageSize(params.pageSize);
  const offset = (page - 1) * pageSize;

  const filters: SQL[] = [];
  if (params.status) {
    filters.push(eq(productReviews.status, params.status));
  }
  if (params.productId) {
    filters.push(eq(productReviews.productId, params.productId));
  }
  const where = filters.length > 0 ? and(...filters) : undefined;

  const rows = await db
    .select({
      id: productReviews.id,
      productId: productReviews.productId,
      productTitleFa: products.titleFa,
      productSlug: products.slug,
      userId: productReviews.userId,
      authorName: productReviews.authorName,
      rating: productReviews.rating,
      titleFa: productReviews.titleFa,
      bodyFa: productReviews.bodyFa,
      status: productReviews.status,
      isVerifiedPurchase: productReviews.isVerifiedPurchase,
      helpfulCount: productReviews.helpfulCount,
      createdAt: productReviews.createdAt,
      updatedAt: productReviews.updatedAt,
    })
    .from(productReviews)
    .innerJoin(products, eq(productReviews.productId, products.id))
    .where(where)
    .orderBy(desc(productReviews.createdAt))
    .limit(pageSize)
    .offset(offset);

  const [{ value: total }] = await db.select({ value: count() }).from(productReviews).where(where);

  const counts = await getStatusCounts(params.productId);

  const reviews = rows.map((row) => ({
    ...row,
    author: row.authorName?.trim() || (row.userId ? "کاربر ثبت‌نام‌شده" : "مهمان"),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }));

  return {
    reviews,
    counts,
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    },
  };
}

export type AdminReviewRow = Awaited<ReturnType<typeof listReviews>>["reviews"][number];
export type ReviewStatusCounts = Awaited<ReturnType<typeof getStatusCounts>>;

/** Count reviews grouped by status (optionally scoped to one product). */
export async function getStatusCounts(productId?: string) {
  const db = getDb();

  const rows = await db
    .select({ status: productReviews.status, value: count() })
    .from(productReviews)
    .where(productId ? eq(productReviews.productId, productId) : undefined)
    .groupBy(productReviews.status);

  const counts = { PENDING: 0, APPROVED: 0, REJECTED: 0, total: 0 };
  for (const row of rows) {
    counts[row.status] = row.value;
    counts.total += row.value;
  }
  return counts;
}

// ─── Mutations ─────────────────────────────────────────────────────────────────

/** Set a review's moderation status. Returns the updated row or null. */
export async function setReviewStatus(id: string, status: ReviewStatus) {
  const [updated] = await getDb()
    .update(productReviews)
    .set({ status, updatedAt: new Date() })
    .where(eq(productReviews.id, id))
    .returning({
      id: productReviews.id,
      status: productReviews.status,
      updatedAt: productReviews.updatedAt,
    });

  return updated ?? null;
}

/** Permanently delete a review. Returns true when a row was removed. */
export async function deleteReview(id: string) {
  const deleted = await getDb()
    .delete(productReviews)
    .where(eq(productReviews.id, id))
    .returning({ id: productReviews.id });

  return deleted.length > 0;
}

// ─── Backfill ─────────────────────────────────────────────────────────────────

/**
 * Backfill `isVerifiedPurchase` for existing reviews.
 *
 * A review is considered a verified purchase when the review's author (userId)
 * has at least one PAID order that contains an item whose variant belongs to
 * the same product as the review.
 *
 * Safe to call multiple times — it only sets rows to `true`, never clears them.
 * Does NOT run automatically on import; call explicitly from an admin action
 * or a one-off migration script.
 *
 * @returns Number of reviews updated from false → true.
 */
export async function recomputeVerifiedPurchase(): Promise<number> {
  const db = getDb();

  // Fetch all reviews that are not yet marked as verified and have a userId.
  const unverified = await db
    .select({
      id: productReviews.id,
      userId: productReviews.userId,
      productId: productReviews.productId,
    })
    .from(productReviews)
    .where(and(eq(productReviews.isVerifiedPurchase, false)));

  if (unverified.length === 0) return 0;

  // For each unverified review, check whether the user has a paid order
  // containing a variant that belongs to the review's product.
  //
  // We do this in one batched query: join orders → orderItems → productVariants
  // and filter by the (userId, productId) pairs we care about.
  const userIds = [...new Set(unverified.map((r) => r.userId).filter(Boolean))] as string[];
  const productIds = [...new Set(unverified.map((r) => r.productId))];

  if (userIds.length === 0) return 0;

  const paidPairs = await db
    .selectDistinct({
      userId: orders.userId,
      productId: productVariants.productId,
    })
    .from(orders)
    .innerJoin(orderItems, eq(orderItems.orderId, orders.id))
    .innerJoin(productVariants, eq(productVariants.id, orderItems.variantId))
    .where(
      and(
        eq(orders.paymentStatus, "PAID"),
        inArray(orders.userId, userIds),
        inArray(productVariants.productId, productIds),
      ),
    );

  // Build a Set of "userId:productId" strings for O(1) lookup.
  const paidSet = new Set(paidPairs.map((p) => `${p.userId}:${p.productId}`));

  const toVerify = unverified
    .filter((r) => r.userId && paidSet.has(`${r.userId}:${r.productId}`))
    .map((r) => r.id);

  if (toVerify.length === 0) return 0;

  await db
    .update(productReviews)
    .set({ isVerifiedPurchase: true, updatedAt: new Date() })
    .where(inArray(productReviews.id, toVerify));

  return toVerify.length;
}
