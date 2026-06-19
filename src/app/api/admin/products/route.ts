import { apiError, apiOk, readJson } from "@/lib/api";
import {
  createAdminProduct,
  listAdminProducts,
  toAdminProductRow,
} from "@/lib/admin/products";
import { requireAdmin } from "@/lib/auth";

export async function GET() {
  const admin = await requireAdmin();

  if (!admin) {
    return apiError("UNAUTHORIZED", "دسترسی مجاز نیست.", 401);
  }

  const products = await listAdminProducts();

  return apiOk({ products: products.map(toAdminProductRow) });
}

export async function POST(request: Request) {
  const admin = await requireAdmin();

  if (!admin) {
    return apiError("UNAUTHORIZED", "دسترسی مجاز نیست.", 401);
  }

  const body = await readJson<Parameters<typeof createAdminProduct>[0]>(request);

  if (!body || !body.titleFa || !body.publicPriceAmount) {
    return apiError("INVALID_PRODUCT", "اطلاعات محصول کامل نیست.");
  }

  try {
    const product = await createAdminProduct(body);
    return apiOk(
      {
        product: {
          id: product.id,
          slug: product.slug,
          titleFa: product.titleFa,
          status: product.status,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof Error && error.message === "INVALID_VARIANTS") {
      return apiError("INVALID_VARIANTS", "حداقل رنگ، جنس و سایز باید وارد شود.");
    }

    if (error instanceof Error && error.message === "INVALID_SLUG") {
      return apiError("INVALID_SLUG", "اسلاگ محصول معتبر نیست.");
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

    return apiError("PRODUCT_CREATE_FAILED", "محصول ذخیره نشد.", 500);
  }
}
