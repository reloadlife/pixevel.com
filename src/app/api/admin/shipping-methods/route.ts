import {
  createShippingMethod,
  listShippingMethods,
  ShippingMethodError,
  type ShippingMethodInput,
  toAdminShippingMethodOption,
} from "@/lib/admin/shipping-methods";
import { apiError, apiOk, readJson } from "@/lib/api";
import { requireAdmin } from "@/lib/auth";

/** Maps a ShippingMethodError code → [httpStatus, Persian message]. */
const SHIPPING_ERROR_MAP: Record<string, [number, string]> = {
  CODE_REQUIRED: [400, "کد روش ارسال الزامی است."],
  CODE_TAKEN: [409, "این کد روش ارسال قبلاً ثبت شده است."],
  TITLE_REQUIRED: [400, "عنوان روش ارسال الزامی است."],
  INVALID_KIND: [400, "نوع روش ارسال نامعتبر است."],
  INVALID_CURRENCY: [400, "ارز انتخاب‌شده نامعتبر است."],
  INVALID_AMOUNT: [400, "مبلغ واردشده نامعتبر است."],
  INVALID_DAYS: [400, "تعداد روز نامعتبر است."],
  NOT_FOUND: [404, "روش ارسال پیدا نشد."],
};

export function shippingMethodErrorResponse(error: unknown) {
  if (error instanceof ShippingMethodError) {
    const mapped = SHIPPING_ERROR_MAP[error.code] ?? [400, "روش ارسال ذخیره نشد."];
    return apiError(error.code, mapped[1], mapped[0]);
  }
  return apiError("SHIPPING_SAVE_FAILED", "روش ارسال ذخیره نشد.", 500);
}

export async function GET() {
  const admin = await requireAdmin();

  if (!admin) {
    return apiError("UNAUTHORIZED", "دسترسی مجاز نیست.", 401);
  }

  const list = await listShippingMethods();
  const rows = list.map(toAdminShippingMethodOption);

  return apiOk({
    rows,
    pagination: {
      page: 1,
      pageSize: rows.length || 20,
      total: rows.length,
      totalPages: 1,
    },
  });
}

export async function POST(request: Request) {
  const admin = await requireAdmin();

  if (!admin) {
    return apiError("UNAUTHORIZED", "دسترسی مجاز نیست.", 401);
  }

  const body = await readJson<ShippingMethodInput>(request);

  if (!body) {
    return apiError("INVALID_BODY", "درخواست معتبر نیست.");
  }

  try {
    const row = await createShippingMethod(body);
    return apiOk({ row: toAdminShippingMethodOption(row) }, { status: 201 });
  } catch (error) {
    return shippingMethodErrorResponse(error);
  }
}
