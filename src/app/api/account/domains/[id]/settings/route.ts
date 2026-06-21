import { apiError, apiOk, readJson } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth";
import { DomainManageError, updateSettings } from "@/lib/domains/manage";

interface RouteContext {
  params: Promise<{ id: string }>;
}

type Body = {
  autoRenew?: boolean;
  transferLock?: boolean;
  privacyProtection?: boolean;
};

/** PATCH /api/account/domains/[id]/settings — auto-renew / transfer-lock / privacy. */
export async function PATCH(request: Request, { params }: RouteContext) {
  const user = await getCurrentUser();
  if (!user) {
    return apiError("AUTH_REQUIRED", "ابتدا وارد شوید.", 401);
  }

  const { id } = await params;
  const body = (await readJson<Body>(request)) ?? {};

  try {
    const result = await updateSettings(user.id, id, {
      autoRenew: body.autoRenew,
      transferLock: body.transferLock,
      privacyProtection: body.privacyProtection,
    });
    return apiOk(result);
  } catch (error) {
    if (error instanceof DomainManageError) {
      return apiError(error.code, error.messageFa, error.code === "NOT_FOUND" ? 404 : 400);
    }
    return apiError("INTERNAL", "ذخیره تنظیمات ممکن نشد.", 500);
  }
}
