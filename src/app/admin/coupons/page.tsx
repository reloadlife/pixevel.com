import { redirect } from "next/navigation";

import { CouponManagement } from "@/components/admin/coupon-management";
import { listCoupons, toAdminCouponOption } from "@/lib/admin/coupons";
import { getCurrentUser } from "@/lib/auth";

export default async function AdminCouponsPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login?redirect=/admin/coupons");
  }

  if (user.role !== "ADMIN") {
    redirect("/admin");
  }

  const couponList = await listCoupons();

  return <CouponManagement initialCoupons={couponList.map(toAdminCouponOption)} />;
}
