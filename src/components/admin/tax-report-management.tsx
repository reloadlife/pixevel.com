"use client";

import { useState } from "react";
import { AdminPage, type ColumnDef, DataTable, DateField } from "@/components/admin/kit";
import type { AdminListResponse } from "@/lib/admin/list-response";
import type { TaxReportRow } from "@/lib/admin/tax-report";
import { useAdminList } from "@/lib/admin/use-admin-list";
import { formatToman, toFaNumber } from "@/lib/format";

// ─── Helpers ─────────────────────────────────────────────────────────────────

const FA_MONTH = new Intl.DateTimeFormat("fa-IR", {
  year: "numeric",
  month: "long",
});

/** "YYYY-MM" → Persian month label, e.g. "خرداد ۱۴۰۴". */
function formatMonthFa(ym: string): string {
  // Append "-01" to produce a valid date for the Intl formatter
  const date = new Date(`${ym}-01T00:00:00`);
  if (Number.isNaN(date.getTime())) return ym;
  return FA_MONTH.format(date);
}

// ─── Summary cards ────────────────────────────────────────────────────────────

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border bg-card p-4 space-y-1">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-lg font-black">{value}</p>
    </div>
  );
}

function TaxSummary({ counts }: { counts: Record<string, number> }) {
  const vatRatePercent = counts.vatRatePercent ?? 0;
  const totalTaxCollected = counts.totalTaxCollected ?? 0;
  const taxedOrderCount = counts.taxedOrderCount ?? 0;
  const paidOrderCount = counts.paidOrderCount ?? 0;

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <SummaryCard label="نرخ مالیات بر ارزش افزوده" value={`٪${toFaNumber(vatRatePercent)}`} />
      <SummaryCard label="مجموع مالیات دریافتی" value={formatToman(String(totalTaxCollected))} />
      <SummaryCard label="سفارش‌های مشمول مالیات" value={toFaNumber(taxedOrderCount)} />
      <SummaryCard label="کل سفارش‌های پرداخت‌شده" value={toFaNumber(paidOrderCount)} />
    </div>
  );
}

// ─── Filter bar ───────────────────────────────────────────────────────────────

function FilterBar({
  from,
  to,
  onFromChange,
  onToChange,
}: {
  from: string;
  to: string;
  onFromChange: (v: string) => void;
  onToChange: (v: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-3 rounded-xl border bg-muted/40 p-3">
      <div className="w-40 min-w-[9rem]">
        <DateField
          id="tax-from"
          label="از تاریخ"
          value={from}
          onChange={onFromChange}
          hint="اختیاری"
        />
      </div>
      <div className="w-40 min-w-[9rem]">
        <DateField id="tax-to" label="تا تاریخ" value={to} onChange={onToChange} hint="اختیاری" />
      </div>
    </div>
  );
}

// ─── Columns ─────────────────────────────────────────────────────────────────

const columns: ColumnDef<TaxReportRow>[] = [
  {
    accessorKey: "month",
    header: "ماه",
    cell: (info) => <span className="font-medium">{formatMonthFa(info.getValue<string>())}</span>,
  },
  {
    accessorKey: "paidOrderCount",
    header: "سفارش‌های پرداخت‌شده",
    meta: { align: "center" },
    cell: (info) => toFaNumber(info.getValue<number>()),
  },
  {
    accessorKey: "taxedOrderCount",
    header: "سفارش‌های مشمول مالیات",
    meta: { align: "center" },
    cell: (info) => toFaNumber(info.getValue<number>()),
  },
  {
    accessorKey: "taxCollected",
    header: "مالیات دریافتی",
    cell: (info) => (
      <span className="font-mono tabular-nums">{formatToman(info.getValue<string>())}</span>
    ),
  },
];

// ─── TaxReportManagement ──────────────────────────────────────────────────────

export function TaxReportManagement({
  initialData,
}: {
  initialData: AdminListResponse<TaxReportRow>;
}) {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const result = useAdminList<TaxReportRow>(
    "tax-report",
    { from: from || undefined, to: to || undefined },
    { initialData },
  );

  const rows = result.data?.rows ?? [];
  // Summary values are carried through `counts` by both the server and the API.
  const counts = result.data?.counts ?? initialData.counts ?? {};

  return (
    <AdminPage
      title="گزارش مالیات بر ارزش افزوده"
      subtitle="فقط سفارش‌های با وضعیت پرداخت‌شده (PAID) در این گزارش لحاظ می‌شوند."
    >
      <TaxSummary counts={counts} />

      <FilterBar from={from} to={to} onFromChange={setFrom} onToChange={setTo} />

      <DataTable
        columns={columns}
        data={rows}
        loading={result.isLoading}
        empty="داده‌ای برای بازه انتخاب‌شده وجود ندارد."
      />
    </AdminPage>
  );
}
