import { type SubscriptionStatus, subscriptionStatus } from "@/db/schema";
import { apiError, apiOk } from "@/lib/api";
import { requireAdmin } from "@/lib/auth";
import { listAdminSubscriptions } from "@/lib/subscriptions/query";

const STATUS_VALUES = new Set<string>(subscriptionStatus.enumValues);

export async function GET(request: Request) {
  const admin = await requireAdmin();

  if (!admin) {
    return apiError("UNAUTHORIZED", "دسترسی مجاز نیست.", 401);
  }

  const { searchParams } = new URL(request.url);
  const statusParam = searchParams.get("status");
  const userId = searchParams.get("userId") || undefined;
  const pageRaw = Number(searchParams.get("page"));
  const pageSizeRaw = Number(searchParams.get("pageSize"));

  if (statusParam && !STATUS_VALUES.has(statusParam)) {
    return apiError("INVALID_STATUS", "وضعیت اشتراک معتبر نیست.");
  }

  const result = await listAdminSubscriptions({
    status: (statusParam as SubscriptionStatus) || undefined,
    userId,
    page: Number.isFinite(pageRaw) && pageRaw > 0 ? pageRaw : undefined,
    pageSize: Number.isFinite(pageSizeRaw) && pageSizeRaw > 0 ? pageSizeRaw : undefined,
  });

  return apiOk(result);
}
