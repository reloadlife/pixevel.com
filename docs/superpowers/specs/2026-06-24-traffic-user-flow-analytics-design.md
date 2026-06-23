# Traffic & User-Flow Analytics — Design

**Date:** 2026-06-24
**Status:** Approved (design), pending spec review
**Sub-project:** B of 2 (companion: `2026-06-24-seo-management-hub-design.md`)

## Problem

The current admin analytics page covers product/category views, searches, and a
coarse funnel — but the funnel's last two steps are fake (`CHECKOUT_START` and
`PURCHASE` are enum values that are **never fired**), and there is no notion of:

- **Per-page traffic** — which URLs are viewed, how often, by how many people.
- **Acquisition** — where visitors came from (referrer, UTM source/medium/campaign).
- **Behavior flow** — where a visitor went next (page→page navigation), entry/exit
  pages.
- **Sessions** — a single visit grouped together (count, pages/visit, duration, bounce).

The `AnalyticsEvent` table already has the columns needed (`sessionId`, `referrer`,
`path`, `query`, `metadata` jsonb), but `sessionId` is unused and `PAGE_VIEW` only fires
on blog posts. This sub-project turns the existing event stream into a real
traffic/behavior analytics surface.

## Goals

- Fire `PAGE_VIEW` on **every** storefront route (with `path`, `referrer`, `sessionId`).
- Group a visit with a `sessionId` (new `px_session` cookie); keep `anonId` as the
  cross-session visitor identity.
- Capture acquisition: referrer host + UTM params on the session's landing event.
- Complete the funnel: fire `CHECKOUT_START` and `PURCHASE` server-side.
- Admin analytics queries + UI for: top pages, unique visitors/page, traffic sources,
  behavior flow (path transitions), entry/exit pages, real 4-step funnel, session KPIs,
  search→conversion.

## Non-Goals (YAGNI)

- No real-time/live dashboard (range-scoped queries only).
- No pre-aggregation/rollup tables yet — deferred until volume demands it (noted under
  Performance). Queries are range-bounded and indexed.
- No cross-device identity stitching beyond the existing `anonId`/`userId`.
- No third-party analytics integration (self-hosted only).

## Instrumentation

### Sessions

- New cookie `px_session` (httpOnly, secure, `SameSite=Lax`), value = random UUID,
  **30-minute sliding expiry** (refreshed on each tracked event). A gap > 30 min starts
  a new session — standard web-analytics session definition.
- Server helper `getOrSetSessionId()` in `src/lib/analytics/track.ts`, mirroring the
  existing `getOrSetAnonId()`. The `/api/analytics/track` route and server-side
  `recordEvent` callers populate `sessionId`.
- `anonId` (existing `px_anon`, 1-year) stays the durable visitor id; `sessionId` groups
  one visit.

### Global page-view tracker

- New client component `src/components/analytics/route-tracker.tsx`, mounted once in the
  **storefront** root layout (not `/admin`). On mount and on every `usePathname` change,
  it POSTs a `PAGE_VIEW` to `/api/analytics/track` with `path` and, on the first event of
  a load, `document.referrer`.
- Uses `sendBeacon`/`keepalive` like the existing `TrackView`. Existing `TrackView` on
  product/category pages stays for the typed `PRODUCT_VIEW`/`CATEGORY_VIEW` events;
  `PAGE_VIEW` is additive and generic. (Blog's manual `PAGE_VIEW` is removed in favor of
  the global tracker to avoid double counting.)

### Acquisition (referrer + UTM)

- On the **first event of a session**, the track API records `referrer` (already a
  column) and parses `utm_source`/`utm_medium`/`utm_campaign` from the landing URL into
  `metadata.utm`. No schema change — uses the existing `metadata` jsonb.
- A "session landing" is detected server-side: if no prior event exists for this
  `sessionId`, treat this event as the landing and attach acquisition data.

### Funnel completion

- `CHECKOUT_START` — fired when checkout begins. Emitted server-side from the order/
  checkout entry (when an order is created in `PENDING`/payment is initiated) with
  `userId` + `sessionId`, fire-and-forget.
- `PURCHASE` — fired from the `confirmPayment` success path (the existing post-payment
  hook that already triggers fulfillment/email) with `userId`, `sessionId`, order id +
  amount in `metadata`. Idempotent: only on the confirming transition, so a duplicate
  gateway callback does not double-count.

