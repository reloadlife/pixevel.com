import { apiError, apiOk, readJson } from "@/lib/api";
import { toAdminProductRow, updateAdminProduct } from "@/lib/admin/products";
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
  const body = await readJson<Parameters<typeof updateAdminProduct>[1]>(request);

  if (!body) {
    return apiError("INVALID_BODY", "درخواست معتبر نیست.");
  }

  try {
    const product = await updateAdminProduct(id, body);
    return apiOk({ product: toAdminProductRow(product) });
  } catch (error) {
    if (error instanceof Error && error.message === "PRODUCT_NOT_FOUND") {
      return apiError("PRODUCT_NOT_FOUND", "محصول پیدا نشد.", 404);
    }

    if (error instanceof Error && error.message === "INVALID_STATUS") {
      return apiError("INVALID_STATUS", "وضعیت محصول معتبر نیست.");
    }

    if (error instanceof Error && error.message === "INVALID_SLUG") {
      return apiError("INVALID_SLUG", "اسلاگ محصول معتبر نیست.");
    }

    if (error instanceof Error && error.message === "INVALID_PRICE") {
      return apiError("INVALID_PRICE", "قیمت محصول معتبر نیست.");
    }

    if (error instanceof Error && error.message === "INVALID_CATEGORY") {
      return apiError("INVALID_CATEGORY", "دسته محصول معتبر نیست.");
    }

    if (error instanceof Error && error.message === "INVALID_IMAGE_VARIANT") {
      return apiError("INVALID_IMAGE_VARIANT", "تنوع انتخاب‌شده برای تصویر معتبر نیست.");
    }

    if (error instanceof Error && error.message === "DUPLICATE_SHOWCASE_IMAGE") {
      return apiError(
        "DUPLICATE_SHOWCASE_IMAGE",
        "برای هر محصول فقط یک تصویر بلاک خانه عادی و یک تصویر بلاک خانه پریمیوم مجاز است."
      );
    }

    if (error instanceof Error && error.message === "INVALID_VARIANT") {
      return apiError("INVALID_VARIANT", "تنوع محصول معتبر نیست.");
    }

    return apiError("PRODUCT_UPDATE_FAILED", "محصول ذخیره نشد.", 500);
  }
}
