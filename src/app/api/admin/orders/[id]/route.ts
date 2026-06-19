import {
  cancelOrder,
  confirmOrderPayment,
  getAdminOrder,
  markDelivered,
  markShipped,
  markUnitDamaged,
  refundOrder,
} from "@/lib/admin/orders";
import { apiError, apiOk, readJson } from "@/lib/api";
import { requireAdmin } from "@/lib/auth";

type ActionBody =
  | { action: "confirm" }
  | { action: "ship" }
  | { action: "deliver" }
  | { action: "cancel" }
  | { action: "refund" }
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

  try {
    switch (body.action) {
      case "confirm":
        await confirmOrderPayment(id);
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
      case "refund":
        await refundOrder(id);
        break;
      case "damage_unit":
        if (!body.unitId) {
          return apiError("INVALID_BODY", "شناسه واحد موجودی الزامی است.");
        }
        await markUnitDamaged(body.unitId);
        break;
      default:
        return apiError("INVALID_ACTION", "عملیات معتبر نیست.");
    }

    const order = await getAdminOrder(id);
    return apiOk({ order });
  } catch (error) {
    if (error instanceof Error && error.message === "ORDER_NOT_FOUND") {
      return apiError("ORDER_NOT_FOUND", "سفارش پیدا نشد.", 404);
    }

    return apiError("ORDER_ACTION_FAILED", "عملیات سفارش انجام نشد.", 500);
  }
}
