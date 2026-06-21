import { apiError, apiOk, readJson } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth";
import { DomainManageError, setNameservers } from "@/lib/domains/manage";

interface RouteContext {
  params: Promise<{ id: string }>;
}

type Body = { nameservers?: unknown };

/** PUT /api/account/domains/[id]/nameservers — set custom NS ([] = registrar defaults). */
export async function PUT(request: Request, { params }: RouteContext) {
  const user = await getCurrentUser();
  if (!user) {
    return apiError("AUTH_REQUIRED", "ابتدا وارد شوید.", 401);
  }

  const { id } = await params;
  const body = (await readJson<Body>(request)) ?? {};
  const list = Array.isArray(body.nameservers) ? body.nameservers.map(String) : [];

  try {
    const result = await setNameservers(user.id, id, list);
    return apiOk(result);
  } catch (error) {
    if (error instanceof DomainManageError) {
      return apiError(error.code, error.messageFa, error.code === "NOT_FOUND" ? 404 : 400);
    }
    return apiError("INTERNAL", "ذخیره نِیم‌سرورها ممکن نشد.", 500);
  }
}
