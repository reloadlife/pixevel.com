import { redirect } from "next/navigation";

import { GiftCardManagement } from "@/components/admin/gift-card-management";
import { giftCardStatusCounts, listGiftCards, toAdminGiftCardOption } from "@/lib/admin/gift-cards";
import { requireAdmin } from "@/lib/auth";

export default async function AdminGiftCardsPage() {
  const admin = await requireAdmin();

  if (!admin) {
    redirect("/login?redirect=/admin/gift-cards");
  }

  const [list, counts] = await Promise.all([listGiftCards(), giftCardStatusCounts()]);

  return (
    <GiftCardManagement
      initialGiftCards={list.rows.map(toAdminGiftCardOption)}
      initialPage={list.page}
      initialTotalPages={list.totalPages}
      initialTotal={list.total}
      initialCounts={counts}
    />
  );
}
