"use client";

import { MoreHorizontal, Plus } from "lucide-react";
import { useState } from "react";
import {
  AdminPage,
  type ColumnDef,
  DataTable,
  DateField,
  MoneyField,
  NumberField,
  SelectField,
  SheetForm,
  SwitchRow,
  TextField,
  useAdminForm,
  useConfirm,
} from "@/components/admin/kit";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { AdminCouponOption } from "@/lib/admin/coupons";
import type { AdminListResponse } from "@/lib/admin/list-response";
import { useAdminList } from "@/lib/admin/use-admin-list";
import { useAdminMutation } from "@/lib/admin/use-admin-mutation";
import { formatToman, toFaNumber } from "@/lib/format";

// ─── Types ────────────────────────────────────────────────────────────────────

type CouponKind = "PERCENT" | "FIXED";

type CouponFormValues = {
  code: string;
  kind: CouponKind;
  value: string;
  minSubtotalAmount: string;
  maxDiscountAmount: string;
  usageLimit: string;
  startsAt: string;
  expiresAt: string;
  isActive: boolean;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const FA_DATE = new Intl.DateTimeFormat("fa-IR", {
  dateStyle: "short",
});

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? "—" : FA_DATE.format(date);
}

/** ISO timestamp → "YYYY-MM-DD" for a date input. */
function toDateInput(iso: string | null | undefined): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** "YYYY-MM-DD" → ISO string or null when empty. */
function fromDateInput(value: string): string | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function formatValue(coupon: AdminCouponOption): string {
  if (coupon.kind === "PERCENT") {
    return `${toFaNumber(coupon.value)}٪`;
  }
  return formatToman(coupon.value);
}

function couponStatusLabel(coupon: AdminCouponOption): string {
  if (!coupon.isActive) return "غیرفعال";
  const now = Date.now();
  if (coupon.expiresAt && new Date(coupon.expiresAt).getTime() <= now) return "منقضی";
  if (coupon.startsAt && new Date(coupon.startsAt).getTime() > now) return "زمان‌بندی‌شده";
  if (coupon.usageLimit != null && coupon.usedCount >= coupon.usageLimit) return "تمام‌شده";
  return "فعال";
}

function defaultsFromCoupon(coupon: AdminCouponOption): CouponFormValues {
  return {
    code: coupon.code,
    kind: coupon.kind as CouponKind,
    value: coupon.value,
    minSubtotalAmount: coupon.minSubtotalAmount ?? "",
    maxDiscountAmount: coupon.maxDiscountAmount ?? "",
    usageLimit: coupon.usageLimit != null ? String(coupon.usageLimit) : "",
    startsAt: toDateInput(coupon.startsAt),
    expiresAt: toDateInput(coupon.expiresAt),
    isActive: coupon.isActive,
  };
}

const EMPTY_FORM: CouponFormValues = {
  code: "",
  kind: "PERCENT",
  value: "",
  minSubtotalAmount: "",
  maxDiscountAmount: "",
  usageLimit: "",
  startsAt: "",
  expiresAt: "",
  isActive: true,
};

// ─── Mutation body transform ───────────────────────────────────────────────────

function toPayload(v: CouponFormValues) {
  return {
    code: v.code,
    kind: v.kind,
    value: v.value,
    minSubtotalAmount: v.minSubtotalAmount.trim() || null,
    maxDiscountAmount: v.maxDiscountAmount.trim() || null,
    usageLimit: v.usageLimit.trim() || null,
    startsAt: fromDateInput(v.startsAt),
    expiresAt: fromDateInput(v.expiresAt),
    isActive: v.isActive,
  };
}

// ─── CouponSheet ──────────────────────────────────────────────────────────────

