import {
  deleteAdminHomeBlock,
  type HomeBlockInput,
  toAdminHomeBlockRow,
  updateAdminHomeBlock,
} from "@/lib/admin/home-blocks";
import { apiError, apiOk, readJson } from "@/lib/api";
import { requireAdmin } from "@/lib/auth";

type HomeBlockPatchPayload = Partial<HomeBlockInput>;

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();

  if (!admin) {
    return apiError("UNAUTHORIZED", "دسترسی مجاز نیست.", 401);
  }

  const { id } = await context.params;
  const body = await readJson<HomeBlockPatchPayload>(request);

  if (!body) {
    return apiError("INVALID_BODY", "درخواست معتبر نیست.");
  }

  try {
    const block = await updateAdminHomeBlock(id, body);
    return apiOk({ block: toAdminHomeBlockRow(block) });
  } catch (error) {
    if (error instanceof Error && error.message === "HOME_BLOCK_NOT_FOUND") {
      return apiError("HOME_BLOCK_NOT_FOUND", "بلاک پیدا نشد.", 404);
    }

    if (error instanceof Error && error.message === "INVALID_TITLE") {
      return apiError("INVALID_TITLE", "عنوان بلاک معتبر نیست.");
    }

    if (error instanceof Error && error.message === "INVALID_TYPE") {
      return apiError("INVALID_TYPE", "نوع نمایش بلاک معتبر نیست.");
    }

    if (error instanceof Error && error.message === "INVALID_SOURCE") {
      return apiError("INVALID_SOURCE", "منبع محصولات بلاک معتبر نیست.");
    }

    return apiError("HOME_BLOCK_UPDATE_FAILED", "بلاک خانه ذخیره نشد.", 500);
  }
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();

  if (!admin) {
    return apiError("UNAUTHORIZED", "دسترسی مجاز نیست.", 401);
  }

  const { id } = await context.params;
  const block = await deleteAdminHomeBlock(id);

  if (!block) {
    return apiError("HOME_BLOCK_NOT_FOUND", "بلاک پیدا نشد.", 404);
  }

  return apiOk({ id: block.id });
}
