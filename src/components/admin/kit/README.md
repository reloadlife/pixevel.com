# Admin UI Kit

A Persian-first, RTL-aware component library for building admin pages. All kit components are re-exported from `src/components/admin/kit/index.ts`.

## Page Pattern

Admin pages follow a server-render → client-island pattern:

1. **Server component** (`page.tsx`):
   ```tsx
   import { requireAdmin } from "@/lib/admin/guard";
   import { getDb } from "@/lib/db";
   import type { AdminListResponse } from "@/lib/admin/list-response";

   export default async function ReviewsPage() {
     // Enforce admin access at the server level.
     await requireAdmin();

     // Fetch initial data server-side for SEO and first-paint.
     const db = getDb();
     const rawReviews = await db.query.reviews.findMany({ limit: 20, offset: 0 });

     const initialData: AdminListResponse<Review> = {
       rows: rawReviews,
       pagination: { page: 1, pageSize: 20, total: rawReviews.length, totalPages: 1 },
     };

     // Pass initial data to client island.
     return <ReviewsClient initialData={initialData} />;
   }
   ```

2. **Client component** (`reviews-client.tsx`):
   - Imports `useAdminList` and `useAdminMutation`.
   - Manages pagination, sorting, and mutations client-side.
   - Renders `AdminPage` with `DataTable` and optional `SheetForm`.

## useAdminList + useAdminMutation

Both hooks live in `src/lib/admin/` and are **not** re-exported from the kit barrel.

### useAdminList

Manages paginated list fetching. Returns a react-query `UseQueryResult`.

```tsx
import { useAdminList } from "@/lib/admin/use-admin-list";
import type { AdminListResponse } from "@/lib/admin/list-response";

// Signature:
// useAdminList<Row>(
//   resource: string,
//   filters?: Record<string, string | number | undefined | null>,
//   opts?: { initialData?: AdminListResponse<Row>; rowsKey?: string; enabled?: boolean }
// ): UseQueryResult<AdminListResponse<Row>>

const [page, setPage] = useState(1);
const [status, setStatus] = useState<string | undefined>(undefined);

const result = useAdminList<Review>(
  "reviews",
  { page, status },
  { initialData },          // optional — pass server-fetched data for first paint
);

// Access data:
const rows = result.data?.rows ?? [];
const pagination = result.data?.pagination;
const isLoading = result.isLoading;

// Trigger a manual refetch (e.g. after a mutation):
result.refetch();
```

### useAdminMutation

Wraps react-query mutations. `url` is a **function** that receives the mutation vars and returns the URL string. `invalidate` is **required**.

```tsx
import { useAdminMutation } from "@/lib/admin/use-admin-mutation";

// Signature:
// useAdminMutation<TVars>({
//   url: (vars: TVars) => string,   // FUNCTION — not a plain string
//   method?: "POST" | "PATCH" | "DELETE" | "PUT",
//   body?: (vars: TVars) => unknown, // optional body transform; defaults to sending vars as JSON
//   invalidate: string[],            // REQUIRED — query keys to invalidate on success
//   successMessage?: string,         // optional toast shown on success
// })

const approveMutation = useAdminMutation<{ id: string; status: string }>({
  url: (vars) => `/api/admin/reviews/${vars.id}`,  // url is a function
  method: "PATCH",
  body: (vars) => ({ status: vars.status }),       // send only the API's fields (not id)
  invalidate: ["reviews"],                          // required
  successMessage: "نظر با موفقیت به‌روز شد.",
});

// To trigger:
await approveMutation.mutateAsync({ id: review.id, status: "APPROVED" });
```

There is **no** `onSuccess` prop on `useAdminMutation`. For side-effects after success:
- Pass `successMessage` (string) for a toast notification.
- Use `useAdminForm`'s `onSuccess` callback when the mutation is driven by a form.

## DataTable

A sortable, virtualized table component.

### Columns Example

```tsx
import { DataTable, type ColumnDef, StatusChip } from "@/components/admin/kit";

interface Review {
  id: string;
  content: string;
  rating: number;
  status: "PENDING" | "APPROVED" | "REJECTED";
}

const columns: ColumnDef<Review>[] = [
  {
    accessorKey: "id",
    header: "شناسه",
    meta: { align: "center" },   // optional: "center" | "end" alignment
  },
  {
    accessorKey: "content",
    header: "متن",
    // columns share width evenly (flex-1)
  },
  {
    accessorKey: "rating",
    header: "امتیاز",
    meta: { align: "center" },
    cell: (info) => info.getValue<number>(),
  },
  {
    accessorKey: "status",
    header: "وضعیت",
    meta: { align: "center" },
    cell: (info) => (
      <StatusChip kind="review" value={info.getValue<string>()} />
    ),
  },
];

// In render:
<DataTable
  columns={columns}
  data={rows}
  loading={result.isLoading}
  pagination={result.data?.pagination}
  onPageChange={setPage}
  rowActions={(review) => (
    <ReviewRowMenu review={review} onSuccess={() => result.refetch()} />
  )}
/>
```

### Controlled Sorting

Pass `sorting` and `onSortingChange` to control sorting state externally (e.g. for server-side sort):

```tsx
import { type SortingState } from "@tanstack/react-table";
import { DataTable } from "@/components/admin/kit";

const [sorting, setSorting] = useState<SortingState>([]);

<DataTable
  columns={columns}
  data={rows}
  sorting={sorting}
  onSortingChange={setSorting}
  loading={result.isLoading}
  pagination={result.data?.pagination}
  onPageChange={setPage}
/>
```

