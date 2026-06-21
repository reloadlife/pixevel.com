/**
 * Spaceship.com reseller API client (domains).
 *
 * Env-gated, thin wrapper over `fetch`. When the three env vars are absent the
 * module degrades gracefully: search returns a `configured: false` result and
 * register throws a Persian error — no raw upstream errors ever leak to callers.
 *
 * Auth: the API authenticates with two plain headers, `X-API-Key` and
 * `X-API-Secret` (no encoding). Base URL is `https://spaceship.dev/api/v1`.
 *
 * Reference (official public API docs):
 *   https://docs.spaceship.dev/
 *   - GET  /domains/{domain}/available      → availability + (premium) pricing
 *   - POST /domains/available               → bulk availability
 *   - POST /domains/{domain}                → register (async, 202 + op id)
 *   - GET  /domains/{domain}                → domain info (status, expiry, ns…)
 *
 * NOTE — parts that could NOT be fully verified from the public docs and are
 * implemented best-effort (see the per-function comments):
 *   1. The exact pricing field for a STANDARD (non-premium) registration. The
 *      docs show a `premiumPricing` array on the availability response; the
 *      standard-tier price field name is assumed (`price` / `registerPrice`).
 *      We read several plausible shapes and fall back to a configured default.
 *   2. The contact model. Registration references contact IDs (registrant /
 *      admin / tech / billing). Creating contacts is assumed to be a separate
 *      `POST /contacts` call returning an id; here we accept a pre-created
 *      contact id via `SPACESHIP_CONTACT_ID` (single id reused for all roles)
 *      and pass it through. Wire the real contact-creation flow when verified.
 *   3. Registration is asynchronous (HTTP 202 + `spaceship-async-operationid`).
 *      We return that operation id as the registrar ref and do not block on
 *      polling `/async-operations/{id}`; a follow-up reconcile job can poll it.
 */

// ─── Config ─────────────────────────────────────────────────────────────────

const BASE_URL = (process.env.SPACESHIP_BASE_URL ?? "https://spaceship.dev/api/v1").replace(
  /\/+$/,
  "",
);

const DEFAULT_TIMEOUT_MS = Number(process.env.SPACESHIP_TIMEOUT_MS ?? "12000");

/** Currency Spaceship quotes in (USD by default). Used only for logging/labels. */
const QUOTE_CURRENCY = process.env.SPACESHIP_QUOTE_CURRENCY ?? "USD";

/** Persian, user-facing error for the unconfigured / failure states. */
const NOT_CONFIGURED_FA = "سرویس دامنه پیکربندی نشده است.";
const UPSTREAM_ERROR_FA = "ثبت دامنه در حال حاضر امکان‌پذیر نیست.";

function readConfig() {
  const apiKey = process.env.SPACESHIP_API_KEY;
  const apiSecret = process.env.SPACESHIP_API_SECRET;

  if (!apiKey || !apiSecret) {
    return null;
  }

  return { apiKey, apiSecret };
}

/** Whether the Spaceship integration has the credentials it needs to run. */
export function isSpaceshipConfigured(): boolean {
  return readConfig() !== null;
}

/**
 * Demo mode: simulate availability/registration WITHOUT registrar credentials so
 * the domain flow is usable in development. HARD off in production — a simulated
 * "REGISTERED" domain a customer paid for is a financial/trust hazard, so no env
 * flag can enable demo in prod. Real creds always take precedence.
 */
export function isDomainDemo(): boolean {
  if (process.env.NODE_ENV === "production" || isSpaceshipConfigured()) {
    return false;
  }
  return true;
}

/** The storefront search is shown when either real creds OR demo mode is active. */
export function isDomainSearchEnabled(): boolean {
  return isSpaceshipConfigured() || isDomainDemo();
}

// ─── Demo simulation (no registrar) ───────────────────────────────────────────

