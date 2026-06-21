# Catalog expansion — digital codes · physical gear · domains · VPS

Date: 2026-06-20
Status: Approved (scope), building
Scope: catalog model, inventory, cart/checkout delivery, admin, homepage, two external integrations (spaceship domains, VPS provisioning)

## Goal

Pixevel sells four product worlds; the catalog must handle all cleanly:
1. **Digital codes** — gift cards, CD keys (DONE: per-unit code inventory).
2. **Physical gaming gear** — mice, keyboards (shipping; quantity stock).
3. **Domains** — search + register via spaceship.com reseller (env-gated scaffold).
4. **Servers (VPS)** — cloud server plans, provisioned via an upstream (env-gated scaffold).

Plus: review + improve **categories** and the **homepage** to present these worlds.

## Architecture

### Fulfillment type
`products.fulfillmentType` enum grows to `DIGITAL | PHYSICAL | DOMAIN | SERVER`.

On payment confirmation (`confirmPayment` → a new **fulfillment dispatcher**), branch by the
order's item fulfillment types:
- **DIGITAL** → deliver codes (email + SMS) — existing.
- **PHYSICAL** → no code; order enters shipping lifecycle (PROCESSING → SHIPPED). No auto-delivery.
- **DOMAIN** → register each domain via spaceship; store a `DomainRegistration` record.
- **SERVER** → provision each VPS via the upstream; store a `ServerInstance` record.

The dispatcher lives in `src/lib/orders/fulfillment.ts` and imports per-world handlers
(`fulfillment/digital.ts`, `fulfillment/domain.ts`, `fulfillment/server.ts`). `confirmPayment`
calls the dispatcher (best-effort, never blocks payment).

### Inventory by type
- **DIGITAL**: per-unit `InventoryUnit` rows with real codes (existing).
- **PHYSICAL**: quantity stock. Reuse `InventoryUnit` rows as plain serials (one row = one item,
  auto serial code) so the existing reserve/sell flow is unchanged; admin "add stock" takes a
  quantity. Delivery skips code-sending for physical.
- **DOMAIN / SERVER**: no stock — provisioned on demand. Addability is always-available (subject
  to the domain being available / the plan being active).

### Products + variants + metadata
- Add `metadata jsonb` to `productVariants` and `orderItems` to carry world-specific data
  (domain: `{ domainName, tld, years }`; server: `{ planCode, cpu, ram, diskGb, periodMonths }`).
- **VPS plans** are ordinary products (`fulfillmentType=SERVER`); each plan's billing options
  (1/3/12-month) are variants with specs in `metadata` + tier prices.
- **Domains** are dynamic: a domain search (`/domains`) queries spaceship for availability +
  price; "add to cart" mints a one-off product+variant (`fulfillmentType=DOMAIN`, `metadata` =
  the domain) priced from the quote, then uses the normal cart → checkout → order flow.

### New tables
- `domainRegistrations`: { id, orderItemId, userId, domainName, tld, years, status
  (PENDING/REGISTERED/FAILED), registrarRef, expiresAt, createdAt, updatedAt }.
- `serverInstances`: { id, orderItemId, userId, planCode, specs(jsonb), status
  (PENDING/ACTIVE/FAILED/SUSPENDED), providerRef, ipAddress, expiresAt, createdAt, updatedAt }.

### External integrations (env-gated scaffolds — real client code, disabled until creds)
- **spaceship.com** `src/lib/domains/spaceship.ts`: `searchDomain(name)` (availability + price),
  `registerDomain({ domainName, years, contact })`, `getDomain(name)`. Env: `SPACESHIP_API_KEY`,
  `SPACESHIP_API_SECRET`, `SPACESHIP_BASE_URL`. No creds → functions return a clear "not
  configured" result; the `/domains` UI shows a disabled/"به‌زودی" state.
- **VPS provisioning** `src/lib/servers/provider.ts`: `provisionServer(plan, specs)` /
  `getServer(ref)` against a configurable upstream. Env-gated; scaffolded.

## Work breakdown (parallel agents, disjoint files)
- **Foundation (serial)**: schema (fulfillmentType, metadata, domainRegistrations,
  serverInstances) + migrate; `fulfillment.ts` dispatcher skeleton + wire into `confirmPayment`;
  the spaceship + server-provider lib skeletons (interfaces + env gating).
- **A — Categories + homepage**: restructure categories around the four worlds; improve homepage
  blocks to showcase them.
- **B — Physical gear**: quantity-stock admin + addability + physical delivery (no code); ensure
  shipping lifecycle works.
- **C — Domains**: spaceship client (env-gated), `/domains` search page + API, dynamic
  add-to-cart, register-on-PAID handler.
- **D — Servers (VPS)**: plan products + admin specs, provisioning client (env-gated),
  provision-on-PAID handler, an account "my servers" view.

## Deferred (flagged)
- Auto-recurring billing for VPS/domains (renewals) — its own subsystem.
- Real transaction testing of spaceship/VPS (needs credentials).
- Domain transfer/DNS management, server lifecycle (reboot/rebuild) controls.
