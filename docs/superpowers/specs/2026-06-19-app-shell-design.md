# Design: Role-Aware Application Shell

Date: 2026-06-19
Status: Approved

## Goal

Replace the website-style chrome (hide-on-scroll `TopBar` + floating-pill `BottomNav`, plus the separate `AdminShell`) with one **application shell** that adapts to guest / customer / admin and feels like an app, not a site. Hosted from `src/app/layout.tsx`.

## Decisions (locked with user)

- **Nav pattern: drawer.** Full role-aware navigation lives in a slide-over drawer (hamburger). Pinned open as a sidebar on desktop (`lg+`); overlay + backdrop on mobile.
- **Persistent mobile bottom bar** (app-like, never hides): quick destinations + a "منو" button that opens the drawer.
- **Unified admin.** Same shell on `/admin/*`; the drawer swaps to admin sections. The per-page `AdminShell` wrapper is retired.
- **Theme-aware chrome.** Shell surfaces follow the active light/dark theme (semantic tokens), not the always-dark `luxe`. Gold accent marks the active item.

## Personas → nav

`navFor(user, pathname)` is the single source of truth.

- **Guest:** خانه · فروشگاه · جستجو · سبد · ورود
- **Customer (logged in):** خانه · فروشگاه · جستجو · سبد · سفارش‌ها · حساب · خروج
- **Admin:** the above + a مدیریت entry. On `/admin/*` the drawer shows admin sections: داشبورد، محصولات، افزودن محصول، دسته‌ها، تگ‌ها، صفحه خانه، واترمارک‌ها، سفارش‌ها، کاربران، و «مشاهده سایت».
- **Mobile bottom bar (all personas):** خانه · جستجو · سبد · حساب(or ورود) · منو(opens drawer).

## Components (`src/components/shell/`)

1. `AppShell` (client) — replaces `SiteChrome` in the layout. Owns drawer open/close state, renders `TopAppBar` + `NavDrawer` + `BottomBar`, and a content container that provides the top-bar offset, the pinned-sidebar inline-start offset on `lg+`, and the bottom-bar offset on mobile. Closes the drawer on route change, backdrop click, and `Esc`.
2. `TopAppBar` (client) — persistent (no hide-on-scroll): hamburger (mobile), brand «پیسکول», search affordance, theme toggle (reuse `ThemeToggle`), cart badge (reuse `useCart`), account link.
3. `NavDrawer` (client) — role-aware item list from `navFor`; overlay+backdrop on mobile, pinned sidebar on `lg+`. Active item highlighted in gold. Footer holds theme + (when logged in) logout.
4. `BottomBar` (client) — mobile only (`lg:hidden`), `fixed bottom`, persistent. Quick items + منو.
5. `nav-items.ts` — `navFor(user, pathname): { items: NavItem[]; bottomBar: NavItem[]; context: "shop" | "admin" }`. `NavItem = { href, label, icon, exact? }`. Active match: `exact ? pathname === href : pathname.startsWith(href)`.

Retire: `src/components/shop/site-chrome.tsx`, `top-bar.tsx`, `bottom-nav.tsx`, `src/components/admin/admin-shell.tsx`.

## Page framing

The shell owns the scroll container + safe padding. Every page drops the framing it set for the old fixed chrome:

- Storefront pages: strip `min-h-dvh`, `pt-14`/`pt-6`, `pb-24`/`pb-28` from the page `<main>`; keep inner horizontal padding and content.
- Admin pages (11): remove the `<AdminShell user={user}>…</AdminShell>` wrapper and its import; render content directly. The shell provides chrome + admin nav. Admin content keeps a `max-w-7xl` container (moved into the shell's content area for `/admin`).

## Behavior / accessibility

- Drawer: `role="dialog"`/`aria-modal` on mobile overlay; focus trap optional (MVP: Esc + backdrop close). Pinned (static) on `lg+`.
- Bottom bar items use `aria-current="page"` on the active route.
- Logout posts to the existing `/api/auth/logout`.
- Login href: `/login?redirect=<current path>`.

## Verification

`bun run build` type-checks + builds all routes; manual walk of guest/customer/admin on mobile and desktop. Existing 47 vitest tests unaffected (no backend change).

## Out of scope

Search overlay/command palette (search affordance links to `/products?q=` for now); drawer focus-trap polish; per-section admin breadcrumbs.
