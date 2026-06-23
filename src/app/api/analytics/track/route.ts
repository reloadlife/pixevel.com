import type { AnalyticsEventType } from "@/db/schema";
import { analyticsEventType } from "@/db/schema";
import { parseUtm } from "@/lib/analytics/acquisition";
import { getOrSetAnonId, getOrSetSessionId, recordEvent } from "@/lib/analytics/track";
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
  /** Full landing URL (with query) — parsed for UTM on a session's first event. */
  landingUrl?: string;
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

    const [user, anonId, session] = await Promise.all([
      getCurrentUser().catch(() => null),
      getOrSetAnonId().catch(() => null),
      getOrSetSessionId().catch(() => null),
    ]);

    // Bound every stored field so a crafted payload can't bloat a row.
    let metadata =
      body.metadata &&
      typeof body.metadata === "object" &&
      JSON.stringify(body.metadata).length <= 4096
        ? body.metadata
        : null;

    // Acquisition: only the session's first (landing) event carries referrer +
    // UTM. The client sends the landing URL it arrived on as `landingUrl`; we
    // parse UTM defensively and attach it under metadata.utm. Later events in
    // the same session skip this so a source is recorded exactly once.
    if (session?.isNew) {
      const utm = parseUtm(typeof body.landingUrl === "string" ? body.landingUrl : null);
      if (utm) {
        metadata = { ...(metadata ?? {}), utm };
      }
    }

    await recordEvent({
      type: body.type as AnalyticsEventType,
      userId: user?.id ?? null,
      anonId,
      sessionId: session?.sessionId ?? null,
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
