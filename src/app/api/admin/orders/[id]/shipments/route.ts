import {
  type CreateShipmentInput,
  createShipment,
  listOrderShipments,
} from "@/lib/admin/shipments";
import { apiError, apiOk, readJson } from "@/lib/api";
import { requireAdmin } from "@/lib/auth";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  if (!admin) return apiError("FORBIDDEN", "دسترسی مجاز نیست.", 403);

  const { id } = await context.params;
  const rows = await listOrderShipments(id);
  return apiOk({ rows });
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  if (!admin) return apiError("FORBIDDEN", "دسترسی مجاز نیست.", 403);

  const { id } = await context.params;

  type Body = Omit<CreateShipmentInput, "orderId" | "actorUserId">;
  const body = await readJson<Body>(request);

  if (!body) {
    return apiError("INVALID_BODY", "درخواست معتبر نیست.");
  }

  try {
    const shipmentId = await createShipment({
      orderId: id,
      actorUserId: admin.id,
      ...body,
    });

    const rows = await listOrderShipments(id);
    return apiOk({ shipmentId, rows });
  } catch {
    return apiError("SHIPMENT_FAILED", "ایجاد مرسوله ناموفق بود.", 500);
  }
}