### Schema change

- Add composite index `(sessionId, createdAt)` on `AnalyticsEvent` for journey/session
  queries. **Additive, `db:push`-safe.** No column changes.

## Queries

Extend `src/lib/admin/analytics.ts` (all range-scoped `[from, to)`):

- **Top pages** — `GROUP BY path` for `PAGE_VIEW`, ordered by count; `views` +
  `uniqueVisitors` (distinct `anonId`).
- **Views over time per path** — daily buckets, optionally filtered to a path.
- **Traffic sources** — group by normalized referrer host + `metadata.utm_source` over
  session-landing events; `sessions` + `visitors` per source. Buckets: Direct (no
  referrer), Search, Social, Referral, Campaign (has UTM).
- **Behavior flow** — within each `sessionId`, order `PAGE_VIEW` by `createdAt`, derive
  consecutive `(path → nextPath)` transitions; aggregate top transitions. Powers a
  flow/Sankey-style view.
- **Entry / exit pages** — first and last `path` per session, aggregated.
- **Session KPIs** — session count, avg pages/session, avg duration
  (`max(createdAt) - min(createdAt)` per session), bounce rate (sessions with 1 page).
- **Real funnel** — `PRODUCT_VIEW → ADD_TO_CART → CHECKOUT_START → PURCHASE` counts +
  step conversion %.
- **Search → conversion** — sessions that fired `SEARCH` and later `PURCHASE`.

Each function returns a typed shape; `getAdminAnalytics(range)` fans them out with
`Promise.all` (existing pattern).

## Admin UI

Refactor `src/app/admin/analytics/page.tsx` into tabs (keep server-component +
range-selector pattern):

- **Overview** — existing KPI cards + real 4-step funnel + views-over-time.
- **Pages** — top pages table (views, unique visitors), per-path trend.
- **Sources** — traffic-source breakdown (Direct/Search/Social/Referral/Campaign),
  top referrers, top campaigns.
- **Flow** — behavior flow (top page→page transitions), entry pages, exit pages.
- **Funnel** — the 4-step funnel detail + search→purchase conversion.
- **Search** — existing top searches + zero-result searches.

Reuses existing chart/table primitives; new viz limited to a transitions list (a simple
two-column "from → to (count)" table first; Sankey can come later — YAGNI).

## Performance

- All queries range-bounded; `(type, createdAt)`, `(createdAt)`, `(anonId)` indexes
  already exist; new `(sessionId, createdAt)` covers journey/session grouping.
- Behavior-flow and session-duration queries are the heaviest (self-join / window over
  session-ordered events). Acceptable at current volume within a 7/30/90-day window.
- **Deferred:** nightly rollup tables (e.g. `DailyPageStats`, `SessionSummary`) if event
  volume makes live queries slow. Explicitly out of scope now; called out so it is a
  conscious future step, not an omission.

## Error Handling

- Tracking is fire-and-forget and must never break UX (existing contract): the track API
  always returns 204, swallows errors, and is rate-limited (60/IP/min).
- `PURCHASE`/`CHECKOUT_START` emission wrapped so an analytics failure cannot fail
  checkout or payment confirmation.
- UTM/referrer parsing is defensive (length-capped, malformed URLs ignored).

## Testing

- Unit: session id issue/refresh (sliding 30-min window); landing-event detection
  (first event of session attaches acquisition, later events do not).
- Unit: behavior-flow transition derivation from an ordered event fixture; entry/exit
  extraction; bounce computation.
- Unit: funnel step counts; `PURCHASE` fires once per confirming transition (no
  double-count on duplicate callback).
- Integration: a simulated session (landing → product view → add to cart → checkout →
  purchase) produces correct funnel + flow + source rows.

## Rollout

- Migration: add `(sessionId, createdAt)` index (additive, `db:push`-safe).
- Deploy instrumentation first (events start populating), then the admin views read the
  growing data. Historical sessions before rollout have null `sessionId` and are
  excluded from session/flow metrics (documented in the UI as "from <rollout date>").
- No destructive operations.

## Open Questions

None blocking. Sankey visualization intentionally deferred to a transitions table for v1.
