/**
 * Domain management domain-logic. The local DB is the source of truth; every
 * mutation persists locally and then does a *best-effort* push to the registrar
 * (Spaceship). Registrar push never blocks success — when it is unconfigured or
 * fails, the local change still stands and `registrarPushed` is reported false.
 *
 * All reads/writes are ownership-scoped by `userId`.
 */

import { and, asc, eq } from "drizzle-orm";

import { type DomainDnsRecord, domainDnsRecords, domainRegistrations } from "@/db/schema";
import { getDb } from "@/lib/db";
import { DNS_RECORD_TYPES, type DnsRecordType } from "@/lib/domains/dns";
import {
  type DnsRecordInput,
  getDomain,
  pushContact,
  pushDnsRecords,
  pushDomainSettings,
  pushNameservers,
} from "@/lib/domains/spaceship";

export type ManagedDomain = typeof domainRegistrations.$inferSelect;

export class DomainManageError extends Error {
  constructor(
    readonly code: string,
    readonly messageFa: string,
  ) {
    super(code);
    this.name = "DomainManageError";
  }
}

const MIN_TTL = 60;
const MAX_TTL = 86400;

// ─── Validation ───────────────────────────────────────────────────────────────

const IPV4 = /^(\d{1,3}\.){3}\d{1,3}$/;
const IPV6 = /^[0-9a-fA-F:]+$/;
const HOSTNAME = /^(?=.{1,253}$)([a-zA-Z0-9_-]{1,63}\.)*[a-zA-Z0-9_-]{1,63}\.?$/;
const HOST_NAME = /^(@|\*|(\*\.)?([a-zA-Z0-9_-]{1,63})(\.[a-zA-Z0-9_-]{1,63})*)$/;

function isIpv4(v: string): boolean {
  return IPV4.test(v) && v.split(".").every((p) => Number(p) >= 0 && Number(p) <= 255);
}

export type DnsRecordFields = {
  type: DnsRecordType;
  name: string;
  value: string;
  ttl?: number;
  priority?: number | null;
};

/** Validates + normalizes a DNS record. Throws DomainManageError on bad input. */
export function validateDnsRecord(input: DnsRecordFields): Required<DnsRecordFields> {
  const type = input.type;
  if (!DNS_RECORD_TYPES.includes(type)) {
    throw new DomainManageError("INVALID_TYPE", "نوع رکورد نامعتبر است.");
  }

  const name = (input.name ?? "").trim().toLowerCase() || "@";
  if (!HOST_NAME.test(name)) {
    throw new DomainManageError("INVALID_NAME", "نام میزبان (host) نامعتبر است.");
  }

  const value = (input.value ?? "").trim();
  if (!value) {
    throw new DomainManageError("INVALID_VALUE", "مقدار رکورد را وارد کنید.");
  }

  const ttl = Math.min(MAX_TTL, Math.max(MIN_TTL, Math.trunc(Number(input.ttl)) || 3600));

  let priority: number | null = null;
  if (type === "MX" || type === "SRV") {
    const p = Math.trunc(Number(input.priority));
    if (!Number.isFinite(p) || p < 0 || p > 65535) {
      throw new DomainManageError("INVALID_PRIORITY", "برای رکورد MX/SRV اولویت معتبر لازم است.");
    }
    priority = p;
  }

  // Per-type value validation.
  switch (type) {
    case "A":
      if (!isIpv4(value)) throw new DomainManageError("INVALID_VALUE", "آدرس IPv4 معتبر نیست.");
      break;
    case "AAAA":
      if (!IPV6.test(value) || !value.includes(":"))
        throw new DomainManageError("INVALID_VALUE", "آدرس IPv6 معتبر نیست.");
      break;
    case "CNAME":
    case "NS":
      if (!HOSTNAME.test(value))
        throw new DomainManageError("INVALID_VALUE", "مقصد باید یک نام دامنه معتبر باشد.");
      break;
    case "MX":
      if (!HOSTNAME.test(value))
        throw new DomainManageError("INVALID_VALUE", "میزبان میل (mail host) معتبر نیست.");
      break;
    default:
      // TXT / SRV / CAA: free-form value, already non-empty.
      break;
  }

  return { type, name, value, ttl, priority };
}

// ─── Reads ──────────────────────────────────────────────────────────────────

