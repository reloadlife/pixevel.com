import { listActiveSessions } from "@/lib/account/sessions";
import { apiError, apiOk } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

/** GET /api/account/sessions — lists the user's active sessions, current flagged. */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return apiError("AUTH_REQUIRED", "ابتدا وارد شوید.", 401);
  }

  try {
    const sessions = await listActiveSessions(user.id);
    return apiOk({
      sessions: sessions.map((s) => ({
        id: s.id,
        createdAt: s.createdAt.toISOString(),
        expiresAt: s.expiresAt.toISOString(),
        isCurrent: s.isCurrent,
      })),
    });
  } catch {
    return apiError("INTERNAL", "دریافت نشست‌ها ممکن نشد.", 500);
  }
}
