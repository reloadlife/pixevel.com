# Multi-Registrar Domains Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move domain-registrar credentials from environment variables to admin-configured, AES-256-GCM-encrypted DB accounts, behind a `RegistrarAdapter` interface with weighted selection. Spaceship is the only adapter; the architecture accepts more.

**Architecture:** A `domainRegistrars` table holds encrypted credentials per account. A registry resolves a `RegistrarAdapter` from `account.provider`. A thin facade (`src/lib/domains/registrar.ts`) keeps the existing public functions (`searchDomain`, `registerDomain`, `getDomain`, `push*`, `renewDomainAtRegistrar`, gating) so call sites barely change — internally it resolves the account (weighted `pickRegistrar`, or the account that registered a given domain) and calls the adapter. Demo mode runs a fake adapter when no account exists and we're not in production.

**Tech Stack:** Next.js 16 (App Router), Drizzle ORM + PostgreSQL, Bun, Biome, Vitest, Zod, `node:crypto`.

## Global Constraints

- Package manager is **Bun** — `bun install`, `bun run <script>`, `bunx`. Never npm/pnpm/yarn.
- Lint/format is **Biome** only — `bunx biome check --write <paths>`. Never ESLint/Prettier. Never run `tsc`; type-checking happens in `next build`.
- Type-check/build verification: `bun run build`. Tests: `bun run test` (vitest, `fileParallelism: false`, `NODE_ENV=test`).
- Migrations: `bun run db:generate` then `bun run db:migrate`. After any migration, **restart the dev server** — `getDb()` caches the client (`lsof -ti tcp:4000 | xargs kill -9` then `preview_start`).
- **Secrets**: encrypt at rest with AES-256-GCM via `APP_VAULT_KEY`. Never log or return raw credentials. Registrar API errors map to generic Persian messages; upstream detail only to `console.error`.
- **Gating becomes async** (`isDomainConfigured/isDomainDemo/isDomainSearchEnabled` return `Promise<boolean>`); the `/domains` page is already `async`.
- **Demo mode is hard-off in production** — `NODE_ENV === "production"` never yields demo.
- All money stays integer Toman strings; pricing via the existing admin exchange rate (`getCachedRate("USD")`) — unchanged.
- We do **not** offer `.ir` domains — do not reintroduce it.

---

### Task 1: Shared secrets/crypto module

**Files:**
- Create: `src/lib/crypto/secrets.ts`
- Test: `src/lib/crypto/secrets.test.ts`

**Interfaces:**
- Produces: `encryptSecret(plain: string): string`, `decryptSecret(blob: string): string`, `encryptJson(value: unknown): string`, `decryptJson<T>(blob: string): T`, `isVaultConfigured(): boolean`.

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/crypto/secrets.test.ts
import { beforeAll, describe, expect, test } from "vitest";

import { decryptJson, decryptSecret, encryptJson, encryptSecret, isVaultConfigured } from "./secrets";

beforeAll(() => {
  // 32 bytes as 64 hex chars
  process.env.APP_VAULT_KEY = "00112233445566778899aabbccddeeff00112233445566778899aabbccddeeff";
});

describe("secrets", () => {
  test("isVaultConfigured true when key set", () => {
    expect(isVaultConfigured()).toBe(true);
  });

  test("round-trips a string and hides plaintext", () => {
    const blob = encryptSecret("hello-secret");
    expect(blob).not.toContain("hello-secret");
    expect(decryptSecret(blob)).toBe("hello-secret");
  });

  test("round-trips json", () => {
    const obj = { apiKey: "k", apiSecret: "s" };
    expect(decryptJson(encryptJson(obj))).toEqual(obj);
  });

  test("random IV: same input → different ciphertext", () => {
    expect(encryptSecret("x")).not.toBe(encryptSecret("x"));
  });

  test("tampered ciphertext throws (GCM tag)", () => {
    const buf = Buffer.from(encryptSecret("hello"), "base64");
    buf[buf.length - 1] ^= 0xff;
    expect(() => decryptSecret(buf.toString("base64"))).toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run test src/lib/crypto/secrets.test.ts`
Expected: FAIL — cannot find module `./secrets`.

- [ ] **Step 3: Write the implementation**

```ts
// src/lib/crypto/secrets.ts
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const ALGO = "aes-256-gcm";
const IV_BYTES = 12;
const TAG_BYTES = 16;

/**
 * Returns the 32-byte vault key from APP_VAULT_KEY. Accepts 64 hex chars or
 * base64. Throws when absent/invalid — callers that must tolerate "no key"
 * (e.g. demo mode) should guard with isVaultConfigured() first.
 */
function getKey(): Buffer {
  const raw = process.env.APP_VAULT_KEY;
  if (!raw) {
    throw new Error("APP_VAULT_KEY is required to encrypt/decrypt secrets.");
  }
  const key = raw.length === 64 ? Buffer.from(raw, "hex") : Buffer.from(raw, "base64");
  if (key.length !== 32) {
    throw new Error("APP_VAULT_KEY must decode to 32 bytes (64 hex chars or base64).");
  }
  return key;
}

/** True when a usable vault key is configured. Never throws. */
export function isVaultConfigured(): boolean {
  try {
    getKey();
    return true;
  } catch {
    return false;
  }
}

/** Encrypts to base64(iv | tag | ciphertext). */
export function encryptSecret(plain: string): string {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGO, getKey(), iv);
  const ct = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), ct]).toString("base64");
}

export function decryptSecret(blob: string): string {
  const buf = Buffer.from(blob, "base64");
  const iv = buf.subarray(0, IV_BYTES);
  const tag = buf.subarray(IV_BYTES, IV_BYTES + TAG_BYTES);
  const ct = buf.subarray(IV_BYTES + TAG_BYTES);
  const decipher = createDecipheriv(ALGO, getKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ct), decipher.final()]).toString("utf8");
}

export function encryptJson(value: unknown): string {
  return encryptSecret(JSON.stringify(value));
}

