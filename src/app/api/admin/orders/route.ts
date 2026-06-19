import type { OrderStatus, PaymentStatus } from "@/db/schema";
import { listAdminOrders, toAdminOrderRow } from "@/lib/admin/orders";
import { apiError, apiOk } from "@/lib/api";
import { requireAdmin } from "@/lib/auth";

export async function GET(request: Request) {
  const admin = await requireAdmin();

  if (!admin) {
    return apiError("FORBIDDEN", "دسترسی مجاز نیست.", 403);
  }

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status") as OrderStatus | null;
  const paymentStatus = searchParams.get("paymentStatus") as PaymentStatus | null;

  const orders = await listAdminOrders({
    status: status ?? undefined,
    paymentStatus: paymentStatus ?? undefined,
  });

  return apiOk({ orders: orders.map(toAdminOrderRow) });
}
