import { desc, eq } from "drizzle-orm";

import { productReviews, type ReviewStatus } from "@/db/schema";
import { getDb } from "@/lib/db";

/**
 * Stable, client-facing shape for one of the current user's product reviews.
 * `productSlug` is null only if the product was hard-deleted (relation broken).
 */
export type MyReviewDto = {
  id: string;
  rating: number;
  titleFa: string | null;
  bodyFa: string;
  status: ReviewStatus;
  createdAt: string;
  updatedAt: string;
  product: {
    id: string;
    slug: string | null;
    titleFa: string;
    imageUrl: string | null;
  } | null;
};

const RATING_MIN = 1;
const RATING_MAX = 5;
const TITLE_MAX = 120;
const BODY_MAX = 2000;

/**
 * Validates an incoming edit payload. Returns either a normalized patch or a
 * machine-readable error code + Persian message ready for `apiError`.
 */
export function validateReviewEdit(input: {
  rating?: unknown;
  titleFa?: unknown;
  bodyFa?: unknown;
}):
  | { ok: true; value: { rating: number; titleFa: string | null; bodyFa: string } }
  | { ok: false; code: string; message: string } {
  const rating = Number(input.rating);
  if (!Number.isInteger(rating) || rating < RATING_MIN || rating > RATING_MAX) {
    return { ok: false, code: "INVALID_RATING", message: "امتیاز باید عددی بین ۱ تا ۵ باشد." };
  }

  const bodyRaw = typeof input.bodyFa === "string" ? input.bodyFa.trim() : "";
  if (!bodyRaw) {
    return { ok: false, code: "MISSING_BODY", message: "متن دیدگاه را وارد کنید." };
  }
  if (bodyRaw.length > BODY_MAX) {
    return {
      ok: false,
      code: "BODY_TOO_LONG",
      message: "متن دیدگاه نباید بیش از ۲۰۰۰ نویسه باشد.",
    };
  }

  const titleRaw = typeof input.titleFa === "string" ? input.titleFa.trim() : "";
  if (titleRaw.length > TITLE_MAX) {
    return {
      ok: false,
      code: "TITLE_TOO_LONG",
      message: "عنوان دیدگاه نباید بیش از ۱۲۰ نویسه باشد.",
    };
  }

  return {
    ok: true,
    value: { rating, titleFa: titleRaw || null, bodyFa: bodyRaw },
  };
}

/** Loads all reviews authored by `userId`, newest first, with product info. */
export async function listMyReviews(userId: string): Promise<MyReviewDto[]> {
  const rows = await getDb().query.productReviews.findMany({
    where: eq(productReviews.userId, userId),
    orderBy: desc(productReviews.createdAt),
    with: {
      product: {
        columns: { id: true, slug: true, titleFa: true, primaryImageUrl: true },
      },
    },
  });

  return rows.map((row) => ({
    id: row.id,
    rating: row.rating,
    titleFa: row.titleFa,
    bodyFa: row.bodyFa,
    status: row.status,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    product: row.product
      ? {
          id: row.product.id,
          slug: row.product.slug,
          titleFa: row.product.titleFa,
          imageUrl: row.product.primaryImageUrl,
        }
      : null,
  }));
}

/** Fetches a single review by id scoped to its owner; null if not owned/found. */
export async function getMyReview(userId: string, reviewId: string) {
  const review = await getDb().query.productReviews.findFirst({
    where: eq(productReviews.id, reviewId),
  });

  if (!review || review.userId !== userId) {
    return null;
  }

  return review;
}
