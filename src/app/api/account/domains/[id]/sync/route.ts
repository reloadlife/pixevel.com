import { apiError, apiOk } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth";
import { DomainManageError, syncFromRegistrar } from "@/lib/domains/manage";

interface RouteContext {
  params: Promise<{ id: string }>;
}

/** POST /api/account/domains/[id]/sync — reconcile status/expiry/NS from the registrar. */
export async function POST(_request: Request, { params }: RouteContext) {
  const user = await getCurrentUser();
  if (!user) {
    return apiError("AUTH_REQUIRED", "ابتدا وارد شوید.", 401);
  }

  const { id } = await params;
  try {
    const { domain, synced } = await syncFromRegistrar(user.id, id);
    return apiOk({
      synced,
      domain: {
        id: domain.id,
        status: domain.status,
        expiresAt: domain.expiresAt,
        nameservers: domain.nameservers,
        lastSyncedAt: domain.lastSyncedAt,
      },
    });
  } catch (error) {
    if (error instanceof DomainManageError) {
      return apiError(error.code, error.messageFa, error.code === "NOT_FOUND" ? 404 : 400);
    }
    return apiError("INTERNAL", "همگام‌سازی ممکن نشد.", 500);
  }
}
