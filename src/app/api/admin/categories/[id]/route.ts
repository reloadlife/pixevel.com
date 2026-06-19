import { apiError, apiOk, readJson } from "@/lib/api";
import { requireAdmin } from "@/lib/auth";
import { updateAdminCategory } from "@/lib/admin/taxonomy";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const admin = await requireAdmin();

  if (!admin) {
    return apiError("UNAUTHORIZED", "دسترسی مجاز نیست.", 401);
  }

  const { id } = await context.params;
  const body = await readJson<Parameters<typeof updateAdminCategory>[1]>(request);

  if (!body) {
    return apiError("INVALID_BODY", "درخواست معتبر نیست.");
  }

  try {
    const category = await updateAdminCategory(id, body);
    return apiOk({ category });
  } catch (error) {
    if (error instanceof Error && error.message === "CATEGORY_NOT_FOUND") {
      return apiError("CATEGORY_NOT_FOUND", "دسته پیدا نشد.", 404);
    }

    if (error instanceof Error && error.message === "INVALID_PARENT_CATEGORY") {
      return apiError("INVALID_PARENT_CATEGORY", "دسته والد معتبر نیست.");
    }

    return apiError("CATEGORY_UPDATE_FAILED", "دسته ذخیره نشد.", 500);
  }
}
