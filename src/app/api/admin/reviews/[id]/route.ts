import type { ReviewStatus } from "@/db/schema";
import { reviewStatus } from "@/db/schema";
import { deleteReview, setReviewStatus } from "@/lib/admin/reviews";
import { apiError, apiOk, readJson } from "@/lib/api";
import { requireAdmin } from "@/lib/auth";

type ReviewPatchPayload = {
  status?: string;
};

const VALID_STATUSES = reviewStatus.enumValues;

function isReviewStatus(value: unknown): value is ReviewStatus {
  return typeof value === "string" && (VALID_STATUSES as readonly string[]).includes(value);
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();

  if (!admin) {
    return apiError("UNAUTHORIZED", "دسترسی مجاز نیست.", 401);
  }

  const { id } = await context.params;
  const body = await readJson<ReviewPatchPayload>(request);

  if (!body || !isReviewStatus(body.status)) {
    return apiError("INVALID_BODY", "وضعیت نظر معتبر نیست.");
  }

  const review = await setReviewStatus(id, body.status);

  if (!review) {
    return apiError("REVIEW_NOT_FOUND", "نظر پیدا نشد.", 404);
  }

  return apiOk({ review });
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();

  if (!admin) {
    return apiError("UNAUTHORIZED", "دسترسی مجاز نیست.", 401);
  }

  const { id } = await context.params;
  const removed = await deleteReview(id);

  if (!removed) {
    return apiError("REVIEW_NOT_FOUND", "نظر پیدا نشد.", 404);
  }

  return apiOk({ id });
}