const DEMO_TLD_USD: Record<string, number> = {
  com: 11.98,
  net: 13.98,
  org: 12.98,
  co: 27.98,
  io: 39.98,
  shop: 2.99,
  dev: 13.98,
};

/** Stable hash so a given domain always returns the same demo availability. */
function demoHash(input: string): number {
  let h = 0;
  for (let i = 0; i < input.length; i++) {
    h = (h * 31 + input.charCodeAt(i)) >>> 0;
  }
  return h;
}

function demoSearch(name: string): SearchDomainResult {
  const { sld, tld } = splitDomain(name.trim().toLowerCase());
  if (!sld) {
    return { configured: true, sld: "", quotes: [] };
  }

  const tlds = tld ? [tld] : [...COMMON_TLDS];
  const quotes: DomainTldQuote[] = tlds.map((currentTld) => {
    const domainName = `${sld}.${currentTld}`;
    const h = demoHash(domainName);
    return {
      domainName,
      tld: currentTld,
      // ~80% available, deterministic per domain.
      available: h % 5 !== 0,
      premium: h % 17 === 0,
      priceUsd: DEMO_TLD_USD[currentTld] ?? 14.98,
      currency: QUOTE_CURRENCY,
    };
  });

  return { configured: true, sld, quotes };
}

// ─── Types ──────────────────────────────────────────────────────────────────

export type DomainTldQuote = {
  /** Full domain, e.g. "myshop.com". */
  domainName: string;
  /** TLD without the dot, e.g. "com". */
  tld: string;
  available: boolean;
  premium: boolean;
  /** Yearly registration price in USD (as quoted by the registrar), or null. */
  priceUsd: number | null;
  currency: string;
};

export type SearchDomainResult =
  | { configured: false; quotes: never[] }
  | { configured: true; sld: string; quotes: DomainTldQuote[] };

export type RegisterDomainInput = {
  domainName: string;
  years: number;
  contact?: {
    /** Pre-created Spaceship contact id reused for all roles. */
    contactId?: string;
    firstName?: string;
    lastName?: string;
    email?: string;
    phone?: string;
  };
};

export type RegisterDomainResult = {
  /** Registrar reference — here the async operation id (or domain on sync). */
  registrarRef: string;
  /** Raw upstream payload, persisted for audit. */
  payload: unknown;
  /** Expiry if the upstream returned one synchronously; usually null (async). */
  expiresAt: Date | null;
};

export type GetDomainResult = {
  domainName: string;
  status: string | null;
  expiresAt: Date | null;
  nameservers: string[];
  payload: unknown;
};

// ─── Common TLDs offered in search ──────────────────────────────────────────

/** TLDs checked for a bare SLD search (no `.ir` — not offered). */
export const COMMON_TLDS = ["com", "net", "org", "co", "io", "shop", "dev"] as const;

// ─── HTTP helper ─────────────────────────────────────────────────────────────

async function spaceshipFetch(
  path: string,
  init: RequestInit & { config: { apiKey: string; apiSecret: string } },
): Promise<Response> {
  const { config, ...rest } = init;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

  try {
    return await fetch(`${BASE_URL}${path}`, {
      ...rest,
      signal: controller.signal,
      headers: {
        "X-API-Key": config.apiKey,
        "X-API-Secret": config.apiSecret,
        Accept: "application/json",
        ...(rest.body ? { "Content-Type": "application/json" } : {}),
        ...(rest.headers ?? {}),
      },
    });
  } finally {
    clearTimeout(timer);
  }
}

function splitDomain(domainName: string): { sld: string; tld: string } {
  const clean = domainName.trim().toLowerCase().replace(/\.+$/, "");
  const dot = clean.indexOf(".");

  if (dot <= 0) {
    return { sld: clean, tld: "" };
  }

  return { sld: clean.slice(0, dot), tld: clean.slice(dot + 1) };
}

/**
 * Best-effort price extraction. The standard-tier price field is not certain
 * from the public docs, so we probe several plausible shapes and otherwise
 * read the premiumPricing array. Returns USD price or null when unknown.
 */
