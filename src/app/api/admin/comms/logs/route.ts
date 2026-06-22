import type { CommChannel, CommDirection, CommStatus } from "@/db/schema";
import { apiError, apiOk } from "@/lib/api";
import { requireAdmin } from "@/lib/auth";
import { type CommLogFilters, listCommLogs } from "@/lib/comms/queries";

const CHANNELS = new Set(["SMS", "VOICE", "EMAIL", "TELEGRAM"]);
const DIRECTIONS = new Set(["OUTBOUND", "INBOUND"]);
const STATUSES = new Set([
  "QUEUED",
  "SENT",
  "PENDING",
  "DELIVERED",
  "FAILED",
  "SKIPPED",
  "RECEIVED",
  "UNDELIVERED",
]);

export async function GET(request: Request) {
  const admin = await requireAdmin();
  if (!admin) return apiError("UNAUTHORIZED", "دسترسی مجاز نیست.", 401);

  const sp = new URL(request.url).searchParams;
  const filters: CommLogFilters = {};

  const channel = sp.get("channel");
  if (channel && CHANNELS.has(channel)) filters.channel = channel as CommChannel;
  const direction = sp.get("direction");
  if (direction && DIRECTIONS.has(direction)) filters.direction = direction as CommDirection;
  const status = sp.get("status");
  if (status && STATUSES.has(status)) filters.status = status as CommStatus;
  const q = sp.get("q")?.trim();
  if (q) filters.q = q;
  const cursor = sp.get("cursor");
  if (cursor) filters.cursor = cursor;
  const limit = sp.get("limit");
  if (limit) filters.limit = Number(limit);

  const { items, nextCursor } = await listCommLogs(filters);
  return apiOk({ items, nextCursor });
}
