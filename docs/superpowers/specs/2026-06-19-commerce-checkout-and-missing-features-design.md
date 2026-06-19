# Design: Commerce Checkout + Missing Features

Date: 2026-06-19
Status: Approved (pending spec review)

## 1. Overview

The Pixevel storefront has a complete browse/read side (catalog, variants, tiered
pricing, per-unit inventory, VIP images, homepage blocks, admin for products) but
no write side of commerce: a basket can be filled but never turned into an order.
This project closes that gap and the remaining spec gaps surfaced in the feature
audit.

Decisions locked with the user:

- **Delivery: hybrid.** Each product is `DIGITAL` (deliver an inventory unit's
  `code` after payment) or `PHYSICAL` (collect address, ship).
- **Payment: all three methods**, behind one pluggable provider interface —
  `ZARINPAL` (sandbox in this build), `CARD_TO_CARD` (receipt upload + admin
  confirm), `MANUAL` (admin confirms, no gateway).
- **Scope: everything** — the 9 audited gaps.
- **Zarinpal: sandbox only** this round; real `merchant_id` dropped in later.
- **Reservation TTL: 30 minutes**, released by a helper + manual admin release.
  A scheduled sweep is a follow-up, not in scope.

## 2. Scope

In scope (the 9 gaps):

1. Order placement flow (transactional).
2. Stock reservation/sale (inventory unit lifecycle).
3. Payment (3 pluggable providers).
4. Shipping/address capture (physical items).
5. Orders admin.
6. Inventory unit status management (mark damaged / release).
7. Text search.
8. Dark-mode toggle (premium).
9. Listing pagination.

Out of scope (explicit follow-ups):

- Scheduled cron sweep for expired reservations (helper exists; wiring a cron is later).
- Real Zarinpal production credentials and go-live.
- Coupons/discounts, shipping-cost calculation (flat `shippingAmount` = 0 for now).
- Gateway-side refunds (admin can mark `REFUNDED` and release units; no API refund call).
- Email/SMS order notifications.

## 3. Existing schema (no change needed)

These already support the work:

- `orderStatus` enum: `PENDING, PAID, PROCESSING, SHIPPED, DELIVERED, CANCELLED, REFUNDED`.
- `paymentStatus` enum: `UNPAID, AUTHORIZED, PAID, FAILED, REFUNDED`.
- `inventoryStatus` enum: `AVAILABLE, RESERVED, SOLD, DAMAGED`; `inventoryUnits` has
  `reservedAt, soldAt, userId, orderId`.
- `orders` has `customerName, customerPhone, addressLine, city, province, postalCode,
  subtotalAmount, shippingAmount, totalAmount, orderNumber`.
- `orderItems` snapshots variant title/sku/color/material/size/price.
- `payments` has `provider (text), reference, amount, status, paidAt`.

## 4. Schema changes (applied via `drizzle-kit` / `db:push`)

Minimal:

1. New enum `fulfillment_type` = `["DIGITAL", "PHYSICAL"]`.
2. `products.fulfillmentType` — `fulfillment_type` not null, default `"DIGITAL"`
   (catalog is digital-first). Indexed not required.
3. `payments.receiptUrl` — `text` nullable (card-to-card receipt image URL).

`payments.provider` stays `text` (table is empty in practice); allowed values
`ZARINPAL | CARD_TO_CARD | MANUAL` enforced in code. `payments.reference` holds the
Zarinpal `authority`/`ref_id`.

## 5. Domain module: stock reservation

New `src/lib/orders/inventory.ts` — the only place that mutates inventory unit
lifecycle. All functions take a Drizzle transaction.

- `reserveUnits(tx, variantId, qty, { orderId, userId }): InventoryUnit[]`
  Selects `qty` `AVAILABLE` units for the variant with
  `SELECT … FOR UPDATE SKIP LOCKED LIMIT qty` (Drizzle `.for("update", { skipLocked: true })`),
  flips them to `RESERVED` with `reservedAt`, `orderId`, `userId`. Throws
  `OUT_OF_STOCK` if fewer than `qty` lockable units. The lock + skip-locked is what
  prevents two concurrent checkouts from grabbing the same unit (the one real
  oversell hazard).
- `sellReservedUnits(tx, orderId)` — `RESERVED → SOLD`, set `soldAt`. Called on
  payment confirmation.
- `releaseUnits(tx, orderId)` — `RESERVED → AVAILABLE`, clear `reservedAt/orderId/userId`.
  Called on payment failure, cancel, or expiry.
- `releaseExpiredReservations(tx, ttlMinutes = 30)` — finds `PENDING` orders with
  `paymentStatus = UNPAID` older than the TTL, releases their reserved units, sets
  order `CANCELLED`. Called opportunistically (see §7) until a cron exists.

Available-stock counting continues to count `AVAILABLE` only, so reserved units
correctly drop out of "in stock" immediately.

## 6. Order placement — `POST /api/orders`

Auth required (session). Anonymous → `401` with `code: "AUTH_REQUIRED"`; client
redirects to `/login?redirect=/checkout`.

Request body:

