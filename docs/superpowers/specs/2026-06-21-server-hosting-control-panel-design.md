# Server / Hosting Control-Panel & Multi-Backend Integration — Design

- **Date:** 2026-06-21
- **Status:** Approved (pending written-spec review)
- **Author:** Pixevel team
- **Topic:** Connect the existing "servers / hosting" world to real backends (WHM, Proxmox, KVM, ESXi) and give customers a self-service control panel: one-click login, console (VNC), change password, SSH keys, power.

---

## 1. Background & current state

Pixevel already has a minimal, well-structured "servers" foundation:

- **DB:** `serverInstances` table + `serverStatus` enum (`PENDING|ACTIVE|FAILED|SUSPENDED|TERMINATED`); products tagged `fulfillmentType = "SERVER"`.
- **Provider client:** `src/lib/servers/provider.ts` — a single env-gated generic REST client (`SERVER_PROVIDER_API_URL` + `SERVER_PROVIDER_API_KEY`). No real hypervisor/panel integration.
- **Fulfillment:** `src/lib/orders/fulfillment/server.ts` provisions on order `PAID` via `provisionServer()`; upserts a `serverInstances` row keyed by `orderItemId`.
- **Pages:** `/servers` (browse plans, SSR), `/account/servers` (list instances, SSR). `POST /api/account/servers/[id]/renew` extends `expiresAt` locally (stub).
- **Seed:** `scripts/seed-servers.ts` seeds the `hosting` category, 3 plans (cloud-s/m/l) × 3 periods (1/3/12mo) + inventory. Variant `metadata`: `{ planCode, cpu, ram, diskGb, periodMonths }`.

What's missing — and what this design adds — is: real per-backend adapters, an encrypted credential store, and the customer **control panel** (login/console/password/SSH-keys/power).

This design mirrors the **domains** feature's proven architecture: an env-gated adapter, a hard-off-in-production **demo mode**, the local DB as source of truth, best-effort upstream pushes, and generic Persian errors that never leak upstream detail.

### Decisions locked during brainstorming

1. **All four backends** (WHM, Proxmox, KVM, ESXi) via **one universal adapter interface + capability model**.
2. **Access model: one-click SSO / deep-link** into each panel's own console & login. **No** embedded noVNC / web-SSH proxy in v1 (avoids a long-lived websocket gateway outside Next's request model). Embedded console is an explicit follow-up.
3. **Secrets model:** a DB `serverNodes` table with credentials **encrypted at rest** (AES-256-GCM, key from `APP_VAULT_KEY` — the shared app secrets key, see sibling spec). Per-server root passwords are **write-only** — set/reset and pushed to the panel, never persisted; only `lastPasswordRotatedAt` is stored.
4. **v1 action set (Core):** console (VNC deep-link), one-click panel login (SSO), change root password, manage SSH keys, power (start/stop/reboot), live status/IP/specs. **Reinstall/rebuild-OS is in the interface but stubbed** (`NOT_IMPLEMENTED`) — it needs an OS-template catalog + per-provider cloud-init, deferred.
5. **Password reset UX:** offer **both** — default to a strong auto-generated password shown once (copy-to-clipboard, never stored), with the option to type a custom one. Policy-validated either way.

---

## 2. Goals / non-goals

### Goals
- A single `ServerAdapter` contract that all four backends implement; UI and routes never branch on provider name.
- Customer self-service control panel at `/account/servers/[id]`.
- Admin node management at `/admin/servers` (register/test/disable backends; view all instances; manual retry/suspend).
- Encrypted credentials; write-only passwords; ownership-checked, rate-limited customer routes.
- Demo mode so the whole flow is usable in development without any real panel.

### Non-goals (this spec)
- Embedded noVNC console / browser SSH terminal (websocket proxy). → follow-up.
- Real OS reinstall/rebuild + template catalog + cloud-init. → follow-up (interface method stubbed now).
- Auto-renew / recurring billing; usage/bandwidth metering; backups/snapshots UI; extra-IP / IPv6 management.

---

## 3. Architecture & data flow

```
order PAID ─► fulfillServerItems ─► pickNode(provider) ─► adapterFor(node).provision()
                                                              │
                                                     serverInstances row (nodeId, providerRef, status)

customer ─► /account/servers/[id] ─► route ─► adapterFor(node) ─► panel API
   (auth + ownership + rate-limit + requireCapability)        (best-effort; DB is source of truth)

admin ─► /admin/servers ─► /api/admin/server-nodes (encrypt creds) + adapter.test()
```

