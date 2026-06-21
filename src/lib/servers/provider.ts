/**
 * VPS / cloud-server provisioning client.
 *
 * Env-gated, generic REST client over `fetch` against a configurable upstream
 * (the real panel — e.g. a Virtualizor / SolusVM / custom orchestrator — is
 * wired later). Mirrors the env-gated provider pattern used by the payment
 * gateways (see `src/lib/payments/zarinpal.ts`): unconfigured → a Persian-faced
 * error; never leaks raw upstream errors or stack traces to callers.
 *
 * Configuration (both required to be "configured"):
 *   - SERVER_PROVIDER_API_URL  base URL of the upstream, e.g. https://panel.example.com/api
 *   - SERVER_PROVIDER_API_KEY  bearer token / API key for the upstream
 *
 * Request/response contract (kept deliberately small + documented so the
 * upstream adapter is easy to point at a real panel):
 *
 *   POST {API_URL}/servers
 *     body: { planCode, specs, periodMonths, label }
 *     200 → { ref|id, ipAddress?|ip?, status? }
 *
 *   GET  {API_URL}/servers/{ref}
 *     200 → { ref|id, ipAddress?|ip?, status? }
 *
 * The client normalizes both field-name variants (`ref`/`id`, `ipAddress`/`ip`)
 * and maps the upstream status string onto our `ProvisionStatus`.
 */

import type { ServerStatus } from "@/db/schema";

// Status we expose to callers. A successful provision lands ACTIVE (or PENDING
// when the upstream provisions asynchronously); anything unexpected is FAILED.
export type ProvisionStatus = Extract<ServerStatus, "PENDING" | "ACTIVE" | "FAILED">;

export type ServerSpecs = {
  cpu?: number;
  ram?: number; // GB
  diskGb?: number;
  [key: string]: unknown;
};

export type ProvisionInput = {
  planCode: string;
  specs: ServerSpecs;
  periodMonths: number;
  /** Human label for the instance in the upstream panel (e.g. order number). */
  label?: string;
};

export type ProvisionResult = {
  providerRef: string;
  ipAddress: string | null;
  status: ProvisionStatus;
  /** Raw upstream JSON, persisted as `providerPayload` for audit/debug. */
  raw: unknown;
};

const NOT_CONFIGURED_FA = "سرویس سرور پیکربندی نشده است.";

// ─── Config ───────────────────────────────────────────────────────────────────

function config(): { baseUrl: string; apiKey: string } | null {
  const baseUrl = process.env.SERVER_PROVIDER_API_URL?.trim();
  const apiKey = process.env.SERVER_PROVIDER_API_KEY?.trim();

  if (!baseUrl || !apiKey) {
    return null;
  }

  // Drop a trailing slash so path joins are predictable.
  return { baseUrl: baseUrl.replace(/\/+$/, ""), apiKey };
}

/**
 * True when both the upstream URL and API key are present. Callers should gate
 * any provisioning attempt on this; the browse/seed flows do not need it.
 */
export function isServerProviderConfigured(): boolean {
  return config() != null;
}

// ─── Upstream error (internal — never surfaced raw to clients) ─────────────────

class ServerProviderError extends Error {
  constructor(
    message: string,
    readonly cause?: unknown,
  ) {
    super(message);
    this.name = "ServerProviderError";
  }
}

// ─── Normalization helpers ─────────────────────────────────────────────────────

function normalizeStatus(value: unknown): ProvisionStatus {
  const status = String(value ?? "").toUpperCase();

  if (status === "ACTIVE" || status === "RUNNING" || status === "ONLINE") {
    return "ACTIVE";
  }

  if (status === "PENDING" || status === "PROVISIONING" || status === "QUEUED") {
    return "PENDING";
  }

  if (status === "FAILED" || status === "ERROR") {
    return "FAILED";
  }

  // Upstream accepted the request but reported no/unknown status: treat as a
  // successful synchronous provision.
  return "ACTIVE";
}

function pickRef(json: Record<string, unknown>): string | null {
  const ref = json.ref ?? json.id ?? json.uuid ?? json.serverId;
  return ref == null ? null : String(ref);
}

function pickIp(json: Record<string, unknown>): string | null {
  const ip = json.ipAddress ?? json.ip ?? json.mainIp ?? null;
  return ip == null ? null : String(ip);
}

function toResult(json: unknown): ProvisionResult {
  const obj = (json && typeof json === "object" ? json : {}) as Record<string, unknown>;
  // Some panels wrap the payload in `{ data: {...} }`.
  const data = (obj.data && typeof obj.data === "object" ? obj.data : obj) as Record<
    string,
    unknown
  >;

  const providerRef = pickRef(data);

  if (!providerRef) {
    throw new ServerProviderError("upstream response missing server reference");
  }

  return {
    providerRef,
    ipAddress: pickIp(data),
    status: normalizeStatus(data.status),
    raw: json,
  };
}

// ─── REST plumbing ─────────────────────────────────────────────────────────────

async function request(method: "GET" | "POST", path: string, body?: unknown): Promise<unknown> {
  const cfg = config();

  if (!cfg) {
    // Configured-state errors are user-facing Persian; the caller (provision)
    // re-throws this. getServer swallows it.
    throw new ServerProviderError(NOT_CONFIGURED_FA);
  }

  let res: Response;

  try {
    res = await fetch(`${cfg.baseUrl}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${cfg.apiKey}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: body == null ? undefined : JSON.stringify(body),
      cache: "no-store",
    });
  } catch (error) {
    throw new ServerProviderError("upstream request failed", error);
  }

  if (!res.ok) {
    // Drain the body for the internal log only; never surface it.
    const detail = await res.text().catch(() => "");
    throw new ServerProviderError(`upstream returned HTTP ${res.status}`, detail);
  }

  return res.json().catch(() => {
    throw new ServerProviderError("upstream returned a non-JSON response");
  });
}

// ─── Public API ────────────────────────────────────────────────────────────────

/**
 * Provisions a server for the given plan. On success resolves with the upstream
 * reference, optional IP, and a normalized status.
 *
 * Throws a Persian-faced error when the provider is unconfigured. Any other
 * (network / HTTP / parse) failure is logged internally and re-thrown as a
 * generic Persian message — the raw upstream error never reaches the caller.
 */
export async function provisionServer(input: ProvisionInput): Promise<ProvisionResult> {
  if (!isServerProviderConfigured()) {
    throw new Error(NOT_CONFIGURED_FA);
  }

  try {
    const json = await request("POST", "/servers", {
      planCode: input.planCode,
      specs: input.specs,
      periodMonths: input.periodMonths,
      label: input.label ?? null,
    });

    return toResult(json);
  } catch (error) {
    if (error instanceof ServerProviderError && error.message === NOT_CONFIGURED_FA) {
      throw new Error(NOT_CONFIGURED_FA);
    }

    console.error("[servers] provisionServer failed", error);
    throw new Error("ثبت سرور در سرویس‌دهنده با خطا مواجه شد.");
  }
}

/**
 * Fetches the current state of a previously provisioned server by its upstream
 * reference. Returns `null` (never throws) when the provider is unconfigured or
 * the lookup fails — callers treat a missing result as "unknown / unchanged".
 */
export async function getServer(ref: string): Promise<ProvisionResult | null> {
  if (!isServerProviderConfigured()) {
    return null;
  }

  try {
    const json = await request("GET", `/servers/${encodeURIComponent(ref)}`);
    return toResult(json);
  } catch (error) {
    console.error("[servers] getServer failed", error);
    return null;
  }
}