```jsonc
{
  "paymentMethod": "ZARINPAL" | "CARD_TO_CARD" | "MANUAL",
  "shipping": {            // required only if cart has a PHYSICAL item
    "customerName": "…",
    "addressLine": "…",
    "city": "…",
    "province": "…",
    "postalCode": "…"
  }
}
```

Flow (single transaction):

1. Load the user's `ACTIVE` cart + items + variant + product. Empty cart → `400 CART_EMPTY`.
2. Re-validate every item: product `ACTIVE`; resolve current tier price (cart price
   may be stale → re-price from `variantPrice(variant, tier)`); compute line/subtotal.
3. If any item's product is `PHYSICAL`, `shipping` is required → else `400 SHIPPING_REQUIRED`.
4. `releaseExpiredReservations(tx)` first (opportunistic cleanup).
5. For each item: `reserveUnits(tx, variantId, qty, …)`. Any `OUT_OF_STOCK` →
   abort tx → `409 OUT_OF_STOCK` with the offending variant.
6. Insert `order` (`PENDING` / `UNPAID`, totals, address snapshot, `customerPhone`
   from user, generated `orderNumber`).
7. Insert `orderItems` (snapshot fields).
8. Insert `payment` (`UNPAID`, chosen provider, `amount = totalAmount`).
9. Mark cart `ORDERED`.
10. Call `provider.initiate(order, payment)` (may run outside the tx for network).

Response:

```jsonc
{
  "data": {
    "orderId": "…",
    "orderNumber": "…",
    "payment": {
      "method": "ZARINPAL",
      "redirectUrl": "https://sandbox.zarinpal.com/…",  // ZARINPAL
      "instructions": { … }                              // CARD_TO_CARD / MANUAL
    }
  }
}
```

`orderNumber`: `PX-<yyMMdd>-<6 random base32>` (uniqueness retried on collision).

## 7. Payment providers

Interface `src/lib/payments/provider.ts`:

```ts
interface PaymentProvider {
  method: "ZARINPAL" | "CARD_TO_CARD" | "MANUAL";
  initiate(order, payment): Promise<{ redirectUrl?: string; instructions?: Json }>;
  verify(payment, params): Promise<{ status: "PAID" | "FAILED"; reference?: string }>;
}
```

Confirmation path (shared) — `confirmPayment(orderId, { reference })`:
in one tx set `payment.PAID/paidAt`, `order.paymentStatus = PAID`,
`sellReservedUnits(tx, orderId)`, then order `status`:
`DELIVERED` if all items digital, else `PROCESSING` (awaiting shipment).
Failure path — `failPayment(orderId)`: `payment.FAILED`, `releaseUnits`,
`order.CANCELLED`.

Providers:

- **MANUAL** — `initiate` returns instructions ("سفارش ثبت شد؛ پرداخت دستی").
  No gateway; admin clicks "تایید پرداخت" in orders-admin → `confirmPayment`.
- **ZARINPAL (sandbox)** — `initiate` POSTs to the sandbox request endpoint with
  `merchant_id` (env `ZARINPAL_MERCHANT_ID`, sandbox default), `amount` (Toman→Rial
  ×10), `callback_url = /api/payments/zarinpal/callback?orderId=…`, `description`.
  Returns `authority` (stored in `payment.reference`) and `redirectUrl`. Callback
  route verifies via the sandbox verify endpoint; on success `confirmPayment`, else
  `failPayment`; redirects the buyer to `/account/orders/[id]`. Sandbox base URL +
  merchant id behind env so production is a config swap.
- **CARD_TO_CARD** — `initiate` returns card/sheba + `orderNumber` reference.
  Buyer uploads a receipt image (reuses `POST /api/admin/uploads` style handler,
  public variant `POST /api/payments/receipt`) → sets `payment.receiptUrl`, order
  stays `PENDING`, payment `UNPAID` but flagged for review. Admin verifies receipt
  in orders-admin → `confirmPayment`.

`releaseExpiredReservations` runs at the top of `POST /api/orders` and when the
orders-admin list loads, so abandoned Zarinpal redirects free their stock within
the next checkout/admin view even before a cron exists.

## 8. Checkout page — `/checkout`

Server component, OTP-gated: no session → redirect `/login?redirect=/checkout`.
Renders cart summary (re-priced), a payment-method selector, and — only when the
cart contains a `PHYSICAL` item — an address form. A client component posts to
`/api/orders` and then: `redirectUrl` → `window.location` to gateway;
`CARD_TO_CARD` → receipt-upload step; `MANUAL` → confirmation screen. The basket's
dead "ثبت سفارش" button now links to `/checkout` (and the "ورود و ادامه خرید" path
already routes anon users through login).

## 9. Post-purchase delivery — `/account/orders/[id]`

Order detail (owner-only): items, status, payment status, totals. Per item:

- Digital + order paid → reveal assigned unit `code`s (from `inventoryUnits` where
  `orderId = order.id`, `status = SOLD`). Copy-to-clipboard.
- Physical → show shipping address + shipping status (`PROCESSING/SHIPPED/DELIVERED`).