/** Ownership-scoped fetch of a domain + its DNS records. Throws when not found. */
export async function getManagedDomain(
  userId: string,
  domainId: string,
): Promise<{ domain: ManagedDomain; records: DomainDnsRecord[] }> {
  const db = getDb();
  const domain = await db.query.domainRegistrations.findFirst({
    where: and(eq(domainRegistrations.id, domainId), eq(domainRegistrations.userId, userId)),
  });

  if (!domain) {
    throw new DomainManageError("NOT_FOUND", "دامنه یافت نشد.");
  }

  const records = await db.query.domainDnsRecords.findMany({
    where: eq(domainDnsRecords.domainId, domainId),
    orderBy: [asc(domainDnsRecords.type), asc(domainDnsRecords.name)],
  });

  return { domain, records };
}

async function ownDomainOrThrow(userId: string, domainId: string): Promise<ManagedDomain> {
  const db = getDb();
  const domain = await db.query.domainRegistrations.findFirst({
    where: and(eq(domainRegistrations.id, domainId), eq(domainRegistrations.userId, userId)),
  });
  if (!domain) {
    throw new DomainManageError("NOT_FOUND", "دامنه یافت نشد.");
  }
  return domain;
}

/** Re-pushes the whole record set to the registrar (best-effort). */
async function syncDnsToRegistrar(domainName: string): Promise<boolean> {
  const db = getDb();
  const domain = await db.query.domainRegistrations.findFirst({
    where: eq(domainRegistrations.domainName, domainName),
    columns: { id: true },
  });
  if (!domain) return false;
  const records = await db.query.domainDnsRecords.findMany({
    where: eq(domainDnsRecords.domainId, domain.id),
  });
  const input: DnsRecordInput[] = records.map((r) => ({
    type: r.type,
    name: r.name,
    value: r.value,
    ttl: r.ttl,
    priority: r.priority,
  }));
  const { pushed } = await pushDnsRecords(domainName, input);
  return pushed;
}

// ─── DNS mutations ────────────────────────────────────────────────────────────

export async function createDnsRecord(
  userId: string,
  domainId: string,
  input: DnsRecordFields,
): Promise<{ record: DomainDnsRecord; registrarPushed: boolean }> {
  const domain = await ownDomainOrThrow(userId, domainId);
  const fields = validateDnsRecord(input);
  const db = getDb();

  const [record] = await db
    .insert(domainDnsRecords)
    .values({ domainId, ...fields })
    .returning();

  const registrarPushed = await syncDnsToRegistrar(domain.domainName);
  return { record, registrarPushed };
}

export async function updateDnsRecord(
  userId: string,
  domainId: string,
  recordId: string,
  input: DnsRecordFields,
): Promise<{ record: DomainDnsRecord; registrarPushed: boolean }> {
  const domain = await ownDomainOrThrow(userId, domainId);
  const fields = validateDnsRecord(input);
  const db = getDb();

  const existing = await db.query.domainDnsRecords.findFirst({
    where: and(eq(domainDnsRecords.id, recordId), eq(domainDnsRecords.domainId, domainId)),
    columns: { id: true },
  });
  if (!existing) {
    throw new DomainManageError("RECORD_NOT_FOUND", "رکورد یافت نشد.");
  }

  const [record] = await db
    .update(domainDnsRecords)
    .set({ ...fields, updatedAt: new Date() })
    .where(eq(domainDnsRecords.id, recordId))
    .returning();

  const registrarPushed = await syncDnsToRegistrar(domain.domainName);
  return { record, registrarPushed };
}

export async function deleteDnsRecord(
  userId: string,
  domainId: string,
  recordId: string,
): Promise<{ registrarPushed: boolean }> {
  const domain = await ownDomainOrThrow(userId, domainId);
  const db = getDb();

  const deleted = await db
    .delete(domainDnsRecords)
    .where(and(eq(domainDnsRecords.id, recordId), eq(domainDnsRecords.domainId, domainId)))
    .returning({ id: domainDnsRecords.id });

  if (deleted.length === 0) {
    throw new DomainManageError("RECORD_NOT_FOUND", "رکورد یافت نشد.");
  }

  const registrarPushed = await syncDnsToRegistrar(domain.domainName);
  return { registrarPushed };
}

// ─── Nameservers / settings / contact ─────────────────────────────────────────

