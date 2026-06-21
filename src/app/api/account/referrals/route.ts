import {
  getReferralSummary,
  REFERRAL_REFEREE_WELCOME_POINTS,
  REFERRAL_REFERRER_POINTS,
} from "@/lib/account/referrals";
import { apiError, apiOk } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth";
import { getDb } from "@/lib/db";

/**
 * GET /api/account/referrals
 * Ensures the authenticated user has a referral code (generating a unique one
 * when missing), then returns the code, the list of invited users with their
 * reward status, and aggregate totals. Suitable for the web account UI and a
 * future Android client.
 */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return apiError("AUTH_REQUIRED", "ابتدا وارد شوید.", 401);
  }

  const db = getDb();
  const summary = await getReferralSummary(user.id, db);

  return apiOk({
    code: summary.code,
    totals: {
      totalInvited: summary.totalInvited,
      qualifiedCount: summary.qualifiedCount,
      rewardedCount: summary.rewardedCount,
      pendingCount: summary.pendingCount,
      totalRewardPoints: summary.totalRewardPoints,
    },
    rewards: {
      referrerPoints: REFERRAL_REFERRER_POINTS,
      refereeWelcomePoints: REFERRAL_REFEREE_WELCOME_POINTS,
    },
    referrals: summary.referrals,
  });
}