export function decryptJson<T = unknown>(blob: string): T {
  return JSON.parse(decryptSecret(blob)) as T;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun run test src/lib/crypto/secrets.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Lint + commit**

```bash
bunx biome check --write src/lib/crypto/secrets.ts src/lib/crypto/secrets.test.ts
git add src/lib/crypto/secrets.ts src/lib/crypto/secrets.test.ts
git commit -m "feat(crypto): AES-256-GCM secrets module (APP_VAULT_KEY)"
```

---

### Task 2: Schema — registrar table, enum, registration columns, migration

**Files:**
- Modify: `src/db/schema.ts` (add enum near line 80; add table after `domainDnsRecords` ~line 738; add columns to `domainRegistrations` ~line 694; add type exports near line 1345)
- Create (generated): `drizzle/<timestamp>_*.sql`

**Interfaces:**
- Produces: `domainRegistrars` table, `domainProvider` pgEnum, `domainRegistrations.registrarAccountId` + `.provider` columns, `export type DomainRegistrar`.

- [ ] **Step 1: Add the enum** (after the `serverStatus` enum block, ~line 88)

```ts
export const domainProvider = pgEnum("domain_provider", ["SPACESHIP"]);
```

- [ ] **Step 2: Add the table** (immediately after the `domainDnsRecords` table, before `serverInstances`)

```ts
export const domainRegistrars = pgTable("DomainRegistrar", {
  id: uuid("id").primaryKey().defaultRandom(),
  provider: domainProvider("provider").notNull(),
  /** Operator label, e.g. "Spaceship — main". */
  name: text("name").notNull(),
  /** AES-256-GCM blob of the credentials JSON (apiKey/apiSecret/contactId). */
  encryptedCredentials: text("encryptedCredentials").notNull(),
  /** Non-secret config: { weight, tldAllowlist?, baseUrl?, quoteCurrency? }. */
  config: jsonb("config").$type<Record<string, unknown>>(),
  /** "active" | "disabled". */
  status: text("status").default("active").notNull(),
  createdAt,
  updatedAt,
});
```

- [ ] **Step 3: Add columns to `domainRegistrations`** (inside the column object, after `registrarPayload`)

```ts
    /** Which registrar account registered/manages this domain. */
    registrarAccountId: uuid("registrarAccountId").references(() => domainRegistrars.id, {
      onDelete: "set null",
    }),
    /** Denormalized provider for display/filtering. */
    provider: domainProvider("provider"),
```

- [ ] **Step 4: Add the type export** (near the other domain type exports, ~line 1332)

```ts
export type DomainRegistrar = typeof domainRegistrars.$inferSelect;
```

- [ ] **Step 5: Generate + apply the migration**

```bash
bun run db:generate
```
Open the generated SQL under `drizzle/` and confirm it ONLY: creates enum `domain_provider`, creates table `DomainRegistrar`, adds `registrarAccountId` + `provider` to `DomainRegistration` (no unrelated drops — see the migration-drift note in the repo).
```bash
bun run db:migrate
```

- [ ] **Step 6: Restart dev server (getDb cache) + verify build**

```bash
lsof -ti tcp:4000 | xargs kill -9 2>/dev/null
bun run build 2>&1 | tail -5
```
Expected: build succeeds.

- [ ] **Step 7: Commit**

```bash
git add src/db/schema.ts drizzle/
git commit -m "feat(db): DomainRegistrar table + registration account columns"
```

---

### Task 3: Registrar adapter types, shared utils, registry

**Files:**
- Create: `src/lib/domains/registrars/types.ts`
- Create: `src/lib/domains/registrars/shared.ts`
- Create: `src/lib/domains/registrars/registry.ts`
- Test: `src/lib/domains/registrars/registry.test.ts`

**Interfaces:**
- Produces: `RegistrarAdapter` interface, `RegistrarCapability`, `DomainProvider`, `RegistrarAccountRecord`, the shared result/input types (`SearchDomainResult`, `DomainTldQuote`, `RegisterDomainInput`, `RegisterDomainResult`, `GetDomainResult`, `PushResult`, `DnsRecordInput`, `DomainSettingsInput`, `RegistrarRenewResult`); `COMMON_TLDS`, `splitDomain`; `registerAdapter`, `registrarFor`, `RegistrarAdapterError`.

- [ ] **Step 1: Create the types module**

```ts
// src/lib/domains/registrars/types.ts
export type DomainProvider = "SPACESHIP";

export type RegistrarCapability =
  | "search"
  | "register"
  | "renew"
  | "transfer"
  | "nameservers"
  | "dns"
  | "contacts"
  | "settings";

export type RegistrarAccountRecord = {
  id: string;
  provider: DomainProvider;
  /** Decrypted credentials (apiKey/apiSecret/contactId). Plaintext, in-process only. */
  credentials: Record<string, string>;
  /** Non-secret config: weight, tldAllowlist, baseUrl, quoteCurrency. */
  config: Record<string, unknown>;
};

export type DomainTldQuote = {
  domainName: string;
  tld: string;
  available: boolean;
  premium: boolean;
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
    contactId?: string;
    firstName?: string;
    lastName?: string;
    email?: string;
    phone?: string;
  };
};

export type RegisterDomainResult = {
  registrarRef: string;
  payload: unknown;
  expiresAt: Date | null;
};

export type GetDomainResult = {
  domainName: string;
  status: string | null;
  expiresAt: Date | null;
  nameservers: string[];
  payload: unknown;
};

export type PushResult = { pushed: boolean };

export type DnsRecordInput = {
  type: string;
  name: string;
  value: string;
  ttl: number;
  priority?: number | null;
};

export type DomainSettingsInput = {
  autoRenew?: boolean;
  transferLock?: boolean;
  privacyProtection?: boolean;
};

export type RegistrarRenewResult = {
  pushed: boolean;
  expiresAt: Date | null;
  payload: unknown;
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
  pushDnsRecords(
    acct: RegistrarAccountRecord,
    name: string,
    records: DnsRecordInput[],
  ): Promise<PushResult>;
  pushContact(
    acct: RegistrarAccountRecord,
    name: string,
    contact: Record<string, unknown>,
  ): Promise<PushResult>;
  pushDomainSettings(
    acct: RegistrarAccountRecord,
    name: string,
    settings: DomainSettingsInput,
  ): Promise<PushResult>;
}
```

- [ ] **Step 2: Create shared utils**

```ts
// src/lib/domains/registrars/shared.ts

/** TLDs checked for a bare SLD search (no `.ir` — not offered). */
export const COMMON_TLDS = ["com", "net", "org", "co", "io", "shop", "dev"] as const;

/** Splits "myshop.com" → { sld: "myshop", tld: "com" }; bare term → { sld, tld: "" }. */
export function splitDomain(domainName: string): { sld: string; tld: string } {
  const clean = domainName.trim().toLowerCase().replace(/\.+$/, "");
  const dot = clean.indexOf(".");
  if (dot <= 0) {
    return { sld: clean, tld: "" };
  }
  return { sld: clean.slice(0, dot), tld: clean.slice(dot + 1) };
}
```

- [ ] **Step 3: Create the registry**

```ts
// src/lib/domains/registrars/registry.ts
import type { DomainProvider, RegistrarAdapter } from "./types";

export class RegistrarAdapterError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "RegistrarAdapterError";
  }
}

const registry = new Map<DomainProvider, RegistrarAdapter>();

export function registerAdapter(adapter: RegistrarAdapter): void {
  registry.set(adapter.provider, adapter);
}

export function registrarFor(provider: DomainProvider): RegistrarAdapter {
  const adapter = registry.get(provider);
  if (!adapter) {
    throw new RegistrarAdapterError("UNKNOWN_PROVIDER", `No registrar adapter for: ${provider}`);
  }
  return adapter;
}
```

- [ ] **Step 4: Write the registry test**

```ts
// src/lib/domains/registrars/registry.test.ts
import { describe, expect, test } from "vitest";

import { RegistrarAdapterError, registerAdapter, registrarFor } from "./registry";
import type { RegistrarAdapter } from "./types";

const stub = { provider: "SPACESHIP", capabilities: () => [] } as unknown as RegistrarAdapter;

describe("registrar registry", () => {
  test("resolves a registered adapter", () => {
    registerAdapter(stub);
    expect(registrarFor("SPACESHIP")).toBe(stub);
  });

  test("throws RegistrarAdapterError for unknown provider", () => {
    expect(() => registrarFor("NOPE" as never)).toThrow(RegistrarAdapterError);
  });
});
```

- [ ] **Step 5: Run + verify pass**

Run: `bun run test src/lib/domains/registrars/registry.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 6: Lint + commit**

```bash
bunx biome check --write src/lib/domains/registrars/
git add src/lib/domains/registrars/
git commit -m "feat(domains): registrar adapter interface + registry"
```

---

### Task 4: Account access — pure selection, DB resolve, CRUD, gating

**Files:**
- Create: `src/lib/domains/registrars/accounts.ts`
- Test: `src/lib/domains/registrars/accounts.test.ts`

**Interfaces:**
- Consumes: `decryptJson`/`encryptJson`/`isVaultConfigured` (Task 1), `domainRegistrars` (Task 2), types (Task 3).
- Produces: `selectRegistrar(accounts, tld?)` (pure), `pickRegistrar(tld?)`, `getRegistrarAccountById(id)`, `isDomainConfigured()`, and admin CRUD `listRegistrars()`, `createRegistrar(input)`, `updateRegistrar(id, patch)`, `deleteRegistrar(id)`; types `AdminRegistrarRow`, `RegistrarCreateInput`, `RegistrarUpdateInput`.

- [ ] **Step 1: Write the pure-selection test first**

```ts
// src/lib/domains/registrars/accounts.test.ts
import { describe, expect, test } from "vitest";

import { selectRegistrar } from "./accounts";

const acc = (id: string, weight: number, tldAllowlist?: string[]) => ({
  id,
  provider: "SPACESHIP" as const,
  config: { weight, ...(tldAllowlist ? { tldAllowlist } : {}) },
});

describe("selectRegistrar", () => {
  test("returns null when no accounts", () => {
    expect(selectRegistrar([], "com")).toBeNull();
  });

  test("picks highest weight", () => {
    expect(selectRegistrar([acc("a", 1), acc("b", 5), acc("c", 3)], "com")?.id).toBe("b");
  });

  test("respects tld allowlist (excludes non-matching)", () => {
    const chosen = selectRegistrar([acc("a", 9, ["io"]), acc("b", 1, ["com"])], "com");
    expect(chosen?.id).toBe("b");
  });

  test("empty/absent allowlist matches any tld", () => {
    expect(selectRegistrar([acc("a", 2)], "anything")?.id).toBe("a");
  });

  test("no tld given ignores allowlist filtering", () => {
    expect(selectRegistrar([acc("a", 2, ["io"])])?.id).toBe("a");
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `bun run test src/lib/domains/registrars/accounts.test.ts`
Expected: FAIL — `selectRegistrar` not exported.

- [ ] **Step 3: Implement accounts.ts**

```ts
// src/lib/domains/registrars/accounts.ts
import "server-only";

import { eq } from "drizzle-orm";

import { domainRegistrars } from "@/db/schema";
import { decryptJson, encryptJson, isVaultConfigured } from "@/lib/crypto/secrets";
import { getDb } from "@/lib/db";
import type { DomainProvider, RegistrarAccountRecord } from "./types";

type Row = typeof domainRegistrars.$inferSelect;

export type AdminRegistrarRow = {
  id: string;
  provider: DomainProvider;
  name: string;
  status: string;
  config: Record<string, unknown>;
  createdAt: Date;
};

export type RegistrarCreateInput = {
  provider: DomainProvider;
  name: string;
  credentials: Record<string, string>;
  config?: Record<string, unknown>;
  status?: string;
};

export type RegistrarUpdateInput = {
  name?: string;
  credentials?: Record<string, string>;
  config?: Record<string, unknown>;
  status?: string;
};

type SelectableAccount = { id: string; provider: DomainProvider; config: Record<string, unknown> };

/** Pure: highest-weight account whose tldAllowlist permits `tld` (or any). */
export function selectRegistrar<T extends SelectableAccount>(accounts: T[], tld?: string): T | null {
  const eligible = accounts.filter((a) => {
    const allow = a.config.tldAllowlist;
    if (Array.isArray(allow) && allow.length > 0 && tld) {
      return allow.map(String).includes(tld);
    }
    return true;
  });
  if (eligible.length === 0) return null;
  return [...eligible].sort((a, b) => Number(b.config.weight ?? 0) - Number(a.config.weight ?? 0))[0];
}

function toAccountRecord(row: Row): RegistrarAccountRecord {
  return {
    id: row.id,
    provider: row.provider,
    credentials: decryptJson<Record<string, string>>(row.encryptedCredentials),
    config: (row.config ?? {}) as Record<string, unknown>,
  };
}

function toAdminRow(row: Row): AdminRegistrarRow {
  return {
    id: row.id,
    provider: row.provider,
    name: row.name,
    status: row.status,
    config: (row.config ?? {}) as Record<string, unknown>,
    createdAt: row.createdAt,
  };
}

async function activeRows(): Promise<Row[]> {
  return getDb().query.domainRegistrars.findMany({
    where: (r, { eq: eqOp }) => eqOp(r.status, "active"),
  });
}

/** Weighted pick of an active account for `tld`; null when none / no vault key. */
export async function pickRegistrar(tld?: string): Promise<RegistrarAccountRecord | null> {
  if (!isVaultConfigured()) return null;
  const rows = await activeRows();
  const chosen = selectRegistrar(
    rows.map((r) => ({ id: r.id, provider: r.provider, config: (r.config ?? {}) as Record<string, unknown> })),
    tld,
  );
  if (!chosen) return null;
  const row = rows.find((r) => r.id === chosen.id);
  return row ? toAccountRecord(row) : null;
}

export async function getRegistrarAccountById(id: string): Promise<RegistrarAccountRecord | null> {
  if (!isVaultConfigured()) return null;
  const row = await getDb().query.domainRegistrars.findFirst({
    where: (r, { eq: eqOp }) => eqOp(r.id, id),
  });
  return row ? toAccountRecord(row) : null;
}

/** True when the vault is configured AND ≥1 active account exists. */
export async function isDomainConfigured(): Promise<boolean> {
  if (!isVaultConfigured()) return false;
  const rows = await activeRows();
  return rows.length > 0;
}

// ─── Admin CRUD (secrets never returned) ───────────────────────────────────────

export async function listRegistrars(): Promise<AdminRegistrarRow[]> {
  const rows = await getDb().query.domainRegistrars.findMany({
    orderBy: (r, { asc }) => [asc(r.createdAt)],
  });
  return rows.map(toAdminRow);
}

export async function createRegistrar(input: RegistrarCreateInput): Promise<AdminRegistrarRow> {
  const [row] = await getDb()
    .insert(domainRegistrars)
    .values({
      provider: input.provider,
      name: input.name,
      encryptedCredentials: encryptJson(input.credentials),
      config: input.config ?? {},
      status: input.status ?? "active",
    })
    .returning();
  return toAdminRow(row);
}

export async function updateRegistrar(
  id: string,
  patch: RegistrarUpdateInput,
): Promise<AdminRegistrarRow | null> {
  const set: Partial<Row> = { updatedAt: new Date() };
  if (patch.name !== undefined) set.name = patch.name;
  if (patch.status !== undefined) set.status = patch.status;
  if (patch.config !== undefined) set.config = patch.config;
  if (patch.credentials !== undefined) set.encryptedCredentials = encryptJson(patch.credentials);

  const [row] = await getDb()
    .update(domainRegistrars)
    .set(set)
    .where(eq(domainRegistrars.id, id))
    .returning();
  return row ? toAdminRow(row) : null;
}

export async function deleteRegistrar(id: string): Promise<void> {
  await getDb().delete(domainRegistrars).where(eq(domainRegistrars.id, id));
}
```

- [ ] **Step 4: Run the pure test, verify pass**

Run: `bun run test src/lib/domains/registrars/accounts.test.ts`
Expected: PASS (5 tests). (DB-backed functions are covered by the manual verification in Task 11.)

- [ ] **Step 5: Lint + commit**

```bash
bunx biome check --write src/lib/domains/registrars/accounts.ts src/lib/domains/registrars/accounts.test.ts
git add src/lib/domains/registrars/accounts.ts src/lib/domains/registrars/accounts.test.ts
git commit -m "feat(domains): registrar account access + weighted selection + CRUD"
```

---

### Task 5: Demo adapter

**Files:**
- Create: `src/lib/domains/registrars/demo.ts`
- Test: `src/lib/domains/registrars/demo.test.ts`

**Interfaces:**
- Consumes: types (Task 3), `COMMON_TLDS`/`splitDomain` (Task 3 shared).
- Produces: `demoAdapter: RegistrarAdapter`, `DEMO_ACCOUNT: RegistrarAccountRecord`.

- [ ] **Step 1: Write the test**

```ts
// src/lib/domains/registrars/demo.test.ts
import { describe, expect, test } from "vitest";

import { DEMO_ACCOUNT, demoAdapter } from "./demo";

describe("demoAdapter", () => {
  test("bare term expands across common TLDs", async () => {
    const res = await demoAdapter.search(DEMO_ACCOUNT, "myshop");
    expect(res.configured).toBe(true);
    if (res.configured) {
      expect(res.quotes.length).toBeGreaterThan(1);
      expect(res.quotes.every((q) => q.domainName.startsWith("myshop."))).toBe(true);
    }
  });

  test("availability is deterministic per domain", async () => {
    const a = await demoAdapter.search(DEMO_ACCOUNT, "stable.com");
    const b = await demoAdapter.search(DEMO_ACCOUNT, "stable.com");
    expect(a).toEqual(b);
  });

  test("register returns a DEMO ref and future expiry", async () => {
    const r = await demoAdapter.register(DEMO_ACCOUNT, { domainName: "x.com", years: 2 });
    expect(r.registrarRef).toMatch(/^DEMO-/);
    expect(r.expiresAt).toBeInstanceOf(Date);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `bun run test src/lib/domains/registrars/demo.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement demo.ts** (ports the demo logic from the old `spaceship.ts`)

```ts
// src/lib/domains/registrars/demo.ts
import { COMMON_TLDS, splitDomain } from "./shared";
import type {
  DomainTldQuote,
  RegistrarAccountRecord,
  RegistrarAdapter,
  SearchDomainResult,
} from "./types";

export const DEMO_ACCOUNT: RegistrarAccountRecord = {
  id: "demo",
  provider: "SPACESHIP",
  credentials: {},
  config: {},
};

const DEMO_TLD_USD: Record<string, number> = {
  com: 11.98,
  net: 13.98,
  org: 12.98,
  co: 27.98,
  io: 39.98,
  shop: 2.99,
  dev: 13.98,
};

const QUOTE_CURRENCY = "USD";

/** Stable hash so a given domain always returns the same demo availability. */
function demoHash(input: string): number {
  let h = 0;
  for (let i = 0; i < input.length; i++) {
    h = (h * 31 + input.charCodeAt(i)) >>> 0;
  }
  return h;
}

function addMonthsYears(years: number): Date {
  const d = new Date();
  d.setFullYear(d.getFullYear() + Math.min(10, Math.max(1, Math.trunc(years) || 1)));
  return d;
}

export const demoAdapter: RegistrarAdapter = {
  provider: "SPACESHIP",
  capabilities() {
    return ["search", "register", "renew", "transfer", "nameservers", "dns", "contacts", "settings"];
  },
  async test() {
    return { ok: true, message: "demo" };
  },
  async search(_acct, term): Promise<SearchDomainResult> {
    const { sld, tld } = splitDomain(term);
    if (!sld) return { configured: true, sld: "", quotes: [] };
    const tlds = tld ? [tld] : [...COMMON_TLDS];
    const quotes: DomainTldQuote[] = tlds.map((currentTld) => {
      const domainName = `${sld}.${currentTld}`;
      const h = demoHash(domainName);
      return {
        domainName,
        tld: currentTld,
        available: h % 5 !== 0, // ~80% available, deterministic
        premium: h % 17 === 0,
        priceUsd: DEMO_TLD_USD[currentTld] ?? 14.98,
        currency: QUOTE_CURRENCY,
      };
    });
    return { configured: true, sld, quotes };
  },
  async register(_acct, input) {
    const expiresAt = addMonthsYears(input.years);
    return {
      registrarRef: `DEMO-${input.domainName}-${expiresAt.getTime()}`,
      payload: { demo: true, ...input },
      expiresAt,
    };
  },
  async getDomain() {
    return null;
  },
  async renew() {
    return { pushed: false, expiresAt: null, payload: { demo: true } };
  },
  async pushNameservers() {
    return { pushed: false };
  },
  async pushDnsRecords() {
    return { pushed: false };
  },
  async pushContact() {
    return { pushed: false };
  },
  async pushDomainSettings() {
    return { pushed: false };
  },
};
```

- [ ] **Step 4: Run, verify pass**

Run: `bun run test src/lib/domains/registrars/demo.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Lint + commit**

```bash
bunx biome check --write src/lib/domains/registrars/demo.ts src/lib/domains/registrars/demo.test.ts
git add src/lib/domains/registrars/demo.ts src/lib/domains/registrars/demo.test.ts
git commit -m "feat(domains): provider-agnostic demo registrar adapter"
```

---

### Task 6: Spaceship adapter (account-based credentials)

**Files:**
- Create: `src/lib/domains/registrars/spaceship.ts`
- Create: `src/lib/domains/registrars/register.ts`
- Test: `src/lib/domains/registrars/spaceship.test.ts`

**Interfaces:**
- Consumes: types + shared (Task 3), `registerAdapter` (Task 3).
- Produces: `spaceshipAdapter: RegistrarAdapter`. `register.ts` registers it as a side-effect import.

This ports the existing `src/lib/domains/spaceship.ts` client verbatim, with **one change**: credentials/baseURL/quoteCurrency come from the account record instead of `process.env`. `apiKey`/`apiSecret`/`contactId` ← `acct.credentials`; `baseUrl`/`quoteCurrency` ← `acct.config`.

- [ ] **Step 1: Write the adapter test (mocked fetch)**

```ts
// src/lib/domains/registrars/spaceship.test.ts
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { spaceshipAdapter } from "./spaceship";
import type { RegistrarAccountRecord } from "./types";

const acct: RegistrarAccountRecord = {
  id: "acct-1",
  provider: "SPACESHIP",
  credentials: { apiKey: "K", apiSecret: "S" },
  config: { baseUrl: "https://spaceship.test/api/v1" },
};

describe("spaceshipAdapter.search", () => {
  beforeEach(() => vi.stubGlobal("fetch", vi.fn()));
  afterEach(() => vi.unstubAllGlobals());

  test("sends auth headers and parses availability", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ result: "available" }),
    });

    const res = await spaceshipAdapter.search(acct, "myshop.com");

    expect(res.configured).toBe(true);
    if (res.configured) {
      expect(res.quotes[0]).toMatchObject({ domainName: "myshop.com", available: true });
    }
    const [url, init] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(String(url)).toContain("https://spaceship.test/api/v1/domains/myshop.com/available");
    expect((init.headers as Record<string, string>)["X-API-Key"]).toBe("K");
    expect((init.headers as Record<string, string>)["X-API-Secret"]).toBe("S");
  });

  test("non-ok upstream → unavailable fallback (never throws)", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ ok: false, json: async () => ({}) });
    const res = await spaceshipAdapter.search(acct, "taken.com");
    expect(res.configured).toBe(true);
    if (res.configured) expect(res.quotes[0].available).toBe(false);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `bun run test src/lib/domains/registrars/spaceship.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the adapter** (full file)

```ts
// src/lib/domains/registrars/spaceship.ts
import { COMMON_TLDS, splitDomain } from "./shared";
import type {
  DnsRecordInput,
  DomainSettingsInput,
  DomainTldQuote,
  GetDomainResult,
  PushResult,
  RegisterDomainInput,
  RegisterDomainResult,
  RegistrarAccountRecord,
  RegistrarAdapter,
  RegistrarRenewResult,
  SearchDomainResult,
} from "./types";

const DEFAULT_BASE_URL = "https://spaceship.dev/api/v1";
const DEFAULT_TIMEOUT_MS = Number(process.env.SPACESHIP_TIMEOUT_MS ?? "12000");
const UPSTREAM_ERROR_FA = "ثبت دامنه در حال حاضر امکان‌پذیر نیست.";
const NOT_CONFIGURED_FA = "سرویس دامنه پیکربندی نشده است.";

function baseUrl(acct: RegistrarAccountRecord): string {
  return String(acct.config.baseUrl ?? DEFAULT_BASE_URL).replace(/\/+$/, "");
}
function quoteCurrency(acct: RegistrarAccountRecord): string {
  return String(acct.config.quoteCurrency ?? "USD");
}

async function ssFetch(
  acct: RegistrarAccountRecord,
  path: string,
  init: RequestInit = {},
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);
  try {
    return await fetch(`${baseUrl(acct)}${path}`, {
      ...init,
      signal: controller.signal,
      headers: {
        "X-API-Key": acct.credentials.apiKey ?? "",
        "X-API-Secret": acct.credentials.apiSecret ?? "",
        Accept: "application/json",
        ...(init.body ? { "Content-Type": "application/json" } : {}),
        ...(init.headers ?? {}),
      },
    });
  } finally {
    clearTimeout(timer);
  }
}