When `sorting`/`onSortingChange` are omitted, the table manages sorting internally.

## SheetForm + useAdminForm

A right-side drawer form for create/edit operations.

### Example

```tsx
import {
  SheetForm,
  useAdminForm,
  TextField,
  SelectField,
  MoneyField,
} from "@/components/admin/kit";
import { useAdminMutation } from "@/lib/admin/use-admin-mutation";

interface CouponForm {
  code: string;
  discountPercent: number;
  type: "PERCENT" | "FIXED";
  currency: "IRT" | "USD" | "EUR";
}

export function CouponSheet({
  open,
  onOpenChange,
  coupon,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  coupon?: Coupon;
}) {
  const mutation = useAdminMutation<CouponForm>({
    url: (vars) =>                                             // url is a function
      coupon ? `/api/admin/coupons/${coupon.id}` : "/api/admin/coupons",
    method: coupon ? "PATCH" : "POST",
    invalidate: ["coupons"],                                   // required
    successMessage: "کوپن ذخیره شد.",
  });

  const form = useAdminForm({
    defaultValues: {
      code: coupon?.code ?? "",
      discountPercent: coupon?.discountPercent ?? 0,
      type: coupon?.type ?? "PERCENT",
      currency: coupon?.currency ?? "IRT",
    },
    mutation,
    onSuccess: () => onOpenChange(false),                      // close sheet after save
  });

  return (
    <SheetForm
      open={open}
      onOpenChange={onOpenChange}
      title={coupon ? "ویرایش کوپن" : "کوپن جدید"}
      form={form}
    >
      <form.Field name="code">
        {(field) => (
          <TextField
            id="code"
            label="کد"
            value={field.state.value}
            onChange={field.handleChange}
            error={field.state.meta.errors?.[0]}
            placeholder="مثال: SUMMER20"
          />
        )}
      </form.Field>

      <form.Field name="discountPercent">
        {(field) => (
          <NumberField
            id="discount"
            label="درصد تخفیف"
            value={field.state.value}
            onChange={field.handleChange}
            error={field.state.meta.errors?.[0]}
            min={0}
            max={100}
          />
        )}
      </form.Field>

      <form.Field name="type">
        {(field) => (
          <SelectField
            id="type"
            label="نوع"
            value={field.state.value}
            onChange={field.handleChange}
            options={[
              { value: "PERCENT", label: "درصد" },
              { value: "FIXED", label: "مبلغ ثابت" },
            ]}
            error={field.state.meta.errors?.[0]}
          />
        )}
      </form.Field>

      <form.Field name="currency">
        {(field) => (
          <MoneyField
            id="currency"
            label="ارز"
            value={field.state.value}
            onChange={field.handleChange}
            currency={field.state.value as "IRT" | "USD" | "EUR"}
            error={field.state.meta.errors?.[0]}
          />
        )}
      </form.Field>
    </SheetForm>
  );
}
```

## Canonical Examples

Refer to the migrated pages for real-world usage:

- **Reviews admin** → `/admin/reviews` — list with status chips, mutations, edit sheet.
- **Coupons admin** → `/admin/coupons` — form fields, money field, currency awareness.

## Form Fields Reference

- **FormField** — wrapper for label + hints + errors.
- **TextField** — single-line text input (RTL-aware).
- **TextareaField** — multi-line text (Persian-first, 3 rows default).
- **NumberField** — numeric input (LTR, left-aligned).
- **SelectField** — dropdown select (RTL-aware).
- **SwitchRow** — toggle switch with label and hint.
- **MoneyField** — numeric input with currency symbol and live Toman preview (when USD/EUR).
- **DateField** — date picker with Jalali (Persian) calendar caption.

## Status Chips

The `StatusChip` component and `STATUS_MAPS` constant provide color-coded status display:

```tsx
import { StatusChip, STATUS_MAPS } from "@/components/admin/kit";

// Predefined kinds: "order", "payment", "shipment", "refund", "subscription", "giftCard", "review", "product"
<StatusChip kind="review" value="APPROVED" />

// Custom status lookup:
import { statusMeta } from "@/components/admin/kit";
const meta = statusMeta("review", "PENDING");
// => { label: "در انتظار", variant: "outline" }
```

## Confirm Dialog

Imperative confirmation with promise-based API:

```tsx
import { useConfirm } from "@/components/admin/kit";

const { confirm, dialog } = useConfirm();

async function handleDelete() {
  const confirmed = await confirm({
    title: "حذف کوپن",
    description: "این عمل قابل برگشت نیست.",
    confirmLabel: "حذف",
    cancelLabel: "لغو",
    destructive: true,
  });

  if (confirmed) {
    await mutation.mutateAsync({ action: "delete" });
  }
}

// In JSX:
<>
  <button onClick={handleDelete}>حذف</button>
  {dialog}
</>
```

## API Response Contract

The kit expects list APIs to return `AdminListResponse` from `src/lib/admin/list-response.ts`:

```ts
interface AdminListResponse<Row> {
  rows: Row[];           // field is `rows`, not `data`
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
  counts?: Record<string, number>;  // optional per-status counts
}
```

Mutations expect a `200` or `201` status on success; errors are handled by the mutation hook.
