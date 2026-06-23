import { redirect } from "next/navigation";

import { OrderManagement } from "@/components/admin/order-management";
import { listOrderEvents } from "@/lib/admin/order-events";
import { getAdminOrder } from "@/lib/admin/orders";
import { listOrderRefunds } from "@/lib/admin/refunds";
import { listOrderShipments } from "@/lib/admin/shipments";
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

  const [refunds, shipments, events] = await Promise.all([
    listOrderRefunds(id),
    listOrderShipments(id),
    listOrderEvents(id),
  ]);

  return (
    <OrderManagement
      initialOrder={order}
      mode="detail"
      initialRefunds={refunds}
      initialShipments={shipments}
      initialEvents={events}
    />
  );
}
