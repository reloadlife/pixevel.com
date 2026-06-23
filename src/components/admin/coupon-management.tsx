"use client";

import { ChevronDown, ChevronUp, MoreHorizontal, Plus } from "lucide-react";
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
  TextareaField,
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
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import type { CouponRedemptionRow } from "@/lib/admin/coupon-redemptions";
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
  // depth fields
  perUserLimit: string;
  individualUse: boolean;
  excludeSaleItems: boolean;
  freeShipping: boolean;
  emailRestrictions: string;
  includeProductIds: string;
  excludeProductIds: string;
  includeCategoryIds: string;
  excludeCategoryIds: string;
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

/** string[] | null → comma-separated string for textarea. */
function arrayToText(arr: string[] | null | undefined): string {
  if (!arr || arr.length === 0) return "";
  return arr.join("\n");
}

/** textarea string → string[] | null (splits on comma or newline, trims, filters). */
function textToArray(text: string): string[] | null {
  const items = text
    .split(/[\n,]+/)
    .map((s) => s.trim())
    .filter(Boolean);
  return items.length > 0 ? items : null;
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
    perUserLimit: coupon.perUserLimit != null ? String(coupon.perUserLimit) : "",
    individualUse: coupon.individualUse ?? false,
    excludeSaleItems: coupon.excludeSaleItems ?? false,
    freeShipping: coupon.freeShipping ?? false,
    emailRestrictions: arrayToText(coupon.emailRestrictions),
    includeProductIds: arrayToText(coupon.includeProductIds),
    excludeProductIds: arrayToText(coupon.excludeProductIds),
    includeCategoryIds: arrayToText(coupon.includeCategoryIds),
    excludeCategoryIds: arrayToText(coupon.excludeCategoryIds),
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
  perUserLimit: "",
  individualUse: false,
  excludeSaleItems: false,
  freeShipping: false,
  emailRestrictions: "",
  includeProductIds: "",
  excludeProductIds: "",
  includeCategoryIds: "",
  excludeCategoryIds: "",
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
    perUserLimit: v.perUserLimit.trim() || null,
    individualUse: v.individualUse,
    excludeSaleItems: v.excludeSaleItems,
    freeShipping: v.freeShipping,
    emailRestrictions: textToArray(v.emailRestrictions),
    includeProductIds: textToArray(v.includeProductIds),
    excludeProductIds: textToArray(v.excludeProductIds),
    includeCategoryIds: textToArray(v.includeCategoryIds),
    excludeCategoryIds: textToArray(v.excludeCategoryIds),
  };
}

// ─── DepthSection (collapsible) ───────────────────────────────────────────────

function DepthSection({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-2xl border border-border/60 overflow-hidden" dir="rtl">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between px-3 py-2.5 text-sm font-medium text-right hover:bg-muted/50 transition-colors"
      >
        <span>محدودیت‌ها و دامنه</span>
        {open ? (
          <ChevronUp className="size-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="size-4 text-muted-foreground" />
        )}
      </button>
      {open ? (
        <div className="flex flex-col gap-4 p-3 border-t border-border/60">{children}</div>
      ) : null}
    </div>
  );
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

      {/* ── Depth / scope section ─────────────────────────────────────── */}
      <DepthSection>
        <form.Field name="perUserLimit">
          {(field) => (
            <NumberField
              id="perUserLimit"
              label="سقف استفاده هر کاربر"
              value={field.state.value}
              onChange={field.handleChange}
              placeholder="نامحدود"
              min={0}
              error={field.state.meta.errors[0] as string | undefined}
            />
          )}
        </form.Field>

        <form.Field name="individualUse">
          {(field) => (
            <SwitchRow
              id="individualUse"
              label="استفاده انفرادی"
              hint="این کد نمی‌تواند با کدهای دیگر ترکیب شود"
              checked={field.state.value}
              onChange={field.handleChange}
            />
          )}
        </form.Field>

        <form.Field name="excludeSaleItems">
          {(field) => (
            <SwitchRow
              id="excludeSaleItems"
              label="محصولات تخفیف‌دار را حذف کن"
              hint="تخفیف روی محصولات حراجی اعمال نمی‌شود"
              checked={field.state.value}
              onChange={field.handleChange}
            />
          )}
        </form.Field>

        <form.Field name="freeShipping">
          {(field) => (
            <SwitchRow
              id="freeShipping"
              label="ارسال رایگان"
              hint="این کد هزینه ارسال را حذف می‌کند"
              checked={field.state.value}
              onChange={field.handleChange}
            />
          )}
        </form.Field>

        <form.Field name="emailRestrictions">
          {(field) => (
            <TextareaField
              id="emailRestrictions"
              label="ایمیل‌های مجاز"
              value={field.state.value}
              onChange={field.handleChange}
              placeholder={"user@example.com\nother@example.com"}
              hint="هر ایمیل در یک خط یا جدا با ویرگول"
              rows={3}
              error={field.state.meta.errors[0] as string | undefined}
            />
          )}
        </form.Field>

        <form.Field name="includeProductIds">
          {(field) => (
            <TextareaField
              id="includeProductIds"
              label="شناسه محصولات مشمول"
              value={field.state.value}
              onChange={field.handleChange}
              placeholder={"uuid1\nuuid2"}
              hint="فقط این محصولات مشمول تخفیف می‌شوند"
              rows={2}
              error={field.state.meta.errors[0] as string | undefined}
            />
          )}
        </form.Field>

        <form.Field name="excludeProductIds">
          {(field) => (
            <TextareaField
              id="excludeProductIds"
              label="شناسه محصولات استثنا"
              value={field.state.value}
              onChange={field.handleChange}
              placeholder={"uuid1\nuuid2"}
              hint="این محصولات از تخفیف حذف می‌شوند"
              rows={2}
              error={field.state.meta.errors[0] as string | undefined}
            />
          )}
        </form.Field>

        <form.Field name="includeCategoryIds">
          {(field) => (
            <TextareaField
              id="includeCategoryIds"
              label="شناسه دسته‌های مشمول"
              value={field.state.value}
              onChange={field.handleChange}
              placeholder={"uuid1\nuuid2"}
              hint="فقط این دسته‌ها مشمول تخفیف می‌شوند"
              rows={2}
              error={field.state.meta.errors[0] as string | undefined}
            />
          )}
        </form.Field>

        <form.Field name="excludeCategoryIds">
          {(field) => (
            <TextareaField
              id="excludeCategoryIds"
              label="شناسه دسته‌های استثنا"
              value={field.state.value}
              onChange={field.handleChange}
              placeholder={"uuid1\nuuid2"}
              hint="این دسته‌ها از تخفیف حذف می‌شوند"
              rows={2}
              error={field.state.meta.errors[0] as string | undefined}
            />
          )}
        </form.Field>
      </DepthSection>
    </SheetForm>
  );
}

