import { type UpdateShipmentInput, updateShipment } from "@/lib/admin/shipments";
import { apiError, apiOk, readJson } from "@/lib/api";
import { requireAdmin } from "@/lib/auth";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  if (!admin) return apiError("FORBIDDEN", "دسترسی مجاز نیست.", 403);

  const { id } = await context.params;

  type Body = Omit<UpdateShipmentInput, "actorUserId">;
  const body = await readJson<Body>(request);

  if (!body) {
    return apiError("INVALID_BODY", "درخواست معتبر نیست.");
  }

  try {
    await updateShipment(id, { ...body, actorUserId: admin.id });
    return apiOk({ updated: true });
  } catch (error) {
    if (error instanceof Error && error.message === "SHIPMENT_NOT_FOUND") {
      return apiError("SHIPMENT_NOT_FOUND", "مرسوله پیدا نشد.", 404);
    }
    return apiError("SHIPMENT_UPDATE_FAILED", "به‌روزرسانی مرسوله ناموفق بود.", 500);
  }
}
