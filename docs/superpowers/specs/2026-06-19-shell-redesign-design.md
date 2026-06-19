# Design: Shell Redesign — Iranian-Commerce Pattern on shadcn

Date: 2026-06-19
Status: Approved

## Goal

Reimagine the application shell around the patterns Iranian shoppers know (Digikala, Torob, Afra): a **search-dominant header**, a **categories menu**, and a **mobile bottom-tab bar** — built on real shadcn/ui primitives instead of hand-rolled chrome. Replace the current top-app-bar + off-canvas drawer + generic bottom-bar.

## Decisions (locked with user)

- **Storefront nav = header + categories + bottom tabs.** No persistent storefront sidebar.
- **Admin = shadcn `Sidebar`** (collapsible, app-like), in its own admin route-group layout.
- **Categories really filter:** add a public `listCategories()` and a `?category=` filter on the product listing/API.
- **shadcn foundation:** install and use `sheet, input, sidebar, dropdown-menu, avatar, badge, separator, scroll-area` (only `button` exists today).

## Storefront shell

Rendered from the root layout via a rewritten `AppShell`. On `/admin/*` the AppShell renders children bare (the admin layout owns admin chrome).

- **`SiteHeader`** (sticky, `z-40`, theme-aware, `border-b`): 
  - Mobile: row 1 = brand «پیسکول» + cart (Badge) + theme; row 2 = full-width `SearchBar`.
  - Desktop: single row = brand + `SearchBar` (flex-1, dominant) + theme + account + cart; plus a **second row** = `CategoryBar` (`همه دسته‌بندی‌ها` trigger + top category quick-links).
- **`SearchBar`** — shadcn `Input` in a `<form action="/products">` (name `q`), Persian placeholder. Submits to `/products?q=`.
- **`CategoryMenu`** — `همه دسته‌بندی‌ها`. Mobile: shadcn `Sheet` (side=end for RTL) listing categories. Desktop: `DropdownMenu` panel. Items link to `/products?category=<slug>`. Categories come from `listCategories()` passed down from the server layout.
- **`BottomTabs`** — mobile-only (`lg:hidden`), `fixed bottom-0`, persistent: خانه · دسته‌بندی · سبد · حساب(or ورود). `دسته‌بندی` opens the `CategoryMenu` Sheet; others are links. Cart count Badge on سبد. Active tab in gold.
- **Account** — header avatar/icon → `/account` (logged in) or `/login`. A small `DropdownMenu` for logged-in users (حساب، سفارش‌ها، خروج، and مدیریت for admins).
- **Overflow safety:** `body` keeps `overflow-x-clip`; any Sheet uses shadcn's portal/overlay (no off-canvas-in-flow overflow).

Retire: `top-app-bar.tsx`, `nav-drawer.tsx`, `bottom-bar.tsx`. Rework `nav-items.ts` to the new model (bottom tabs + account menu items).

## Admin shell

- **`src/app/admin/layout.tsx`** (server) — guards admin (`getCurrentUser`, redirect non-admin), wraps content in shadcn `SidebarProvider` + `AppSidebar` + `SidebarInset`. Provides the admin top bar (`SidebarTrigger` + breadcrumb/title).
- **`AdminSidebar`** — shadcn `Sidebar` with the admin sections (داشبورد، محصولات، افزودن محصول، دسته‌ها، تگ‌ها، صفحه خانه، واترمارک‌ها، سفارش‌ها، کاربران، مشاهده سایت). Collapsible to icons.
- Admin pages (already unwrapped from the old `AdminShell`) render their content into `SidebarInset`. Keep their existing light-styled tables; the sidebar is theme-aware.
- The root `AppShell` detects `/admin` and renders children without storefront chrome so the admin layout's sidebar is the only chrome there.

## Data: categories + filter

- **`listCategories()`** (public, in `src/lib/catalog.ts` or `src/lib/categories.ts`): active categories → `{ id, slug, titleFa }[]`, ordered. Lightweight; cached per request (`noStore` consistent with the rest).
- **Category filter:** `getProductsForListing(user, { q?, category?, page?, pageSize?, _db? })` gains `category` (slug). Filter via an EXISTS subquery on `categories` joined to `products.categoryId` (mirrors the existing tag/category search predicate). Excludes `ARCHIVED` as today.
- **`GET /api/products`** accepts `?category=`; **`/products`** reads `?category=` (awaited `searchParams`) and shows an active-filter chip.
- Test: listing filtered by a category returns only that category's products (including disabled/out-of-stock), excludes others.

## shadcn integration

Install via `bunx shadcn@latest add sheet input sidebar dropdown-menu avatar badge separator scroll-area`. These land in `src/components/ui/`. Use the project's existing tokens (the preset already set them). `Sidebar` brings its own `SidebarProvider`/`useSidebar` + a `--sidebar-*` token set; verify those tokens exist (the preset's globals may need the sidebar tokens appended).

## Verification

- `bun run build` type-checks + builds.
- In-browser (the running `:4000`, Playwright): mobile (375) + desktop (1280) + admin — assert `scrollWidth == viewport` (no horizontal scroll), header/search/bottom-tabs render, category Sheet opens, admin sidebar collapses. Screenshot each.
- Vitest: existing suite + the new category-filter test stay green.

## Out of scope

- Category mega-menu with sub-categories/images (flat list for now).
- Search autosuggest/typeahead (plain submit to `/products?q=`).
- Persisting sidebar collapsed state across sessions (shadcn default cookie is fine if it comes free).

## Build order

1. Install shadcn components (+ sidebar tokens if missing).
2. `listCategories()` + `?category=` filter on listing/API/products page (+ test).
3. Storefront: `SearchBar`, `CategoryMenu`, `BottomTabs`, `SiteHeader`, rewritten `AppShell`, layout wiring (fetch categories + user), retire old shell files.
4. Admin: `AdminSidebar` + `src/app/admin/layout.tsx`; AppShell renders admin children bare.
5. Browser verification pass (mobile/desktop/admin) + fixes.
