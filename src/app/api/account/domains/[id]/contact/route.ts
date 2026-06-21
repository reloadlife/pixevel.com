import { apiError, apiOk, readJson } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth";
import { DomainManageError, type RegistrantContact, updateContact } from "@/lib/domains/manage";

interface RouteContext {
  params: Promise<{ id: string }>;
}

/** PUT /api/account/domains/[id]/contact — update registrant (WHOIS) contact. */
export async function PUT(request: Request, { params }: RouteContext) {
  const user = await getCurrentUser();
  if (!user) {
    return apiError("AUTH_REQUIRED", "ابتدا وارد شوید.", 401);
  }

  const { id } = await params;
  const body = (await readJson<RegistrantContact>(request)) ?? {};

  try {
    const result = await updateContact(user.id, id, body);
    return apiOk(result);
  } catch (error) {
    if (error instanceof DomainManageError) {
      return apiError(error.code, error.messageFa, error.code === "NOT_FOUND" ? 404 : 400);
    }
    return apiError("INTERNAL", "ذخیره اطلاعات تماس ممکن نشد.", 500);
  }
}
