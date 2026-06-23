import { ShippingMethodManagement } from "@/components/admin/shipping-method-management";
import { requireAdmin } from "@/lib/admin/guard";
import type { AdminListResponse } from "@/lib/admin/list-response";
import {
  type AdminShippingMethodOption,
  listShippingMethods,
  toAdminShippingMethodOption,
} from "@/lib/admin/shipping-methods";

export default async function AdminShippingPage() {
  await requireAdmin("/admin/shipping");

  const list = await listShippingMethods();
  const rows = list.map(toAdminShippingMethodOption);

  const initialData: AdminListResponse<AdminShippingMethodOption> = {
    rows,
    pagination: { page: 1, pageSize: rows.length || 20, total: rows.length, totalPages: 1 },
  };

  return <ShippingMethodManagement initialData={initialData} />;
}
