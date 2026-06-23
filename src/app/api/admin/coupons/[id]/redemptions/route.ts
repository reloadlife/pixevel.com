import { listCouponRedemptions } from "@/lib/admin/coupon-redemptions";
import { apiError, apiOk } from "@/lib/api";
import { requireAdmin } from "@/lib/auth";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();

  if (!admin) {
    return apiError("UNAUTHORIZED", "دسترسی مجاز نیست.", 401);
  }

  const { id } = await context.params;

  const rows = await listCouponRedemptions(id);

  return apiOk({ rows });
}
