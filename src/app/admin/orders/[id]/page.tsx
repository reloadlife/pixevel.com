import { redirect } from "next/navigation";

import { AdminShell } from "@/components/admin/admin-shell";
import { OrderManagement } from "@/components/admin/order-management";
import { getAdminOrder } from "@/lib/admin/orders";
import { getCurrentUser } from "@/lib/auth";

export default async function AdminOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login?redirect=/admin/orders");
  }

  if (user.role !== "ADMIN") {
    redirect("/admin");
  }

  const { id } = await params;
  const order = await getAdminOrder(id);

  if (!order) {
    redirect("/admin/orders");
  }

  return (
    <AdminShell user={user}>
      <OrderManagement initialOrder={order} mode="detail" />
    </AdminShell>
  );
}