/** Best-effort price extraction (standard-tier field unverified — probe shapes). */
function extractPriceUsd(body: Record<string, unknown>): { premium: boolean; priceUsd: number | null } {
  const premiumArr = Array.isArray(body.premiumPricing)
    ? (body.premiumPricing as Array<Record<string, unknown>>)
    : [];
  const registerEntry =
    premiumArr.find((e) => String(e.operation ?? "").toLowerCase() === "register") ?? premiumArr[0];
  if (registerEntry && typeof registerEntry.price !== "undefined") {
    const price = Number(registerEntry.price);
    return { premium: true, priceUsd: Number.isFinite(price) ? price : null };
  }
  for (const key of ["price", "registerPrice", "registrationPrice", "renewalPrice"]) {
    const raw = body[key];
    if (typeof raw === "number" && Number.isFinite(raw)) return { premium: false, priceUsd: raw };
    if (typeof raw === "string" && Number.isFinite(Number(raw)))
      return { premium: false, priceUsd: Number(raw) };
  }
  return { premium: false, priceUsd: null };
}

async function mutate(
  acct: RegistrarAccountRecord,
  path: string,
  method: "POST" | "PUT" | "PATCH" | "DELETE",
  body?: unknown,
): Promise<PushResult> {
  try {
    const res = await ssFetch(acct, path, {
      method,
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

export const spaceshipAdapter: RegistrarAdapter = {
  provider: "SPACESHIP",
  capabilities() {
    return ["search", "register", "renew", "transfer", "nameservers", "dns", "contacts", "settings"];
  },

  async test(acct) {
    try {
      const res = await ssFetch(acct, `/domains/pixevel-conn-check-0.com/available`, { method: "GET" });
      if (res.status === 401 || res.status === 403) {
        return { ok: false, message: "احراز هویت ناموفق بود." };
      }
      return { ok: res.ok };
    } catch {
      return { ok: false, message: "اتصال برقرار نشد." };
    }
  },

  async search(acct, name): Promise<SearchDomainResult> {
    const term = name.trim().toLowerCase();
    const { sld, tld } = splitDomain(term);
    if (!sld) return { configured: true, sld: "", quotes: [] };
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
          currency: quoteCurrency(acct),
        };
        try {
          const res = await ssFetch(acct, `/domains/${encodeURIComponent(domainName)}/available`, {
            method: "GET",
          });
          if (!res.ok) return fallback;
          const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
          const available = String(body.result ?? "").toLowerCase() === "available";
          const { premium, priceUsd } = extractPriceUsd(body);
          return { domainName, tld: currentTld, available, premium, priceUsd, currency: quoteCurrency(acct) };
        } catch {
          return fallback;
        }
      }),
    );

    return { configured: true, sld, quotes };
  },

  async register(acct, input): Promise<RegisterDomainResult> {
    const domainName = input.domainName.trim().toLowerCase();
    const years = Math.min(10, Math.max(1, Math.trunc(input.years) || 1));
    const contactId = input.contact?.contactId ?? acct.credentials.contactId;
    if (!contactId) {
      throw new Error(NOT_CONFIGURED_FA);
    }

    const body = {
      autoRenew: false,
      years,
      privacyProtection: { level: "high", userConsent: true },
      contacts: { registrant: contactId, admin: contactId, tech: contactId, billing: contactId },
    };

    let res: Response;
    try {
      res = await ssFetch(acct, `/domains/${encodeURIComponent(domainName)}`, {
        method: "POST",
        body: JSON.stringify(body),
      });
    } catch {
      throw new Error(UPSTREAM_ERROR_FA);
    }

    if (!res.ok && res.status !== 202) {
      const detail = await res.text().catch(() => "");
      console.error(`[spaceship] register ${domainName} failed: ${res.status} ${detail}`);
      throw new Error(UPSTREAM_ERROR_FA);
    }

    const payload = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    const operationId =
      res.headers.get("spaceship-async-operationid") ??
      (typeof payload.operationId === "string" ? payload.operationId : null);
    const exp = typeof payload.expirationDate === "string" ? new Date(payload.expirationDate) : null;

    return {
      registrarRef: operationId ?? domainName,
      payload,
      expiresAt: exp && !Number.isNaN(exp.getTime()) ? exp : null,
    };
  },

  async getDomain(acct, name): Promise<GetDomainResult | null> {
    const domainName = name.trim().toLowerCase();
    try {
      const res = await ssFetch(acct, `/domains/${encodeURIComponent(domainName)}`, { method: "GET" });
      if (!res.ok) return null;
      const payload = (await res.json().catch(() => ({}))) as Record<string, unknown>;
      const exp = typeof payload.expirationDate === "string" ? new Date(payload.expirationDate) : null;
      const nameservers = Array.isArray(payload.nameservers)
        ? (payload.nameservers as unknown[]).map(String)
        : [];
      return {
        domainName,
        status: typeof payload.status === "string" ? payload.status : null,
        expiresAt: exp && !Number.isNaN(exp.getTime()) ? exp : null,
        nameservers,
        payload,
      };
    } catch {
      return null;
    }
  },

  async renew(acct, name, years): Promise<RegistrarRenewResult> {
    const safeYears = Math.min(10, Math.max(1, Math.trunc(years) || 1));
    try {
      const res = await ssFetch(acct, `/domains/${encodeURIComponent(name.trim().toLowerCase())}/renew`, {
        method: "POST",
        body: JSON.stringify({ years: safeYears }),
      });
      if (!res.ok && res.status !== 202) {
        const detail = await res.text().catch(() => "");
        console.error(`[spaceship] renew ${name} → ${res.status} ${detail}`);
        return { pushed: false, expiresAt: null, payload: null };
      }
      const payload = (await res.json().catch(() => ({}))) as Record<string, unknown>;
      const exp = typeof payload.expirationDate === "string" ? new Date(payload.expirationDate) : null;
      return { pushed: true, expiresAt: exp && !Number.isNaN(exp.getTime()) ? exp : null, payload };
    } catch (error) {
      console.error(`[spaceship] renew ${name} failed`, error);
      return { pushed: false, expiresAt: null, payload: null };
    }
  },

  pushNameservers(acct, name, nameservers) {
    const clean = nameservers.map((n) => n.trim().toLowerCase()).filter(Boolean);
    const provider = clean.length === 0 ? "basic" : "custom";
    return mutate(acct, `/domains/${encodeURIComponent(name.trim().toLowerCase())}/nameservers`, "PUT", {
      provider,
      hosts: clean,
    });
  },

  pushDomainSettings(acct, name, settings: DomainSettingsInput) {
    const body: Record<string, unknown> = {};
    if (settings.autoRenew !== undefined) body.autoRenew = settings.autoRenew;
    if (settings.transferLock !== undefined) body.locked = settings.transferLock;
    if (settings.privacyProtection !== undefined) {
      body.privacyProtection = { level: settings.privacyProtection ? "high" : "public", userConsent: true };
    }
    return mutate(acct, `/domains/${encodeURIComponent(name.trim().toLowerCase())}`, "PUT", body);
  },

  pushContact(acct, name, contact) {
    return mutate(acct, `/domains/${encodeURIComponent(name.trim().toLowerCase())}/contacts`, "PUT", {
      registrant: contact,
    });
  },

  pushDnsRecords(acct, name, records: DnsRecordInput[]) {
    const items = records.map((r) => ({
      type: r.type,
      name: r.name,
      value: r.value,
      ttl: r.ttl,
      ...(r.priority != null ? { priority: r.priority } : {}),
    }));
    return mutate(acct, `/dns/records/${encodeURIComponent(name.trim().toLowerCase())}`, "PUT", {
      force: true,
      items,
    });
  },
};
```

- [ ] **Step 4: Create the registration side-effect module**

```ts
// src/lib/domains/registrars/register.ts
import { registerAdapter } from "./registry";
import { spaceshipAdapter } from "./spaceship";

