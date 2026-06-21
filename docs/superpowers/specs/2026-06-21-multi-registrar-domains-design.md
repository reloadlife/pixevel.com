# Multi-Registrar Domains (Admin-Configured Credentials) — Design

- **Date:** 2026-06-21
- **Status:** Approved (pending written-spec review)
- **Topic:** Move domain-registrar integration from env vars to **admin-configured, encrypted DB credentials**, behind a multi-provider registrar adapter. Spaceship is the only adapter for now, but keys/secrets are managed in the admin panel — same model as the server nodes.
- **Sibling spec:** `2026-06-21-server-hosting-control-panel-design.md` (shares the crypto/vault module and the `/admin/integrations` surface).

---

## 1. Background & current state

The domain feature works but its registrar credentials come from **environment variables**:

- `src/lib/domains/spaceship.ts` reads `SPACESHIP_API_KEY` / `SPACESHIP_API_SECRET` (+ `SPACESHIP_BASE_URL`, `SPACESHIP_QUOTE_CURRENCY`, `SPACESHIP_CONTACT_ID`) via `readConfig()`.
- Gating: `isSpaceshipConfigured()`, `isDomainDemo()`, `isDomainSearchEnabled()` (all sync, env-based).
- `domainRegistrations` stores per-domain state (`registrarRef`, status, nameservers, DNS, etc.). Management verbs (`pushNameservers`, `pushDnsRecords`, `pushContact`, `pushDomainSettings`, `renewDomainAtRegistrar`) call Spaceship directly.

This makes onboarding a registrar a redeploy, allows only one account, and stores no credential securely. We want the **server-nodes treatment**: credentials in the DB, encrypted at rest, managed from `/admin`, multiple accounts/providers, with Spaceship as the first adapter.

