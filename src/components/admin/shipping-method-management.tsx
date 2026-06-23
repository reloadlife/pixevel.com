"use client";

import { MoreHorizontal, Plus } from "lucide-react";
import { useState } from "react";
import {
  AdminPage,
  type ColumnDef,
  DataTable,
  MoneyField,
  NumberField,
  SelectField,
  SheetForm,
  StatusChip,
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
import type { AdminListResponse } from "@/lib/admin/list-response";
import type { AdminShippingMethodOption } from "@/lib/admin/shipping-methods";
import { useAdminList } from "@/lib/admin/use-admin-list";
import { useAdminMutation } from "@/lib/admin/use-admin-mutation";
import { formatToman, toFaNumber } from "@/lib/format";

// ─── Local types ──────────────────────────────────────────────────────────────

type ShippingKind = "FLAT" | "FREE";
type CurrencyCode = "IRT" | "USD" | "EUR";

type ShippingFormValues = {
  code: string;
  titleFa: string;
  kind: ShippingKind;
  flatAmount: string;
  freeThresholdAmount: string;
  minDays: string;
  maxDays: string;
  currency: CurrencyCode;
  isActive: boolean;
  sortOrder: string;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function kindLabel(kind: string): string {
  return kind === "FREE" ? "رایگان" : "فلت";
}

function formatDays(min: number | null, max: number | null): string {
  if (min == null && max == null) return "—";
  if (min != null && max != null) return `${toFaNumber(min)}–${toFaNumber(max)} روز`;
  if (min != null) return `از ${toFaNumber(min)} روز`;
  return `تا ${toFaNumber(max as number)} روز`;
}

function defaultsFromRow(row: AdminShippingMethodOption): ShippingFormValues {
  return {
    code: row.code,
    titleFa: row.titleFa,
    kind: row.kind as ShippingKind,
    flatAmount: row.flatAmount ?? "0",
    freeThresholdAmount: row.freeThresholdAmount ?? "",
    minDays: row.minDays != null ? String(row.minDays) : "",
    maxDays: row.maxDays != null ? String(row.maxDays) : "",
    currency: row.currency as CurrencyCode,
    isActive: row.isActive,
    sortOrder: String(row.sortOrder ?? 0),
  };
}

const EMPTY_FORM: ShippingFormValues = {
  code: "",
  titleFa: "",
  kind: "FLAT",
  flatAmount: "0",
  freeThresholdAmount: "",
  minDays: "",
  maxDays: "",
  currency: "IRT",
  isActive: true,
  sortOrder: "0",
};

function toPayload(v: ShippingFormValues) {
  return {
    code: v.code,
    titleFa: v.titleFa,
    kind: v.kind,
    flatAmount: v.flatAmount || "0",
    freeThresholdAmount: v.freeThresholdAmount.trim() || null,
    minDays: v.minDays.trim() || null,
    maxDays: v.maxDays.trim() || null,
    currency: v.currency,
    isActive: v.isActive,
    sortOrder: v.sortOrder || "0",
  };
}

// ─── ShippingSheet ────────────────────────────────────────────────────────────

function ShippingSheet({
  open,
  onOpenChange,
  method,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  method?: AdminShippingMethodOption;
}) {
  const mutation = useAdminMutation<ShippingFormValues>({
    url: () =>
      method ? `/api/admin/shipping-methods/${method.id}` : "/api/admin/shipping-methods",
    method: method ? "PATCH" : "POST",
    body: toPayload,
    invalidate: ["shipping-methods"],
    successMessage: method ? "روش ارسال به‌روزرسانی شد." : "روش ارسال ساخته شد.",
  });

  const form = useAdminForm<ShippingFormValues>({
    defaultValues: method ? defaultsFromRow(method) : EMPTY_FORM,
    mutation,
    onSuccess: () => onOpenChange(false),
  });

  return (
    <SheetForm
      open={open}
      onOpenChange={onOpenChange}
      title={method ? "ویرایش روش ارسال" : "روش ارسال جدید"}
      form={form}
    >
      <form.Field name="code">
        {(field) => (
          <TextField
            id="code"
            label="کد یکتا"
            value={field.state.value}
            onChange={(v) => field.handleChange(v.toUpperCase())}
            placeholder="EXPRESS"
            error={field.state.meta.errors[0] as string | undefined}
          />
        )}
      </form.Field>

      <form.Field name="titleFa">
        {(field) => (
          <TextField
            id="titleFa"
            label="عنوان (فارسی)"
            value={field.state.value}
            onChange={field.handleChange}
            placeholder="ارسال پستی سریع"
            error={field.state.meta.errors[0] as string | undefined}
          />
        )}
      </form.Field>

      <form.Field name="kind">
        {(field) => (
          <SelectField
            id="kind"
            label="نوع"
            value={field.state.value}
            onChange={(v) => field.handleChange(v as ShippingKind)}
            options={[
              { value: "FLAT", label: "فلت (مبلغ ثابت)" },
              { value: "FREE", label: "رایگان" },
            ]}
            error={field.state.meta.errors[0] as string | undefined}
          />
        )}
      </form.Field>

      <form.Field name="currency">
        {(field) => (
          <SelectField
            id="currency"
            label="ارز"
            value={field.state.value}
            onChange={(v) => field.handleChange(v as CurrencyCode)}
            options={[
              { value: "IRT", label: "تومان (IRT)" },
              { value: "USD", label: "دلار (USD)" },
              { value: "EUR", label: "یورو (EUR)" },
            ]}
            error={field.state.meta.errors[0] as string | undefined}
          />
        )}
      </form.Field>

      <form.Field name="flatAmount">
        {(field) => (
          <MoneyField
            id="flatAmount"
            label="مبلغ ارسال"
            value={field.state.value}
            onChange={field.handleChange}
            currency="IRT"
            error={field.state.meta.errors[0] as string | undefined}
          />
        )}
      </form.Field>

      <form.Field name="freeThresholdAmount">
        {(field) => (
          <MoneyField
            id="freeThresholdAmount"
            label="آستانه ارسال رایگان (اختیاری)"
            value={field.state.value}
            onChange={field.handleChange}
            currency="IRT"
            error={field.state.meta.errors[0] as string | undefined}
          />
        )}
      </form.Field>

      <form.Field name="minDays">
        {(field) => (
          <NumberField
            id="minDays"
            label="حداقل روز تحویل"
            value={field.state.value}
            onChange={field.handleChange}
            placeholder="—"
            min={0}
            error={field.state.meta.errors[0] as string | undefined}
          />
        )}
      </form.Field>

      <form.Field name="maxDays">
        {(field) => (
          <NumberField
            id="maxDays"
            label="حداکثر روز تحویل"
            value={field.state.value}
            onChange={field.handleChange}
            placeholder="—"
            min={0}
            error={field.state.meta.errors[0] as string | undefined}
          />
        )}
      </form.Field>

      <form.Field name="sortOrder">
        {(field) => (
          <NumberField
            id="sortOrder"
            label="ترتیب نمایش"
            value={field.state.value}
            onChange={field.handleChange}
            placeholder="0"
            min={0}
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

// ─── Row action menu ──────────────────────────────────────────────────────────

function MethodRowMenu({
  method,
  onEdit,
  onToggleActive,
  onDelete,
}: {
  method: AdminShippingMethodOption;
  onEdit: (method: AdminShippingMethodOption) => void;
  onToggleActive: (method: AdminShippingMethodOption) => void;
  onDelete: (method: AdminShippingMethodOption) => void;
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
        <DropdownMenuItem onClick={() => onEdit(method)}>ویرایش</DropdownMenuItem>
        <DropdownMenuItem onClick={() => onToggleActive(method)}>
          {method.isActive ? "غیرفعال‌سازی" : "فعال‌سازی"}
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => onDelete(method)}
          className="text-destructive focus:text-destructive"
        >
          حذف
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// ─── ShippingMethodManagement ─────────────────────────────────────────────────

export function ShippingMethodManagement({
  initialData,
}: {
  initialData: AdminListResponse<AdminShippingMethodOption>;
}) {
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editMethod, setEditMethod] = useState<AdminShippingMethodOption | undefined>(undefined);

  const { confirm, dialog } = useConfirm();

  const result = useAdminList<AdminShippingMethodOption>("shipping-methods", {}, { initialData });

  const rows = result.data?.rows ?? [];

  const deleteMutation = useAdminMutation<{ id: string }>({
    url: (vars) => `/api/admin/shipping-methods/${vars.id}`,
    method: "DELETE",
    invalidate: ["shipping-methods"],
    successMessage: "روش ارسال حذف شد.",
  });

  const toggleActiveMutation = useAdminMutation<{ id: string; isActive: boolean }>({
    url: (vars) => `/api/admin/shipping-methods/${vars.id}`,
    method: "PATCH",
    body: (vars) => ({ isActive: vars.isActive }),
    invalidate: ["shipping-methods"],
    successMessage: "وضعیت روش ارسال به‌روزرسانی شد.",
  });

  function handleToggleActive(method: AdminShippingMethodOption) {
    toggleActiveMutation.mutate({ id: method.id, isActive: !method.isActive });
  }

  function openCreate() {
    setEditMethod(undefined);
    setSheetOpen(true);
  }

  function openEdit(method: AdminShippingMethodOption) {
    setEditMethod(method);
    setSheetOpen(true);
  }

  async function handleDelete(method: AdminShippingMethodOption) {
    const confirmed = await confirm({
      title: "حذف روش ارسال",
      description: `روش «${method.titleFa}» برای همیشه حذف شود؟ این عمل قابل بازگشت نیست.`,
      confirmLabel: "حذف",
      cancelLabel: "لغو",
      destructive: true,
    });
    if (confirmed) {
      await deleteMutation.mutateAsync({ id: method.id });
    }
  }

  const columns: ColumnDef<AdminShippingMethodOption>[] = [
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
      accessorKey: "titleFa",
      header: "عنوان",
    },
    {
      accessorKey: "kind",
      header: "نوع",
      meta: { align: "center" },
      cell: (info) => kindLabel(info.getValue<string>()),
    },
    {
      id: "flatAmount",
      header: "مبلغ ارسال",
      meta: { align: "end" },
      cell: (info) => {
        const { flatAmount, kind } = info.row.original;
        if (kind === "FREE") return <span className="text-muted-foreground">رایگان</span>;
        return formatToman(flatAmount);
      },
    },
    {
      id: "freeThreshold",
      header: "آستانه رایگان",
      meta: { align: "end" },
      cell: (info) => {
        const { freeThresholdAmount } = info.row.original;
        return freeThresholdAmount ? formatToman(freeThresholdAmount) : "—";
      },
    },
    {
      id: "days",
      header: "زمان تحویل",
      meta: { align: "center" },
      cell: (info) => {
        const { minDays, maxDays } = info.row.original;
        return <span className="text-xs">{formatDays(minDays, maxDays)}</span>;
      },
    },
    {
      accessorKey: "sortOrder",
      header: "ترتیب",
      meta: { align: "center" },
      cell: (info) => toFaNumber(info.getValue<number>()),
    },
    {
      accessorKey: "isActive",
      header: "وضعیت",
      meta: { align: "center" },
      cell: (info) => (
        <StatusChip kind="product" value={info.getValue<boolean>() ? "ACTIVE" : "DISABLED"} />
      ),
    },
  ];

  return (
    <AdminPage
      title="روش‌های ارسال"
      subtitle={`${toFaNumber(rows.length)} روش ثبت‌شده`}
      actions={
        <Button type="button" onClick={openCreate}>
          <Plus className="size-4" />
          روش ارسال جدید
        </Button>
      }
    >
      <DataTable
        columns={columns}
        data={rows}
        loading={result.isLoading}
        empty="هنوز روش ارسالی ثبت نشده است."
        rowActions={(method) => (
          <MethodRowMenu
            method={method}
            onEdit={openEdit}
            onToggleActive={handleToggleActive}
            onDelete={handleDelete}
          />
        )}
      />

      {/* key forces a fresh form instance per target */}
      <ShippingSheet
        key={editMethod?.id ?? "new"}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        method={editMethod}
      />

      {dialog}
    </AdminPage>
  );
}
