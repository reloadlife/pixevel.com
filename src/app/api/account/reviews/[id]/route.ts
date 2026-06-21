import { eq } from "drizzle-orm";

import { productReviews } from "@/db/schema";
import { getMyReview, validateReviewEdit } from "@/lib/account/reviews";
import { apiError, apiOk, readJson } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth";
import { getDb } from "@/lib/db";

interface RouteContext {
  params: Promise<{ id: string }>;
}

type EditReviewPayload = {
  rating?: number;
  titleFa?: string;
  bodyFa?: string;
};

export async function PATCH(request: Request, { params }: RouteContext) {
  const user = await getCurrentUser();

  if (!user) {
    return apiError("AUTH_REQUIRED", "ابتدا وارد شوید.", 401);
  }

  const { id } = await params;
  const existing = await getMyReview(user.id, id);

  if (!existing) {
    return apiError("REVIEW_NOT_FOUND", "دیدگاه یافت نشد.", 404);
  }

  const body = await readJson<EditReviewPayload>(request);

  if (!body) {
    return apiError("INVALID_BODY", "اطلاعات ارسالی نامعتبر است.");
  }

  const validated = validateReviewEdit(body);

  if (!validated.ok) {
    return apiError(validated.code, validated.message);
  }

  // Editing resets the review to PENDING so it is re-moderated before showing.
  const [updated] = await getDb()
    .update(productReviews)
    .set({
      rating: validated.value.rating,
      titleFa: validated.value.titleFa,
      bodyFa: validated.value.bodyFa,
      status: "PENDING",
      updatedAt: new Date(),
    })
    .where(eq(productReviews.id, id))
    .returning();

  return apiOk({
    review: {
      id: updated.id,
      rating: updated.rating,
      titleFa: updated.titleFa,
      bodyFa: updated.bodyFa,
      status: updated.status,
      updatedAt: updated.updatedAt.toISOString(),
    },
  });
}

export async function DELETE(_request: Request, { params }: RouteContext) {
  const user = await getCurrentUser();

  if (!user) {
    return apiError("AUTH_REQUIRED", "ابتدا وارد شوید.", 401);
  }

  const { id } = await params;
  const existing = await getMyReview(user.id, id);

  if (!existing) {
    return apiError("REVIEW_NOT_FOUND", "دیدگاه یافت نشد.", 404);
  }

  await getDb().delete(productReviews).where(eq(productReviews.id, id));

  return apiOk({ deleted: true });
}
