import { redirect } from "next/navigation";

import { InventoryManagement } from "@/components/admin/inventory-management";
import {
  getVariantStockSummary,
  listInventoryUnits,
  listInventoryVariantOptions,
} from "@/lib/admin/inventory";
import { getCurrentUser } from "@/lib/auth";

export default async function AdminInventoryPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login?redirect=/admin/inventory");
  }

  if (user.role !== "ADMIN") {
    redirect("/admin");
  }

  const [list, summary, variantOptions] = await Promise.all([
    listInventoryUnits({}),
    getVariantStockSummary({}),
    listInventoryVariantOptions(),
  ]);

  return (
    <InventoryManagement
      initialUnits={list.units}
      initialPagination={list.pagination}
      initialSummary={summary}
      variantOptions={variantOptions}
    />
  );
}
