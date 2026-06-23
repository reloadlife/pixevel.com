# Admin UI Kit & Shell — Wave 0 Design

**Date:** 2026-06-23
**Status:** Approved (design)
**Part of:** WooCommerce-parity admin rebuild (foundation-first; Waves 1–4 follow, each its own spec).

## Context

The admin (`/admin`) has 24 pages / 40 API routes / 20 client `*-management` components. Every page re-implements the same boilerplate: a server `page.tsx` auth-gates (`getCurrentUser` → role redirect) and fetches initial data via `lib/admin/*`, then a client island holds `useState(initialData)`, refetches `/api/admin/*` with `URLSearchParams`, and rolls its own tabs+counts, loading/empty states, status-badge maps, `Intl` date formatting, pagination footer, and `window.confirm()` destructive actions. The duplication drifts page to page (inconsistent UX) and produces monolith components (`product-management.tsx` 107 KB, `order-management.tsx` 37 KB).

The stack already has Tailwind v4 + shadcn-style primitives (`src/components/ui/*`: button, badge, card, input, label, sheet, dropdown-menu, tooltip, separator, skeleton, scroll-area, sidebar), CVA, clsx, tailwind-merge, lucide, sonner, vaul. App is RTL + Persian-first with custom "luxe" theme tokens. There is **no admin-specific layer** above the primitives.

## Goal

Build one reusable admin layer (the "kit") on top of the existing primitives, adopt TanStack libraries for data/grid/forms/virtualization, and prove the abstraction by migrating 2 representative pages. No new admin **features** land in Wave 0 — only the foundation that Waves 1–4 rebuild on.

## Non-Goals (explicitly deferred to later waves)

- Shipping methods / shipments, refunds, tax UI, order timeline, coupon depth, sale-price/dims/relations editors, product/order/blog rebuilds.
- Any new DB-backed field surfacing.
- Changing existing API route response shapes wholesale (Wave 0 tolerates current shapes via per-page mappers; each later wave normalizes its own routes).

## TanStack adoption (per direction: use TanStack wherever it fits)

| Concern | Library | Use |
|---|---|---|
| API calls | `@tanstack/react-query` | queries (lists) + mutations (writes) with cache invalidation |
| Grid | `@tanstack/react-table` | headless table; columns config, sort, pagination |
| Long lists | `@tanstack/react-virtual` | row virtualization above a threshold (InventoryUnit, CommLog) |
| Forms | `@tanstack/react-form` | field state + validation for Sheet forms & heavy editors |

New deps: `@tanstack/react-query`, `@tanstack/react-table`, `@tanstack/react-form`, `@tanstack/react-virtual`.

## Architecture

### File layout
```
src/components/admin/kit/
  admin-page.tsx      <AdminPage title subtitle actions> — standard header + content slot
  data-table.tsx      <DataTable> on react-table (+ react-virtual over threshold); RTL/Persian renderers,
                      columns config, sort, loading/empty, pagination, rowActions
  filter-bar.tsx      <FilterBar> (search + select filters) and <StatTabs> (count tabs)
  status-chip.tsx     central enum→{label,tone} maps + <StatusChip kind value/>
  sheet-form.tsx      <SheetForm> right-side create/edit overlay bound to a TanStack Form instance
  confirm-dialog.tsx  <ConfirmDialog> + useConfirm() hook (replaces window.confirm)
  form-fields.tsx     FormField, TextField, TextareaField, SelectField, NumberField, SwitchRow,
                      MoneyField (IRT/USD/EUR + live Toman hint), DateField (Jalali display)
  index.ts            barrel
src/components/admin/admin-providers.tsx   QueryClientProvider wrapper (client) for admin/layout
src/lib/admin/
  guard.ts            requireAdmin(redirectTo) — server helper, collapses per-page auth redirect
  use-admin-list.ts   useAdminList(resource, filters) → useQuery wrapper; standard list-response; initialData
  use-admin-mutation.ts useAdminMutation(...) → useMutation + invalidateQueries + toast
  list-response.ts    type AdminListResponse<Row> = { rows: Row[]; pagination: {page,pageSize,total,totalPages}; counts?: Record<string,number> }
```

