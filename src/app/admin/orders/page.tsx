import { redirect } from "next/navigation";

import { OrderManagement } from "@/components/admin/order-management";
import { listAdminOrders, toAdminOrderRow } from "@/lib/admin/orders";
import { getCurrentUser } from "@/lib/auth";

export default async function AdminOrdersPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login?redirect=/admin/orders");
  }

  if (user.role !== "ADMIN") {
    redirect("/admin");
  }

  const orders = await listAdminOrders();

  return <OrderManagement initialOrders={orders.map(toAdminOrderRow)} mode="list" />;
}