registerAdapter(spaceshipAdapter);
```

- [ ] **Step 5: Run the adapter test, verify pass**

Run: `bun run test src/lib/domains/registrars/spaceship.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 6: Lint + commit**

```bash
bunx biome check --write src/lib/domains/registrars/spaceship.ts src/lib/domains/registrars/register.ts src/lib/domains/registrars/spaceship.test.ts
git add src/lib/domains/registrars/spaceship.ts src/lib/domains/registrars/register.ts src/lib/domains/registrars/spaceship.test.ts
git commit -m "feat(domains): Spaceship registrar adapter (account-based creds)"
```

---

### Task 7: Facade + rewire call sites + delete old spaceship.ts

**Files:**
- Create: `src/lib/domains/registrar.ts`
- Modify: `src/lib/domains/cart.ts:9`, `src/app/api/domains/search/route.ts:3`, `src/lib/domains/manage.ts:15-22`, `src/lib/account/services.ts:5`, `src/app/domains/page.tsx:3,114-115`
- Delete: `src/lib/domains/spaceship.ts`

**Interfaces:**
- Consumes: accounts (Task 4), registry (Task 3), demo (Task 5), `./registrars/register` side-effect (Task 6).
- Produces: `searchDomain(name)`, `registerDomain(input)` (returns `RegisterDomainResult & { registrarAccountId: string | null; provider: DomainProvider | null }`), `getDomain(name)`, `pushNameservers/pushDnsRecords/pushContact/pushDomainSettings`, `renewDomainAtRegistrar(name, years)`, `isDomainConfigured()`, `isDomainDemo()`, `isDomainSearchEnabled()`, and re-exported types incl. `DnsRecordInput`.