### Data layer (TanStack Query)
- `useAdminList(resource, filters)`: `useQuery({ queryKey:[resource, filters], queryFn: fetch(/api/admin/<resource>?<filters>), initialData })`. Server `page.tsx` still fetches initial data and passes it as `initialData` → instant first paint, background refetch, SSR/SEO preserved.
- `useAdminMutation`: wraps `useMutation` with success/error `toast` and `queryClient.invalidateQueries([resource])` → automatic, race-safe refresh. Removes all manual `refresh()`/`setState`-after-write code.
- `AdminProviders` provides a per-session `QueryClient` (sensible defaults: `staleTime`, no refetch-on-focus for admin grids) and wraps the admin subtree in `admin/layout.tsx`.
- Wave 0 ships a tolerant response mapper so current varied API shapes feed the standard `AdminListResponse`; later waves normalize each route to return it directly.

### Grid (TanStack Table + Virtual)
- `DataTable<Row>`: props `{ columns, data, loading, empty, pagination, sorting, onSortingChange, rowActions }`. Built on `useReactTable` (core + sorted + paginated models). RTL header/cell alignment, Persian-digit numbers via `lib/format`, sticky header, density. `@tanstack/react-virtual` activates when `data.length` exceeds a threshold (default ~50) to keep InventoryUnit/CommLog grids fast.

### Forms (TanStack Form)
- `SheetForm` opens a right-side `Sheet`, owns a TanStack Form instance, renders children field components, handles submit→`useAdminMutation`→close+toast, shows field + form errors and a busy state.
- `form-fields.tsx` components bind to the form's field API (`form.Field`). `MoneyField` is currency-aware (IRT/USD/EUR) with a live Toman conversion hint reusing the exchange-rate helper. `DateField` uses a native date input with Jalali display (see Open Questions).
- Heavy editors (product/order/blog) live on dedicated routes and reuse the same field components + TanStack Form, not the Sheet.

### Shell / IA
- `requireAdmin(redirectTo)` one-liner replaces the ~24 duplicated auth blocks in `page.tsx`.
- `<AdminPage title subtitle actions>` standardizes the header used by `review-management` et al.
- `admin-sidebar.tsx` regrouped: **Catalog** (products, categories, tags, inventory, reviews) · **Sales** (orders, coupons, gift-cards; reserved slots: shipping, refunds, tax) · **Customers** (users, balances, referrals, subscriptions, support) · **Content** (homepage, blog, watermarks) · **Comms** · **Insights** (analytics) · **Settings**.

## Reference migrations (the proof)

Wave 0 migrates exactly two pages to validate the kit covers both archetypes:
1. **Reviews** — list + count tabs + per-row approve/reject/delete + ConfirmDialog. Archetype: list-only with row actions. (Smallest existing component, clean target.)
2. **Coupons** — list + Sheet create/edit form + delete ConfirmDialog. Archetype: list + form. (Coupon depth fields stay deferred — migrate the *existing* fields only; depth lands in Wave 3.)

Both must render on the kit with no behavior regression and their existing APIs unchanged.

## Testing

- Unit: `useAdminList` query-key/querystring building; `status-chip` enum maps exhaustive; `MoneyField` currency→Toman display.
- Integration: reuse existing reviews/coupons API tests (unchanged).
- Visual: preview renders `/admin/reviews` and `/admin/coupons` on the kit (RTL, Persian digits, sort, pagination, Sheet form, confirm).
- Lint/format: `biome check` green; `next build` typechecks.

## Done-definition

- Kit components built, typed, with a short usage doc (`src/components/admin/kit/README.md`).
- `requireAdmin`, `useAdminList`, `useAdminMutation`, `AdminListResponse`, `AdminProviders` in place; QueryClient wired into `admin/layout.tsx`.
- Reviews + Coupons migrated and verified.
- Sidebar regrouped.
- Existing admin APIs unchanged; full test suite + build green.

## Open Questions (resolved)

- **Jalali date input:** native date input (Gregorian value) with Jalali display label now; a dedicated Jalali picker dependency can replace it later if operators need calendar-native entry. Chosen: native-now (no new dep beyond TanStack).

## Parallelization map (for subagent-driven execution)

- **Batch A (independent leaves, parallel):** `status-chip`, `confirm-dialog`, `form-fields`, `admin-page`, `guard`, `list-response` types, `admin-providers`.
- **Batch B (depends on A + deps installed):** `data-table` (table+virtual); `use-admin-list` + `use-admin-mutation` (query); `sheet-form` (needs form-fields + react-form).
- **Batch C (depends on B):** migrate **Reviews**; migrate **Coupons**; regroup **sidebar** (sidebar independent, can also run in A).
- Dep install (`bun add @tanstack/react-query @tanstack/react-table @tanstack/react-form @tanstack/react-virtual`) is the prerequisite step before B.
