import { apiError, apiOk, readJson } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth";
import { DomainManageError, deleteDnsRecord, updateDnsRecord } from "@/lib/domains/manage";

interface RouteContext {
  params: Promise<{ id: string; recordId: string }>;
}

type DnsBody = {
  type?: string;
  name?: string;
  value?: string;
  ttl?: number;
  priority?: number | null;
};

function fail(error: unknown, fallbackFa: string) {
  if (error instanceof DomainManageError) {
    const status = error.code === "NOT_FOUND" || error.code === "RECORD_NOT_FOUND" ? 404 : 400;
    return apiError(error.code, error.messageFa, status);
  }
  return apiError("INTERNAL", fallbackFa, 500);
}

/** PATCH /api/account/domains/[id]/dns/[recordId] — edit a DNS record. */
export async function PATCH(request: Request, { params }: RouteContext) {
  const user = await getCurrentUser();
  if (!user) {
    return apiError("AUTH_REQUIRED", "ابتدا وارد شوید.", 401);
  }

  const { id, recordId } = await params;
  const body = (await readJson<DnsBody>(request)) ?? {};

  try {
    const result = await updateDnsRecord(user.id, id, recordId, {
      type: body.type as never,
      name: body.name ?? "@",
      value: body.value ?? "",
      ttl: body.ttl,
      priority: body.priority,
    });
    return apiOk(result);
  } catch (error) {
    return fail(error, "ویرایش رکورد ممکن نشد.");
  }
}

/** DELETE /api/account/domains/[id]/dns/[recordId] — remove a DNS record. */
export async function DELETE(_request: Request, { params }: RouteContext) {
  const user = await getCurrentUser();
  if (!user) {
    return apiError("AUTH_REQUIRED", "ابتدا وارد شوید.", 401);
  }

  const { id, recordId } = await params;
  try {
    const result = await deleteDnsRecord(user.id, id, recordId);
    return apiOk(result);
  } catch (error) {
    return fail(error, "حذف رکورد ممکن نشد.");
  }
}
