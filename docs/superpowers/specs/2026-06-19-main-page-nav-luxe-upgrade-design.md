# Main-page UI upgrade: dark/gold luxe nav — design

Date: 2026-06-19
Status: approved

## Context

Pixevel (پیکسِل) is a Persian-first, RTL online shop for **digital gaming/media goods** —
Steam gift cards, game CD keys, Spotify/Apple gift cards, and similar. (Note: the checked-in
`AGENTS.md` "Product Identity" describing clothing/lingerie is stale; the real identity is
digital goods, confirmed by the user and by `src/app/layout.tsx` metadata.)

The homepage today renders dynamic blocks plus a floating bottom navigation pill. There is
**no top bar**. The bottom nav has no active-route indicator and inlines its own scroll engine
and cart-count fetch. The user wants a premium, fashion-retail-grade upgrade to the main page,
especially the navigation.

## Goal

Upgrade the main page with a **dark/gold luxe** treatment applied to the **bars and showcase
hero only**, while keeping the light browsing base and the existing `premium = full dark`
model intact. Add a new top bar, restyle the bottom nav, and polish the homepage blocks.

## Decisions (locked with user)

- Scope: new top bar + bottom-nav restyle + homepage block polish.
- Aesthetic: premium gold/dark luxe lean.
- Top bar scroll behavior: hide-on-scroll-down / reveal-up (mirrors bottom nav).
- Bottom nav: keep current flat items (خانه/محصولات/حساب/سبد + مدیریت for admin). No center
  button, no new feature.
- Dark reach: bars + showcase hero only. Product browsing stays on the light base.
  `premium = full dark` model is untouched.

## Non-goals

- No wishlist, no search-feature changes, no new catalog/backend behavior.
- No theme flip — luxe is a scoped token band, not a new global theme.
- RTL and the admin nav-item logic are preserved exactly.

## Design tokens (`src/app/globals.css`)

Add a `.luxe` scope (a class that sets its own custom properties) so dark bars render
correctly over either the light or the premium-dark base:

- `--luxe-bg` — near-black purple (aligns with existing dark `--background`).
- `--luxe-surface` — raised dark surface.
- `--luxe-border` — low-alpha white hairline.
- `--luxe-fg` — near-white foreground.
- `--luxe-muted` — muted foreground for inactive labels.
- `--gold` / `--gold-strong` — warm gold accent (active state, CTAs, price pills).

Values expressed in `oklch` to match the existing palette. Components opt in by wrapping in
`className="luxe"` (or by applying the vars directly), so the band is dark regardless of the
page's light/dark base.

## Components

### 1. Top bar — new `src/components/shop/top-bar.tsx` (client)

- Full-width luxe band, `fixed top-0`, gold hairline bottom border, `z-50`.
- RTL layout: wordmark **پیکسِل** (gold) at the start (right); search + account + cart
  (with badge) icons at the end (left).
- Search icon links to `/products`; account icon links to `/account` when logged in else
  `/login`; cart icon links to `/basket`.
- Hides on scroll down, reveals on scroll up via the shared `useHideOnScroll` hook.
- `src/app/page.tsx` `<main>` gains top padding so the first block is not covered on load.

### 2. Bottom nav — restyle `src/components/shop/bottom-nav.tsx`

- Keep the existing structure and items, including the admin `مدیریت` insertion.
- Repaint with luxe tokens + gold.
- **Add active-route highlight**: use `usePathname()` to mark the active item gold (no active
  state exists today — this is the main UX win on the bottom nav).
- Consume the shared `useHideOnScroll` hook and the shared cart context instead of inlined logic.

### 3. Shared logic extraction (clean boundaries per AGENTS.md)

- `src/lib/use-hide-on-scroll.ts` — client hook returning `hidden: boolean`, encapsulating the
  rAF-throttled scroll-direction logic currently inlined in `bottom-nav.tsx`. Both bars use it.
- `src/components/shop/cart-provider.tsx` — a small client context mounted in `layout.tsx` that
  fetches the cart count once and refreshes on `cart:changed` / window `focus`. Exposes
  `useCart()` returning `{ count }`. Both bars read from it, so the two badges stay in sync and
  there is a single fetch (today the bottom nav fetches on its own; a second bar would double it).

### 4. Homepage block polish — `src/app/page.tsx` + showcase components

- `ShowcaseHero`, `ShowcaseBlock`, and the image-only hero adopt the luxe card: dark panel,
  gold price pill, gold CTA — consistent with the approved mockup.
- `SectionHeader`: tighter type scale; the "همه محصولات" link uses the gold accent.
- Consistent vertical rhythm and section padding across blocks.
- Keep the horizontal-scroll gallery and the existing product-card hover motion.
- Any placeholder/example copy uses digital-goods framing (gift cards, CD keys), never clothing.

## Data flow

No new server data. The cart count comes from the existing `GET /api/cart` endpoint, now read
through `CartProvider` instead of a per-component fetch. `getHomepageView(user)` and
`getCurrentUser()` are unchanged. The top bar and bottom nav are client components mounted
within the server-rendered page/layout.

## Error handling

- Cart fetch failures are swallowed silently (badge keeps its last known value) — matches
  current behavior.
- `useHideOnScroll` and the cart provider register/cleanup listeners in `useEffect`; no SSR
  window access.
- `prefers-reduced-motion` continues to disable the existing animations; new transitions
  (bar hide/reveal) respect it.

## Testing / verification

The repo has no test runner (`package.json` has no `test` script), so verification is manual
and visual via the Playwright MCP against `npm run dev` (port 4000):

1. Top bar renders, hides on scroll down, reveals on scroll up.
2. Bottom nav shows the correct active-route highlight while navigating.
3. Cart badge updates on both bars after a `cart:changed` event and stays in sync.
4. Premium user (dark base) still works; the luxe bars sit naturally.
5. Light product-browsing pages are visually unaffected by the luxe tokens.
6. `prefers-reduced-motion` disables motion.

## Integration

After implementation and verification, merge the feature branch into local `main`
(the repo's primary branch is `main`).
