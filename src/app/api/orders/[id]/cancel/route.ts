import { apiError, apiOk } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { isOrderCancellable } from "@/lib/orders/account-orders";
import { failPayment } from "@/lib/orders/payments";

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) {
    return apiError("AUTH_REQUIRED", "ابتدا وارد شوید.", 401);
  }

  const { id } = await context.params;
  const db = getDb();

  const order = await db.query.orders.findFirst({
    where: (o, { and: andOp, eq: eqOp }) => andOp(eqOp(o.id, id), eqOp(o.userId, user.id)),
    columns: { id: true, status: true },
  });

  if (!order) {
    return apiError("ORDER_NOT_FOUND", "سفارش پیدا نشد.", 404);
  }

  if (!isOrderCancellable(order.status)) {
    return apiError("ORDER_NOT_CANCELLABLE", "این سفارش در وضعیت فعلی قابل لغو نیست.", 409);
  }

  // Route through failPayment so reserved inventory is released and the payment
  // row is marked FAILED atomically — never a bare status flip (leaks stock).
  await failPayment(order.id);

  return apiOk({ order: { id: order.id, status: "CANCELLED" } });
}
