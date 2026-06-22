import "server-only";

import { timingSafeEqual } from "node:crypto";
import { eq } from "drizzle-orm";

import { type CommChannel, type CommStatus, commLogs, commWebhookEvents } from "@/db/schema";
import { getDb } from "@/lib/db";
import { getSetting } from "@/lib/settings";
import { recordInbound } from "./record";

/**
 * Shared logic for provider webhooks (delivery-status callbacks + inbound SMS).
 *
 * Security: these endpoints can't use a session (providers can't log in), so the
 * ONLY auth is a per-provider shared secret compared in constant time. Every hit
 * — even an unauthenticated one — is recorded in `commWebhookEvents` so a
 * misconfigured callback is visible in the admin Callbacks tab.
 */

// ─── Pure helpers (unit-tested) ────────────────────────────────────────────────

/** Constant-time string compare. Length-guarded, never throws, false on nullish/empty. */
export function safeEqual(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b) return false;
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}

export function mapKavenegarDeliveryStatus(code: number | string): CommStatus {
  const n = Number(code);
  switch (n) {
    case 10:
      return "DELIVERED";
    case 11:
    case 13:
    case 14:
      return "UNDELIVERED";
    case 6:
      return "FAILED";
    case 1:
    case 2:
      return "QUEUED";
    case 4:
    case 5:
      return "SENT";
    default:
      return "PENDING";
  }
}

export function mapSelfhostedDeliveryStatus(raw: string): CommStatus {
  const s = raw.toLowerCase();
  if (s === "delivered") return "DELIVERED";
  if (s === "failed" || s === "undelivered") return "UNDELIVERED";
  return "PENDING";
}

export function mapIppanelDeliveryStatus(raw: number | string): CommStatus {
  const s = String(raw).toLowerCase();
  if (s === "delivered" || s === "2") return "DELIVERED";
  if (s === "undelivered" || s === "failed" || s === "3" || s === "blocked") return "UNDELIVERED";
  return "PENDING";
}

// ─── Request parsing + auth ─────────────────────────────────────────────────────

/** Read a webhook body as a flat object, tolerating form-urlencoded OR JSON. */
export async function readWebhookBody(request: Request): Promise<Record<string, unknown>> {
  const contentType = request.headers.get("content-type") ?? "";
  try {
    if (contentType.includes("application/json")) {
      return (await request.json()) as Record<string, unknown>;
    }
    const form = await request.formData();
    const obj: Record<string, unknown> = {};
    for (const [k, v] of form.entries()) obj[k] = typeof v === "string" ? v : v.name;
    return obj;
  } catch {
    return {};
  }
}

/** First present, non-empty value among `keys`, coerced to string (provider shapes vary). */
export function pickString(obj: Record<string, unknown>, ...keys: string[]): string | null {
  for (const k of keys) {
    const v = obj[k];
    if (v != null && v !== "") return String(v);
  }
  return null;
}

/** Pull the caller-supplied secret from `?secret=` or the `x-webhook-secret` header. */
export function extractSecret(request: Request): string | null {
  const url = new URL(request.url);
  return url.searchParams.get("secret") ?? request.headers.get("x-webhook-secret");
}

/** True when the request carries the configured shared secret for `settingKey`. */
export async function verifyWebhookSecret(request: Request, settingKey: string): Promise<boolean> {
  const expected = await getSetting(settingKey);
  if (!expected) return false; // not configured → cannot authenticate any hit
  return safeEqual(extractSecret(request), expected);
}

// ─── DB writes ──────────────────────────────────────────────────────────────────

export async function recordWebhookEvent(input: {
  provider: string;
  channel: CommChannel;
  type: "delivery_status" | "inbound";
  rawPayload: unknown;
  matchedLogId?: string | null;
  signatureValid: boolean;
}): Promise<void> {
  try {
    await getDb()
      .insert(commWebhookEvents)
      .values({
        provider: input.provider,
        channel: input.channel,
        type: input.type,
        rawPayload: (input.rawPayload as object) ?? null,
        matchedLogId: input.matchedLogId ?? null,
        signatureValid: input.signatureValid,
      });
  } catch (error) {
    console.error("[comms] failed to record webhook event", error);
  }
}

/**
 * Find the outbound ledger row for `providerMessageId` and move it to `status`.
 * Returns the matched log id (for the webhook-event row) or null if unmatched.
 */
export async function applyDeliveryStatus(
  providerMessageId: string,
  status: CommStatus,
): Promise<string | null> {
  try {
    const db = getDb();
    const [row] = await db
      .select({ id: commLogs.id })
      .from(commLogs)
      .where(eq(commLogs.providerMessageId, providerMessageId))
      .limit(1);
    if (!row) return null;
    await db.update(commLogs).set({ status, updatedAt: new Date() }).where(eq(commLogs.id, row.id));
    return row.id;
  } catch (error) {
    console.error("[comms] failed to apply delivery status", error);
    return null;
  }
}

export { recordInbound };