function CouponSheet({
  open,
  onOpenChange,
  coupon,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  coupon?: AdminCouponOption;
}) {
  const mutation = useAdminMutation<CouponFormValues>({
    url: () => (coupon ? `/api/admin/coupons/${coupon.id}` : "/api/admin/coupons"),
    method: coupon ? "PATCH" : "POST",
    body: toPayload,
    invalidate: ["coupons"],
    successMessage: coupon ? "کد تخفیف به‌روزرسانی شد." : "کد تخفیف ساخته شد.",
  });

  const form = useAdminForm<CouponFormValues>({
    defaultValues: coupon ? defaultsFromCoupon(coupon) : EMPTY_FORM,
    mutation,
    onSuccess: () => onOpenChange(false),
  });

  return (
    <SheetForm
      open={open}
      onOpenChange={onOpenChange}
      title={coupon ? "ویرایش کد تخفیف" : "کد تخفیف جدید"}
      form={form}
    >
      <form.Field name="code">
        {(field) => (
          <TextField
            id="code"
            label="کد تخفیف"
            value={field.state.value}
            onChange={(v) => field.handleChange(v.toUpperCase())}
            placeholder="WELCOME20"
            error={field.state.meta.errors[0] as string | undefined}
          />
        )}
      </form.Field>

      <form.Field name="kind">
        {(field) => (
          <SelectField
            id="kind"
            label="نوع تخفیف"
            value={field.state.value}
            onChange={(v) => field.handleChange(v as CouponKind)}
            options={[
              { value: "PERCENT", label: "درصدی" },
              { value: "FIXED", label: "مبلغ ثابت (تومان)" },
            ]}
            error={field.state.meta.errors[0] as string | undefined}
          />
        )}
      </form.Field>

      <form.Field name="value">
        {(field) => (
          <NumberField
            id="value"
            label="مقدار تخفیف"
            value={field.state.value}
            onChange={field.handleChange}
            placeholder="0"
            min={0}
            error={field.state.meta.errors[0] as string | undefined}
          />
        )}
      </form.Field>

      <form.Field name="minSubtotalAmount">
        {(field) => (
          <MoneyField
            id="minSubtotalAmount"
            label="حداقل مبلغ سبد (تومان)"
            value={field.state.value}
            onChange={field.handleChange}
            currency="IRT"
            error={field.state.meta.errors[0] as string | undefined}
          />
        )}
      </form.Field>

      <form.Field name="maxDiscountAmount">
        {(field) => (
          <MoneyField
            id="maxDiscountAmount"
            label="سقف تخفیف (تومان)"
            value={field.state.value}
            onChange={field.handleChange}
            currency="IRT"
            error={field.state.meta.errors[0] as string | undefined}
          />
        )}
      </form.Field>

      <form.Field name="usageLimit">
        {(field) => (
          <NumberField
            id="usageLimit"
            label="سقف تعداد استفاده"
            value={field.state.value}
            onChange={field.handleChange}
            placeholder="نامحدود"
            min={0}
            error={field.state.meta.errors[0] as string | undefined}
          />
        )}
      </form.Field>

      <form.Field name="startsAt">
        {(field) => (
          <DateField
            id="startsAt"
            label="شروع اعتبار"
            value={field.state.value}
            onChange={field.handleChange}
            hint="اختیاری"
            error={field.state.meta.errors[0] as string | undefined}
          />
        )}
      </form.Field>

      <form.Field name="expiresAt">
        {(field) => (
          <DateField
            id="expiresAt"
            label="پایان اعتبار"
            value={field.state.value}
            onChange={field.handleChange}
            hint="اختیاری"
            error={field.state.meta.errors[0] as string | undefined}
          />
        )}
      </form.Field>

      <form.Field name="isActive">
        {(field) => (
          <SwitchRow
            id="isActive"
            label="فعال باشد"
            checked={field.state.value}
            onChange={field.handleChange}
          />
        )}
      </form.Field>
    </SheetForm>
  );
}

// ─── Row action menu ───────────────────────────────────────────────────────────

