# Admin UI Kit & Shell (Wave 0) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a reusable, TanStack-based admin UI layer (data/grid/forms/shell) and prove it by migrating the Reviews and Coupons pages, with zero new features and zero API-shape regressions.

**Architecture:** Server `page.tsx` keeps auth-gating (via a new `requireAdmin` helper) and fetching initial data, then passes it as `initialData` to client islands. Client islands use TanStack Query (`useAdminList`/`useAdminMutation`) for reads/writes, a TanStack-Table `DataTable` for grids, and TanStack-Form-backed `SheetForm`/field components for create/edit. Shared presentational pieces (`AdminPage`, `StatusChip`, `ConfirmDialog`) standardize the chrome.

**Tech Stack:** Next.js (this repo's fork), React, TanStack Query/Table/Form/Virtual, Tailwind v4, shadcn-style `ui/*` primitives, sonner, lucide, Bun, Biome, Vitest.

## Global Constraints

- Package manager: **Bun only** (`bun add`, `bun run`). Never npm/pnpm/yarn.
- Lint/format: **Biome only** (`bun run check`). No ESLint/Prettier/standalone tsc; typecheck happens in `next build`.
- Persian-first, **RTL**. All user-facing copy in Persian. Use `lib/format` (`toFaNumber`, `formatToman`) for numbers/money; never hand-format digits.
- Reuse existing `src/components/ui/*` primitives and the `cn` util; do not re-implement buttons/inputs/sheets.
- **No API response-shape changes** in Wave 0. Existing `/api/admin/*` routes stay byte-compatible; the kit adapts to them via a per-resource mapper.
- Tests follow repo convention: **Vitest, `environment: "node"`** (no DOM). Logic units get Vitest tests; presentational components are verified by `next build` typecheck + preview render. Integration tests use `withRollback` from `test/db`.
- Money: amounts are integer-Toman strings matching `numeric` columns. Currency enum is `currency_code` (IRT/USD/EUR).
- Commit after every task. Work on `master` (no new branch), per the user's workflow.

---

## File Structure

```
src/components/admin/admin-providers.tsx     QueryClient provider (client) for the admin subtree
src/components/admin/kit/
  index.ts                                    barrel re-exporting the kit
  admin-page.tsx                              <AdminPage>
  status-chip.tsx                             status maps + <StatusChip>
  confirm-dialog.tsx                          <ConfirmDialog> + useConfirm()
  form-fields.tsx                             FormField/Text/Textarea/Select/Number/SwitchRow/MoneyField/DateField
  data-table.tsx                              <DataTable> (react-table + react-virtual)
  sheet-form.tsx                              <SheetForm> (react-form)
  README.md                                   usage doc
src/lib/admin/
  guard.ts                                    requireAdmin()
  list-response.ts                            AdminListResponse type + normalizeListResponse()
  use-admin-list.ts                           useAdminList()
  use-admin-mutation.ts                       useAdminMutation()
src/lib/admin/list-response.test.ts
src/lib/admin/use-admin-list.test.ts
src/components/admin/kit/status-chip.test.ts
```

Modified: `src/app/admin/layout.tsx` (wrap with AdminProviders), `src/components/admin/admin-sidebar.tsx` (regroup), `src/app/admin/reviews/page.tsx` + `src/components/admin/review-management.tsx` (migrate), `src/app/admin/coupons/page.tsx` + `src/components/admin/coupon-management.tsx` (migrate).

## Parallelization (for subagent-driven execution)

- **Task 0 first** (deps + provider) — prerequisite for Query/Table/Form tasks.
- **Batch A (parallel after 0):** Tasks 1, 2, 3, 4, 5, 6, 14.
- **Batch B (parallel after A):** Tasks 7, 8, 9, 10, then 11.
- **Batch C (parallel after B):** Tasks 12, 13.

---

### Task 0: Install TanStack deps + AdminProviders + wire layout

**Files:**
- Modify: `package.json` (via `bun add`)
- Create: `src/components/admin/admin-providers.tsx`
- Modify: `src/app/admin/layout.tsx`

**Interfaces:**
- Produces: `<AdminProviders>{children}</AdminProviders>` — a client component supplying a singleton-per-render `QueryClient`.

- [ ] **Step 1: Install dependencies**

Run: `bun add @tanstack/react-query @tanstack/react-table @tanstack/react-form @tanstack/react-virtual`
Expected: packages added to `package.json`, `bun.lock` updated.

- [ ] **Step 2: Create AdminProviders**

```tsx
// src/components/admin/admin-providers.tsx
"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";

export function AdminProviders({ children }: { children: React.ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { staleTime: 30_000, refetchOnWindowFocus: false, retry: 1 },
        },
      }),
  );
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
```

- [ ] **Step 3: Wrap the admin layout**

Read `src/app/admin/layout.tsx`, import `AdminProviders`, and wrap the rendered children (inside any existing auth/shell markup, around the page content slot).

- [ ] **Step 4: Verify build**

Run: `bun run build`
Expected: compiles; no type errors from the new provider.

- [ ] **Step 5: Commit**

```bash
git add package.json bun.lock src/components/admin/admin-providers.tsx src/app/admin/layout.tsx
git commit -m "chore(admin): add TanStack deps + AdminProviders (QueryClient)"
```

---

### Task 1: List-response type + normalizer

**Files:**
- Create: `src/lib/admin/list-response.ts`
- Test: `src/lib/admin/list-response.test.ts`

**Interfaces:**
- Produces:
  - `type AdminListResponse<Row> = { rows: Row[]; pagination: { page: number; pageSize: number; total: number; totalPages: number }; counts?: Record<string, number> }`
  - `function normalizeListResponse<Row>(raw: unknown, opts?: { rowsKey?: string }): AdminListResponse<Row>` — pulls rows from `rows`/`rowsKey`/the first array value; derives pagination defaults when absent.

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/admin/list-response.test.ts
import { describe, expect, it } from "vitest";
import { normalizeListResponse } from "./list-response";

describe("normalizeListResponse", () => {
  it("passes through the canonical shape", () => {
    const r = normalizeListResponse({
      rows: [{ id: "a" }],
      pagination: { page: 1, pageSize: 20, total: 1, totalPages: 1 },
    });
    expect(r.rows).toHaveLength(1);
    expect(r.pagination.total).toBe(1);
  });

  it("adapts a legacy key (reviews → rows)", () => {
    const r = normalizeListResponse({ reviews: [{ id: "x" }] }, { rowsKey: "reviews" });
    expect(r.rows).toEqual([{ id: "x" }]);
    expect(r.pagination.page).toBe(1);
  });

  it("falls back to the first array value and synthesizes pagination", () => {
    const r = normalizeListResponse({ items: [1, 2, 3] });
    expect(r.rows).toEqual([1, 2, 3]);
    expect(r.pagination.total).toBe(3);
    expect(r.pagination.totalPages).toBe(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bunx vitest run src/lib/admin/list-response.test.ts`
Expected: FAIL ("normalizeListResponse is not a function").

- [ ] **Step 3: Implement**

```ts
// src/lib/admin/list-response.ts
export interface AdminPagination {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface AdminListResponse<Row> {
  rows: Row[];
  pagination: AdminPagination;
  counts?: Record<string, number>;
}

export function normalizeListResponse<Row>(
  raw: unknown,
  opts: { rowsKey?: string } = {},
): AdminListResponse<Row> {
  const obj = (raw ?? {}) as Record<string, unknown>;
  let rows: Row[] = [];
  if (opts.rowsKey && Array.isArray(obj[opts.rowsKey])) {
    rows = obj[opts.rowsKey] as Row[];
  } else if (Array.isArray(obj.rows)) {
    rows = obj.rows as Row[];
  } else {
    const firstArray = Object.values(obj).find((v) => Array.isArray(v));
    rows = (firstArray as Row[]) ?? [];
  }

  const p = (obj.pagination ?? {}) as Partial<AdminPagination>;
  const total = typeof p.total === "number" ? p.total : rows.length;
  const pageSize = typeof p.pageSize === "number" && p.pageSize > 0 ? p.pageSize : rows.length || 20;
  const pagination: AdminPagination = {
    page: typeof p.page === "number" ? p.page : 1,
    pageSize,
    total,
    totalPages: typeof p.totalPages === "number" ? p.totalPages : Math.max(1, Math.ceil(total / pageSize)),
  };

  const counts = (obj.counts as Record<string, number> | undefined) ?? undefined;
  return { rows, pagination, counts };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bunx vitest run src/lib/admin/list-response.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/admin/list-response.ts src/lib/admin/list-response.test.ts
git commit -m "feat(admin): AdminListResponse type + tolerant normalizer"
```

---

### Task 2: requireAdmin guard

**Files:**
- Create: `src/lib/admin/guard.ts`

**Interfaces:**
- Consumes: `getCurrentUser` from `@/lib/auth`.
- Produces: `async function requireAdmin(redirectTo: string): Promise<CurrentUser>` — redirects to `/login?redirect=<redirectTo>` when signed out, to `/admin` when signed in but not ADMIN, else returns the user.

- [ ] **Step 1: Implement** (server-only redirect helper; no unit test — uses `next/navigation redirect`, exercised by pages)

```ts
// src/lib/admin/guard.ts
import { redirect } from "next/navigation";
import { type CurrentUser, getCurrentUser } from "@/lib/auth";

export async function requireAdmin(redirectTo: string): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect(`/login?redirect=${encodeURIComponent(redirectTo)}`);
  if (user.role !== "ADMIN") redirect("/admin");
  return user;
}
```

- [ ] **Step 2: Verify build**

Run: `bun run build`
Expected: compiles.

- [ ] **Step 3: Commit**

```bash
git add src/lib/admin/guard.ts
git commit -m "feat(admin): requireAdmin server guard"
```

---

### Task 3: StatusChip + status maps

**Files:**
- Create: `src/components/admin/kit/status-chip.tsx`
- Test: `src/components/admin/kit/status-chip.test.ts`

**Interfaces:**
- Produces:
  - `const STATUS_MAPS` keyed by `kind` (`"order" | "payment" | "shipment" | "refund" | "subscription" | "giftCard" | "review" | "product"`), each mapping an enum value → `{ label: string; variant: "default"|"secondary"|"destructive"|"outline" }`.
  - `function statusMeta(kind, value): { label, variant }` — falls back to `{ label: value, variant: "outline" }` for unknown values.
  - `<StatusChip kind={Kind} value={string} />` rendering a `Badge`.

- [ ] **Step 1: Write the failing test**

```ts
// src/components/admin/kit/status-chip.test.ts
import { describe, expect, it } from "vitest";
import { statusMeta } from "./status-chip";

describe("statusMeta", () => {
  it("maps a known order status to a Persian label", () => {
    expect(statusMeta("order", "PAID").label).toBe("پرداخت‌شده");
  });
  it("maps payment FAILED to destructive variant", () => {
    expect(statusMeta("payment", "FAILED").variant).toBe("destructive");
  });
  it("falls back for an unknown value", () => {
    expect(statusMeta("order", "WAT")).toEqual({ label: "WAT", variant: "outline" });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bunx vitest run src/components/admin/kit/status-chip.test.ts`
Expected: FAIL ("statusMeta is not a function").

- [ ] **Step 3: Implement** (cover every enum value from `src/db/schema.ts`: orderStatus, paymentStatus, shipmentStatus, refundStatus, subscriptionStatus, giftCardStatus, reviewStatus, productStatus — Persian labels)

```tsx
// src/components/admin/kit/status-chip.tsx
import { Badge } from "@/components/ui/badge";

type Variant = "default" | "secondary" | "destructive" | "outline";
type Meta = { label: string; variant: Variant };

export const STATUS_MAPS = {
  order: {
    PENDING: { label: "در انتظار", variant: "outline" },
    PAID: { label: "پرداخت‌شده", variant: "default" },
    PROCESSING: { label: "در حال پردازش", variant: "secondary" },
    SHIPPED: { label: "ارسال‌شده", variant: "secondary" },
    DELIVERED: { label: "تحویل‌شده", variant: "default" },
    CANCELLED: { label: "لغوشده", variant: "destructive" },
    REFUNDED: { label: "بازپرداخت‌شده", variant: "destructive" },
  },
  payment: {
    UNPAID: { label: "پرداخت‌نشده", variant: "outline" },
    AUTHORIZED: { label: "تأییدشده", variant: "secondary" },
    PAID: { label: "پرداخت‌شده", variant: "default" },
    FAILED: { label: "ناموفق", variant: "destructive" },
    REFUNDED: { label: "بازپرداخت‌شده", variant: "destructive" },
  },
  shipment: {
    PENDING: { label: "در انتظار", variant: "outline" },
    SHIPPED: { label: "ارسال‌شده", variant: "secondary" },
    IN_TRANSIT: { label: "در مسیر", variant: "secondary" },
    DELIVERED: { label: "تحویل‌شده", variant: "default" },
    RETURNED: { label: "مرجوعی", variant: "destructive" },
    CANCELLED: { label: "لغوشده", variant: "destructive" },
  },
  refund: {
    PENDING: { label: "در انتظار", variant: "outline" },
    PROCESSING: { label: "در حال انجام", variant: "secondary" },
    COMPLETED: { label: "انجام‌شده", variant: "default" },
    FAILED: { label: "ناموفق", variant: "destructive" },
    REJECTED: { label: "ردشده", variant: "destructive" },
  },
  subscription: {
    TRIALING: { label: "آزمایشی", variant: "secondary" },
    ACTIVE: { label: "فعال", variant: "default" },
    PAST_DUE: { label: "معوق", variant: "destructive" },
    CANCELED: { label: "لغوشده", variant: "destructive" },
    EXPIRED: { label: "منقضی", variant: "outline" },
    PAUSED: { label: "متوقف", variant: "outline" },
  },
  giftCard: {
    ACTIVE: { label: "فعال", variant: "default" },
    REDEEMED: { label: "استفاده‌شده", variant: "secondary" },
    DISABLED: { label: "غیرفعال", variant: "outline" },
    EXPIRED: { label: "منقضی", variant: "outline" },
  },
  review: {
    PENDING: { label: "در انتظار", variant: "outline" },
    APPROVED: { label: "تأییدشده", variant: "default" },
    REJECTED: { label: "ردشده", variant: "destructive" },
  },
  product: {
    DRAFT: { label: "پیش‌نویس", variant: "outline" },
    ACTIVE: { label: "فعال", variant: "default" },
    DISABLED: { label: "غیرفعال", variant: "secondary" },
    ARCHIVED: { label: "بایگانی", variant: "outline" },
  },
} as const satisfies Record<string, Record<string, Meta>>;

export type StatusKind = keyof typeof STATUS_MAPS;

export function statusMeta(kind: StatusKind, value: string): Meta {
  const map = STATUS_MAPS[kind] as Record<string, Meta>;
  return map[value] ?? { label: value, variant: "outline" };
}

export function StatusChip({ kind, value }: { kind: StatusKind; value: string }) {
  const meta = statusMeta(kind, value);
  return <Badge variant={meta.variant}>{meta.label}</Badge>;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bunx vitest run src/components/admin/kit/status-chip.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/admin/kit/status-chip.tsx src/components/admin/kit/status-chip.test.ts
git commit -m "feat(admin): central StatusChip + status maps"
```

---

### Task 4: Form field components

**Files:**
- Create: `src/components/admin/kit/form-fields.tsx`

**Interfaces:**
- Consumes: `ui/input`, `ui/label`, the `cn` util, `lib/format` (`formatToman`), and the exchange-rate helper `loadExchangeRates`/rate lookup from `@/lib/pricing/exchange` for the MoneyField hint.
- Produces presentational, controlled field components (value + onChange props, NOT bound to a specific form lib so both SheetForm and route editors reuse them):
  - `<FormField label hint error htmlFor>{children}</FormField>`
  - `<TextField id label value onChange ... />`, `<TextareaField ... />`, `<NumberField ... />`
  - `<SelectField id label value onChange options={{value,label}[]} />`
  - `<SwitchRow id label checked onChange />`
  - `<MoneyField id label value onChange currency />` — integer-Toman string value; when `currency!=="IRT"` shows a live "≈ X تومان" hint.
  - `<DateField id label value onChange />` — native `<input type="date">`, Jalali display caption via `Intl.DateTimeFormat("fa-IR")`.

- [ ] **Step 1: Implement the field components**

Build the components above using `ui/*` primitives + `cn`, RTL-aware (labels right-aligned), Persian copy. `MoneyField` parses the digits, and if currency is USD/EUR multiplies by the loaded rate to show a Toman hint via `formatToman`. Keep each component small and controlled.

- [ ] **Step 2: Verify build**

Run: `bun run build`
Expected: compiles, no type errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/admin/kit/form-fields.tsx
git commit -m "feat(admin): reusable form field components (incl. currency-aware MoneyField)"
```

---

### Task 5: ConfirmDialog + useConfirm

**Files:**
- Create: `src/components/admin/kit/confirm-dialog.tsx`

**Interfaces:**
- Consumes: a dialog primitive. If `src/components/ui/dialog.tsx` is absent, add it via `bunx shadcn@latest add dialog` (allowed shadcn CLI) or build a minimal one on the existing `sheet`/Radix dep.
- Produces:
  - `<ConfirmDialog open title description confirmLabel destructive onConfirm onOpenChange />`
  - `useConfirm()` → `{ confirm(opts): Promise<boolean>, dialog: ReactNode }` so callers `await confirm({title})` instead of `window.confirm`.

- [ ] **Step 1: Ensure a dialog primitive exists**

Run: `ls src/components/ui/dialog.tsx || bunx shadcn@latest add dialog`
Expected: `dialog.tsx` present.

- [ ] **Step 2: Implement ConfirmDialog + useConfirm**

Implement the promise-based `useConfirm` hook (stores the resolver in a ref, renders a controlled `ConfirmDialog`) and the presentational `ConfirmDialog`. Persian default labels ("تأیید"/"انصراف"), `destructive` styles the confirm button.

- [ ] **Step 3: Verify build**

Run: `bun run build`
Expected: compiles.

- [ ] **Step 4: Commit**

```bash
git add src/components/admin/kit/confirm-dialog.tsx src/components/ui/dialog.tsx
git commit -m "feat(admin): ConfirmDialog + useConfirm (replaces window.confirm)"
```

---

### Task 6: AdminPage shell

**Files:**
- Create: `src/components/admin/kit/admin-page.tsx`

**Interfaces:**
- Produces: `<AdminPage title subtitle actions>{children}</AdminPage>` — renders the standard header (h1 `text-lg font-black`, subtitle `text-sm text-muted-foreground`, right-aligned `actions` slot) used by `review-management`, then a `space-y-4` content region.

- [ ] **Step 1: Implement**

```tsx
// src/components/admin/kit/admin-page.tsx
export function AdminPage({
  title,
  subtitle,
  actions,
  children,
}: {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-lg font-black">{title}</h1>
          {subtitle ? <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p> : null}
        </div>
        {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
      </div>
      {children}
    </div>
  );
}
```

- [ ] **Step 2: Verify build**

Run: `bun run build`
Expected: compiles.

- [ ] **Step 3: Commit**

```bash
git add src/components/admin/kit/admin-page.tsx
git commit -m "feat(admin): AdminPage shell"
```

---

### Task 7: useAdminList (TanStack Query)

**Files:**
- Create: `src/lib/admin/use-admin-list.ts`
- Test: `src/lib/admin/use-admin-list.test.ts`

**Interfaces:**
- Consumes: `AdminListResponse`, `normalizeListResponse` (Task 1); `@tanstack/react-query` (Task 0).
- Produces:
  - `function buildAdminListUrl(resource: string, filters?: Record<string, string|number|undefined|null>): string` — `/api/admin/<resource>` plus a querystring of defined, non-empty filters (numbers stringified). **Pure, unit-tested.**
  - `function useAdminList<Row>(resource, filters?, opts?: { initialData?, rowsKey?, enabled? }): UseQueryResult<AdminListResponse<Row>>` — `queryKey:[resource, filters]`, fetches `buildAdminListUrl`, unwraps `{ ok, data }`, runs `normalizeListResponse`.

- [ ] **Step 1: Write the failing test (pure URL builder)**

```ts
// src/lib/admin/use-admin-list.test.ts
import { describe, expect, it } from "vitest";
import { buildAdminListUrl } from "./use-admin-list";

describe("buildAdminListUrl", () => {
  it("returns the bare path with no filters", () => {
    expect(buildAdminListUrl("reviews")).toBe("/api/admin/reviews");
  });
  it("appends only defined, non-empty filters", () => {
    expect(buildAdminListUrl("orders", { status: "PAID", q: "", page: 2, x: undefined })).toBe(
      "/api/admin/orders?status=PAID&page=2",
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bunx vitest run src/lib/admin/use-admin-list.test.ts`
Expected: FAIL ("buildAdminListUrl is not a function").

- [ ] **Step 3: Implement**

```ts
// src/lib/admin/use-admin-list.ts
import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { type AdminListResponse, normalizeListResponse } from "./list-response";

export function buildAdminListUrl(
  resource: string,
  filters: Record<string, string | number | undefined | null> = {},
): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value === undefined || value === null || value === "") continue;
    params.set(key, String(value));
  }
  const qs = params.toString();
  return `/api/admin/${resource}${qs ? `?${qs}` : ""}`;
}

export function useAdminList<Row>(
  resource: string,
  filters: Record<string, string | number | undefined | null> = {},
  opts: { initialData?: AdminListResponse<Row>; rowsKey?: string; enabled?: boolean } = {},
): UseQueryResult<AdminListResponse<Row>> {
  return useQuery({
    queryKey: [resource, filters],
    enabled: opts.enabled ?? true,
    initialData: opts.initialData,
    queryFn: async () => {
      const res = await fetch(buildAdminListUrl(resource, filters));
      const json = await res.json();
      const payload = json?.ok ? json.data : json;
      return normalizeListResponse<Row>(payload, { rowsKey: opts.rowsKey });
    },
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bunx vitest run src/lib/admin/use-admin-list.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/admin/use-admin-list.ts src/lib/admin/use-admin-list.test.ts
git commit -m "feat(admin): useAdminList (TanStack Query) + URL builder"
```

---

### Task 8: useAdminMutation (TanStack Query)

**Files:**
- Create: `src/lib/admin/use-admin-mutation.ts`

**Interfaces:**
- Consumes: `@tanstack/react-query`, `sonner`.
- Produces: `function useAdminMutation<TVars>(opts: { url(vars): string; method?: "POST"|"PATCH"|"DELETE"|"PUT"; body?(vars): unknown; invalidate: string[]; successMessage?: string }): UseMutationResult` — performs the fetch, throws on `!ok` with the API error message, toasts success/error, and `invalidateQueries` for each resource in `invalidate`.

- [ ] **Step 1: Implement**

```ts
// src/lib/admin/use-admin-mutation.ts
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

export function useAdminMutation<TVars = void>(opts: {
  url: (vars: TVars) => string;
  method?: "POST" | "PATCH" | "DELETE" | "PUT";
  body?: (vars: TVars) => unknown;
  invalidate: string[];
  successMessage?: string;
}) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vars: TVars) => {
      const init: RequestInit = { method: opts.method ?? "POST" };
      if (opts.body) {
        init.headers = { "Content-Type": "application/json" };
        init.body = JSON.stringify(opts.body(vars));
      }
      const res = await fetch(opts.url(vars), init);
      const json = await res.json().catch(() => ({}));
      if (!res.ok || json?.ok === false) {
        throw new Error(json?.error?.message ?? "عملیات انجام نشد.");
      }
      return json?.data ?? json;
    },
    onSuccess: () => {
      if (opts.successMessage) toast.success(opts.successMessage);
      for (const key of opts.invalidate) qc.invalidateQueries({ queryKey: [key] });
    },
    onError: (err: Error) => toast.error(err.message),
  });
}
```

- [ ] **Step 2: Verify build**

Run: `bun run build`
Expected: compiles.

- [ ] **Step 3: Commit**

```bash
git add src/lib/admin/use-admin-mutation.ts
git commit -m "feat(admin): useAdminMutation (write + invalidate + toast)"
```

---

### Task 9: DataTable (TanStack Table + Virtual)

**Files:**
- Create: `src/components/admin/kit/data-table.tsx`

**Interfaces:**
- Consumes: `@tanstack/react-table`, `@tanstack/react-virtual`, `ui/*`, `lib/format` (`toFaNumber`), `AdminPagination` (Task 1).
- Produces:
  - re-export `type ColumnDef` from react-table for callers.
  - `<DataTable columns data loading empty pagination onPageChange rowActions virtualizeOver={50} />` — headless `useReactTable` (core + sorted models), RTL header/cells, Persian-digit pagination footer using `pagination` + `onPageChange`, loading/empty states matching the current `review-management` look (`rounded-2xl border bg-card`, spinner, empty copy), optional `rowActions(row): ReactNode` rendered in a trailing cell. When `data.length > virtualizeOver`, wrap rows with `@tanstack/react-virtual`.

- [ ] **Step 1: Implement DataTable**

Build the component per the interface. Keep sorting client-side via `getSortedRowModel`; pagination is server-driven (controlled by `pagination`+`onPageChange`). Use `flexRender` for headers/cells.

- [ ] **Step 2: Verify build**

Run: `bun run build`
Expected: compiles.

- [ ] **Step 3: Commit**

```bash
git add src/components/admin/kit/data-table.tsx
git commit -m "feat(admin): DataTable on TanStack Table + Virtual"
```

---

### Task 10: SheetForm (TanStack Form)

**Files:**
- Create: `src/components/admin/kit/sheet-form.tsx`

**Interfaces:**
- Consumes: `ui/sheet`, `@tanstack/react-form`, `form-fields` (Task 4), `useAdminMutation` (Task 8).
- Produces:
  - `<SheetForm open onOpenChange title submitLabel form>{fields}</SheetForm>` — renders a right-side `Sheet` containing a `<form>` that calls `form.handleSubmit()`, a footer with submit (busy state from `form.state.isSubmitting`) + cancel.
  - `useAdminForm<Values>({ defaultValues, mutation, toValues? })` helper wrapping `useForm` whose `onSubmit` calls the provided `useAdminMutation` and closes on success. (Thin; callers may also use `useForm` directly.)

- [ ] **Step 1: Implement SheetForm + useAdminForm**

Build per interface; field children are the Task 4 components bound via `form.Field`. Persian labels; RTL.

- [ ] **Step 2: Verify build**

Run: `bun run build`
Expected: compiles.

- [ ] **Step 3: Commit**

```bash
git add src/components/admin/kit/sheet-form.tsx
git commit -m "feat(admin): SheetForm on TanStack Form"
```

---

### Task 11: Kit barrel + usage README

**Files:**
- Create: `src/components/admin/kit/index.ts`
- Create: `src/components/admin/kit/README.md`

**Interfaces:**
- Produces: barrel re-exporting `AdminPage`, `DataTable`, `ColumnDef`, `StatusChip`, `statusMeta`, `ConfirmDialog`, `useConfirm`, `SheetForm`, `useAdminForm`, and all field components.

- [ ] **Step 1: Write the barrel**

Re-export every public symbol from the kit files.

- [ ] **Step 2: Write README.md**

Short usage doc: the page pattern (`requireAdmin` in `page.tsx` → fetch initial → pass to island), `useAdminList`/`useAdminMutation` examples, a `DataTable` columns example, and a `SheetForm` example. Reference the migrated Reviews/Coupons pages as canonical examples.

- [ ] **Step 3: Verify build + commit**

```bash
bun run build
git add src/components/admin/kit/index.ts src/components/admin/kit/README.md
git commit -m "docs(admin): kit barrel + usage README"
```

---

### Task 12: Migrate Reviews onto the kit

**Files:**
- Modify: `src/app/admin/reviews/page.tsx` (use `requireAdmin`)
- Rewrite: `src/components/admin/review-management.tsx` (use kit)

**Interfaces:**
- Consumes: `requireAdmin`, `AdminPage`, `DataTable`, `StatusChip`, `useAdminList`, `useAdminMutation`, `useConfirm`, `StatTabs`/`FilterBar` (count tabs).
- Produces: no API change. Same behavior: PENDING/APPROVED/REJECTED/ALL count tabs, approve/reject row actions, delete with confirm.

- [ ] **Step 1: Update the page to use requireAdmin**

Replace the inline auth block with `await requireAdmin("/admin/reviews")`; keep `listReviews()` initial fetch and pass as `initialData`.

- [ ] **Step 2: Rewrite the island on the kit**

Use `useAdminList("reviews", { status }, { initialData, rowsKey: "reviews" })`, `useAdminMutation` for PATCH status + DELETE (invalidate `["reviews"]`), `useConfirm()` for delete, `DataTable` (or the existing list layout via kit) with `StatusChip kind="review"`, count tabs from `data.counts`. Remove the manual `refresh()`/`useEffect` plumbing.

- [ ] **Step 3: Verify build + tests**

Run: `bun run build && bunx vitest run` 
Expected: compiles; full suite green (reviews API tests unchanged).

- [ ] **Step 4: Verify in preview**

Start/refresh preview, open `/admin/reviews`: tabs filter, approve/reject/delete work, RTL + Persian digits intact, confirm dialog replaces `window.confirm`. Capture a screenshot.

- [ ] **Step 5: Commit**

```bash
git add src/app/admin/reviews/page.tsx src/components/admin/review-management.tsx
git commit -m "refactor(admin): migrate Reviews onto the UI kit (Query + DataTable)"
```

---

### Task 13: Migrate Coupons onto the kit

**Files:**
- Modify: `src/app/admin/coupons/page.tsx` (use `requireAdmin`)
- Rewrite: `src/components/admin/coupon-management.tsx` (use kit)

**Interfaces:**
- Consumes: `requireAdmin`, `AdminPage`, `DataTable`, `StatusChip` (none needed; coupons use isActive), `useAdminList`, `useAdminMutation`, `SheetForm`/`useAdminForm`, field components, `useConfirm`.
- Produces: no API change. Same behavior on **existing** coupon fields only (code, kind, value, minSubtotal, maxDiscount, usageLimit, startsAt, expiresAt, isActive). **Do NOT add depth fields** (perUserLimit/scoping/etc.) — those are Wave 3.

- [ ] **Step 1: Update the page to use requireAdmin** and pass initial data as `initialData`.

- [ ] **Step 2: Rewrite the island on the kit**

`useAdminList("coupons", filters, { initialData })`; `DataTable` listing coupons with `MoneyField`-formatted value/min/max columns; create/edit via `SheetForm` + field components bound to `useAdminForm` → `useAdminMutation` (POST `/api/admin/coupons`, PATCH `/api/admin/coupons/[id]`, invalidate `["coupons"]`); delete via `useConfirm` + DELETE. Map only existing fields.

- [ ] **Step 3: Verify build + tests**

Run: `bun run build && bunx vitest run`
Expected: compiles; suite green.

- [ ] **Step 4: Verify in preview**

Open `/admin/coupons`: list renders, create via Sheet, edit via Sheet, delete via confirm, validation errors surface. Capture a screenshot.

- [ ] **Step 5: Commit**

```bash
git add src/app/admin/coupons/page.tsx src/components/admin/coupon-management.tsx
git commit -m "refactor(admin): migrate Coupons onto the UI kit (Query + SheetForm)"
```

---

### Task 14: Regroup the admin sidebar

**Files:**
- Modify: `src/components/admin/admin-sidebar.tsx`

**Interfaces:**
- Produces: sidebar grouped Catalog / Sales / Customers / Content / Comms / Insights / Settings. Existing routes only; no new links yet (later waves add Shipping/Refunds/Tax). Independent of the kit.

- [ ] **Step 1: Read the current sidebar** and regroup the existing items under the new section headings, preserving every existing href and icon.

- [ ] **Step 2: Verify build + preview**

Run: `bun run build`; open any `/admin` page and confirm the grouped nav renders (RTL).

- [ ] **Step 3: Commit**

```bash
git add src/components/admin/admin-sidebar.tsx
git commit -m "refactor(admin): regroup sidebar into Catalog/Sales/Customers/Content/Comms/Insights/Settings"
```

---

## Self-Review

**Spec coverage:** kit files (Tasks 3–11) ↔ spec §Architecture; TanStack Query/Table/Form/Virtual (Tasks 0,7,8,9,10) ↔ spec §TanStack adoption; `requireAdmin`+shell+sidebar (Tasks 2,6,14) ↔ spec §Shell/IA; reference migrations (Tasks 12,13) ↔ spec §Reference migrations; tests (Tasks 1,3,7) ↔ spec §Testing; list-response convention (Task 1) ↔ spec §Data layer. Non-goals respected (no depth fields, no new features). All covered.

**Placeholder scan:** logic tasks carry full code + tests; presentational tasks carry interfaces + key code + build/preview verification (justified by the repo's node-only Vitest — no component DOM tests, per Global Constraints). No "TBD/handle edge cases" left.

**Type consistency:** `AdminListResponse`/`AdminPagination` defined in Task 1 and consumed by Tasks 7/9; `statusMeta`/`StatusKind` Task 3 → Tasks 12/13; `useAdminList(resource, filters, opts)` and `useAdminMutation({url,method,body,invalidate})` signatures stable across Tasks 7/8/12/13; `buildAdminListUrl` name consistent. Consistent.
