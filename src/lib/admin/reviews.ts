import { and, count, desc, eq, type SQL } from "drizzle-orm";

import type { ReviewStatus } from "@/db/schema";
import { productReviews, products } from "@/db/schema";
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
