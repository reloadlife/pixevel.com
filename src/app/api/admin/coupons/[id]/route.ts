import { couponErrorResponse } from "@/app/api/admin/coupons/route";
import {
  type CouponPatchInput,
  deleteCoupon,
  toAdminCouponOption,
  updateCoupon,
} from "@/lib/admin/coupons";
import { apiError, apiOk, readJson } from "@/lib/api";
import { requireAdmin } from "@/lib/auth";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();

  if (!admin) {
    return apiError("UNAUTHORIZED", "دسترسی مجاز نیست.", 401);
  }

  const { id } = await context.params;
  const body = await readJson<CouponPatchInput>(request);

  if (!body) {
    return apiError("INVALID_BODY", "درخواست معتبر نیست.");
  }

  try {
    const coupon = await updateCoupon(id, body);
    return apiOk({ coupon: toAdminCouponOption(coupon) });
  } catch (error) {
    return couponErrorResponse(error);
  }
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();

  if (!admin) {
    return apiError("UNAUTHORIZED", "دسترسی مجاز نیست.", 401);
  }

  const { id } = await context.params;

  try {
    await deleteCoupon(id);
    return apiOk({ deleted: true });
  } catch (error) {
    return couponErrorResponse(error);
  }
}