- **`adapterFor(provider): ServerAdapter`** — registry resolving the adapter from `node.provider`.
- **Capability gating** — every customer action calls `requireCapability(adapter, cap)`; unsupported → `apiError("CAPABILITY_UNSUPPORTED", ...)`. The detail page only renders buttons for capabilities the instance's provider advertises.
- **Local DB authoritative** — actions persist locally first where meaningful (e.g. sshKeys list, lastPasswordRotatedAt), then push to the panel; upstream failures are logged server-side and surfaced as a generic Persian error.

---

## 4. Adapter interface & capability model

`src/lib/servers/adapters/types.ts`:

```ts
export type ServerProvider = "PROXMOX" | "WHM" | "KVM" | "ESXI" | "GENERIC";

export type ServerCapability =
  | "console"        // VNC / noVNC deep-link
  | "ssoLogin"       // one-click panel login
  | "passwordReset"  // set/reset root or account password (write-only)
  | "sshKeys"        // manage authorized_keys
  | "power"          // start / stop / reboot
  | "reinstall"      // rebuild OS from template (stubbed v1)
  | "suspend";       // admin suspend / unsuspend

export type PowerAction = "start" | "stop" | "reboot";

export type ServerRuntime = {
  powerState: "running" | "stopped" | "unknown";
  ipAddress: string | null;
  specs: { cpu?: number; ram?: number; diskGb?: number } | null;
  raw?: unknown;
};

export type AccessLink = { url: string; expiresAt: Date | null };

export type ServerNodeRecord = {
  id: string;
  provider: ServerProvider;
  host: string;
  /** Decrypted at call time by the registry; adapters receive plaintext creds. */
  credentials: Record<string, string>;
  config: Record<string, unknown>;
};

export interface ServerAdapter {
  readonly provider: ServerProvider;
  capabilities(): ServerCapability[];

  /** Liveness/auth check for admin "test connection". */
  test(node: ServerNodeRecord): Promise<{ ok: boolean; message?: string }>;

  provision(node: ServerNodeRecord, input: ProvisionInput): Promise<ProvisionResult>;
  getStatus(node: ServerNodeRecord, ref: string): Promise<ServerRuntime | null>;

  consoleLink(node: ServerNodeRecord, ref: string): Promise<AccessLink>;
  ssoLink(node: ServerNodeRecord, ref: string): Promise<AccessLink>;

  setPassword(node: ServerNodeRecord, ref: string, password: string): Promise<void>;
  setSshKeys(node: ServerNodeRecord, ref: string, publicKeys: string[]): Promise<void>;
  power(node: ServerNodeRecord, ref: string, action: PowerAction): Promise<void>;
  reinstall(node: ServerNodeRecord, ref: string, template: string): Promise<void>; // throws NOT_IMPLEMENTED
  suspend(node: ServerNodeRecord, ref: string, on: boolean): Promise<void>;
}
```

`ProvisionInput`/`ProvisionResult` reuse the shapes already in `src/lib/servers/provider.ts` (extended with `node`).

### Per-provider capabilities

| Provider | console | ssoLogin | passwordReset | sshKeys | power | suspend | reinstall |
|----------|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| PROXMOX  | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | stub |
| KVM      | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | stub |
| ESXI     | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | stub |
| WHM      | — | ✓ | ✓ | — | — | ✓ | — |
| GENERIC  | — | — | — | — | — | — | — |

### Adapter notes (per backend)

- **Proxmox VE** (`/api2/json`): API-token auth (`PVEAPIToken=user@realm!tokenid=secret`). `consoleLink` issues a `vncproxy` ticket and builds the noVNC URL; `ssoLink` builds an access-ticket login URL; `power` → `status/start|stop|reboot`; `setPassword`/`setSshKeys` via guest-agent `set-user-password` / cloud-init `sshkeys`; `getStatus` → `status/current`.
- **WHM/cPanel** (`/json-api`, `whostmgr`): API-token auth. `ssoLink` → `create_user_session` (cPanel SSO). `setPassword` → `passwd`. `suspend` → `suspendacct`/`unsuspendacct`. No console / sshKeys / power (capability model hides them).
- **KVM (libvirt)**: REST shim assumed at `node.host` (libvirt has no native HTTP API). `consoleLink` → VNC display URL; password/keys via cloud-init/guestfs through the shim. Documented as requiring the operator-side shim; adapter is a clean client to it.
- **VMware ESXi / vSphere** (REST API `/rest` or `/api`): session auth. `consoleLink` → WebMKS/console ticket; `power` → `power/start|stop|reset`; `setPassword`/`setSshKeys` via guest customization where available.

