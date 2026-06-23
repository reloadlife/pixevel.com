import { type CreateRefundInput, createRefund, listOrderRefunds } from "@/lib/admin/refunds";
import { apiError, apiOk, readJson } from "@/lib/api";
import { requireAdmin } from "@/lib/auth";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  if (!admin) return apiError("FORBIDDEN", "دسترسی مجاز نیست.", 403);

  const { id } = await context.params;
  const rows = await listOrderRefunds(id);
  return apiOk({ rows });
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  if (!admin) return apiError("FORBIDDEN", "دسترسی مجاز نیست.", 403);

  const { id } = await context.params;

  type Body = Omit<CreateRefundInput, "orderId" | "createdByUserId">;
  const body = await readJson<Body>(request);

  if (!body?.amount) {
    return apiError("INVALID_BODY", "مبلغ استرداد الزامی است.");
  }

  try {
    const refundId = await createRefund({
      orderId: id,
      createdByUserId: admin.id,
      amount: body.amount,
      reason: body.reason,
      paymentId: body.paymentId,
      items: body.items,
    });

    const rows = await listOrderRefunds(id);
    return apiOk({ refundId, rows });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "ORDER_NOT_FOUND") {
        return apiError("ORDER_NOT_FOUND", "سفارش پیدا نشد.", 404);
      }
      if (error.message === "ORDER_NOT_REFUNDABLE") {
        return apiError("ORDER_NOT_REFUNDABLE", "سفارش قابل استرداد نیست.", 409);
      }
    }
    return apiError("REFUND_FAILED", "ایجاد استرداد ناموفق بود.", 500);
  }
}
