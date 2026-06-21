import {
  computeTier,
  getLoyaltyOverview,
  LOYALTY_EARN_RATE,
  LOYALTY_MIN_REDEEM,
  LOYALTY_POINT_VALUE_TOMAN,
} from "@/lib/account/loyalty";
import { apiError, apiOk } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth";

/**
 * GET /api/account/loyalty
 * Returns the user's loyalty account (balance, tier, lifetime), the redemption
 * rules, and recent transaction history.
 */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return apiError("AUTH_REQUIRED", "ابتدا وارد شوید.", 401);
  }

  try {
    const overview = await getLoyaltyOverview(user.id);

    return apiOk({
      account: {
        pointsBalance: overview.account.pointsBalance,
        lifetimePoints: overview.account.lifetimePoints,
        tier: computeTier(overview.account.lifetimePoints),
      },
      nextTier: overview.nextTier,
      rules: {
        earnRate: LOYALTY_EARN_RATE,
        pointValueToman: LOYALTY_POINT_VALUE_TOMAN,
        minRedeem: LOYALTY_MIN_REDEEM,
      },
      transactions: overview.transactions.map((t) => ({
        id: t.id,
        points: t.points,
        reason: t.reason,
        orderId: t.orderId,
        note: t.note,
        createdAt: t.createdAt,
      })),
    });
  } catch {
    return apiError("INTERNAL", "دریافت اطلاعات باشگاه مشتریان ممکن نشد.", 500);
  }
}