- [ ] **Step 1: Create the facade**

```ts
// src/lib/domains/registrar.ts
import "server-only";

import { eq } from "drizzle-orm";

import { domainRegistrations } from "@/db/schema";
import { getDb } from "@/lib/db";

import { getRegistrarAccountById, isDomainConfigured, pickRegistrar } from "./registrars/accounts";
import { DEMO_ACCOUNT, demoAdapter } from "./registrars/demo";
import "./registrars/register"; // side-effect: register real adapters
import { registrarFor } from "./registrars/registry";
import type {
  DnsRecordInput,
  DomainProvider,
  DomainSettingsInput,
  GetDomainResult,
  PushResult,
  RegisterDomainInput,
  RegisterDomainResult,
  RegistrarAccountRecord,
  RegistrarAdapter,
  RegistrarRenewResult,
  SearchDomainResult,
} from "./registrars/types";

export type {
  DnsRecordInput,
  DomainProvider,
  DomainSettingsInput,
  GetDomainResult,
  PushResult,
  RegisterDomainInput,
  RegisterDomainResult,
  RegistrarRenewResult,
  SearchDomainResult,
} from "./registrars/types";

export { isDomainConfigured };

function tldOf(name: string): string {
  const i = name.indexOf(".");
  return i > 0 ? name.slice(i + 1) : "";
}

type Resolved = { adapter: RegistrarAdapter; acct: RegistrarAccountRecord; isDemo: boolean };

/** Pick an account by TLD (weighted), else demo when not in production. */
async function resolveForTld(tld?: string): Promise<Resolved | null> {
  const acct = await pickRegistrar(tld);
  if (acct) return { adapter: registrarFor(acct.provider), acct, isDemo: false };
  if (process.env.NODE_ENV !== "production") {
    return { adapter: demoAdapter, acct: DEMO_ACCOUNT, isDemo: true };
  }
  return null;
}

/** Resolve the account that registered a domain (falls back to weighted pick). */
async function resolveForDomain(domainName: string): Promise<Resolved | null> {
  const reg = await getDb().query.domainRegistrations.findFirst({
    where: eq(domainRegistrations.domainName, domainName.trim().toLowerCase()),
    columns: { registrarAccountId: true, tld: true },
  });
  if (reg?.registrarAccountId) {
    const acct = await getRegistrarAccountById(reg.registrarAccountId);
    if (acct) return { adapter: registrarFor(acct.provider), acct, isDemo: false };
  }
  return resolveForTld(reg?.tld ?? tldOf(domainName));
}

export async function searchDomain(name: string): Promise<SearchDomainResult> {
  const r = await resolveForTld(tldOf(name) || undefined);
  if (!r) return { configured: false, quotes: [] };
  return r.adapter.search(r.acct, name);
}

export async function registerDomain(
  input: RegisterDomainInput,
): Promise<RegisterDomainResult & { registrarAccountId: string | null; provider: DomainProvider | null }> {
  const r = await resolveForTld(tldOf(input.domainName) || undefined);
  if (!r) throw new Error("سرویس دامنه پیکربندی نشده است.");
  const result = await r.adapter.register(r.acct, input);
  return {
    ...result,
    registrarAccountId: r.isDemo ? null : r.acct.id,
    provider: r.adapter.provider,
  };
}

export async function getDomain(name: string): Promise<GetDomainResult | null> {
  const r = await resolveForDomain(name);
  if (!r) return null;
  return r.adapter.getDomain(r.acct, name);
}

export async function pushNameservers(name: string, ns: string[]): Promise<PushResult> {
  const r = await resolveForDomain(name);
  return r ? r.adapter.pushNameservers(r.acct, name, ns) : { pushed: false };
}

export async function pushDnsRecords(name: string, records: DnsRecordInput[]): Promise<PushResult> {
  const r = await resolveForDomain(name);
  return r ? r.adapter.pushDnsRecords(r.acct, name, records) : { pushed: false };
}

export async function pushContact(name: string, contact: Record<string, unknown>): Promise<PushResult> {
  const r = await resolveForDomain(name);
  return r ? r.adapter.pushContact(r.acct, name, contact) : { pushed: false };
}

export async function pushDomainSettings(
  name: string,
  settings: DomainSettingsInput,
): Promise<PushResult> {
  const r = await resolveForDomain(name);
  return r ? r.adapter.pushDomainSettings(r.acct, name, settings) : { pushed: false };
}

export async function renewDomainAtRegistrar(name: string, years: number): Promise<RegistrarRenewResult> {
  const r = await resolveForDomain(name);
  return r ? r.adapter.renew(r.acct, name, years) : { pushed: false, expiresAt: null, payload: null };
}

export async function isDomainDemo(): Promise<boolean> {
  if (process.env.NODE_ENV === "production") return false;
  return !(await isDomainConfigured());
}

export async function isDomainSearchEnabled(): Promise<boolean> {
  return (await isDomainConfigured()) || (await isDomainDemo());
}
```

