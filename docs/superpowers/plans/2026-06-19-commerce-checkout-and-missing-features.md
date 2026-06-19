# Commerce Checkout + Missing Features Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the 9 audited gaps — turn a fillable basket into real orders with reserved per-unit stock, three payment methods, hybrid digital/physical delivery, orders admin, search, premium dark-mode, and pagination.

**Architecture:** A new `src/lib/orders` domain owns the order/stock transaction and the payment-provider interface; thin API route handlers call it. Inventory units move `AVAILABLE → RESERVED → SOLD` (or back) inside one Postgres transaction using `FOR UPDATE SKIP LOCKED` to prevent oversell. UI is server-rendered pages plus small client components that POST to stable JSON APIs.

**Tech Stack:** Next.js 16 (App Router), Drizzle ORM + Postgres, Biome (lint/format — never eslint/tsc), Vitest (new, for stock/money logic), Tailwind v4.

## Global Constraints

- Persian-first, RTL. User-facing copy in Persian.
- Lint/format = Biome only. Verify with `./node_modules/.bin/biome check --write`. Never run `eslint`, `tsc`, or `next lint`.
- API envelope: success `{ "data": … }` (+ `"meta"` for lists); error `{ "error": { "code": "SCREAMING_SNAKE", "message": "<fa>" } }` with correct HTTP status. Never leak ORM errors / stack traces / internal fields.
- Money: `numeric` price columns, stored in Toman, currency `IRR`. Zarinpal amount = Toman × 10 (Rial).
- Auth via existing `getCurrentUser()` (session cookie). Admin via `role === "ADMIN"`.
- Reservation TTL = 30 minutes.
- DB schema changes applied with `npm run db:push` against the local Postgres (`npm run db:up` first).
- Commit after each task. Commit footer: `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.

---

## File Structure

- `src/db/schema.ts` — add `fulfillmentType` enum+column, `payments.receiptUrl`.
- `src/lib/orders/inventory.ts` — stock-unit lifecycle (reserve/sell/release/expire).
- `src/lib/orders/order-number.ts` — order number generator.
- `src/lib/orders/pricing.ts` — cart re-pricing + totals.
- `src/lib/orders/place-order.ts` — the transactional order-placement service.
- `src/lib/orders/payments.ts` — `confirmPayment` / `failPayment` shared transitions.
- `src/lib/payments/provider.ts` — `PaymentProvider` interface + registry.
- `src/lib/payments/manual.ts`, `zarinpal.ts`, `card-to-card.ts` — providers.
- `src/app/api/orders/route.ts` — `POST` place order.
- `src/app/api/payments/zarinpal/callback/route.ts` — gateway callback.
- `src/app/api/payments/receipt/route.ts` — card-to-card receipt upload.
- `src/app/api/preferences/theme/route.ts` — theme cookie.
- `src/app/checkout/page.tsx` + `src/components/shop/checkout-client.tsx`.
- `src/app/account/orders/[id]/page.tsx` — order detail / delivery.
- `src/lib/admin/orders.ts` + `src/app/api/admin/orders/...` + `src/app/admin/orders/...` + `src/components/admin/order-management.tsx`.
- `src/lib/catalog.ts` — add search + pagination to listing.
- `src/app/api/products/route.ts` — add `q` + `meta`.
- `vitest.config.ts` + `src/lib/orders/__tests__/*` + `test/db.ts` helper.

---

### Task 1: Schema changes + Vitest setup

**Files:**
- Modify: `src/db/schema.ts` (enums block ~line 22; products table ~line 186; payments table ~line 475)
- Create: `vitest.config.ts`
- Create: `test/db.ts`
- Modify: `package.json` (add `test` script + `vitest` dev dep)

**Interfaces:**
- Produces: `fulfillmentType` pgEnum (`["DIGITAL","PHYSICAL"]`); `products.fulfillmentType` (default `"DIGITAL"`); `payments.receiptUrl` (text, nullable). `test/db.ts` exports `getTestDb()` and `withRollback(fn)`.

- [ ] **Step 1: Add enum + columns to schema**

In `src/db/schema.ts`, after `productStatus` enum add:
```ts
export const fulfillmentType = pgEnum("fulfillment_type", ["DIGITAL", "PHYSICAL"]);
```
In `products` columns (after `status`):
```ts
fulfillmentType: fulfillmentType("fulfillmentType").default("DIGITAL").notNull(),
```
In `payments` columns (after `reference`):
```ts
receiptUrl: text("receiptUrl"),
```

- [ ] **Step 2: Add Vitest**

Run: `npm install -D --save-exact vitest@^3`
Create `vitest.config.ts`:
```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    fileParallelism: false,
    env: { NODE_ENV: "test" },
  },
});
```
Add to `package.json` scripts: `"test": "vitest run"`, `"test:watch": "vitest"`.

- [ ] **Step 3: Test DB helper**

Create `test/db.ts`:
```ts
import { getDb } from "@/lib/db";

// Integration tests run against the local dev Postgres (npm run db:up).
// Each test wraps work in a transaction that is always rolled back.
export function getTestDb() {
  return getDb();
}

export async function withRollback<T>(fn: (tx: any) => Promise<T>): Promise<T> {
  const db = getDb();
  let out: T;
  await db
    .transaction(async (tx) => {
      out = await fn(tx);
      throw new RollbackSignal();
    })
    .catch((e) => {
      if (!(e instanceof RollbackSignal)) throw e;
    });
  return out!;
}

class RollbackSignal extends Error {}
```

- [ ] **Step 4: Push schema + smoke test**

Run: `npm run db:up && npm run db:push`
Expected: `fulfillment_type` enum + columns created, no errors.
Create `src/lib/orders/schema.test.ts`:
```ts
import { expect, test } from "vitest";
import { getDb } from "@/lib/db";

test("db reachable", async () => {
  const rows = await getDb().query.products.findMany({ limit: 1 });
  expect(Array.isArray(rows)).toBe(true);
});
```
Run: `npm run test`
Expected: PASS.

- [ ] **Step 5: Biome + commit**

Run: `./node_modules/.bin/biome check --write src/db/schema.ts vitest.config.ts test/db.ts`
```bash
git add -A && git commit -m "feat(db): add product fulfillmentType + payment receiptUrl; add vitest"
```

---

### Task 2: Inventory reservation module

**Files:**
- Create: `src/lib/orders/inventory.ts`
- Create: `src/lib/orders/inventory.test.ts`

**Interfaces:**
- Consumes: `getDb()`, `inventoryUnits`, `orders` from schema; a Drizzle tx.
- Produces:
  - `reserveUnits(tx, variantId: string, qty: number, ctx: { orderId: string; userId: string }): Promise<InventoryUnitRow[]>` — throws `OutOfStockError` (with `.variantId`) if fewer than `qty` available.
  - `sellReservedUnits(tx, orderId: string): Promise<void>`
  - `releaseUnits(tx, orderId: string): Promise<void>`
  - `releaseExpiredReservations(tx, ttlMinutes?: number): Promise<string[]>` (returns cancelled order ids)
  - `class OutOfStockError extends Error { variantId: string }`

- [ ] **Step 1: Failing test — reserve exact count + oversell guard**

Create `src/lib/orders/inventory.test.ts`. Tests (use a seeded variant id from a created throwaway product inside the rolled-back tx, or a known seed): reserving N flips exactly N rows to `RESERVED` with `orderId`; reserving more than available throws `OutOfStockError`; a second `reserveUnits` for the last unit in a parallel tx does not double-reserve (simulate by reserving all, then expecting throw). Write concrete assertions on counts.

- [ ] **Step 2: Run — verify fail** (`npm run test -- inventory`) Expected: FAIL (module missing).

- [ ] **Step 3: Implement**

```ts
import { and, eq, lt, inArray, sql } from "drizzle-orm";
import { inventoryUnits, orders } from "@/db/schema";

export class OutOfStockError extends Error {
  constructor(public variantId: string) {
    super("OUT_OF_STOCK");
  }
}

export async function reserveUnits(tx, variantId, qty, ctx) {
  const rows = await tx
    .select({ id: inventoryUnits.id })
    .from(inventoryUnits)
    .where(and(eq(inventoryUnits.variantId, variantId), eq(inventoryUnits.status, "AVAILABLE")))
    .for("update", { skipLocked: true })
    .limit(qty);
  if (rows.length < qty) throw new OutOfStockError(variantId);
  const ids = rows.map((r) => r.id);
  await tx
    .update(inventoryUnits)
    .set({ status: "RESERVED", reservedAt: sql`now()`, orderId: ctx.orderId, userId: ctx.userId })
    .where(inArray(inventoryUnits.id, ids));
  return ids;
}

export async function sellReservedUnits(tx, orderId) {
  await tx.update(inventoryUnits).set({ status: "SOLD", soldAt: sql`now()` })
    .where(and(eq(inventoryUnits.orderId, orderId), eq(inventoryUnits.status, "RESERVED")));
}

export async function releaseUnits(tx, orderId) {
  await tx.update(inventoryUnits)
    .set({ status: "AVAILABLE", reservedAt: null, orderId: null, userId: null })
    .where(and(eq(inventoryUnits.orderId, orderId), eq(inventoryUnits.status, "RESERVED")));
}

export async function releaseExpiredReservations(tx, ttlMinutes = 30) {
  const stale = await tx.select({ id: orders.id }).from(orders)
    .where(and(eq(orders.status, "PENDING"), eq(orders.paymentStatus, "UNPAID"),
      lt(orders.createdAt, sql`now() - ${`${ttlMinutes} minutes`}::interval`)));
  for (const o of stale) {
    await releaseUnits(tx, o.id);
    await tx.update(orders).set({ status: "CANCELLED" }).where(eq(orders.id, o.id));
  }
  return stale.map((o) => o.id);
}
```

- [ ] **Step 4: Run — verify pass.** Expected: PASS.
- [ ] **Step 5: Biome + commit** `git commit -m "feat(orders): inventory reservation lifecycle with FOR UPDATE SKIP LOCKED"`

---

### Task 3: Order number + pricing/totals

**Files:**
- Create: `src/lib/orders/order-number.ts`, `src/lib/orders/pricing.ts`
- Create: `src/lib/orders/pricing.test.ts`

**Interfaces:**
- Produces:
  - `generateOrderNumber(): string` → `PX-<yyMMdd>-<6 base32>`.
  - `priceCartForUser(cartItems, tier): { items: PricedItem[]; subtotal: string; total: string }` where `PricedItem = { variant, quantity, unitPrice, lineTotal }`. Reuses existing `variantPrice(variant, tier)` from `src/lib/catalog.ts` (export it if not already).

- [ ] **Step 1: Failing test** — `generateOrderNumber` matches `/^PX-\d{6}-[A-Z2-7]{6}$/`; `priceCartForUser` picks premium price for PREMIUM tier and sums line totals correctly (2×, 3× quantities). Concrete fixtures.
- [ ] **Step 2: Run — fail.**
- [ ] **Step 3: Implement** both helpers. `generateOrderNumber` uses date parts + 6 chars from a crypto-random base32 alphabet (`A-Z2-7`). `priceCartForUser` maps items → `variantPrice` → numeric strings (keep as strings to match `numeric`).
- [ ] **Step 4: Run — pass.**
- [ ] **Step 5: Biome + commit** `git commit -m "feat(orders): order-number + cart pricing helpers"`

---

### Task 4: Payment provider interface + MANUAL + shared transitions

**Files:**
- Create: `src/lib/payments/provider.ts`, `src/lib/payments/manual.ts`
- Create: `src/lib/orders/payments.ts`
- Create: `src/lib/orders/payments.test.ts`

**Interfaces:**
- Produces:
  - `type PaymentMethod = "ZARINPAL" | "CARD_TO_CARD" | "MANUAL"`.
  - `interface PaymentProvider { method; initiate(order, payment): Promise<{ redirectUrl?: string; instructions?: unknown }>; verify(payment, params): Promise<{ status: "PAID" | "FAILED"; reference?: string }> }`.
  - `getProvider(method): PaymentProvider`.
  - `confirmPayment(orderId: string, opts?: { reference?: string }): Promise<void>` — tx: payment→PAID/paidAt, order.paymentStatus→PAID, `sellReservedUnits`, order.status→`DELIVERED` if all items digital else `PROCESSING`.
  - `failPayment(orderId: string): Promise<void>` — tx: payment→FAILED, `releaseUnits`, order→CANCELLED.

- [ ] **Step 1: Failing test** — given a seeded paid-pending order with reserved units (all-digital), `confirmPayment` sets units `SOLD`, order `DELIVERED`, payment `PAID`; with a physical item → order `PROCESSING`. `failPayment` releases units (`AVAILABLE`) + order `CANCELLED`. Build fixtures inside `withRollback`.
- [ ] **Step 2: Run — fail.**
- [ ] **Step 3: Implement** provider registry, `manual` (initiate → `{ instructions: { fa: "سفارش ثبت شد. پرداخت پس از تایید مدیر." } }`; verify never called), and `confirmPayment`/`failPayment` (read order items to decide all-digital via joined product `fulfillmentType`).
- [ ] **Step 4: Run — pass.**
- [ ] **Step 5: Biome + commit** `git commit -m "feat(payments): provider interface + manual provider + confirm/fail transitions"`

---

### Task 5: Order placement service + `POST /api/orders`

**Files:**
- Create: `src/lib/orders/place-order.ts`
- Create: `src/app/api/orders/route.ts`
- Create: `src/lib/orders/place-order.test.ts`

**Interfaces:**
- Consumes: Tasks 2–4 helpers; existing `getCartView`/cart schema; `getCurrentUser`; `getUserTier`/`variantPrice`.
- Produces: `placeOrder(userId, input): Promise<{ orderId; orderNumber; payment }>` where `input = { paymentMethod; shipping? }`. Errors thrown as `OrderError(code)` with codes `CART_EMPTY | SHIPPING_REQUIRED | OUT_OF_STOCK | PRODUCT_UNAVAILABLE`.

- [ ] **Step 1: Failing test** — happy path: seeded user + active cart with 1 in-stock digital variant → `placeOrder` creates order(PENDING/UNPAID), reserves the unit, creates orderItems + payment(MANUAL), marks cart ORDERED. Physical item with no `shipping` → throws `SHIPPING_REQUIRED`. Out-of-stock variant → `OUT_OF_STOCK`. Assertions on row states inside `withRollback`.
- [ ] **Step 2: Run — fail.**
- [ ] **Step 3: Implement `placeOrder`** — the §6 transaction: `releaseExpiredReservations` → load+validate cart → re-price → require shipping if any physical → insert order → `reserveUnits` per item → insert orderItems → insert payment → cart ORDERED → `getProvider(method).initiate(...)`.
- [ ] **Step 4: Implement route** `src/app/api/orders/route.ts` `POST`: `getCurrentUser()` → 401 `AUTH_REQUIRED` if none; parse body; `placeOrder`; map `OrderError` → 400/409 envelope; success `{ data: { orderId, orderNumber, payment } }`.
- [ ] **Step 5: Run — pass** (logic test). Then manual curl smoke (documented).
- [ ] **Step 6: Biome + commit** `git commit -m "feat(orders): transactional placeOrder + POST /api/orders"`

---

### Task 6: `/checkout` page + wire basket button

**Files:**
- Create: `src/app/checkout/page.tsx`
- Create: `src/components/shop/checkout-client.tsx`
- Modify: `src/components/shop/basket-items.tsx` (the dead "ثبت سفارش" button → link/flow to `/checkout`)

**Interfaces:**
- Consumes: `getCurrentUser`, `getCartView`, `/api/orders`.
- Behavior: server page redirects to `/login?redirect=/checkout` if no session. Renders re-priced cart summary, payment-method radio (`ZARINPAL`/`CARD_TO_CARD`/`MANUAL`), and an address form **only when** the cart has a `PHYSICAL` item (needs product `fulfillmentType` in cart view — extend `getCartView` to include it). Client posts `/api/orders`; on `redirectUrl` → `window.location.assign`; `CARD_TO_CARD` → go to receipt step (Task 9); `MANUAL` → `/account/orders/[id]`.

- [ ] Step 1: Extend `getCartView` items to include `product.fulfillmentType`.
- [ ] Step 2: Build `/checkout` server page (auth gate + summary).
- [ ] Step 3: Build `checkout-client.tsx` (method select, conditional address form, submit + error display in Persian).
- [ ] Step 4: Point basket "ثبت سفارش" button to `/checkout` (logged-in) — keep existing login link for anon.
- [ ] Step 5: Manual verify (run app, add to cart, reach checkout). Biome + commit `feat(checkout): checkout page + wire basket button`.

---

### Task 7: Order detail / delivery — `/account/orders/[id]`

**Files:**
- Create: `src/app/account/orders/[id]/page.tsx`
- Modify: `src/app/account/page.tsx` (link each order to its detail)

**Interfaces:**
- Consumes: `getCurrentUser`, order + orderItems + assigned `inventoryUnits` (where `orderId`).
- Behavior: owner-only (404 if `order.userId !== user.id`). Shows items, status, paymentStatus, totals. Digital + order paid (`paymentStatus = PAID`) → reveal each `SOLD` unit's `code` (copy button). Physical → address + shipping status. Codes never render unless paid.

- [ ] Step 1: Query order with items + units (server). 404/redirect rules.
- [ ] Step 2: Render detail (RTL); conditional code reveal vs shipping block.
- [ ] Step 3: Add detail links on account list.
- [ ] Step 4: Manual verify + Biome + commit `feat(account): order detail with digital code delivery`.

---

### Task 8: Zarinpal sandbox provider + callback

**Files:**
- Create: `src/lib/payments/zarinpal.ts`
- Create: `src/app/api/payments/zarinpal/callback/route.ts`
- Create: `src/lib/payments/zarinpal.test.ts`
- Modify: `.env.example` (`ZARINPAL_MERCHANT_ID`, `ZARINPAL_SANDBOX=true`, `APP_BASE_URL`)

**Interfaces:**
- `initiate(order, payment)` → POST sandbox `payment/request` (`merchant_id`, `amount` = Toman×10, `callback_url = ${APP_BASE_URL}/api/payments/zarinpal/callback?orderId=${order.id}`, `description`). Store returned `authority` in `payment.reference`; return `{ redirectUrl: sandbox StartPay + authority }`.
- `verify(payment, { authority, status })` → POST sandbox `payment/verify`; map `code === 100` → `PAID` else `FAILED`.
- Callback route: load order+payment by `orderId`; `verify`; `confirmPayment`/`failPayment`; redirect to `/account/orders/[id]`.

- [ ] Step 1: Failing test for `verify` mapping (code 100 → PAID; others → FAILED) using a mocked fetch.
- [ ] Step 2: Run — fail. Step 3: Implement provider (env-driven base URL: sandbox vs prod) + register in provider registry. Step 4: Implement callback route. Step 5: Run — pass. Step 6: `.env.example`. Biome + commit `feat(payments): zarinpal sandbox provider + callback`.

---

### Task 9: Card-to-card provider + receipt upload

**Files:**
- Create: `src/lib/payments/card-to-card.ts`
- Create: `src/app/api/payments/receipt/route.ts`
- Modify: `src/components/shop/checkout-client.tsx` (receipt step)

**Interfaces:**
- `initiate` → `{ instructions: { cardNumber, holder, fa } }` (card from env `CARD_TO_CARD_NUMBER`/`_HOLDER`). Order stays PENDING/UNPAID.
- `POST /api/payments/receipt` (auth, owns order): accepts upload, saves via the existing upload handler pattern, sets `payment.receiptUrl`. Returns `{ data: { ok: true } }`. Admin confirms later (Task 10).

- [ ] Step 1: Provider + env. Step 2: Receipt upload route (reuse `src/app/api/admin/uploads` storage approach; public + ownership-checked). Step 3: Checkout receipt step UI. Step 4: Manual verify + Biome + commit `feat(payments): card-to-card provider + receipt upload`.

---

### Task 10: Orders admin

**Files:**
- Create: `src/lib/admin/orders.ts`
- Create: `src/app/api/admin/orders/route.ts`, `src/app/api/admin/orders/[id]/route.ts`
- Create: `src/app/admin/orders/page.tsx`, `src/app/admin/orders/[id]/page.tsx`
- Create: `src/components/admin/order-management.tsx`
- Modify: `src/components/admin/admin-shell.tsx` (add "سفارش‌ها" nav link)

**Interfaces:**
- `listAdminOrders({ status?, paymentStatus? })`, `getAdminOrder(id)`, and actions: `confirmOrderPayment(id)` (→ `confirmPayment`), `markShipped(id)`, `markDelivered(id)`, `cancelOrder(id)` (→ `releaseUnits` + CANCELLED), `refundOrder(id)` (→ `releaseUnits` + REFUNDED), `markUnitDamaged(unitId)`. List load runs `releaseExpiredReservations`.
- All admin routes guard `role === "ADMIN"` (else 403 `FORBIDDEN`).

- [ ] Step 1: `lib/admin/orders.ts` (queries + action fns reusing Task 4 transitions). Step 2: API routes (GET list/detail, PATCH action). Step 3: Admin pages + `order-management.tsx` (filters, detail, action buttons, receipt view, unit list w/ damage). Step 4: Nav link. Step 5: Manual verify + Biome + commit `feat(admin): orders management + inventory unit status`.

---

### Task 11: Text search

**Files:**
- Modify: `src/lib/catalog.ts` (`getProductsForListing` gains `{ q?, page?, pageSize? }`)
- Modify: `src/app/api/products/route.ts` (accept `q`, return `data`+`meta`)
- Modify: `src/app/products/page.tsx` (search input + `?q=` server render)
- Create: `src/lib/catalog.search.test.ts`

**Interfaces:**
- Search matches `titleFa`/`summaryFa`/tag name/category name, case-insensitive `ILIKE`. Includes `ACTIVE/DISABLED/DRAFT`, excludes `ARCHIVED`. (Pagination lands in Task 13 — here add `q` filtering; if Task 13 runs first, just add `q`.)

- [ ] Step 1: Failing test — search includes a DISABLED match and an out-of-stock match, excludes ARCHIVED. Step 2: Run — fail. Step 3: Implement `q` filter in listing query. Step 4: Products page search box (RTL, submits `?q=`) + top-bar search icon → `/products`. Step 5: Run — pass + manual verify. Biome + commit `feat(search): product text search including disabled/out-of-stock`.

---

### Task 12: Premium dark-mode toggle

**Files:**
- Create: `src/app/api/preferences/theme/route.ts`
- Modify: `src/app/layout.tsx` (read `pixevel_theme` cookie → `dark` class; premium-only)
- Modify: `src/app/account/page.tsx` (toggle control, premium-gated) + small client toggle component

**Interfaces:**
- `POST /api/preferences/theme` body `{ theme: "dark" | "light" }` (auth + premium) → sets cookie `pixevel_theme` (1 year). Layout: `dark` class when cookie=`dark`, or premium && cookie unset (preserve current auto-dark default).

- [ ] Step 1: Theme route. Step 2: Layout cookie read. Step 3: Account toggle (premium only). Step 4: Manual verify (premium user switches, persists) + Biome + commit `feat(theme): premium dark-mode toggle`.

---

### Task 13: Listing pagination

**Files:**
- Modify: `src/lib/catalog.ts` (`getProductsForListing` returns `{ items, meta }`)
- Modify: `src/app/api/products/route.ts` (`meta` in response)
- Modify: `src/app/products/page.tsx` (pager UI, preserve `q`)
- Modify: `src/app/page.tsx` if it consumes listing shape (verify no break)
- Create/extend: `src/lib/catalog.pagination.test.ts`

**Interfaces:**
- `getProductsForListing(user, { q?, page = 1, pageSize = 24 })` → `{ items: ProductListItem[]; meta: { total, page, pageSize, hasNext } }`. Update all callers to the new shape.

- [ ] Step 1: Failing test — page 1 vs 2 disjoint, `meta.total` correct, `hasNext` true/false at boundaries. Step 2: Run — fail. Step 3: Implement count + limit/offset; update callers (products page, API). Step 4: Pager UI (prev/next, preserves `q`). Step 5: Run — pass + manual verify. Biome + commit `feat(catalog): listing + search pagination with meta`.

---

## Self-Review

- **Spec coverage:** Schema §4→T1; reservation §5→T2; order API §6→T5; providers/lifecycle §7→T4,T8,T9; checkout §8→T6; delivery §9→T7; orders admin §10→T10; search §11→T11; dark toggle §12→T12; pagination §13→T13; API envelope §14→all routes; testing §15→T1–T5,T8,T11,T13. All covered.
- **Ordering note:** T11 (search) and T13 (pagination) both touch `getProductsForListing`. Execute T13's signature change first OR have T11 add only `q` and T13 wrap with `meta`; the plan notes this so the second implementer merges rather than conflicts.
- **Types:** `confirmPayment`/`failPayment`/`reserveUnits`/`sellReservedUnits`/`releaseUnits` names are consistent across T2/T4/T5/T8/T10.
- **No placeholders:** foundation tasks carry real code; UI tasks carry exact files + interfaces + acceptance (full per-line UI code is written by the implementer against the spec, which pins behavior).