// ─── RedemptionSheet ──────────────────────────────────────────────────────────

const FA_DATETIME = new Intl.DateTimeFormat("fa-IR", {
  dateStyle: "short",
  timeStyle: "short",
});

function formatDateTime(iso: string | null): string {
  if (!iso) return "—";
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? "—" : FA_DATETIME.format(date);
}

function RedemptionSheet({
  coupon,
  open,
  onOpenChange,
}: {
  coupon: AdminCouponOption;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [rows, setRows] = useState<CouponRedemptionRow[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch on first open
  function handleOpenChange(next: boolean) {
    onOpenChange(next);
    if (next && rows === null && !loading) {
      setLoading(true);
      setError(null);
      fetch(`/api/admin/coupons/${coupon.id}/redemptions`)
        .then((r) => r.json())
        .then((json) => {
          if (json?.ok && Array.isArray(json.data?.rows)) {
            setRows(json.data.rows);
          } else {
            setError("بارگذاری گزارش ناموفق بود.");
          }
        })
        .catch(() => setError("خطا در دریافت اطلاعات."))
        .finally(() => setLoading(false));
    }
  }

  const redemptionColumns: ColumnDef<CouponRedemptionRow>[] = [
    {
      accessorKey: "userPhone",
      header: "شماره کاربر",
      cell: (info) => (
        <span dir="ltr" className="font-mono text-sm">
          {info.getValue<string | null>() ?? "—"}
        </span>
      ),
    },
    {
      accessorKey: "orderNumber",
      header: "شماره سفارش",
      cell: (info) => (
        <span dir="ltr" className="font-mono text-sm">
          {info.getValue<string | null>() ?? "—"}
        </span>
      ),
    },
    {
      accessorKey: "amount",
      header: "مبلغ تخفیف",
      meta: { align: "end" },
      cell: (info) => (
        <span className="text-sm tabular-nums">{formatToman(info.getValue<string>())}</span>
      ),
    },
    {
      accessorKey: "createdAt",
      header: "تاریخ",
      cell: (info) => (
        <span className="text-xs text-muted-foreground">
          {formatDateTime(info.getValue<string | null>())}
        </span>
      ),
    },
  ];

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent side="left" className="w-full max-w-2xl overflow-y-auto" dir="rtl">
        <SheetHeader className="text-right pb-4">
          <SheetTitle>
            گزارش استفاده —{" "}
            <span dir="ltr" className="font-mono">
              {coupon.code}
            </span>
          </SheetTitle>
        </SheetHeader>

        {loading && (
          <p className="text-sm text-muted-foreground text-right py-8">در حال بارگذاری…</p>
        )}

        {error && <p className="text-sm text-destructive text-right py-8">{error}</p>}

        {!loading && !error && rows !== null && (
          <>
            <p className="text-xs text-muted-foreground text-right mb-4">
              {toFaNumber(rows.length)} بار استفاده‌شده
            </p>
            <DataTable
              columns={redemptionColumns}
              data={rows}
              loading={false}
              empty="هنوز این کد تخفیف استفاده نشده است."
            />
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

// ─── Row action menu ───────────────────────────────────────────────────────────

function CouponRowMenu({
  coupon,
  onEdit,
  onToggleActive,
  onDelete,
  onReport,
}: {
  coupon: AdminCouponOption;
  onEdit: (coupon: AdminCouponOption) => void;
  onToggleActive: (coupon: AdminCouponOption) => void;
  onDelete: (coupon: AdminCouponOption) => void;
  onReport: (coupon: AdminCouponOption) => void;
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
        <DropdownMenuItem onClick={() => onReport(coupon)}>گزارش استفاده</DropdownMenuItem>
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
  const [reportCoupon, setReportCoupon] = useState<AdminCouponOption | undefined>(undefined);
  const [reportOpen, setReportOpen] = useState(false);

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

  function openReport(coupon: AdminCouponOption) {
    setReportCoupon(coupon);
    setReportOpen(true);
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
            onReport={openReport}
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

      {reportCoupon && (
        <RedemptionSheet
          key={`report-${reportCoupon.id}`}
          coupon={reportCoupon}
          open={reportOpen}
          onOpenChange={setReportOpen}
        />
      )}

      {dialog}
    </AdminPage>
  );
}
