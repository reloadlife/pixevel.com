import "server-only";

import { and, count, desc, eq, gte, ilike, lt, or, type SQL } from "drizzle-orm";

import {
  type CommChannel,
  type CommDirection,
  type CommStatus,
  commLogs,
  commWebhookEvents,
} from "@/db/schema";
import { getDb } from "@/lib/db";

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;

function clampLimit(limit?: number): number {
  if (!limit || !Number.isFinite(limit)) return DEFAULT_LIMIT;
  return Math.min(Math.max(Math.trunc(limit), 1), MAX_LIMIT);
}

/** Cursor encodes the (createdAt, id) of the last row for keyset pagination. */
function encodeCursor(createdAt: Date, id: string): string {
  return Buffer.from(`${createdAt.getTime()}_${id}`).toString("base64url");
}

function decodeCursor(cursor: string): { ts: number; id: string } | null {
  try {
    const [ts, id] = Buffer.from(cursor, "base64url").toString("utf8").split("_");
    const n = Number(ts);
    if (!Number.isFinite(n) || !id) return null;
    return { ts: n, id };
  } catch {
    return null;
  }
}

export type CommLogFilters = {
  channel?: CommChannel;
  direction?: CommDirection;
  status?: CommStatus;
  q?: string;
  cursor?: string;
  limit?: number;
};

export async function listCommLogs(filters: CommLogFilters) {
  const limit = clampLimit(filters.limit);
  const conds: SQL[] = [];

  if (filters.channel) conds.push(eq(commLogs.channel, filters.channel));
  if (filters.direction) conds.push(eq(commLogs.direction, filters.direction));
  if (filters.status) conds.push(eq(commLogs.status, filters.status));
  if (filters.q) {
    const pattern = `%${filters.q}%`;
    const search = or(ilike(commLogs.toAddress, pattern), ilike(commLogs.fromAddress, pattern));
    if (search) conds.push(search);
  }
  if (filters.cursor) {
    const c = decodeCursor(filters.cursor);
    if (c) {
      const after = new Date(c.ts);
      // (createdAt, id) strictly before the cursor — stable keyset ordering.
      const keyset = or(
        lt(commLogs.createdAt, after),
        and(eq(commLogs.createdAt, after), lt(commLogs.id, c.id)),
      );
      if (keyset) conds.push(keyset);
    }
  }

  const rows = await getDb()
    .select()
    .from(commLogs)
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(desc(commLogs.createdAt), desc(commLogs.id))
    .limit(limit + 1);

  const items = rows.slice(0, limit);
  const last = items.at(-1);
  const nextCursor = rows.length > limit && last ? encodeCursor(last.createdAt, last.id) : null;

  return { items, nextCursor };
}

export type WebhookEventFilters = {
  provider?: string;
  type?: string;
  cursor?: string;
  limit?: number;
};

export async function listWebhookEvents(filters: WebhookEventFilters) {
  const limit = clampLimit(filters.limit);
  const conds: SQL[] = [];

  if (filters.provider) conds.push(eq(commWebhookEvents.provider, filters.provider));
  if (filters.type) conds.push(eq(commWebhookEvents.type, filters.type));
  if (filters.cursor) {
    const c = decodeCursor(filters.cursor);
    if (c) {
      const after = new Date(c.ts);
      const keyset = or(
        lt(commWebhookEvents.receivedAt, after),
        and(eq(commWebhookEvents.receivedAt, after), lt(commWebhookEvents.id, c.id)),
      );
      if (keyset) conds.push(keyset);
    }
  }

  const rows = await getDb()
    .select()
    .from(commWebhookEvents)
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(desc(commWebhookEvents.receivedAt), desc(commWebhookEvents.id))
    .limit(limit + 1);

  const items = rows.slice(0, limit);
  const last = items.at(-1);
  const nextCursor = rows.length > limit && last ? encodeCursor(last.receivedAt, last.id) : null;

  return { items, nextCursor };
}

/** Header-card counts over the trailing 24h. */
export async function commStats() {
  const since = new Date(Date.now() - 24 * 60 * 60_000);
  const db = getDb();

  const rows = await db
    .select({ status: commLogs.status, direction: commLogs.direction, n: count() })
    .from(commLogs)
    .where(gte(commLogs.createdAt, since))
    .groupBy(commLogs.status, commLogs.direction);

  let outbound = 0;
  let delivered = 0;
  let failed = 0;
  let inbound = 0;
  for (const r of rows) {
    const n = Number(r.n);
    if (r.direction === "INBOUND") {
      inbound += n;
      continue;
    }
    outbound += n;
    if (r.status === "DELIVERED") delivered += n;
    if (r.status === "FAILED" || r.status === "UNDELIVERED") failed += n;
  }

  return { windowHours: 24, outbound, delivered, failed, inbound };
}
