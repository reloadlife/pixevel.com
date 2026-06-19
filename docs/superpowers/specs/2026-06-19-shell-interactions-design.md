# Design: Shell Interactions — Mini-Cart, Hover Account, Spotlight Search, Category Mega-Menu

Date: 2026-06-19
Status: Approved

## Goal

Make the storefront chrome feel like an app using established libraries (no
hand-rolled overlays): a mini-cart drawer/preview, a hover account menu with the
theme switch inside, a ⌘K spotlight search, and a proper category mega-menu.

## Libraries

- `vaul` — Emil Kowalski's drawer → the mobile bottom-sheet mini-cart + the desktop
  drawer-on-click.
- `cmdk` — command palette → the spotlight search.
- `react-hotkeys-hook` — ⌘K / Ctrl+K.
- `@base-ui/react` (installed) — `PreviewCard` for the desktop cart hover preview;
  the existing `DropdownMenu` (base-ui Menu) in controlled mode for the hover
  account menu and the category mega-menu.

Add thin shadcn-style wrappers: `src/components/ui/drawer.tsx` (vaul),
`src/components/ui/command.tsx` (cmdk).

## Decisions (locked with user)

- Desktop cart: **hover → preview popover; click → opens the Vaul drawer.** Full
  `/basket` reached from a link inside.
- Theme control in the account menu: **3-way segmented (روشن / تیره / سیستم).**

## 1. CartProvider rework

Today `useCart` exposes only `count` and re-fetches ad-hoc. Rework it to hold the
whole cart view and expose `{ cart, count, refresh() }`:

- On mount and on a `cart:changed` window event (dispatched by add/remove), `GET
  /api/cart` → store `CartView` (`items`, `subtotal`, `itemCount`). `count` derives
  from it. One source of truth for the badge + mini-cart.
- Add-to-cart / remove flows dispatch `cart:changed` so the badge and mini-cart stay
  live without a full reload.

## 2. Mini-cart + CartButton

- `MiniCart` (content): item rows (image, title, variant, qty, line total), subtotal,
  a «تسویه حساب» button → `/checkout`, and «مشاهده سبد کامل» → `/basket`. Empty state.
- `CartButton` (replaces the header cart `Link`): cart icon + count badge.
  - **Mobile** (`useIsMobile` / `lg` breakpoint): tap → **Vaul `Drawer`** (bottom sheet) holding `MiniCart`.
  - **Desktop**: wrapped in base-ui **`PreviewCard`** — hover shows `MiniCart` in a popover; **click** opens the same Vaul `Drawer`.
- `/basket` stays the detailed page (full qty steppers, remove, totals) — it is the "more data" view; the mini-cart is the quick view.

## 3. Account hover menu + theme segmented

- `AccountMenu` becomes a **controlled** dropdown that opens on `mouseenter` and closes
  on `mouseleave` (small close delay) — hover behavior without fighting base-ui. Click
  still toggles (keyboard/touch accessible).
- Contents: avatar/identity header, حساب کاربری (`/account`), سفارش‌ها, پنل مدیریت (admin
  only), a **theme segmented control** (`ThemeSegmented`: روشن/تیره/سیستم via
  `next-themes` `useTheme`), خروج. The standalone header `ThemeToggle` is removed
  (its function now lives here). Guests: the icon links to `/login`.

## 4. Spotlight search (⌘K)

- `SpotlightSearch` (cmdk `CommandDialog`): an input + a debounced product search
  (`GET /api/products?q=`, ~250ms), result rows (image + title + price) → the product
  page; pressing Enter with no selection → `/products?q=<term>`. Recent/empty state
  shows a hint and top categories as quick links.
- The header search becomes a **trigger button** showing «جستجو…  ⌘K». Opens the dialog.
- `react-hotkeys-hook` binds `meta+k` and `ctrl+k` (preventDefault) to open it, globally.

## 5. Category mega-menu

- Desktop «همه دسته‌بندی‌ها»: replace the side-`Sheet` trigger with a **dropdown
  mega-panel** (base-ui `DropdownMenu`/Menu) — a clean multi-column grid of categories
  → `/products?category=<slug>`. Opens on click (and hover-friendly). Fix the button's
  icon/label.
- Mobile keeps the bottom-tab «دسته‌بندی» → `CategoryMenu` Sheet (unchanged).

## Files

- New: `src/components/ui/drawer.tsx`, `src/components/ui/command.tsx`,
  `src/components/shell/cart-button.tsx`, `src/components/shell/mini-cart.tsx`,
  `src/components/shell/spotlight-search.tsx`, `src/components/shell/category-mega-menu.tsx`,
  `src/components/shell/theme-segmented.tsx`.
- Modify: `src/components/shop/cart-provider.tsx`, `src/components/shell/site-header.tsx`,
  `src/components/shell/account-menu.tsx`, `src/components/shell/search-bar.tsx` (→ trigger),
  add/remove flows to dispatch `cart:changed` (`basket-items.tsx`, `/api/cart` client callers).

## Verification

- `bun run build` type-checks + builds.
- In-browser (`:4000`, admin session): desktop — hover cart shows preview, click opens
  drawer; hover account shows menu with the 3-way theme switch; ⌘K opens spotlight, typing
  returns products; «همه دسته‌بندی‌ها» opens the mega-menu. Mobile — cart tap opens the
  bottom sheet. `scrollWidth == viewport`, 0 console errors. Screenshot each.
- Vitest suite stays green (these are UI; no backend logic change beyond reads).

## Out of scope

- Cart quantity editing inside the mini-cart (quick view is read-ish + links to /basket; editing lives on /basket).
- Search history persistence, fuzzy ranking (server `ILIKE` is the matcher).
- Keyboard arrow-nav polish beyond what cmdk provides by default.

## Build order

1. Install `vaul`, `cmdk`, `react-hotkeys-hook`; add `drawer.tsx` + `command.tsx` wrappers.
2. CartProvider rework (+ `cart:changed`).
3. MiniCart + CartButton (drawer + PreviewCard); wire into header.
4. AccountMenu hover + ThemeSegmented; drop header ThemeToggle.
5. SpotlightSearch + ⌘K; SearchBar → trigger.
6. Category mega-menu (desktop).
7. Browser verification + fixes.
