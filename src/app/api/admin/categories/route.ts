import {
  createAdminCategory,
  listAdminCategories,
  toAdminCategoryOption,
} from "@/lib/admin/taxonomy";
import { apiError, apiOk, readJson } from "@/lib/api";
import { requireAdmin } from "@/lib/auth";

export async function GET() {
  const admin = await requireAdmin();

  if (!admin) {
    return apiError("UNAUTHORIZED", "دسترسی مجاز نیست.", 401);
  }

  const categories = await listAdminCategories();

  return apiOk({ categories: categories.map(toAdminCategoryOption) });
}

export async function POST(request: Request) {
  const admin = await requireAdmin();

  if (!admin) {
    return apiError("UNAUTHORIZED", "دسترسی مجاز نیست.", 401);
  }

  const body = await readJson<Parameters<typeof createAdminCategory>[0]>(request);

  if (!body?.titleFa) {
    return apiError("INVALID_CATEGORY", "نام دسته الزامی است.");
  }

  try {
    const category = await createAdminCategory(body);
    return apiOk({ category }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === "INVALID_PARENT_CATEGORY") {
      return apiError("INVALID_PARENT_CATEGORY", "دسته والد معتبر نیست.");
    }

    return apiError("CATEGORY_CREATE_FAILED", "دسته ذخیره نشد.", 500);
  }
}