- [ ] **Step 2: Rewire `src/lib/domains/cart.ts`**

Change line 9 from:
```ts
import { searchDomain } from "@/lib/domains/spaceship";
```
to:
```ts
import { searchDomain } from "@/lib/domains/registrar";
```
(The `search.configured`/`quotes` usage is unchanged — `searchDomain` is already awaited.)

- [ ] **Step 3: Rewire `src/app/api/domains/search/route.ts`**

Change line 3 from `@/lib/domains/spaceship` to `@/lib/domains/registrar`. No other change.

- [ ] **Step 4: Rewire `src/lib/domains/manage.ts`**

Change the import block (lines 15-22) from:
```ts
import {
  type DnsRecordInput,
  getDomain,
  pushContact,
  pushDnsRecords,
  pushDomainSettings,
  pushNameservers,
} from "@/lib/domains/spaceship";
```
to:
```ts
import {
  type DnsRecordInput,
  getDomain,
  pushContact,
  pushDnsRecords,
  pushDomainSettings,
  pushNameservers,
} from "@/lib/domains/registrar";
```

- [ ] **Step 5: Rewire `src/lib/account/services.ts`**

Change line 5 from `@/lib/domains/spaceship` to `@/lib/domains/registrar`. No other change (`renewDomainAtRegistrar` signature is identical).

- [ ] **Step 6: Rewire `src/app/domains/page.tsx`** (gating now async)

Change line 3 import to `@/lib/domains/registrar`, then change lines 114-115 from:
```ts
  const configured = isDomainSearchEnabled();
  const demo = isDomainDemo();
```
to:
```ts
  const configured = await isDomainSearchEnabled();
  const demo = await isDomainDemo();
```

- [ ] **Step 7: Delete the old module**

```bash
git rm src/lib/domains/spaceship.ts
```

- [ ] **Step 8: Verify build (catches any missed import / type drift)**

```bash
bun run build 2>&1 | tail -15
```
Expected: build succeeds. If any file still imports `@/lib/domains/spaceship`, fix it to `@/lib/domains/registrar`.

- [ ] **Step 9: Run the full test suite**

Run: `bun run test`
Expected: all suites pass (the new registrar tests + the pre-existing ones).

- [ ] **Step 10: Lint + commit**

```bash
bunx biome check --write src/lib/domains/ src/app/api/domains/search/route.ts src/lib/account/services.ts src/app/domains/page.tsx
git add -A
git commit -m "refactor(domains): route registrar calls through DB-account facade; drop SPACESHIP env client"
```

---

### Task 8: Persist the registrar account on fulfillment

**Files:**
- Modify: `src/lib/orders/fulfillment/domain.ts` (import line 5; `registerDomain` call ~65; `RegistrationValues` type ~102; both `upsertRegistration` writers ~117-153)

**Interfaces:**
- Consumes: `registerDomain` (Task 7) now returns `registrarAccountId` + `provider`.
- Produces: `domainRegistrations.registrarAccountId` + `.provider` populated on success.

- [ ] **Step 1: Update the import**

Change line 5 from `@/lib/domains/spaceship` to `@/lib/domains/registrar`.

- [ ] **Step 2: Extend `RegistrationValues`** (add two fields)

```ts
type RegistrationValues = {
  userId: string | null;
  domainName: string;
  tld: string;
  years: number;
  status: "REGISTERED" | "FAILED";
  registrarRef: string | null;
  registrarPayload: unknown;
  expiresAt: Date | null;
  registrarAccountId: string | null;
  provider: "SPACESHIP" | null;
};
```

- [ ] **Step 3: Pass the new fields from the success path** (in `fulfillDomainItems`)

Replace the success `upsertRegistration` call body to include:
```ts
      await upsertRegistration(item.id, {
        userId,
        domainName: meta.domainName,
        tld: meta.tld,
        years: meta.years,
        status: "REGISTERED",
        registrarRef: result.registrarRef,
        registrarPayload: result.payload,
        expiresAt: result.expiresAt,
        registrarAccountId: result.registrarAccountId,
        provider: result.provider,
      });
```
And in the FAILED path add `registrarAccountId: null, provider: null,` to that values object.

- [ ] **Step 4: Write both columns in `upsertRegistration`**

In the `.update(...).set({...})` object and the `.insert(...).values({...})` object, add:
```ts
        registrarAccountId: values.registrarAccountId,
        provider: values.provider,
```

- [ ] **Step 5: Verify build**

```bash
bun run build 2>&1 | tail -8
```
Expected: succeeds.

- [ ] **Step 6: Commit**

```bash
bunx biome check --write src/lib/orders/fulfillment/domain.ts
git add src/lib/orders/fulfillment/domain.ts
git commit -m "feat(domains): record registrar account on fulfillment"
```

---

### Task 9: Admin API — registrar CRUD + test connection

**Files:**
- Create: `src/app/api/admin/domain-registrars/route.ts` (GET list, POST create)
- Create: `src/app/api/admin/domain-registrars/[id]/route.ts` (PATCH update, DELETE)
- Create: `src/app/api/admin/domain-registrars/[id]/test/route.ts` (POST test)

**Interfaces:**
- Consumes: `requireAdmin` (auth), `parseBody` (Zod), accounts CRUD (Task 4), `getRegistrarAccountById` + `registrarFor` (Tasks 3-4), `./registrars/register` side-effect.
- Produces: admin endpoints returning `AdminRegistrarRow` shapes (never secrets).

- [ ] **Step 1: Create the collection route**

```ts
// src/app/api/admin/domain-registrars/route.ts
import { z } from "zod";

import { apiError, apiOk } from "@/lib/api";
import { requireAdmin } from "@/lib/auth";
import { createRegistrar, listRegistrars } from "@/lib/domains/registrars/accounts";
import { parseBody } from "@/lib/validate";

export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return apiError("UNAUTHORIZED", "دسترسی مجاز نیست.", 401);
  return apiOk({ registrars: await listRegistrars() });
}

const CreateSchema = z.object({
  provider: z.literal("SPACESHIP"),
  name: z.string().min(1),
  credentials: z.object({
    apiKey: z.string().min(1),
    apiSecret: z.string().min(1),
    contactId: z.string().optional(),
  }),
  config: z
    .object({
      weight: z.number().int().min(0).optional(),
      tldAllowlist: z.array(z.string()).optional(),
      baseUrl: z.string().url().optional(),
      quoteCurrency: z.string().optional(),
    })
    .optional(),
  status: z.enum(["active", "disabled"]).optional(),
});

export async function POST(request: Request) {
  const admin = await requireAdmin();
  if (!admin) return apiError("UNAUTHORIZED", "دسترسی مجاز نیست.", 401);

  const parsed = await parseBody(request, CreateSchema);
  if (!parsed.ok) return parsed.response;

  const row = await createRegistrar(parsed.data);
  return apiOk({ registrar: row });
}
```