The account page order list ([account/page.tsx](../../../src/app/account/page.tsx))
gains a link to each detail page; codes never render before payment is `PAID`.

## 10. Orders admin — `/admin/orders`, `/admin/orders/[id]`

New `src/lib/admin/orders.ts` + API routes under `src/app/api/admin/orders`.

- List: filter by `status` and `paymentStatus`, newest first; runs
  `releaseExpiredReservations` on load.
- Detail + actions: **confirm payment** (`MANUAL`/`CARD_TO_CARD` → `confirmPayment`),
  **view receipt** (card-to-card), **mark shipped/delivered** (physical →
  `SHIPPED`/`DELIVERED`), **cancel** (→ `CANCELLED` + `releaseUnits`), **refund**
  (→ `REFUNDED` + `releaseUnits`; no gateway call), **view assigned units/codes**,
  **mark unit DAMAGED** (gap #6).
- Admin nav gains an "سفارش‌ها" link.

## 11. Text search — `GET /api/products?q=` + `/products?q=`

Public, stable contract (Android-ready). Searches `titleFa`, `summaryFa`, tag names,
category name (case-insensitive `ILIKE`/trigram-ish on `titleFa`). Includes
`ACTIVE + DISABLED + DRAFT`, excludes `ARCHIVED` (matches existing listing rule) so
disabled and out-of-stock products remain discoverable per spec. Products page gains
a search input (RTL); top-bar search icon points to `/products`. Server-renders the
first page for SEO; the same endpoint backs client-side queries.

## 12. Dark-mode toggle — premium

Premium users already auto-get the `dark` class
([layout.tsx](../../../src/app/layout.tsx)). Add an explicit preference: cookie
`pixevel_theme` = `dark|light`, read in the root layout to set the class (premium
only; falls back to auto-dark when unset). A toggle control on the account page
(premium-gated) writes the cookie via `POST /api/preferences/theme` and refreshes
the route. Non-premium users are unaffected (spec: premium feature).

## 13. Pagination — listing + search

`getProductsForListing(user, { q?, page = 1, pageSize = 24 })` returns
`{ items, meta: { total, page, pageSize, hasNext } }`. `GET /api/products` returns
the same `meta` block (API-Standards spec: pagination metadata for lists). Products
page renders a pager (prev/next + page count), preserving `q`.

## 14. API response conventions

All new endpoints follow a stable shape:

- Success: `{ "data": … }`, lists add `{ "data": [...], "meta": {...} }`.
- Error: `{ "error": { "code": "SCREAMING_SNAKE", "message": "<fa user text>" } }`,
  correct HTTP status. No ORM errors, stack traces, or internal fields leak.

Error codes introduced: `AUTH_REQUIRED, CART_EMPTY, SHIPPING_REQUIRED, OUT_OF_STOCK,
PRODUCT_UNAVAILABLE, PAYMENT_INIT_FAILED, ORDER_NOT_FOUND, FORBIDDEN`.

## 15. Testing

The repo has no test runner. Add `vitest` (dev dep) and cover the
money-and-stock-critical pure logic only — not UI:

- `reserveUnits` accounting (exact-count, oversell-prevention via a simulated
  concurrent grab), `sellReservedUnits`, `releaseUnits`, `releaseExpiredReservations`.
- Order total computation + tier re-pricing.
- Payment status mapping (`verify` params → `PAID/FAILED`) for each provider.
- Search query inclusion rule (ARCHIVED excluded; disabled/OOS included).

Tests run via `vitest` against logic with a mocked/in-memory tx where practical.
Biome stays the linter/formatter; no `tsc`/eslint (per project policy).

## 16. Build order (phases)

1. Schema changes + `inventory.ts` reservation module (+ tests).
2. Payment provider interface + `MANUAL` + `confirmPayment/failPayment`.
3. `POST /api/orders` + order-number util (+ tests).
4. `/checkout` page + wire basket button.
5. `/account/orders/[id]` delivery + account list link.
6. Zarinpal (sandbox) provider + callback route.
7. Card-to-card provider + receipt upload route.
8. Orders admin (lib + routes + pages + nav) incl. unit DAMAGED.
9. Text search (API + page + top-bar).
10. Dark-mode toggle.
11. Listing pagination.

Each phase is independently shippable and leaves the app building.

## 17. Acceptance criteria

- A logged-in user with an in-stock cart can place an order; stock is reserved, an
  order + payment row are created, the cart closes.
- Two concurrent checkouts for the last unit: exactly one succeeds, the other gets
  `OUT_OF_STOCK`; never both.
- MANUAL/card-to-card: admin confirm flips units to `SOLD`, order to PAID +
  DELIVERED (digital) / PROCESSING (physical); digital codes then visible to the buyer.
- Zarinpal sandbox: successful sandbox payment confirms the order via callback;
  cancelled/failed releases stock and cancels the order.
- Abandoned pending order older than 30 min has its units released on the next
  checkout or orders-admin load.
- Search returns disabled and out-of-stock matches; none can be added to basket.
- Premium user can toggle dark/light and it persists across reloads.
- Product listing and search return paginated results with `meta`.
- All new endpoints return the documented success/error envelope; no internal leaks.
