import { renewServer, ServiceError } from "@/lib/account/services";
import { apiError, apiOk } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth";

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/account/servers/[id]/renew
 *
 * Renews a server the caller owns. Ownership-guarded. Until a provider
 * integration exists, this extends `expiresAt` by the billing term.
 */
export async function POST(_request: Request, { params }: RouteContext) {
  const user = await getCurrentUser();
  if (!user) {
    return apiError("AUTH_REQUIRED", "ابتدا وارد شوید.", 401);
  }

  const { id } = await params;

  try {
    const server = await renewServer(user.id, id);
    return apiOk({
      server: {
        id: server.id,
        planCode: server.planCode,
        status: server.status,
        expiresAt: server.expiresAt,
      },
    });
  } catch (error) {
    if (error instanceof ServiceError) {
      const status = error.code === "NOT_FOUND" ? 404 : 400;
      return apiError(error.code, error.messageFa, status);
    }
    return apiError("INTERNAL", "تمدید سرور ممکن نشد.", 500);
  }
}