Each adapter is a thin `fetch` client with a per-request timeout, tolerant parsing, and **never throws raw upstream errors** — it throws typed `ServerAdapterError` (mapped to generic Persian messages at the route layer), logging detail server-side.

---

## 5. Data model changes (`src/db/schema.ts`)

### New enum
```ts
serverProvider = pgEnum("server_provider", ["PROXMOX","WHM","KVM","ESXI","GENERIC"])
```

### New table `serverNodes`
| column | type | notes |
|--------|------|-------|
| id | uuid PK | |
| provider | serverProvider | not null |
| name | text | operator label, not null |
| host | text | base URL, not null |
| encryptedCredentials | text | AES-256-GCM blob (api token/user/secret) |
| config | jsonb | non-secret: datacenter, storage, templates, **weight** |
| status | text | `active` \| `disabled` (default `active`) |
| createdAt / updatedAt | timestamp | |

### `serverInstances` additions
`nodeId` (fk → serverNodes, set null), `provider` (serverProvider, denormalized for display/gating), `hostname` (text), `powerState` (text), `sshKeys` (jsonb: `{ label, publicKey, fingerprint }[]` — public keys are not secret), `lastPasswordRotatedAt` (timestamp), `lastSyncedAt` (timestamp).

### Plan → provider mapping
Variant `metadata` (existing jsonb) gains optional `provider` and `template`/`providerPlan`. `pickNode(provider)` selects an `active` node of that provider, weighted by `config.weight` (simple weighted/round-robin; falls back to `GENERIC` provider.ts when no node matches, preserving current behavior).

### Migration
New drizzle migration `0006_server_nodes`. Note the repo's known migration-drift: generate carefully against current meta, restart the dev server after applying (`getDb()` caches the client).

---

## 6. Secrets / crypto

`src/lib/crypto/secrets.ts` (**shared** with the multi-registrar domains feature — see sibling spec):
- `encryptSecret(plain: string): string` → `base64(iv(12) | tag(16) | ciphertext)` using AES-256-GCM.
- `decryptSecret(blob: string): string`.
- Key from `APP_VAULT_KEY` (32 bytes, hex or base64) — one key for all at-rest secrets (server-node creds and registrar creds alike). **Required in production**; if absent, only demo mode works (no real nodes can be created/used).
- Helpers `encryptJson`/`decryptJson` for the credentials object.
- Key is read once, never logged; plaintext credentials exist only in-process at call time.

Unit-tested round-trip + tamper detection (GCM tag mismatch throws).

---

## 7. API routes

### Customer (all: `getCurrentUser` required, ownership check `instance.userId === user.id`, rate-limited, `requireCapability`)
- `GET  /api/account/servers/[id]` — instance + **live** runtime (adapter.getStatus, cached to `serverInstances`), capabilities list.
- `POST /api/account/servers/[id]/console` — `{ url, expiresAt }` (cap: console).
- `POST /api/account/servers/[id]/login` — `{ url, expiresAt }` SSO (cap: ssoLogin).
- `POST /api/account/servers/[id]/password` — body `{ mode: "generate"|"custom", password? }`; returns the generated password **once** when `generate` (never persisted). (cap: passwordReset).
- `GET/POST/DELETE /api/account/servers/[id]/ssh-keys` — list / add (validate public-key format) / remove; persists `sshKeys` locally then `adapter.setSshKeys`. (cap: sshKeys).
- `POST /api/account/servers/[id]/power` — body `{ action }`. (cap: power).
- `POST /api/account/servers/[id]/renew` — existing.

### Admin (`requireAdmin`)
- `GET/POST /api/admin/server-nodes` — list / create (encrypt creds on write; never return secrets).
- `PATCH/DELETE /api/admin/server-nodes/[id]` — update / disable.
- `POST /api/admin/server-nodes/[id]/test` — `adapter.test()`.
- `GET /api/admin/servers` — all instances (filters: provider/status/user).
- `POST /api/admin/servers/[id]/suspend` — `{ on }`.
- `POST /api/admin/servers/[id]/provision` — manual (re)provision for `FAILED`/`PENDING`.

