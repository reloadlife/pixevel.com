import { apiError, apiOk, readJson } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth";
import { createDnsRecord, DomainManageError, getManagedDomain } from "@/lib/domains/manage";

interface RouteContext {
  params: Promise<{ id: string }>;
}

/** GET /api/account/domains/[id]/dns — list this domain's DNS records. */
export async function GET(_request: Request, { params }: RouteContext) {
  const user = await getCurrentUser();
  if (!user) {
    return apiError("AUTH_REQUIRED", "ابتدا وارد شوید.", 401);
  }

  const { id } = await params;
  try {
    const { records } = await getManagedDomain(user.id, id);
    return apiOk({ records });
  } catch (error) {
    if (error instanceof DomainManageError) {
      return apiError(error.code, error.messageFa, error.code === "NOT_FOUND" ? 404 : 400);
    }
    return apiError("INTERNAL", "دریافت رکوردها ممکن نشد.", 500);
  }
}

type DnsBody = {
  type?: string;
  name?: string;
  value?: string;
  ttl?: number;
  priority?: number | null;
};

/** POST /api/account/domains/[id]/dns — create a DNS record. */
export async function POST(request: Request, { params }: RouteContext) {
  const user = await getCurrentUser();
  if (!user) {
    return apiError("AUTH_REQUIRED", "ابتدا وارد شوید.", 401);
  }

  const { id } = await params;
  const body = (await readJson<DnsBody>(request)) ?? {};

  try {
    const result = await createDnsRecord(user.id, id, {
      type: body.type as never,
      name: body.name ?? "@",
      value: body.value ?? "",
      ttl: body.ttl,
      priority: body.priority,
    });
    return apiOk(result);
  } catch (error) {
    if (error instanceof DomainManageError) {
      return apiError(error.code, error.messageFa, error.code === "NOT_FOUND" ? 404 : 400);
    }
    return apiError("INTERNAL", "افزودن رکورد ممکن نشد.", 500);
  }
}
