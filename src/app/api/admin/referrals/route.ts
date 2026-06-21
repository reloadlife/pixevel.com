import type { ReferralStatus } from "@/db/schema";
import { referralStatus } from "@/db/schema";
import { getReferralStats, listReferrals } from "@/lib/admin/referrals";
import { apiError, apiOk } from "@/lib/api";
import { requireAdmin } from "@/lib/auth";

const VALID_STATUSES = referralStatus.enumValues;

function parseStatus(value: string | null): ReferralStatus | undefined {
  if (value && (VALID_STATUSES as readonly string[]).includes(value)) {
    return value as ReferralStatus;
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

/** Referral list (filtered, paginated) plus program-wide stats. */
export async function GET(request: Request) {
  const admin = await requireAdmin();

  if (!admin) {
    return apiError("UNAUTHORIZED", "دسترسی مجاز نیست.", 401);
  }

  const { searchParams } = new URL(request.url);

  const [list, stats] = await Promise.all([
    listReferrals({
      status: parseStatus(searchParams.get("status")),
      q: searchParams.get("q") ?? undefined,
      page: parseInt10(searchParams.get("page")),
      pageSize: parseInt10(searchParams.get("pageSize")),
    }),
    getReferralStats(),
  ]);

  return apiOk({ ...list, stats });
}