All responses use the standard `apiOk`/`apiError` envelope. Validation via `parseBody` + Zod.

---

## 8. UI

### Customer control panel — `/account/servers/[id]` (SSR shell + small client islands)
- Header: hostname, status badge, power-state, IP, specs; period/expiry; renew.
- **Power** buttons (start/stop/reboot) with confirm.
- **One-click** buttons: «باز کردن کنسول» (console) and «ورود به پنل» (SSO) — open the returned short-lived URL in a new tab.
- **Password reset** modal: "تولید رمز قوی" (generate, shown once + copy) or type custom; strength meter.
- **SSH keys** manager: list (label + fingerprint), add (paste public key, validated), remove.
- Buttons render only for advertised capabilities (WHM shows login + password only).
- Mobile-first, gold accent, matching the domains detail page style.

### Admin — node management under `/admin/integrations` (server-nodes tab) + instances under `/admin/servers`
- **`/admin/integrations` → server-nodes tab** (unified with the domain-registrars tab from the sibling spec): table of `serverNodes` (provider, host, status, weight), add/edit form (provider-specific credential fields), "تست اتصال" button.
- **`/admin/servers`** instances section: table of all `serverInstances` with provider/status/user filters; suspend / retry-provision actions.
- Sidebar links "ادغام‌ها / Integrations" + "سرورها" (alongside analytics/blog/settings).

---

## 9. Demo mode

`src/lib/servers/demo.ts` + `isServerDemo()` (mirrors `isDomainDemo()`):
- True when **no usable real node exists** for a provider AND `NODE_ENV !== "production"`.
- **Hard-off in production** — a customer must never see a fake "running" server or a fake console URL they paid for.
- Demo adapter: deterministic fake `getStatus`, console/login URLs pointing at a harmless in-app placeholder, password/sshKeys/power succeed as no-ops with the correct success envelope, `provision` returns a `DEMO-...` ref (matches the existing demo register pattern for domains/servers).

---

## 10. Security considerations

- All node credentials AES-256-GCM at rest; key only in env; never logged or returned by any route.
- Root passwords **write-only**: never stored, never returned except the one-time generated value at creation; store only `lastPasswordRotatedAt`.
- Every customer route enforces ownership (`instance.userId === user.id`) before any adapter call.
- Rate-limit sensitive actions (password, power, console/login link minting) per user+IP via the existing in-memory limiter.
- Console/SSO URLs are short-lived panel-issued tickets, opened in a new tab; not embedded.
- SSH public keys validated (type prefix + base64 body) before push; only public keys stored.
- Generic Persian errors to clients; upstream detail logged server-side only (mirrors `spaceship.ts`).
- `requireAdmin` on all node management; capability gating prevents calling unsupported verbs.

---

## 11. Testing (Vitest)

- `secrets.ts`: encrypt→decrypt round-trip; tampered blob throws; wrong key fails.
- Registry: `adapterFor` resolves each provider; capability gating throws `CAPABILITY_UNSUPPORTED`.
- `pickNode`: weighted selection; provider filtering; GENERIC fallback.
- Each adapter: request building / URL + auth header shape / response parsing with mocked `fetch`; error mapping to `ServerAdapterError`.
- Demo adapter: returns the expected fake shapes; never active in production.
- Routes: auth + ownership rejection; capability rejection; password not echoed on `custom` mode.

---

## 12. Build order (for the implementation plan)

1. Crypto module + tests.
2. Schema: `serverProvider` enum, `serverNodes`, `serverInstances` additions; migration `0006`.
3. Adapter `types.ts` + registry + `requireCapability` + `ServerAdapterError`.
4. Demo adapter + `isServerDemo`.
5. Adapters: Proxmox → WHM → ESXi → KVM (each env/node-gated, mocked-fetch tests).
6. `pickNode` + wire `fulfillServerItems` to node-aware provisioning.
7. Customer routes + control-panel UI.
8. Admin node-management routes + `/admin/servers` UI + sidebar link.
9. Seed/update plan metadata with `provider`; docs for `SERVER_VAULT_KEY` + per-provider node setup.

---

## 13. Open follow-ups (separate specs)
- Embedded noVNC console + browser SSH terminal (websocket gateway).
- Real OS reinstall/rebuild: template catalog + per-provider cloud-init.
- Auto-renew / recurring billing; usage metering; backups/snapshots; extra-IP / IPv6.
