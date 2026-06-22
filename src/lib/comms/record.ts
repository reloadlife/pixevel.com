import "server-only";

import { type CommChannel, type CommKind, type CommStatus, commLogs } from "@/db/schema";
import { getDb } from "@/lib/db";
import type { OtpDeliveryStatus } from "@/lib/sms/delivery";

/**
 * The comms dispatch boundary: turns a provider send/receive result into a
 * redacted `commLogs` row. Raw provider clients stay pure — all persistence and
 * secret-stripping happens here, in one place.
 *
 * Logging must never break a send (an OTP/checkout must succeed even if the
 * ledger write fails), so the DB-writing functions swallow errors and return
 * null. The pure transforms below are exported for unit testing.
 */

// ─── Pure transforms ──────────────────────────────────────────────────────────

/** Provider delivery status → ledger status. Callbacks later move rows to DELIVERED/UNDELIVERED. */
export function mapDeliveryStatus(status: OtpDeliveryStatus): CommStatus {
  switch (status) {
    case "sent":
      return "SENT";
    case "pending":
      return "PENDING";
    case "skipped":
      return "SKIPPED";
    default:
      return "FAILED";
  }
}

// Full-data logging is intentional: message bodies and provider payloads are
// stored as-is so operators can see the exact code/text that was sent. Only
// LONG-LIVED credentials are stripped from stored payloads — API keys,
// passwords, client secrets, access/refresh tokens, auth headers. Short-lived
// OTP codes (keys `code`, `otp`, Kavenegar's `token`) are deliberately KEPT, as
// are status codes like `message_code`/`statusCode`, so the ledger stays useful.
const REDACT_EXACT = new Set([
  "secret",
  "password",
  "passwd",
  "apikey",
  "authorization",
  "auth",
  "bearer",
  "accesstoken",
  "refreshtoken",
  "clientsecret",
]);

function isSensitiveKey(key: string): boolean {
  const norm = key.toLowerCase().replace(/[-_\s]/g, "");
  if (REDACT_EXACT.has(norm)) return true;
  return norm.includes("secret") || norm.includes("password") || norm.includes("apikey");
}

/** Deep-strip sensitive keys from a payload before persisting it. Non-objects pass through. */
export function redactCommPayload(value: unknown): unknown {
  if (value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map(redactCommPayload);
  const out: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
    out[key] = isSensitiveKey(key) ? "[redacted]" : redactCommPayload(val);
  }
  return out;
}

/** Pull the provider's message id out of its raw response (the join key for callbacks). */
export function extractProviderMessageId(provider: string, payload: unknown): string | null {
  if (payload === null || typeof payload !== "object") return null;
  const p = payload as Record<string, unknown>;

  switch (provider) {
    case "kavenegar": {
      const entries = p.entries as Array<{ messageid?: number | string }> | undefined;
      const id = entries?.[0]?.messageid;
      return id != null ? String(id) : null;
    }
    case "ippanel": {
      const data = p.data as { message_outbox_ids?: Array<number | string> } | undefined;
      const id = data?.message_outbox_ids?.[0];
      return id != null ? String(id) : null;
    }
    case "telegram": {
      const result = p.result as
        | { messageId?: number | string; message_id?: number | string }
        | undefined;
      const id = result?.messageId ?? result?.message_id;
      return id != null ? String(id) : null;
    }
    case "selfhosted": {
      const id = p.id;
      return id != null && id !== "" ? String(id) : null;
    }
    default:
      return null;
  }
}

/** Best-effort provider cost (Kavenegar reports it per entry). Returns a numeric string or null. */
function extractProviderCost(provider: string, payload: unknown): string | null {
  if (provider !== "kavenegar" || payload === null || typeof payload !== "object") return null;
  const entries = (payload as Record<string, unknown>).entries as
    | Array<{ cost?: number }>
    | undefined;
  const cost = entries?.[0]?.cost;
  return typeof cost === "number" && Number.isFinite(cost) ? String(cost) : null;
}

// ─── DB writes (never throw) ───────────────────────────────────────────────────

export type RecordOutboundInput = {
  channel: CommChannel;
  provider: string;
  kind: CommKind;
  toAddress: string;
  fromAddress?: string | null;
  body?: string | null;
  status: OtpDeliveryStatus;
  message?: string | null;
  payload?: unknown;
  /** Explicit id override (e.g. Resend returns it outside `payload`). */
  providerMessageId?: string | null;
  userId?: string | null;
  orderId?: string | null;
};

export async function recordOutbound(input: RecordOutboundInput): Promise<string | null> {
  try {
    const status = mapDeliveryStatus(input.status);
    const providerMessageId =
      input.providerMessageId ?? extractProviderMessageId(input.provider, input.payload);
    const [row] = await getDb()
      .insert(commLogs)
      .values({
        direction: "OUTBOUND",
        channel: input.channel,
        provider: input.provider,
        kind: input.kind,
        status,
        toAddress: input.toAddress,
        fromAddress: input.fromAddress ?? null,
        body: input.body ?? null,
        providerMessageId,
        errorMessage: status === "FAILED" ? ((input.message ?? null)?.slice(0, 500) ?? null) : null,
        cost: extractProviderCost(input.provider, input.payload),
        payload: redactCommPayload(input.payload) ?? null,
        userId: input.userId ?? null,
        orderId: input.orderId ?? null,
      })
      .returning({ id: commLogs.id });
    return row?.id ?? null;
  } catch (error) {
    console.error("[comms] failed to record outbound log", error);
    return null;
  }
}

export type RecordInboundInput = {
  channel: CommChannel;
  provider: string;
  /** The number/address that received it (ours). */
  toAddress: string;
  /** The sender. */
  fromAddress?: string | null;
  body?: string | null;
  payload?: unknown;
};

export async function recordInbound(input: RecordInboundInput): Promise<string | null> {
  try {
    const [row] = await getDb()
      .insert(commLogs)
      .values({
        direction: "INBOUND",
        channel: input.channel,
        provider: input.provider,
        kind: "INBOUND",
        status: "RECEIVED",
        toAddress: input.toAddress,
        fromAddress: input.fromAddress ?? null,
        body: input.body ?? null,
        payload: redactCommPayload(input.payload) ?? null,
      })
      .returning({ id: commLogs.id });
    return row?.id ?? null;
  } catch (error) {
    console.error("[comms] failed to record inbound log", error);
    return null;
  }
}
