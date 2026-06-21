import type { AnalyticsEventType } from "@/db/schema";
import { analyticsEventType } from "@/db/schema";
import { getOrSetAnonId, recordEvent } from "@/lib/analytics/track";
import { readJson } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth";
import { clientIp, rateLimit } from "@/lib/rate-limit";

/**
 * POST /api/analytics/track
 *
 * Lightweight client beacon (navigator.sendBeacon / fetch keepalive). Records a
 * single analytics event. Designed to be cheap and never error: it always
 * returns a fast 204 and swallows every failure so it can't disrupt the page.
 *
 * Body: { type, productId?, categoryId?, query?, resultCount?, path?, metadata? }
 * `type` must be a valid AnalyticsEventType; anything else is ignored (still 204).
 */

const VALID_TYPES = new Set<string>(analyticsEventType.enumValues);

type TrackBody = {
  type?: string;
  productId?: string;
  categoryId?: string;
  query?: string;
  resultCount?: number;
  path?: string;
  metadata?: Record<string, unknown>;
};

function noContent() {
  return new Response(null, { status: 204 });
}

export async function POST(request: Request) {
  try {
    const body = await readJson<TrackBody>(request);

    // Invalid / missing type → accept silently (200-class), record nothing.
    if (!body?.type || !VALID_TYPES.has(body.type)) {
      return noContent();
    }

    // Cheap abuse guard: cap events per IP so this public beacon can't be
    // scripted to flood the table. Over-limit is silently dropped (still 204).
    if (!rateLimit(`track:${clientIp(request)}`, 60, 60_000).ok) {
      return noContent();
    }

    const referrer = request.headers.get("referer");

    const [user, anonId] = await Promise.all([
      getCurrentUser().catch(() => null),
      getOrSetAnonId().catch(() => null),
    ]);

    // Bound every stored field so a crafted payload can't bloat a row.
    const metadata =
      body.metadata &&
      typeof body.metadata === "object" &&
      JSON.stringify(body.metadata).length <= 4096
        ? body.metadata
        : null;

    await recordEvent({
      type: body.type as AnalyticsEventType,
      userId: user?.id ?? null,
      anonId,
      productId: typeof body.productId === "string" ? body.productId.slice(0, 64) : null,
      categoryId: typeof body.categoryId === "string" ? body.categoryId.slice(0, 64) : null,
      query: typeof body.query === "string" ? body.query.slice(0, 256) : null,
      resultCount: typeof body.resultCount === "number" ? body.resultCount : null,
      path: typeof body.path === "string" ? body.path.slice(0, 512) : null,
      referrer: referrer ? referrer.slice(0, 1024) : null,
      metadata,
    });
  } catch {
    // Beacon endpoint must never surface errors to the client.
  }

  return noContent();
}
