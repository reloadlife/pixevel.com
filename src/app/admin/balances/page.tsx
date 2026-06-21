import { redirect } from "next/navigation";

import { BalanceManagement } from "@/components/admin/balance-management";
import { listUserBalances, toBalanceRow } from "@/lib/admin/balances";
import { requireAdmin } from "@/lib/auth";

export default async function AdminBalancesPage() {
  const admin = await requireAdmin();

  if (!admin) {
    redirect("/login?redirect=/admin/balances");
  }

  const result = await listUserBalances({ page: 1 });

  return (
    <BalanceManagement
      initialUsers={result.rows.map(toBalanceRow)}
      initialPagination={{
        page: result.page,
        pageSize: result.pageSize,
        total: result.total,
        totalPages: result.totalPages,
      }}
    />
  );
}
