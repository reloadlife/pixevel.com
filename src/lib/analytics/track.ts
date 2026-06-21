import "server-only";

import { randomUUID } from "node:crypto";

import { cookies } from "next/headers";

import type { AnalyticsEventType } from "@/db/schema";
import { analyticsEvents } from "@/db/schema";
import { getDb } from "@/lib/db";

/** Cookie holding the PII-free anonymous visitor id. */
export const ANON_COOKIE = "px_anon";

const ANON_COOKIE_MAX_AGE = 365 * 24 * 60 * 60; // 1 year

/**
 * Input for {@link recordEvent}. Only `type` is required — every other field is
 * optional context. `userId`/`anonId` identify the actor (both PII-free: anonId
 * is a random cookie id, never a phone/email).
 */
export type RecordEventInput = {
  type: AnalyticsEventType;
  userId?: string | null;
  anonId?: string | null;
  sessionId?: string | null;
  productId?: string | null;
  categoryId?: string | null;
  query?: string | null;
  resultCount?: number | null;
  path?: string | null;
  referrer?: string | null;
  metadata?: Record<string, unknown> | null;
};

/**
 * Reads the `px_anon` cookie, creating (and setting) a random id when absent.
 * The id is opaque and carries no PII — it only lets us count unique visitors.
 *
 * Note: setting cookies is only possible in a Server Action / Route Handler
 * context. When called from a plain Server Component render the set is silently
 * a no-op (Next throws, which we swallow) and the read value is returned.
 */
export async function getOrSetAnonId(): Promise<string> {
  const cookieStore = await cookies();
  const existing = cookieStore.get(ANON_COOKIE)?.value;

  if (existing) {
    return existing;
  }

  const anonId = randomUUID();

  try {
    cookieStore.set(ANON_COOKIE, anonId, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: ANON_COOKIE_MAX_AGE,
    });
  } catch {
    // Cookie writes are disallowed outside actions/route handlers — ignore.
  }

  return anonId;
}

/**
 * Inserts exactly one analytics row. Fire-and-forget SAFE: every failure is
 * swallowed so analytics can never break a user-facing flow. Never throws.
 *
 * Callers should NOT await this in a hot path — call it and move on (or
 * `void recordEvent(...)`). It is deliberately resilient to bad input.
 */
export async function recordEvent(input: RecordEventInput): Promise<void> {
  try {
    await getDb()
      .insert(analyticsEvents)
      .values({
        type: input.type,
        userId: input.userId ?? null,
        anonId: input.anonId ?? null,
        sessionId: input.sessionId ?? null,
        productId: input.productId ?? null,
        categoryId: input.categoryId ?? null,
        query: input.query ?? null,
        resultCount: input.resultCount ?? null,
        path: input.path ?? null,
        referrer: input.referrer ?? null,
        metadata: input.metadata ?? null,
      });
  } catch {
    // Analytics must never break UX — swallow all errors.
  }
}
