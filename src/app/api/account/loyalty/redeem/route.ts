import { computeTier, LoyaltyError, redeemPoints } from "@/lib/account/loyalty";
import { apiError, apiOk, readJson } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth";

type RedeemBody = { points?: number };

/**
 * POST /api/account/loyalty/redeem  { points }
 * Converts loyalty points to wallet credit (1 point = 100 Toman, min 100 pts).
 * Atomic: decrements points, writes a REDEEM ledger row, credits the wallet.
 */
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return apiError("AUTH_REQUIRED", "ابتدا وارد شوید.", 401);
  }

  const body = (await readJson<RedeemBody>(request)) ?? {};
  const points = Number(body.points);

  if (!Number.isFinite(points) || points <= 0) {
    return apiError("INVALID_POINTS", "تعداد امتیاز نامعتبر است.", 400);
  }

  try {
    const result = await redeemPoints({ userId: user.id, points: Math.floor(points) });

    return apiOk({
      pointsRedeemed: result.pointsRedeemed,
      walletCreditToman: result.walletCreditToman,
      account: {
        pointsBalance: result.account.pointsBalance,
        lifetimePoints: result.account.lifetimePoints,
        tier: computeTier(result.account.lifetimePoints),
      },
    });
  } catch (error) {
    if (error instanceof LoyaltyError) {
      const status = error.code === "INSUFFICIENT_POINTS" ? 409 : 400;
      return apiError(error.code, error.message, status);
    }
    return apiError("INTERNAL", "تبدیل امتیاز ممکن نشد.", 500);
  }
}