- [ ] **Step 2: Create the item route**

```ts
// src/app/api/admin/domain-registrars/[id]/route.ts
import { z } from "zod";

import { apiError, apiOk } from "@/lib/api";
import { requireAdmin } from "@/lib/auth";
import { deleteRegistrar, updateRegistrar } from "@/lib/domains/registrars/accounts";
import { parseBody } from "@/lib/validate";

const UpdateSchema = z.object({
  name: z.string().min(1).optional(),
  credentials: z
    .object({
      apiKey: z.string().min(1),
      apiSecret: z.string().min(1),
      contactId: z.string().optional(),
    })
    .optional(),
  config: z
    .object({
      weight: z.number().int().min(0).optional(),
      tldAllowlist: z.array(z.string()).optional(),
      baseUrl: z.string().url().optional(),
      quoteCurrency: z.string().optional(),
    })
    .optional(),
  status: z.enum(["active", "disabled"]).optional(),
});

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  if (!admin) return apiError("UNAUTHORIZED", "دسترسی مجاز نیست.", 401);

  const { id } = await params;
  const parsed = await parseBody(request, UpdateSchema);
  if (!parsed.ok) return parsed.response;

  const row = await updateRegistrar(id, parsed.data);
  if (!row) return apiError("NOT_FOUND", "حساب ثبت‌کننده یافت نشد.", 404);
  return apiOk({ registrar: row });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  if (!admin) return apiError("UNAUTHORIZED", "دسترسی مجاز نیست.", 401);

  const { id } = await params;
  await deleteRegistrar(id);
  return apiOk({ deleted: true });
}
```

- [ ] **Step 3: Create the test-connection route**

```ts
// src/app/api/admin/domain-registrars/[id]/test/route.ts
import { apiError, apiOk } from "@/lib/api";
import { requireAdmin } from "@/lib/auth";
import { getRegistrarAccountById } from "@/lib/domains/registrars/accounts";
import "@/lib/domains/registrars/register";
import { registrarFor } from "@/lib/domains/registrars/registry";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  if (!admin) return apiError("UNAUTHORIZED", "دسترسی مجاز نیست.", 401);

  const { id } = await params;
  const acct = await getRegistrarAccountById(id);
  if (!acct) return apiError("NOT_FOUND", "حساب ثبت‌کننده یافت نشد.", 404);

  const result = await registrarFor(acct.provider).test(acct);
  return apiOk(result);
}
```

- [ ] **Step 4: Verify build**

```bash
bun run build 2>&1 | tail -8
```
Expected: succeeds (new routes compile).

- [ ] **Step 5: Lint + commit**

```bash
bunx biome check --write src/app/api/admin/domain-registrars/
git add src/app/api/admin/domain-registrars/
git commit -m "feat(admin): domain-registrar CRUD + test-connection API"
```

---

### Task 10: Admin UI — /admin/integrations (registrars tab) + sidebar link

**Files:**
- Create: `src/app/admin/integrations/page.tsx` (server shell)
- Create: `src/components/admin/registrar-management.tsx` (client)
- Modify: `src/components/admin/admin-sidebar.tsx` (add nav item)

**Interfaces:**
- Consumes: `listRegistrars` (Task 4), the admin API routes (Task 9).
- Produces: a working registrars management screen; a placeholder server-nodes tab (filled by the server-feature plan).

- [ ] **Step 1: Create the page (server component)**

```tsx
// src/app/admin/integrations/page.tsx
import type { Metadata } from "next";

import { RegistrarManagement } from "@/components/admin/registrar-management";
import { requireAdmin } from "@/lib/auth";
import { listRegistrars } from "@/lib/domains/registrars/accounts";

export const metadata: Metadata = { title: "ادغام‌ها | مدیریت" };

export default async function AdminIntegrationsPage() {
  const admin = await requireAdmin();
  if (!admin) {
    return <p className="p-6 text-sm text-muted-foreground">دسترسی مجاز نیست.</p>;
  }

  const registrars = await listRegistrars();

  return (
    <div className="space-y-6 p-4 sm:p-6" dir="rtl">
      <header>
        <h1 className="text-2xl font-black">ادغام‌ها</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          مدیریت اعتبارنامه‌های سرویس‌های خارجی. کلیدها به‌صورت رمزنگاری‌شده ذخیره می‌شوند.
        </p>
      </header>

      <section>
        <h2 className="mb-3 text-lg font-black">درگاه‌های دامنه</h2>
        <RegistrarManagement initialRegistrars={registrars} />
      </section>

      <section className="opacity-60">
        <h2 className="mb-3 text-lg font-black">سرورها / نودها</h2>
        <p className="rounded-2xl border border-dashed border-border p-6 text-sm text-muted-foreground">
          به‌زودی — مدیریت نودهای سرور (Proxmox/WHM/KVM/ESXi) در این بخش اضافه می‌شود.
        </p>
      </section>
    </div>
  );
}
```

- [ ] **Step 2: Create the client management component**

```tsx
// src/components/admin/registrar-management.tsx
"use client";

import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

type RegistrarRow = {
  id: string;
  provider: string;
  name: string;
  status: string;
  config: Record<string, unknown>;
  createdAt: string | Date;
};

export function RegistrarManagement({ initialRegistrars }: { initialRegistrars: RegistrarRow[] }) {
  const [rows, setRows] = useState<RegistrarRow[]>(initialRegistrars);
  const [name, setName] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [apiSecret, setApiSecret] = useState("");
  const [contactId, setContactId] = useState("");
  const [weight, setWeight] = useState(1);
  const [saving, setSaving] = useState(false);
  const [testingId, setTestingId] = useState<string | null>(null);

  async function refresh() {
    const res = await fetch("/api/admin/domain-registrars", { cache: "no-store" });
    const payload = await res.json();
    if (payload.ok) setRows(payload.data.registrars);
  }

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/api/admin/domain-registrars", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          provider: "SPACESHIP",
          name,
          credentials: { apiKey, apiSecret, ...(contactId ? { contactId } : {}) },
          config: { weight },
        }),
      });
      const payload = await res.json();
      if (payload.ok) {
        toast.success("درگاه دامنه افزوده شد.");
        setName("");
        setApiKey("");
        setApiSecret("");
        setContactId("");
        await refresh();
      } else {
        toast.error(payload.error?.message ?? "ثبت ناموفق بود.");
      }
    } finally {
      setSaving(false);
    }
  }

  async function testConn(id: string) {
    setTestingId(id);
    try {
      const res = await fetch(`/api/admin/domain-registrars/${id}/test`, { method: "POST" });
      const payload = await res.json();
      if (payload.ok && payload.data.ok) toast.success("اتصال موفق بود.");
      else toast.error(payload.data?.message ?? "اتصال ناموفق بود.");
    } finally {
      setTestingId(null);
    }
  }

  async function toggleStatus(row: RegistrarRow) {
    const next = row.status === "active" ? "disabled" : "active";
    const res = await fetch(`/api/admin/domain-registrars/${row.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status: next }),
    });
    const payload = await res.json();
    if (payload.ok) {
      await refresh();
    } else {
      toast.error("به‌روزرسانی ناموفق بود.");
    }
  }

  async function remove(id: string) {
    const res = await fetch(`/api/admin/domain-registrars/${id}`, { method: "DELETE" });
    const payload = await res.json();
    if (payload.ok) await refresh();
    else toast.error("حذف ناموفق بود.");
  }

  return (
    <div className="space-y-5">
      <div className="overflow-hidden rounded-2xl border border-border">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-right">
            <tr>
              <th className="p-3 font-bold">نام</th>
              <th className="p-3 font-bold">سرویس</th>
              <th className="p-3 font-bold">وزن</th>
              <th className="p-3 font-bold">وضعیت</th>
              <th className="p-3 font-bold">عملیات</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={5} className="p-6 text-center text-muted-foreground">
                  هنوز درگاهی اضافه نشده است.
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.id} className="border-t border-border">
                  <td className="p-3 font-bold">{row.name}</td>
                  <td className="p-3">{row.provider}</td>
                  <td className="p-3">{String(row.config.weight ?? 0)}</td>
                  <td className="p-3">{row.status === "active" ? "فعال" : "غیرفعال"}</td>
                  <td className="p-3">
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={testingId === row.id}
                        onClick={() => testConn(row.id)}
                      >
                        تست اتصال
                      </Button>
                      <Button type="button" size="sm" variant="outline" onClick={() => toggleStatus(row)}>
                        {row.status === "active" ? "غیرفعال‌سازی" : "فعال‌سازی"}
                      </Button>
                      <Button type="button" size="sm" variant="destructive" onClick={() => remove(row.id)}>
                        حذف
                      </Button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <form onSubmit={create} className="grid gap-3 rounded-2xl border border-border p-4 sm:grid-cols-2">
        <h3 className="sm:col-span-2 font-black">افزودن درگاه (Spaceship)</h3>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="نام نمایشی"
          required
          className="rounded-xl border border-border bg-muted/30 px-3 py-2"
        />
        <input
          value={weight}
          onChange={(e) => setWeight(Number(e.target.value) || 0)}
          type="number"
          min={0}
          placeholder="وزن (اولویت)"
          className="rounded-xl border border-border bg-muted/30 px-3 py-2"
        />
        <input
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          placeholder="API Key"
          required
          dir="ltr"
          className="rounded-xl border border-border bg-muted/30 px-3 py-2"
        />
        <input
          value={apiSecret}
          onChange={(e) => setApiSecret(e.target.value)}
          placeholder="API Secret"
          required
          dir="ltr"
          type="password"
          className="rounded-xl border border-border bg-muted/30 px-3 py-2"
        />
        <input
          value={contactId}
          onChange={(e) => setContactId(e.target.value)}
          placeholder="Contact ID (اختیاری)"
          dir="ltr"
          className="rounded-xl border border-border bg-muted/30 px-3 py-2"
        />
        <div className="sm:col-span-2">
          <Button type="submit" disabled={saving}>
            افزودن درگاه
          </Button>
        </div>
      </form>
    </div>
  );
}
```

- [ ] **Step 3: Add the sidebar link**

In `src/components/admin/admin-sidebar.tsx`, add `PlugIcon` to the lucide import list, and insert this item into `navItems` right after the settings entry (line 50):
```ts
  { href: "/admin/integrations", label: "ادغام‌ها", icon: PlugIcon, exact: false },
