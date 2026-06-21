import { listMyReviews } from "@/lib/account/reviews";
import { apiError, apiOk } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth";

export async function GET() {
  const user = await getCurrentUser();

  if (!user) {
    return apiError("AUTH_REQUIRED", "ابتدا وارد شوید.", 401);
  }

  const reviews = await listMyReviews(user.id);

  return apiOk({ reviews });
}