export async function setNameservers(
  userId: string,
  domainId: string,
  nameservers: string[],
): Promise<{ domain: ManagedDomain; registrarPushed: boolean }> {
  const domain = await ownDomainOrThrow(userId, domainId);
  const clean = [...new Set(nameservers.map((n) => n.trim().toLowerCase()).filter(Boolean))];

  for (const ns of clean) {
    if (!HOSTNAME.test(ns)) {
      throw new DomainManageError("INVALID_NS", `نِیم‌سرور نامعتبر: ${ns}`);
    }
  }
  if (clean.length > 0 && clean.length < 2) {
    throw new DomainManageError(
      "TOO_FEW_NS",
      "حداقل دو نِیم‌سرور لازم است (یا هیچ‌کدام برای پیش‌فرض).",
    );
  }

  const db = getDb();
  const [updated] = await db
    .update(domainRegistrations)
    .set({ nameservers: clean, updatedAt: new Date() })
    .where(eq(domainRegistrations.id, domainId))
    .returning();

  const { pushed } = await pushNameservers(domain.domainName, clean);
  return { domain: updated, registrarPushed: pushed };
}

export type DomainSettingsInput = {
  autoRenew?: boolean;
  transferLock?: boolean;
  privacyProtection?: boolean;
};

export async function updateSettings(
  userId: string,
  domainId: string,
  input: DomainSettingsInput,
): Promise<{ domain: ManagedDomain; registrarPushed: boolean }> {
  const domain = await ownDomainOrThrow(userId, domainId);
  const patch: DomainSettingsInput & { updatedAt: Date } = { updatedAt: new Date() };
  if (typeof input.autoRenew === "boolean") patch.autoRenew = input.autoRenew;
  if (typeof input.transferLock === "boolean") patch.transferLock = input.transferLock;
  if (typeof input.privacyProtection === "boolean")
    patch.privacyProtection = input.privacyProtection;

  const db = getDb();
  const [updated] = await db
    .update(domainRegistrations)
    .set(patch)
    .where(eq(domainRegistrations.id, domainId))
    .returning();

  const { pushed } = await pushDomainSettings(domain.domainName, input);
  return { domain: updated, registrarPushed: pushed };
}

export type RegistrantContact = {
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  organization?: string;
  address?: string;
  city?: string;
  country?: string;
};

export async function updateContact(
  userId: string,
  domainId: string,
  contact: RegistrantContact,
): Promise<{ domain: ManagedDomain; registrarPushed: boolean }> {
  const domain = await ownDomainOrThrow(userId, domainId);

  const email = contact.email?.trim();
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new DomainManageError("INVALID_EMAIL", "ایمیل معتبر نیست.");
  }

  const snapshot: RegistrantContact = {
    firstName: contact.firstName?.trim() || undefined,
    lastName: contact.lastName?.trim() || undefined,
    email: email || undefined,
    phone: contact.phone?.trim() || undefined,
    organization: contact.organization?.trim() || undefined,
    address: contact.address?.trim() || undefined,
    city: contact.city?.trim() || undefined,
    country: contact.country?.trim() || undefined,
  };

  const db = getDb();
  const [updated] = await db
    .update(domainRegistrations)
    .set({ registrantContact: snapshot, updatedAt: new Date() })
    .where(eq(domainRegistrations.id, domainId))
    .returning();

  const { pushed } = await pushContact(domain.domainName, snapshot as Record<string, unknown>);
  return { domain: updated, registrarPushed: pushed };
}

// ─── Registrar sync ────────────────────────────────────────────────────────────

/**
 * Reconciles local state from the registrar: status, expiry, nameservers.
 * No-op-safe when the integration is unconfigured (only stamps lastSyncedAt).
 */
export async function syncFromRegistrar(
  userId: string,
  domainId: string,
): Promise<{ domain: ManagedDomain; synced: boolean }> {
  const domain = await ownDomainOrThrow(userId, domainId);
  const remote = await getDomain(domain.domainName);
  const db = getDb();

  if (!remote) {
    const [stamped] = await db
      .update(domainRegistrations)
      .set({ lastSyncedAt: new Date(), updatedAt: new Date() })
      .where(eq(domainRegistrations.id, domainId))
      .returning();
    return { domain: stamped, synced: false };
  }

  const patch: Partial<ManagedDomain> = {
    lastSyncedAt: new Date(),
    updatedAt: new Date(),
  };
  if (remote.expiresAt) patch.expiresAt = remote.expiresAt;
  if (remote.nameservers.length > 0) patch.nameservers = remote.nameservers;
  // Map a few common registrar statuses onto our enum.
  const s = (remote.status ?? "").toLowerCase();
  if (s.includes("active") || s.includes("registered")) patch.status = "REGISTERED";
  else if (s.includes("expired")) patch.status = "EXPIRED";

  const [updated] = await db
    .update(domainRegistrations)
    .set(patch)
    .where(eq(domainRegistrations.id, domainId))
    .returning();

  return { domain: updated, synced: true };
}