```

- [ ] **Step 4: Verify build**

```bash
bun run build 2>&1 | tail -8
```
Expected: succeeds.

- [ ] **Step 5: Lint + commit**

```bash
bunx biome check --write src/app/admin/integrations/ src/components/admin/registrar-management.tsx src/components/admin/admin-sidebar.tsx
git add src/app/admin/integrations/ src/components/admin/registrar-management.tsx src/components/admin/admin-sidebar.tsx
git commit -m "feat(admin): /admin/integrations registrars management UI"
```

---

### Task 11: Env-import script, cleanup, end-to-end verification

**Files:**
- Create: `scripts/import-spaceship-env.ts`
- Modify: `.env.example` (if present) — add `APP_VAULT_KEY`, remove `SPACESHIP_*`
- Grep-and-remove any remaining `SPACESHIP_API_KEY`/`SPACESHIP_API_SECRET` references

- [ ] **Step 1: Create the optional import script**

```ts
// scripts/import-spaceship-env.ts
// One-time: seed a DomainRegistrar row from existing SPACESHIP_* env values.
// Run: APP_VAULT_KEY=... bun run scripts/import-spaceship-env.ts
import { createRegistrar, listRegistrars } from "@/lib/domains/registrars/accounts";

async function main() {
  const apiKey = process.env.SPACESHIP_API_KEY;
  const apiSecret = process.env.SPACESHIP_API_SECRET;
  if (!apiKey || !apiSecret) {
    console.error("No SPACESHIP_API_KEY/SECRET in env — nothing to import.");
    process.exit(1);
  }
  const existing = await listRegistrars();
  if (existing.length > 0) {
    console.log(`Already have ${existing.length} registrar(s); skipping.`);
    return;
  }
  const row = await createRegistrar({
    provider: "SPACESHIP",
    name: "Spaceship — imported",
    credentials: {
      apiKey,
      apiSecret,
      ...(process.env.SPACESHIP_CONTACT_ID ? { contactId: process.env.SPACESHIP_CONTACT_ID } : {}),
    },
    config: {
      weight: 1,
      ...(process.env.SPACESHIP_BASE_URL ? { baseUrl: process.env.SPACESHIP_BASE_URL } : {}),
      ...(process.env.SPACESHIP_QUOTE_CURRENCY
        ? { quoteCurrency: process.env.SPACESHIP_QUOTE_CURRENCY }
        : {}),
    },
  });
  console.log(`Imported registrar ${row.id} (${row.name}).`);
}

main().then(() => process.exit(0));
```

- [ ] **Step 2: Confirm no stale env references remain**

```bash
grep -rn "SPACESHIP_API_KEY\|SPACESHIP_API_SECRET\|lib/domains/spaceship" src/ ; echo "exit: $?"
```
Expected: only matches inside `src/lib/domains/registrars/spaceship.ts` (the `SPACESHIP_TIMEOUT_MS` constant is acceptable) and `scripts/import-spaceship-env.ts`. No `@/lib/domains/spaceship` imports remain.

- [ ] **Step 3: Update `.env.example`** (if the file exists)

Remove `SPACESHIP_API_KEY`/`SPACESHIP_API_SECRET`/`SPACESHIP_BASE_URL`/`SPACESHIP_QUOTE_CURRENCY`/`SPACESHIP_CONTACT_ID` lines; add:
```
# 32-byte key (64 hex chars) for encrypting integration credentials at rest
APP_VAULT_KEY=
```

- [ ] **Step 4: Full gate — build, lint, tests**

```bash
lsof -ti tcp:4000 | xargs kill -9 2>/dev/null
bun run build 2>&1 | tail -8
bunx biome ci src/lib/domains src/lib/crypto src/app/api/admin/domain-registrars src/app/admin/integrations src/components/admin 2>&1 | tail -5
bun run test 2>&1 | tail -10
```
Expected: build succeeds, biome clean, all tests pass.

- [ ] **Step 5: Manual demo-mode verification** (no `APP_VAULT_KEY`, dev)

Start the dev server (`preview_start`), open `/domains`:
- Search a name → results render (demo adapter; the «حالت آزمایشی» badge shows because `isDomainConfigured()` is false).
This confirms gating still resolves to demo when no account + no vault key, in development.

- [ ] **Step 6: Manual configured-mode verification** (with `APP_VAULT_KEY` set, dev)

With `APP_VAULT_KEY` set and the dev server restarted: go to `/admin/integrations`, add a Spaceship registrar (any test keys), click "تست اتصال" (expect a clear success/fail toast), confirm it appears active. Reload `/domains` → the demo badge disappears (now "configured"). Disable the registrar → demo returns.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "chore(domains): env-import script + retire SPACESHIP env, vault docs"
```

---

## Self-Review

**Spec coverage** (against `2026-06-21-multi-registrar-domains-design.md`):
- §3 architecture (registrarFor, pickRegistrar weighted, demo) → Tasks 3,4,5,7. ✓
- §4 RegistrarAdapter + capabilities → Task 3. ✓
- §5 Spaceship refactor (env→account) → Tasks 6,7. ✓
- §6 schema (enum, table, registration columns) → Task 2. ✓
- §7 shared crypto (APP_VAULT_KEY) → Task 1. ✓
- §8 async gating, env retired → Tasks 4,7,11. ✓
- §9 admin /admin/integrations + API → Tasks 9,10. ✓ (server-nodes tab is a placeholder, filled by the server-feature plan — noted.)
- §10 migration → Task 2. ✓
- §11 security (encrypted at rest, requireAdmin, secrets never returned, generic errors) → Tasks 1,4,9. ✓
- §12 testing → Tasks 1,3,4,5,6 unit tests; DB-backed paths + admin via Task 11 manual. ✓ (Gating/CRUD DB functions are verified manually rather than unit-tested to avoid a DB harness — explicit, not a gap.)
- §13 build order → matches Task ordering. ✓

**Placeholder scan:** No TBD/TODO; every code step shows complete code. The Spaceship adapter is a full file, not "port the rest". ✓

**Type consistency:** `RegistrarAccountRecord`, `SearchDomainResult`, `RegisterDomainResult`, `PushResult`, `RegistrarRenewResult`, `DnsRecordInput`, `DomainSettingsInput` defined in Task 3 and used identically in Tasks 5,6,7. Facade `registerDomain` return type (adds `registrarAccountId`/`provider`) matches the consumer in Task 8. `selectRegistrar`/`pickRegistrar`/`registrarFor`/`getRegistrarAccountById` names consistent across Tasks 4,7,9. ✓
