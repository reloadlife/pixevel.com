import {
  isValidRelationKind,
  listProductRelations,
  setProductRelations,
  toAdminRelationRow,
} from "@/lib/admin/product-relations";
import { apiError, apiOk, readJson } from "@/lib/api";
import { requireAdmin } from "@/lib/auth";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  if (!admin) return apiError("UNAUTHORIZED", "دسترسی مجاز نیست.", 401);

  const { id } = await context.params;
  const rows = await listProductRelations(id);
  return apiOk({ relations: rows.map(toAdminRelationRow) });
}

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  if (!admin) return apiError("UNAUTHORIZED", "دسترسی مجاز نیست.", 401);

  const { id } = await context.params;
  const body = await readJson<{ kind: string; relatedIds: string[] }>(request);

  if (!body?.kind || !Array.isArray(body.relatedIds)) {
    return apiError("INVALID_BODY", "درخواست معتبر نیست.");
  }

  if (!isValidRelationKind(body.kind)) {
    return apiError("INVALID_RELATION_KIND", "نوع رابطه معتبر نیست.");
  }

  try {
    await setProductRelations(id, body.kind, body.relatedIds);
    const rows = await listProductRelations(id);
    return apiOk({ relations: rows.map(toAdminRelationRow) });
  } catch (error) {
    if (error instanceof Error && error.message === "INVALID_RELATED_PRODUCT") {
      return apiError("INVALID_RELATED_PRODUCT", "یکی از محصولات مرتبط پیدا نشد.", 400);
    }
    return apiError("RELATIONS_UPDATE_FAILED", "روابط محصول ذخیره نشد.", 500);
  }
}
