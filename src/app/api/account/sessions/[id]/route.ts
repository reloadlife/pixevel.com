import { cookies } from "next/headers";
import { revokeSession, SessionError } from "@/lib/account/sessions";
import { apiError, apiOk } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth";
import { SESSION_COOKIE } from "@/lib/session";

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * DELETE /api/account/sessions/[id] — revokes one of the user's sessions.
 * Ownership is enforced in the lib. Revoking the current session also clears
 * the cookie, logging the user out of this device.
 */
export async function DELETE(_request: Request, { params }: RouteContext) {
  const user = await getCurrentUser();
  if (!user) {
    return apiError("AUTH_REQUIRED", "ابتدا وارد شوید.", 401);
  }

  const { id } = await params;

  try {
    const { wasCurrent } = await revokeSession(user.id, id);

    if (wasCurrent) {
      const cookieStore = await cookies();
      cookieStore.delete(SESSION_COOKIE);
    }

    return apiOk({ revoked: true, wasCurrent });
  } catch (error) {
    if (error instanceof SessionError) {
      const status = error.code === "NOT_FOUND" ? 404 : 400;
      return apiError(error.code, error.messageFa, status);
    }
    return apiError("INTERNAL", "لغو نشست ممکن نشد.", 500);
  }
}
