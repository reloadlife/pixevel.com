import type { ReviewStatus } from "@/db/schema";
import { reviewStatus } from "@/db/schema";
import { listReviews } from "@/lib/admin/reviews";
import { apiError, apiOk } from "@/lib/api";
import { requireAdmin } from "@/lib/auth";

const VALID_STATUSES = reviewStatus.enumValues;

function parseStatus(value: string | null): ReviewStatus | undefined {
  if (value && (VALID_STATUSES as readonly string[]).includes(value)) {
    return value as ReviewStatus;
  }
  return undefined;
}

function parseInt10(value: string | null): number | undefined {
  if (!value) {
    return undefined;
  }
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? undefined : parsed;
}

export async function GET(request: Request) {
  const admin = await requireAdmin();

  if (!admin) {
    return apiError("UNAUTHORIZED", "دسترسی مجاز نیست.", 401);
  }

  const { searchParams } = new URL(request.url);

  const result = await listReviews({
    status: parseStatus(searchParams.get("status")),
    productId: searchParams.get("productId") ?? undefined,
    page: parseInt10(searchParams.get("page")),
    pageSize: parseInt10(searchParams.get("pageSize")),
  });

  return apiOk(result);
}
