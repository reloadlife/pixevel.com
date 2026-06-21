import { and, eq } from "drizzle-orm";

import { domainRegistrations, serverInstances } from "@/db/schema";
import { getDb } from "@/lib/db";
import { renewDomainAtRegistrar } from "@/lib/domains/spaceship";

export type DomainRegistration = typeof domainRegistrations.$inferSelect;
export type ServerInstance = typeof serverInstances.$inferSelect;

/** A service expiring within this many days surfaces a warning badge. */
export const EXPIRY_WARNING_DAYS = 30;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

export class ServiceError extends Error {
  constructor(
    public code: string,
    public messageFa: string,
  ) {
    super(code);
    this.name = "ServiceError";
  }
}

/**
 * Number of whole days until `expiresAt` (negative when already expired).
 * Returns `null` when no expiry is set.
 */
export function daysUntil(expiresAt: Date | string | null): number | null {
  if (!expiresAt) {
    return null;
  }
  const diff = new Date(expiresAt).getTime() - Date.now();
  return Math.ceil(diff / MS_PER_DAY);
}

export function isExpired(expiresAt: Date | string | null): boolean {
  const days = daysUntil(expiresAt);
  return days != null && days < 0;
}

export function isExpiringSoon(expiresAt: Date | string | null): boolean {
  const days = daysUntil(expiresAt);
  return days != null && days >= 0 && days <= EXPIRY_WARNING_DAYS;
}

/**
 * Auto-renew is not a first-class column yet, so it is read from the
 * registrar/provider JSON payload (`{ autoRenew: true }`) and defaults to off.
 */
export function readAutoRenew(payload: unknown): boolean {
  return (
    !!payload &&
    typeof payload === "object" &&
    (payload as { autoRenew?: unknown }).autoRenew === true
  );
}

/** Add `years` to a base date (start of "now" when the service already lapsed). */
function extendByYears(base: Date | string | null, years: number): Date {
  const start = base && new Date(base).getTime() > Date.now() ? new Date(base) : new Date();
  const next = new Date(start);
  next.setFullYear(next.getFullYear() + years);
  return next;
}

/** Add `months` to a base date (start of "now" when the service already lapsed). */
function extendByMonths(base: Date | string | null, months: number): Date {
  const start = base && new Date(base).getTime() > Date.now() ? new Date(base) : new Date();
  const next = new Date(start);
  next.setMonth(next.getMonth() + months);
  return next;
}

/**
 * Renew a domain the caller owns. No registrar integration yet, so this is a
 * stub that extends `expiresAt` by the registration term (`years`) and clears an
 * EXPIRED status back to REGISTERED. Returns the updated row.
 */
export async function renewDomain(userId: string, domainId: string): Promise<DomainRegistration> {
  const db = getDb();
  const domain = await db.query.domainRegistrations.findFirst({
    where: and(eq(domainRegistrations.id, domainId), eq(domainRegistrations.userId, userId)),
  });

  if (!domain) {
    throw new ServiceError("NOT_FOUND", "دامنه یافت نشد.");
  }

  if (domain.status === "PENDING" || domain.status === "FAILED") {
    throw new ServiceError("NOT_RENEWABLE", "این دامنه هنوز قابل تمدید نیست.");
  }

  const years = domain.years > 0 ? domain.years : 1;

  // Best-effort registrar renew; trust its expiry when returned, otherwise
  // extend locally by the registration term. Never blocks on the registrar.
  const registrar = await renewDomainAtRegistrar(domain.domainName, years);
  const expiresAt = registrar.expiresAt ?? extendByYears(domain.expiresAt, years);

  const [updated] = await db
    .update(domainRegistrations)
    .set({ expiresAt, status: "REGISTERED", updatedAt: new Date() })
    .where(eq(domainRegistrations.id, domain.id))
    .returning();

  return updated;
}

/**
 * Renew a server the caller owns. Stub: extends `expiresAt` by the billing term
 * (`periodMonths`) and reactivates a SUSPENDED instance. Returns the updated row.
 */
export async function renewServer(userId: string, serverId: string): Promise<ServerInstance> {
  const db = getDb();
  const [server] = await db
    .select()
    .from(serverInstances)
    .where(and(eq(serverInstances.id, serverId), eq(serverInstances.userId, userId)))
    .limit(1);

  if (!server) {
    throw new ServiceError("NOT_FOUND", "سرور یافت نشد.");
  }

  if (server.status === "PENDING" || server.status === "FAILED" || server.status === "TERMINATED") {
    throw new ServiceError("NOT_RENEWABLE", "این سرور قابل تمدید نیست.");
  }

  const months = server.periodMonths > 0 ? server.periodMonths : 1;
  const expiresAt = extendByMonths(server.expiresAt, months);

  const [updated] = await db
    .update(serverInstances)
    .set({ expiresAt, status: "ACTIVE", updatedAt: new Date() })
    .where(eq(serverInstances.id, server.id))
    .returning();

  return updated;
}
