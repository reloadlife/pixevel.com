import { apiError, apiOk } from "@/lib/api";
import { requireAdmin } from "@/lib/auth";
import { listWebhookEvents, type WebhookEventFilters } from "@/lib/comms/queries";

const PROVIDERS = new Set(["kavenegar", "ippanel"]);
const TYPES = new Set(["delivery_status", "inbound"]);

export async function GET(request: Request) {
  const admin = await requireAdmin();
  if (!admin) return apiError("UNAUTHORIZED", "دسترسی مجاز نیست.", 401);

  const sp = new URL(request.url).searchParams;
  const filters: WebhookEventFilters = {};

  const provider = sp.get("provider");
  if (provider && PROVIDERS.has(provider)) filters.provider = provider;
  const type = sp.get("type");
  if (type && TYPES.has(type)) filters.type = type;
  const cursor = sp.get("cursor");
  if (cursor) filters.cursor = cursor;
  const limit = sp.get("limit");
  if (limit) filters.limit = Number(limit);

  const { items, nextCursor } = await listWebhookEvents(filters);
  return apiOk({ items, nextCursor });
}
