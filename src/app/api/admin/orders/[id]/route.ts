import {
  cancelOrder,
  confirmOrderPayment,
  failOrderPayment,
  getAdminOrder,
  markDelivered,
  markShipped,
  markUnitDamaged,
  refundOrder,
  resendOrderCodes,
} from "@/lib/admin/orders";
import { apiError, apiOk, readJson } from "@/lib/api";
import { requireAdmin } from "@/lib/auth";

type ActionBody =
  | { action: "confirm" }
  | { action: "fail" }
  | { action: "ship" }
  | { action: "deliver" }
  | { action: "cancel" }
  | { action: "refund" }
  | { action: "resend-codes" }
  | { action: "damage_unit"; unitId: string };

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();

  if (!admin) {
    return apiError("FORBIDDEN", "دسترسی مجاز نیست.", 403);
  }

  const { id } = await context.params;
  const order = await getAdminOrder(id);

  if (!order) {
    return apiError("ORDER_NOT_FOUND", "سفارش پیدا نشد.", 404);
  }

  return apiOk({ order });
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();

  if (!admin) {
    return apiError("FORBIDDEN", "دسترسی مجاز نیست.", 403);
  }

  const { id } = await context.params;
  const body = await readJson<ActionBody>(request);

  if (!body?.action) {
    return apiError("INVALID_BODY", "درخواست معتبر نیست.");
  }

  // Some actions carry extra metadata back to the client (refund / resend).
  let actionResult: Record<string, unknown> | undefined;

  try {
    switch (body.action) {
      case "confirm":
        await confirmOrderPayment(id);
        break;
      case "fail":
        await failOrderPayment(id);
        break;
      case "ship":
        await markShipped(id);
        break;
      case "deliver":
        await markDelivered(id);
        break;
      case "cancel":
        await cancelOrder(id);
        break;
      case "refund": {
        const outcome = await refundOrder(id);
        actionResult = { refund: outcome };
        break;
      }
      case "resend-codes":
        await resendOrderCodes(id);
        actionResult = { resent: true };
        break;
      case "damage_unit":
        if (!body.unitId) {
          return apiError("INVALID_BODY", "شناسه واحد موجودی الزامی است.");
        }
        await markUnitDamaged(body.unitId, id);
        break;
      default:
        return apiError("INVALID_ACTION", "عملیات معتبر نیست.");
    }

    const order = await getAdminOrder(id);
    return apiOk({ order, ...actionResult });
  } catch (error) {
    if (error instanceof Error && error.message === "ORDER_NOT_FOUND") {
      return apiError("ORDER_NOT_FOUND", "سفارش پیدا نشد.", 404);
    }

    if (error instanceof Error && error.message === "ORDER_NOT_PAID") {
      return apiError("ORDER_NOT_PAID", "ارسال مجدد کدها فقط برای سفارش پرداخت‌شده ممکن است.");
    }

    if (error instanceof Error && error.message === "ORDER_NOT_REFUNDABLE") {
      return apiError("ORDER_NOT_REFUNDABLE", "فقط سفارش پرداخت‌شده قابل استرداد است.", 409);
    }

    if (error instanceof Error && error.message === "UNIT_NOT_IN_ORDER") {
      return apiError("UNIT_NOT_IN_ORDER", "این واحد موجودی به این سفارش تعلق ندارد.", 400);
    }

    return apiError("ORDER_ACTION_FAILED", "عملیات سفارش انجام نشد.", 500);
  }
}