function CouponRowMenu({
  coupon,
  onEdit,
  onToggleActive,
  onDelete,
}: {
  coupon: AdminCouponOption;
  onEdit: (coupon: AdminCouponOption) => void;
  onToggleActive: (coupon: AdminCouponOption) => void;
  onDelete: (coupon: AdminCouponOption) => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label="عملیات"
        className="inline-flex size-8 items-center justify-center rounded-xl text-foreground/70 transition hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <MoreHorizontal className="size-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" dir="rtl">
        <DropdownMenuItem onClick={() => onEdit(coupon)}>ویرایش</DropdownMenuItem>
        <DropdownMenuItem onClick={() => onToggleActive(coupon)}>
          {coupon.isActive ? "غیرفعال‌سازی" : "فعال‌سازی"}
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => onDelete(coupon)}
          className="text-destructive focus:text-destructive"
        >
          حذف
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// ─── CouponManagement ─────────────────────────────────────────────────────────

export function CouponManagement({
  initialData,
}: {
  initialData: AdminListResponse<AdminCouponOption>;
}) {
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editCoupon, setEditCoupon] = useState<AdminCouponOption | undefined>(undefined);

  const { confirm, dialog } = useConfirm();

  const result = useAdminList<AdminCouponOption>(
    "coupons",
    {},
    {
      initialData,
      rowsKey: "coupons",
    },
  );

  const rows = result.data?.rows ?? [];

  const deleteMutation = useAdminMutation<{ id: string }>({
    url: (vars) => `/api/admin/coupons/${vars.id}`,
    method: "DELETE",
    invalidate: ["coupons"],
    successMessage: "کد تخفیف حذف شد.",
  });

  const toggleActiveMutation = useAdminMutation<{ id: string; isActive: boolean }>({
    url: (vars) => `/api/admin/coupons/${vars.id}`,
    method: "PATCH",
    body: (vars) => ({ isActive: vars.isActive }),
    invalidate: ["coupons"],
    successMessage: "وضعیت کد تخفیف به‌روزرسانی شد.",
  });

  function handleToggleActive(coupon: AdminCouponOption) {
    toggleActiveMutation.mutate({ id: coupon.id, isActive: !coupon.isActive });
  }

  function openCreate() {
    setEditCoupon(undefined);
    setSheetOpen(true);
  }

  function openEdit(coupon: AdminCouponOption) {
    setEditCoupon(coupon);
    setSheetOpen(true);
  }

  async function handleDelete(coupon: AdminCouponOption) {
    const confirmed = await confirm({
      title: "حذف کد تخفیف",
      description: `کد «${coupon.code}» برای همیشه حذف شود؟ این عمل قابل بازگشت نیست.`,
      confirmLabel: "حذف",
      cancelLabel: "لغو",
      destructive: true,
    });
    if (confirmed) {
      await deleteMutation.mutateAsync({ id: coupon.id });
    }
  }

  const columns: ColumnDef<AdminCouponOption>[] = [
    {
      accessorKey: "code",
      header: "کد",
      cell: (info) => (
        <span className="font-mono font-bold" dir="ltr">
          {info.getValue<string>()}
        </span>
      ),
    },
    {
      accessorKey: "kind",
      header: "نوع",
      meta: { align: "center" },
      cell: (info) => (info.getValue<string>() === "PERCENT" ? "درصدی" : "مبلغ ثابت"),
    },
    {
      id: "value",
      header: "مقدار",
      cell: (info) => formatValue(info.row.original),
    },
    {
      id: "min_max",
      header: "حداقل / سقف",
      cell: (info) => {
        const { minSubtotalAmount, maxDiscountAmount } = info.row.original;
        return (
          <div className="text-xs text-muted-foreground space-y-0.5">
            <div>حداقل: {minSubtotalAmount ? formatToman(minSubtotalAmount) : "—"}</div>
            <div>سقف: {maxDiscountAmount ? formatToman(maxDiscountAmount) : "—"}</div>
          </div>
        );
      },
    },
    {
      id: "usage",
      header: "استفاده",
      meta: { align: "center" },
      cell: (info) => {
        const { usedCount, usageLimit } = info.row.original;
        return (
          <span className="text-xs">
            {usageLimit != null
              ? `${toFaNumber(usedCount)} از ${toFaNumber(usageLimit)}`
              : `${toFaNumber(usedCount)} بار`}
          </span>
        );
      },
    },
    {
      id: "validity",
      header: "بازه اعتبار",
      cell: (info) => {
        const { startsAt, expiresAt } = info.row.original;
        return (
          <div className="text-xs text-muted-foreground space-y-0.5">
            <div>از: {formatDate(startsAt)}</div>
            <div>تا: {formatDate(expiresAt)}</div>
          </div>
        );
      },
    },
    {
      id: "status",
      header: "وضعیت",
      meta: { align: "center" },
      cell: (info) => {
        const label = couponStatusLabel(info.row.original);
        return <span className="text-xs font-medium">{label}</span>;
      },
    },
  ];

  return (
    <AdminPage
      title="کدهای تخفیف"
      subtitle={`${toFaNumber(rows.length)} کد ثبت‌شده`}
      actions={
        <Button type="button" onClick={openCreate}>
          <Plus className="size-4" />
          کد تخفیف جدید
        </Button>
      }
    >
      <DataTable
        columns={columns}
        data={rows}
        loading={result.isLoading}
        empty="هنوز کد تخفیفی ثبت نشده است."
        rowActions={(coupon) => (
          <CouponRowMenu
            coupon={coupon}
            onEdit={openEdit}
            onToggleActive={handleToggleActive}
            onDelete={handleDelete}
          />
        )}
      />

      {/* key forces a fresh form instance per target, so a touched-but-unsaved
          edit never leaks its values into the next coupon opened. */}
      <CouponSheet
        key={editCoupon?.id ?? "new"}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        coupon={editCoupon}
      />

      {dialog}
    </AdminPage>
  );
}
