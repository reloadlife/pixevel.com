import { redirect } from "next/navigation";

import { ReferralManagement } from "@/components/admin/referral-management";
import { getReferralStats, listReferrals } from "@/lib/admin/referrals";
import { requireAdmin } from "@/lib/auth";

export default async function AdminReferralsPage() {
  const admin = await requireAdmin();

  if (!admin) {
    redirect("/login?redirect=/admin/referrals");
  }

  const [list, stats] = await Promise.all([listReferrals(), getReferralStats()]);

  return <ReferralManagement initialData={list} initialStats={stats} />;
}
