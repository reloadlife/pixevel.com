import {
  CouponError,
  type CouponInput,
  createCoupon,
  listCoupons,
  toAdminCouponOption,
} from "@/lib/admin/coupons";
import { apiError, apiOk, readJson } from "@/lib/api";
import { requireAdmin } from "@/lib/auth";

/** Maps a CouponError code → [httpStatus, Persian message]. */
const COUPON_ERROR_MAP: Record<string, [number, string]> = {
  CODE_REQUIRED: [400, "کد تخفیف الزامی است."],
  CODE_TAKEN: [409, "این کد تخفیف قبلاً ثبت شده است."],
  INVALID_KIND: [400, "نوع کد تخفیف نامعتبر است."],
  INVALID_VALUE: [400, "مقدار تخفیف باید بزرگ‌تر از صفر باشد."],
  PERCENT_TOO_HIGH: [400, "درصد تخفیف نمی‌تواند بیشتر از ۱۰۰ باشد."],
  INVALID_AMOUNT: [400, "مبلغ واردشده نامعتبر است."],
  INVALID_USAGE_LIMIT: [400, "سقف استفاده نامعتبر است."],
  INVALID_DATE: [400, "تاریخ واردشده نامعتبر است."],
  NOT_FOUND: [404, "کد تخفیف پیدا نشد."],
};

export function couponErrorResponse(error: unknown) {
  if (error instanceof CouponError) {
    const mapped = COUPON_ERROR_MAP[error.code] ?? [400, "کد تخفیف ذخیره نشد."];
    return apiError(error.code, mapped[1], mapped[0]);
  }
  return apiError("COUPON_SAVE_FAILED", "کد تخفیف ذخیره نشد.", 500);
}

export async function GET() {
  const admin = await requireAdmin();

  if (!admin) {
    return apiError("UNAUTHORIZED", "دسترسی مجاز نیست.", 401);
  }

  const couponList = await listCoupons();

  return apiOk({ coupons: couponList.map(toAdminCouponOption) });
}

export async function POST(request: Request) {
  const admin = await requireAdmin();

  if (!admin) {
    return apiError("UNAUTHORIZED", "دسترسی مجاز نیست.", 401);
  }

  const body = await readJson<CouponInput>(request);

  if (!body) {
    return apiError("INVALID_BODY", "درخواست معتبر نیست.");
  }

  try {
    const coupon = await createCoupon(body);
    return apiOk({ coupon: toAdminCouponOption(coupon) }, { status: 201 });
  } catch (error) {
    return couponErrorResponse(error);
  }
}
