import { listOrderEvents } from "@/lib/admin/order-events";
import { apiError, apiOk } from "@/lib/api";
import { requireAdmin } from "@/lib/auth";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  if (!admin) return apiError("FORBIDDEN", "دسترسی مجاز نیست.", 403);

  const { id } = await context.params;
  const rows = await listOrderEvents(id);
  return apiOk({ rows });
}