### Decisions locked during brainstorming
1. **Registrar routing:** primary + **weighted pool**. Each account has a weight/priority; registration uses the highest-priority `active` account for the provider. Optional per-account **TLD allowlist** in config (defaults to "any").
2. **Admin surface:** a unified **`/admin/integrations`** area with tabs — *Domain registrars* + *Server nodes* (room for payment gateways later).
3. **Shared crypto:** one `src/lib/crypto/secrets.ts` (AES-256-GCM) used by both registrars and server nodes, keyed by a generic **`APP_VAULT_KEY`** (replaces the server spec's `SERVER_VAULT_KEY`).

---

## 2. Goals / non-goals

### Goals
- A `RegistrarAdapter` contract; Spaceship implemented against it.
- `domainRegistrars` table with **encrypted** credentials, admin CRUD + "test connection".
- Weighted account selection (`pickRegistrar(tld?)`), with optional TLD allowlist.
- Retire all `SPACESHIP_*` env vars; gating becomes "an active registrar account exists, or demo".
- Demo mode preserved (hard-off in production).

### Non-goals (this spec)
- A second real registrar adapter (interface is ready; add later).
- Changing the domain UX, pricing, DNS editor, or `domainRegistrations` semantics beyond adding the account link.
- Per-TLD explicit mapping UI (allowlist on the account covers the near-term need).

---

## 3. Architecture & data flow

```
search/add/register/renew/manage
        │
   resolve account ── pickRegistrar(tld?) ──► domainRegistrars (active, weighted, tld-allowed)
        │                                          │ decrypt credentials (APP_VAULT_KEY)
   registrarFor(account.provider) ──► RegistrarAdapter ──► registrar API (Spaceship)
        │
   domainRegistrations (registrarAccountId, registrarRef, status, …)  ← local source of truth
```

- **`registrarFor(provider): RegistrarAdapter`** — registry resolving the adapter from `account.provider`.
- **`pickRegistrar(tld?): RegistrarAccount | null`** — active accounts, filtered by `config.tldAllowlist` (when set, must include `tld`), ordered by `config.weight` desc; first wins. `null` → demo or "not configured".
- DB stays authoritative; registrar calls are best-effort and never leak raw upstream errors (unchanged behavior, now routed through the adapter).

---

## 4. RegistrarAdapter interface & capabilities

`src/lib/domains/registrars/types.ts`:

```ts
export type DomainProvider = "SPACESHIP"; // extensible (NAMECHEAP, GODADDY, …)

export type RegistrarCapability =
  | "search" | "register" | "renew" | "transfer"
  | "nameservers" | "dns" | "contacts" | "settings";

export type RegistrarAccountRecord = {
  id: string;
  provider: DomainProvider;
  /** Decrypted at call time by the registry; adapters receive plaintext creds. */
  credentials: Record<string, string>; // Spaceship: { apiKey, apiSecret, contactId?, baseUrl?, quoteCurrency? }
  config: Record<string, unknown>;      // { weight, tldAllowlist?, … }
};

export interface RegistrarAdapter {
  readonly provider: DomainProvider;
  capabilities(): RegistrarCapability[];
  test(acct: RegistrarAccountRecord): Promise<{ ok: boolean; message?: string }>;

  search(acct: RegistrarAccountRecord, term: string): Promise<SearchDomainResult>;
  register(acct: RegistrarAccountRecord, input: RegisterDomainInput): Promise<RegisterDomainResult>;
  getDomain(acct: RegistrarAccountRecord, name: string): Promise<GetDomainResult | null>;
  renew(acct: RegistrarAccountRecord, name: string, years: number): Promise<RegistrarRenewResult>;

  pushNameservers(acct: RegistrarAccountRecord, name: string, ns: string[]): Promise<PushResult>;
  pushDnsRecords(acct: RegistrarAccountRecord, name: string, records: DnsRecordInput[]): Promise<PushResult>;
  pushContact(acct: RegistrarAccountRecord, name: string, contact: Record<string, unknown>): Promise<PushResult>;
  pushDomainSettings(acct: RegistrarAccountRecord, name: string, settings: DomainSettingsInput): Promise<PushResult>;
}
```

The result/input types (`SearchDomainResult`, `RegisterDomainInput`, `RegisterDomainResult`, `GetDomainResult`, `RegistrarRenewResult`, `PushResult`, `DnsRecordInput`) already exist in `spaceship.ts` and move to a shared types module. Spaceship advertises **all** capabilities.

---

## 5. Spaceship adapter refactor

`spaceship.ts` becomes `src/lib/domains/registrars/spaceship.ts` implementing `RegistrarAdapter`:
- `readConfig()` (env) → credentials read from the **account record** (`acct.credentials.apiKey/apiSecret`, `baseUrl`, `quoteCurrency`, `contactId`).
- `spaceshipFetch` takes the account's `baseUrl`/keys instead of module-level env.
- All existing logic (availability parsing, `extractPriceUsd`, register-async-202, management verbs) preserved verbatim — only the credential source changes.
- The demo simulation (`demoSearch`, demo register) moves to a provider-agnostic `src/lib/domains/registrars/demo.ts`.

---

## 6. Data model changes (`src/db/schema.ts`)

### New enum
```ts
domainProvider = pgEnum("domain_provider", ["SPACESHIP"])
```

### New table `domainRegistrars`
| column | type | notes |
|--------|------|-------|
| id | uuid PK | |
| provider | domainProvider | not null |
| name | text | operator label, not null |
| encryptedCredentials | text | AES-256-GCM blob (apiKey/apiSecret/contactId) |
| config | jsonb | non-secret: `weight`, `tldAllowlist?`, `baseUrl?`, `quoteCurrency?` |
| status | text | `active` \| `disabled` (default `active`) |
| createdAt / updatedAt | timestamp | |

### `domainRegistrations` additions
`registrarAccountId` (fk → domainRegistrars, set null) — which account registered/manages this domain, so renews/management use the same one. `provider` (domainProvider, denormalized) optional for display/filtering. `registrarRef` already exists.

---

## 7. Shared crypto

Uses the same `src/lib/crypto/secrets.ts` defined in the server spec, **with the env var renamed to `APP_VAULT_KEY`** (one key for all at-rest secrets — registrar creds and server-node creds). AES-256-GCM, `encryptSecret`/`decryptSecret`/`encryptJson`/`decryptJson`. Required in production; absent → only demo mode works.

---

## 8. Gating & demo (env retired)

These become **async** (DB-backed) and replace the env checks:
- `isDomainConfigured(): Promise<boolean>` — at least one `active` `domainRegistrars` row exists.
- `isDomainDemo(): Promise<boolean>` — `!configured && NODE_ENV !== "production"`.
- `isDomainSearchEnabled(): Promise<boolean>` — `configured || demo`.

`src/app/domains/page.tsx` already `async` — it awaits these and passes `configured`/`demo` to the client (no client change). `SPACESHIP_*` env vars are removed from the codebase.

Pricing is unaffected: `quoteToToman` still uses the admin exchange rate (`getCachedRate("USD")`); `quoteCurrency` moves into the account config but USD remains the default.

---

## 9. Admin: `/admin/integrations`

- **New page** `/admin/integrations` with tabs:
  - *درگاه‌های دامنه* (Domain registrars) — list `domainRegistrars` (provider, name, weight, status), add/edit form with provider-specific credential fields (Spaceship: API key, API secret, contact id, base URL, weight, TLD allowlist), **"تست اتصال"** button.
  - *سرورها / نودها* (Server nodes) — the server spec's node management (same screen, different tab).
- Sidebar link "ادغام‌ها / Integrations" (alongside analytics/blog/settings).
- **API routes** (`requireAdmin`, encrypt on write, never return secrets):
  - `GET/POST /api/admin/domain-registrars`
  - `PATCH/DELETE /api/admin/domain-registrars/[id]`
  - `POST /api/admin/domain-registrars/[id]/test`
- Optional one-time **import script** `scripts/import-spaceship-env.ts` to seed a registrar row from existing `SPACESHIP_*` env values (convenience for the current deployment).

---

## 10. Migration

New drizzle migration adding `domain_provider` enum + `domainRegistrars` + the `domainRegistrations.registrarAccountId/provider` columns. Tables are independent of the server feature's `serverNodes`; if both features land together they share one migration wave, otherwise this takes the next free index. Mind the repo's migration-drift note and restart the dev server after applying (`getDb()` caches the client).

---

## 11. Security

- Registrar credentials AES-256-GCM at rest (`APP_VAULT_KEY`); never logged or returned by any route.
- `requireAdmin` on all registrar-management routes; secrets write-only from the admin form (edit shows masked, re-enter to change).
- Generic Persian errors to clients; upstream detail logged server-side only (unchanged).
- Plaintext credentials exist only in-process at call time (decrypted by the registry just before the adapter call).
- `authCode` (EPP) handling in `domainRegistrations` unchanged.

---

## 12. Testing (Vitest)

- Shared `secrets.ts`: covered by the server spec's tests (no duplication).
- Registry: `registrarFor("SPACESHIP")` resolves; unknown provider throws.
- `pickRegistrar`: weighted ordering; `tldAllowlist` filtering; `null` when none active.
- Spaceship adapter: request building with **account** creds (mocked fetch); availability/price parsing preserved; error mapping.
- Demo adapter: deterministic fake search/register; never active in production.
- Admin routes: auth rejection; secret never echoed; encrypt-on-write.
- Gating: async `isDomainConfigured/Demo/SearchEnabled` reflect DB state.

---

## 13. Build order
1. (Shared) crypto module + `APP_VAULT_KEY` — from the server spec; build once.
2. Schema: `domain_provider` enum, `domainRegistrars`, `domainRegistrations` additions; migration.
3. `registrars/types.ts` (move shared types) + registry + `RegistrarAdapterError`.
4. Demo adapter + async gating helpers.
5. Spaceship adapter refactor (env → account); rewire `cart.ts`/`manage.ts`/`pricing.ts`/search route to `pickRegistrar` + adapter.
6. Admin routes + `/admin/integrations` (registrars tab) + sidebar link.
7. Optional env-import script; remove `SPACESHIP_*` env usage; update docs.

---

## 14. Relationship to the server spec
- **Shared:** `src/lib/crypto/secrets.ts` + `APP_VAULT_KEY`; the `/admin/integrations` page (registrars tab here, server-nodes tab there); the "encrypted DB account record + adapter registry + weighted selection + test-connection + demo-mode" pattern.
- **Independent:** separate tables (`domainRegistrars` vs `serverNodes`) and separate adapter interfaces — no premature unification into one polymorphic credentials table.
- **Server-spec edit required:** rename `SERVER_VAULT_KEY` → `APP_VAULT_KEY` and point its admin surface at `/admin/integrations` (server-nodes tab). Applied in that spec.
