import { and, desc, eq } from "drizzle-orm";

import { orderItems, orders, productReviews, products, productVariants } from "@/db/schema";
import { apiError, apiOk, readJson } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth";
import { getDb } from "@/lib/db";

type ReviewDto = {
  id: string;
  rating: number;
  titleFa: string | null;
  bodyFa: string;
  authorName: string;
  createdAt: string;
};

type ReviewAggregate = {
  count: number;
  average: number;
};

type CreateReviewPayload = {
  productId?: string;
  rating?: number;
  titleFa?: string;
  bodyFa?: string;
};

/**
 * Resolves a product id from an explicit `productId` or a `slug` query param.
 * Returns null when neither resolves to an existing product.
 */
async function resolveProductId(productId: string | null, slug: string | null) {
  const db = getDb();

  if (productId) {
    const found = await db.query.products.findFirst({
      where: eq(products.id, productId),
      columns: { id: true },
    });

    return found?.id ?? null;
  }

  if (slug) {
    const found = await db.query.products.findFirst({
      where: eq(products.slug, slug),
      columns: { id: true },
    });

    return found?.id ?? null;
  }

  return null;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const productId = searchParams.get("productId");
  const slug = searchParams.get("slug");

  if (!productId && !slug) {
    return apiError("MISSING_PRODUCT", "شناسه محصول مشخص نشده است.");
  }

  const resolvedProductId = await resolveProductId(productId, slug);

  if (!resolvedProductId) {
    return apiError("PRODUCT_NOT_FOUND", "محصول یافت نشد.", 404);
  }

  const rows = await getDb().query.productReviews.findMany({
    where: and(
      eq(productReviews.productId, resolvedProductId),
      eq(productReviews.status, "APPROVED"),
    ),
    orderBy: desc(productReviews.createdAt),
  });

  const reviews: ReviewDto[] = rows.map((row) => ({
    id: row.id,
    rating: row.rating,
    titleFa: row.titleFa,
    bodyFa: row.bodyFa,
    authorName: row.authorName?.trim() || "کاربر پیسکول",
    createdAt: row.createdAt.toISOString(),
  }));

  const count = reviews.length;
  const average =
    count === 0
      ? 0
      : Math.round((reviews.reduce((sum, review) => sum + review.rating, 0) / count) * 10) / 10;

  return apiOk({
    reviews,
    aggregate: { count, average } satisfies ReviewAggregate,
  });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();

  if (!user) {
    return apiError("UNAUTHENTICATED", "برای ثبت دیدگاه ابتدا وارد شوید.", 401);
  }

  const body = await readJson<CreateReviewPayload>(request);

  if (!body) {
    return apiError("INVALID_BODY", "اطلاعات ارسالی نامعتبر است.");
  }

  const productId = body.productId?.trim();

  if (!productId) {
    return apiError("MISSING_PRODUCT", "شناسه محصول مشخص نشده است.");
  }

  const rating = Number(body.rating);

  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    return apiError("INVALID_RATING", "امتیاز باید عددی بین ۱ تا ۵ باشد.");
  }

  const bodyFa = body.bodyFa?.trim();

  if (!bodyFa) {
    return apiError("MISSING_BODY", "متن دیدگاه را وارد کنید.");
  }

  if (bodyFa.length > 2000) {
    return apiError("BODY_TOO_LONG", "متن دیدگاه نباید بیش از ۲۰۰۰ نویسه باشد.");
  }

  const titleFa = body.titleFa?.trim() || null;

  if (titleFa && titleFa.length > 120) {
    return apiError("TITLE_TOO_LONG", "عنوان دیدگاه نباید بیش از ۱۲۰ نویسه باشد.");
  }

  const db = getDb();
  const product = await db.query.products.findFirst({
    where: eq(products.id, productId),
    columns: { id: true },
  });

  if (!product) {
    return apiError("PRODUCT_NOT_FOUND", "محصول یافت نشد.", 404);
  }

  // Verified-purchase gate: only a buyer (a PAID order containing this product)
  // may review it — blocks review spam from non-customers.
  const [purchased] = await db
    .select({ id: orderItems.id })
    .from(orderItems)
    .innerJoin(orders, eq(orderItems.orderId, orders.id))
    .innerJoin(productVariants, eq(orderItems.variantId, productVariants.id))
    .where(
      and(
        eq(orders.userId, user.id),
        eq(orders.paymentStatus, "PAID"),
        eq(productVariants.productId, productId),
      ),
    )
    .limit(1);

  if (!purchased) {
    return apiError("NOT_PURCHASED", "فقط خریداران این محصول می‌توانند دیدگاه ثبت کنند.", 403);
  }

  const authorName = user.fullName?.trim() || "کاربر پیسکول";

  try {
    const [created] = await db
      .insert(productReviews)
      .values({
        productId,
        userId: user.id,
        authorName,
        rating,
        titleFa,
        bodyFa,
      })
      .returning();

    return apiOk(
      {
        review: {
          id: created.id,
          rating: created.rating,
          titleFa: created.titleFa,
          bodyFa: created.bodyFa,
          authorName,
          createdAt: created.createdAt.toISOString(),
        } satisfies ReviewDto,
      },
      { status: 201 },
    );
  } catch (error) {
    // Unique index ProductReview_productId_userId_key → one review per user.
    if (isUniqueViolation(error)) {
      return apiError("DUPLICATE_REVIEW", "شما قبلاً برای این محصول دیدگاه ثبت کرده‌اید.", 409);
    }

    console.error("[reviews] create failed:", error);
    return apiError("INTERNAL", "ثبت دیدگاه ممکن نشد.", 500);
  }
}

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "23505"
  );
}
