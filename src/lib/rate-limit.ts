/**
 * In-memory fixed-window rate limiter. Per-process — it resets on deploy and is
 * not shared across instances, which is fine for the current single-node deploy
 * and for blunting abuse bursts (SMS/email bombs, analytics flooding, redeem
 * brute-force oracles). Durable, cross-instance guarantees (e.g. OTP attempt
 * caps) are enforced separately in the database, not here.
 *
 * No external dependency (no Redis). If the app moves to multi-instance, swap
 * the Map for a shared store behind this same interface.
 */

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

export type RateLimitResult = {
  ok: boolean;
  /** Remaining requests in the current window. */
  remaining: number;
  /** Milliseconds until the window resets (0 when allowed). */
  retryAfterMs: number;
};

let lastSweep = 0;

/** Drops expired buckets at most once a minute to bound memory. */
function sweep(now: number): void {
  if (now - lastSweep < 60_000) {
    return;
  }
  lastSweep = now;
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) {
      buckets.delete(key);
    }
  }
}

/**
 * Records a hit for `key` and reports whether it is within `max` per `windowMs`.
 * Call once per request; the call itself counts.
 */
export function rateLimit(key: string, max: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  sweep(now);

  const bucket = buckets.get(key);

  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, remaining: max - 1, retryAfterMs: 0 };
  }

  if (bucket.count >= max) {
    return { ok: false, remaining: 0, retryAfterMs: bucket.resetAt - now };
  }

  bucket.count += 1;
  return { ok: true, remaining: max - bucket.count, retryAfterMs: 0 };
}

/**
 * Best-effort client IP from common proxy headers. Falls back to "unknown" so a
 * missing header collapses all callers into one bucket (fails safe — stricter).
 */
export function clientIp(request: Request): string {
  const fwd = request.headers.get("x-forwarded-for");
  if (fwd) {
    return fwd.split(",")[0]?.trim() || "unknown";
  }
  return request.headers.get("x-real-ip")?.trim() || "unknown";
}
