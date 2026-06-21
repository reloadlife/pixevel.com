import { renewDomain, ServiceError } from "@/lib/account/services";
import { apiError, apiOk } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth";

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/domains/[id]/renew
 *
 * Renews a domain the caller owns. Ownership-guarded. Until a registrar
 * integration exists, this extends `expiresAt` by the registration term.
 */
export async function POST(_request: Request, { params }: RouteContext) {
  const user = await getCurrentUser();
  if (!user) {
    return apiError("AUTH_REQUIRED", "ابتدا وارد شوید.", 401);
  }

  const { id } = await params;

  try {
    const domain = await renewDomain(user.id, id);
    return apiOk({
      domain: {
        id: domain.id,
        domainName: domain.domainName,
        status: domain.status,
        expiresAt: domain.expiresAt,
      },
    });
  } catch (error) {
    if (error instanceof ServiceError) {
      const status = error.code === "NOT_FOUND" ? 404 : 400;
      return apiError(error.code, error.messageFa, status);
    }
    return apiError("INTERNAL", "تمدید دامنه ممکن نشد.", 500);
  }
}
