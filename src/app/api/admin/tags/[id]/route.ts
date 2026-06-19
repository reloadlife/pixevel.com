import { apiError, apiOk, readJson } from "@/lib/api";
import { updateAdminTag } from "@/lib/admin/taxonomy";
import { requireAdmin } from "@/lib/auth";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const admin = await requireAdmin();

  if (!admin) {
    return apiError("UNAUTHORIZED", "دسترسی مجاز نیست.", 401);
  }

  const { id } = await context.params;
  const body = await readJson<Parameters<typeof updateAdminTag>[1]>(request);

  if (!body) {
    return apiError("INVALID_BODY", "درخواست معتبر نیست.");
  }

  try {
    const tag = await updateAdminTag(id, body);
    return apiOk({ tag });
  } catch (error) {
    if (error instanceof Error && error.message === "TAG_NOT_FOUND") {
      return apiError("TAG_NOT_FOUND", "تگ پیدا نشد.", 404);
    }

    return apiError("TAG_UPDATE_FAILED", "تگ ذخیره نشد.", 500);
  }
}
