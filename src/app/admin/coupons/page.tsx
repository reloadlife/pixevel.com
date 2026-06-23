import { CouponManagement } from "@/components/admin/coupon-management";
import { type AdminCouponOption, listCoupons, toAdminCouponOption } from "@/lib/admin/coupons";
import { requireAdmin } from "@/lib/admin/guard";
import type { AdminListResponse } from "@/lib/admin/list-response";

export default async function AdminCouponsPage() {
  await requireAdmin("/admin/coupons");

  const couponList = await listCoupons();
  const rows = couponList.map(toAdminCouponOption);

  const initialData: AdminListResponse<AdminCouponOption> = {
    rows,
    pagination: { page: 1, pageSize: rows.length || 20, total: rows.length, totalPages: 1 },
  };

  return <CouponManagement initialData={initialData} />;
}