function extractPriceUsd(body: Record<string, unknown>): {
  premium: boolean;
  priceUsd: number | null;
} {
  const premiumArr = Array.isArray(body.premiumPricing)
    ? (body.premiumPricing as Array<Record<string, unknown>>)
    : [];

  const registerEntry =
    premiumArr.find((entry) => String(entry.operation ?? "").toLowerCase() === "register") ??
    premiumArr[0];

  if (registerEntry && typeof registerEntry.price !== "undefined") {
    const price = Number(registerEntry.price);
    return { premium: true, priceUsd: Number.isFinite(price) ? price : null };
  }

  // Probe plausible standard-tier fields (unverified — see module header).
  for (const key of ["price", "registerPrice", "registrationPrice", "renewalPrice"]) {
    const raw = body[key];
    if (typeof raw === "number" && Number.isFinite(raw)) {
      return { premium: false, priceUsd: raw };
    }
    if (typeof raw === "string" && Number.isFinite(Number(raw))) {
      return { premium: false, priceUsd: Number(raw) };
    }
  }

  return { premium: false, priceUsd: null };
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Checks availability + price for a search term.
 *
 * - If the term already contains a dot ("foo.com"), only that domain is checked.
 * - Otherwise the bare SLD is checked across {@link COMMON_TLDS}.
 *
 * Never throws: upstream/network failures collapse to an entry with
 * `available: false, priceUsd: null` so the UI can render a degraded row.
 */
export async function searchDomain(name: string): Promise<SearchDomainResult> {
  const config = readConfig();

  if (!config) {
    return isDomainDemo() ? demoSearch(name) : { configured: false, quotes: [] };
  }

  const term = name.trim().toLowerCase();
  const { sld, tld } = splitDomain(term);

  if (!sld) {
    return { configured: true, sld: "", quotes: [] };
  }

  const tlds = tld ? [tld] : [...COMMON_TLDS];

  const quotes = await Promise.all(
    tlds.map(async (currentTld): Promise<DomainTldQuote> => {
      const domainName = `${sld}.${currentTld}`;
      const fallback: DomainTldQuote = {
        domainName,
        tld: currentTld,
        available: false,
        premium: false,
        priceUsd: null,
        currency: QUOTE_CURRENCY,
      };

      try {
        const res = await spaceshipFetch(`/domains/${encodeURIComponent(domainName)}/available`, {
          method: "GET",
          config,
        });

        if (!res.ok) {
          return fallback;
        }

        const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
        const available = String(body.result ?? "").toLowerCase() === "available";
        const { premium, priceUsd } = extractPriceUsd(body);

        return {
          domainName,
          tld: currentTld,
          available,
          premium,
          priceUsd,
          currency: QUOTE_CURRENCY,
        };
      } catch {
        // Network/timeout — degrade to "unavailable" rather than throwing.
        return fallback;
      }
    }),
  );

  return { configured: true, sld, quotes };
}

/**
 * Registers a single domain. Returns the registrar reference (async operation
 * id) on success. Throws a Persian error when unconfigured or on upstream
 * failure — the raw upstream error is never surfaced to the caller.
 */
export async function registerDomain(input: RegisterDomainInput): Promise<RegisterDomainResult> {
  const config = readConfig();

  const domainName = input.domainName.trim().toLowerCase();
  const years = Math.min(10, Math.max(1, Math.trunc(input.years) || 1));

  // Demo mode: simulate a successful registration so checkout fulfillment can
  // create a REGISTERED row and the manage flow is exercisable without creds.
  if (!config) {
    if (!isDomainDemo()) {
      throw new Error(NOT_CONFIGURED_FA);
    }
    const expiresAt = new Date();
    expiresAt.setFullYear(expiresAt.getFullYear() + years);
    return {
      registrarRef: `DEMO-${domainName}-${expiresAt.getTime()}`,
      payload: { demo: true, domainName, years },
      expiresAt,
    };
  }

  // Contact id: either supplied per-call or a single shared id from env.
  // The real flow would POST /contacts first; see module header note (2).
  const contactId = input.contact?.contactId ?? process.env.SPACESHIP_CONTACT_ID;

  if (!contactId) {
    // Without a contact we cannot register; surface a clean Persian error.
    throw new Error(NOT_CONFIGURED_FA);
  }

  const body = {
    autoRenew: false,
    years,
    privacyProtection: { level: "high", userConsent: true },
    contacts: {
      registrant: contactId,
      admin: contactId,
      tech: contactId,
      billing: contactId,
    },
  };

  let res: Response;

  try {
    res = await spaceshipFetch(`/domains/${encodeURIComponent(domainName)}`, {
      method: "POST",
      config,
      body: JSON.stringify(body),
    });
  } catch {
    throw new Error(UPSTREAM_ERROR_FA);
  }

  if (!res.ok && res.status !== 202) {
    // Log server-side for operators; never leak upstream detail to the client.
    const detail = await res.text().catch(() => "");
    console.error(`[spaceship] register ${domainName} failed: ${res.status} ${detail}`);
    throw new Error(UPSTREAM_ERROR_FA);
  }

  const payload = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  const operationId =
    res.headers.get("spaceship-async-operationid") ??
    (typeof payload.operationId === "string" ? payload.operationId : null);

  const expiresAt =
    typeof payload.expirationDate === "string" ? new Date(payload.expirationDate) : null;

  return {
    registrarRef: operationId ?? domainName,
    payload,
    expiresAt: expiresAt && !Number.isNaN(expiresAt.getTime()) ? expiresAt : null,
  };
}

/**
 * Fetches the current registrar state for a domain. Returns null when
 * unconfigured or on any upstream error (never throws).
 */
export async function getDomain(name: string): Promise<GetDomainResult | null> {
  const config = readConfig();

  if (!config) {
    return null;
  }

  const domainName = name.trim().toLowerCase();

  try {
    const res = await spaceshipFetch(`/domains/${encodeURIComponent(domainName)}`, {
      method: "GET",
      config,
    });

    if (!res.ok) {
      return null;
    }

    const payload = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    const expRaw = payload.expirationDate;
    const expiresAt = typeof expRaw === "string" ? new Date(expRaw) : null;
    const nameservers = Array.isArray(payload.nameservers)
      ? (payload.nameservers as unknown[]).map(String)
      : [];

    return {
      domainName,
      status: typeof payload.status === "string" ? payload.status : null,
      expiresAt: expiresAt && !Number.isNaN(expiresAt.getTime()) ? expiresAt : null,
      nameservers,
      payload,
    };
  } catch {
    return null;
  }
}

// ─── Management verbs ─────────────────────────────────────────────────────────
//
// All of the following MUTATE registrar state. The local DB is the source of
// truth in Pixevel, so these are *best-effort*: when the integration is not
// configured (or the upstream call fails) they return `{ pushed: false }` and
// never throw — the caller has already persisted the change locally. The exact
// endpoint shapes are implemented per the public docs and are tolerant of
// non-2xx responses (logged server-side, never surfaced).

export type PushResult = { pushed: boolean };

export type DnsRecordInput = {
  type: string;
  /** Host relative to the domain ("@" for apex). */
  name: string;
  value: string;
  ttl: number;
  priority?: number | null;
};

/** Generic best-effort mutation wrapper shared by the verbs below. */
async function spaceshipMutate(
  path: string,
  method: "POST" | "PUT" | "PATCH" | "DELETE",
  body?: unknown,
): Promise<PushResult> {
  const config = readConfig();
  if (!config) {
    return { pushed: false };
  }

  try {
    const res = await spaceshipFetch(path, {
      method,
      config,
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });

    if (!res.ok && res.status !== 202) {
      const detail = await res.text().catch(() => "");
      console.error(`[spaceship] ${method} ${path} → ${res.status} ${detail}`);
      return { pushed: false };
    }

    return { pushed: true };
  } catch (error) {
    console.error(`[spaceship] ${method} ${path} failed`, error);
    return { pushed: false };
  }
}

/** Set custom nameservers ([] / empty ⇒ registrar defaults). */
export function pushNameservers(domainName: string, nameservers: string[]): Promise<PushResult> {
  const clean = nameservers.map((n) => n.trim().toLowerCase()).filter(Boolean);
  const provider = clean.length === 0 ? "basic" : "custom";
  return spaceshipMutate(
    `/domains/${encodeURIComponent(domainName.trim().toLowerCase())}/nameservers`,
    "PUT",
    { provider, hosts: clean },
  );
}

/** Toggle auto-renew, transfer lock and/or privacy protection. */
export function pushDomainSettings(
  domainName: string,
  settings: { autoRenew?: boolean; transferLock?: boolean; privacyProtection?: boolean },
): Promise<PushResult> {
  const body: Record<string, unknown> = {};
  if (settings.autoRenew !== undefined) body.autoRenew = settings.autoRenew;
  if (settings.transferLock !== undefined) body.locked = settings.transferLock;
  if (settings.privacyProtection !== undefined) {
    body.privacyProtection = {
      level: settings.privacyProtection ? "high" : "public",
      userConsent: true,
    };
  }
  return spaceshipMutate(
    `/domains/${encodeURIComponent(domainName.trim().toLowerCase())}`,
    "PUT",
    body,
  );
}

/** Update the registrant contact snapshot. */
export function pushContact(
  domainName: string,
  contact: Record<string, unknown>,
): Promise<PushResult> {
  return spaceshipMutate(
    `/domains/${encodeURIComponent(domainName.trim().toLowerCase())}/contacts`,
    "PUT",
    { registrant: contact },
  );
}

/** Replace the full DNS record set for a domain. */
export function pushDnsRecords(domainName: string, records: DnsRecordInput[]): Promise<PushResult> {
  const items = records.map((r) => ({
    type: r.type,
    name: r.name,
    value: r.value,
    ttl: r.ttl,
    ...(r.priority != null ? { priority: r.priority } : {}),
  }));
  return spaceshipMutate(
    `/dns/records/${encodeURIComponent(domainName.trim().toLowerCase())}`,
    "PUT",
    { force: true, items },
  );
}

export type RegistrarRenewResult = {
  pushed: boolean;
  expiresAt: Date | null;
  payload: unknown;
};

/** Renew a domain at the registrar; returns the new expiry when provided. */
export async function renewDomainAtRegistrar(
  domainName: string,
  years: number,
): Promise<RegistrarRenewResult> {
  const config = readConfig();
  if (!config) {
    return { pushed: false, expiresAt: null, payload: null };
  }

  const safeYears = Math.min(10, Math.max(1, Math.trunc(years) || 1));

  try {
    const res = await spaceshipFetch(
      `/domains/${encodeURIComponent(domainName.trim().toLowerCase())}/renew`,
      { method: "POST", config, body: JSON.stringify({ years: safeYears }) },
    );

    if (!res.ok && res.status !== 202) {
      const detail = await res.text().catch(() => "");
      console.error(`[spaceship] renew ${domainName} → ${res.status} ${detail}`);
      return { pushed: false, expiresAt: null, payload: null };
    }

    const payload = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    const exp =
      typeof payload.expirationDate === "string" ? new Date(payload.expirationDate) : null;
    return {
      pushed: true,
      expiresAt: exp && !Number.isNaN(exp.getTime()) ? exp : null,
      payload,
    };
  } catch (error) {
    console.error(`[spaceship] renew ${domainName} failed`, error);
    return { pushed: false, expiresAt: null, payload: null };
  }
}
