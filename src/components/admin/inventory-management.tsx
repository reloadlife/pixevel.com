"use client";

import {
  ChevronLeft,
  ChevronRight,
  Eye,
  EyeOff,
  Loader2,
  PackagePlus,
  RotateCcw,
  Search,
  TriangleAlert,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { toFaNumber } from "@/lib/format";

type InventoryUnit = {
  id: string;
  code: string | null;
  maskedCode: string | null;
  status: string;
  reservedAt: string | null;
  soldAt: string | null;
  createdAt: string | null;
  orderId: string | null;
  variantId: string;
  variantSku: string;
  variantTitleFa: string;
  productId: string;
  productTitleFa: string;
};

type Pagination = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

type StockSummary = {
  variantId: string;
  variantSku: string;
  variantTitleFa: string;
  productId: string;
  productTitleFa: string;
  available: number;
  reserved: number;
  sold: number;
  damaged: number;
  total: number;
};

type VariantOption = {
  variantId: string;
  variantSku: string;
  variantTitleFa: string;
  productId: string;
  productTitleFa: string;
  label: string;
};

const STATUS_FILTER_OPTIONS = [
  { value: "", label: "همه وضعیت‌ها" },
  { value: "AVAILABLE", label: "موجود" },
  { value: "RESERVED", label: "رزرو شده" },
  { value: "SOLD", label: "فروخته شده" },
  { value: "DAMAGED", label: "خراب" },
];

const STATUS_LABELS: Record<string, string> = {
  AVAILABLE: "موجود",
  RESERVED: "رزرو شده",
  SOLD: "فروخته شده",
  DAMAGED: "خراب",
};

const STATUS_BADGE: Record<string, string> = {
  AVAILABLE: "bg-emerald-50 text-emerald-700 border-emerald-200",
  RESERVED: "bg-amber-50 text-amber-700 border-amber-200",
  SOLD: "bg-zinc-100 text-zinc-600 border-zinc-200",
  DAMAGED: "bg-red-50 text-red-700 border-red-200",
};

function statusLabel(status: string) {
  return STATUS_LABELS[status] ?? status;
}

export function InventoryManagement({
  initialUnits,
  initialPagination,
  initialSummary,
  variantOptions,
}: {
  initialUnits: InventoryUnit[];
  initialPagination: Pagination;
  initialSummary: StockSummary[];
  variantOptions: VariantOption[];
}) {
  const [units, setUnits] = useState(initialUnits);
  const [pagination, setPagination] = useState(initialPagination);
  const [summary, setSummary] = useState(initialSummary);
  const [loading, setLoading] = useState(false);
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});
  const [busyUnitId, setBusyUnitId] = useState<string | null>(null);

  // Filters
  const [variantFilter, setVariantFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [codeQuery, setCodeQuery] = useState("");

  // Bulk import
  const [importVariantId, setImportVariantId] = useState("");
  const [importCodes, setImportCodes] = useState("");
  const [importing, setImporting] = useState(false);

  const loadPage = useCallback(
    async (page: number) => {
      setLoading(true);

      const params = new URLSearchParams();
      params.set("page", String(page));

      if (variantFilter) {
        params.set("variantId", variantFilter);
      }

      if (statusFilter) {
        params.set("status", statusFilter);
      }

      if (codeQuery.trim()) {
        params.set("code", codeQuery.trim());
      }

      try {
        const response = await fetch(`/api/admin/inventory?${params.toString()}`);
        const result = await response.json();

        if (!result.ok) {
          toast.error(result.error?.message ?? "بارگذاری موجودی ناموفق بود.");
          return;
        }

        setUnits(result.data.units);
        setPagination(result.data.pagination);
        setSummary(result.data.summary);
        setRevealed({});
      } catch {
        toast.error("بارگذاری موجودی ناموفق بود.");
      } finally {
        setLoading(false);
      }
    },
    [variantFilter, statusFilter, codeQuery],
  );

  // Re-fetch when variant or status filter changes.
  // biome-ignore lint/correctness/useExhaustiveDependencies: loadPage depends on filters; intentional.
  useEffect(() => {
    loadPage(1);
  }, [variantFilter, statusFilter]);

  async function setUnitStatus(unit: InventoryUnit, nextStatus: string) {
    setBusyUnitId(unit.id);

    try {
      const response = await fetch("/api/admin/inventory", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ unitId: unit.id, status: nextStatus }),
      });
      const result = await response.json();

      if (!result.ok) {
        toast.error(result.error?.message ?? "تغییر وضعیت ناموفق بود.");
        return;
      }

      toast.success(`وضعیت واحد به «${statusLabel(nextStatus)}» تغییر کرد.`);
      await loadPage(pagination.page);
    } catch {
      toast.error("تغییر وضعیت ناموفق بود.");
    } finally {
      setBusyUnitId(null);
    }
  }

  async function runImport() {
    const codes = importCodes
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);

    if (!importVariantId) {
      toast.error("تنوع مقصد را انتخاب کنید.");
      return;
    }

    if (codes.length === 0) {
      toast.error("حداقل یک کد وارد کنید.");
      return;
    }

    setImporting(true);

    try {
      const response = await fetch("/api/admin/inventory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ variantId: importVariantId, codes }),
      });
      const result = await response.json();

      if (!result.ok) {
        toast.error(result.error?.message ?? "وارد کردن کدها ناموفق بود.");
        return;
      }

      const { added, skipped } = result.data.result;
      toast.success(
        `${toFaNumber(added)} کد افزوده شد${skipped > 0 ? ` و ${toFaNumber(skipped)} کد تکراری رد شد` : ""}.`,
      );
      setImportCodes("");
      await loadPage(1);
    } catch {
      toast.error("وارد کردن کدها ناموفق بود.");
    } finally {
      setImporting(false);
    }
  }

  function toggleReveal(unitId: string) {
    setRevealed((current) => ({ ...current, [unitId]: !current[unitId] }));
  }

  return (
    <div className="grid gap-6" dir="rtl">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-black">موجودی و کدها</h1>
          <p className="mt-1 text-sm text-zinc-500">
            مدیریت واحدهای موجودی (کدهای کارت هدیه / لایسنس) و وضعیت آن‌ها.
          </p>
        </div>
      </header>

      {/* Bulk import */}
      <section className="border border-zinc-200 bg-white p-4">
        <h2 className="flex items-center gap-2 text-lg font-black">
          <PackagePlus className="size-5" />
          وارد کردن گروهی کدها
        </h2>
        <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)_auto]">
          <label className="block">
            <span className="mb-2 block text-sm font-bold">تنوع مقصد</span>
            <select
              value={importVariantId}
              onChange={(event) => setImportVariantId(event.target.value)}
              className="h-11 w-full border border-zinc-300 bg-white px-3 text-sm outline-none focus:border-zinc-950"
            >
              <option value="">انتخاب تنوع…</option>
              {variantOptions.map((option) => (
                <option key={option.variantId} value={option.variantId}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-2 block text-sm font-bold">کدها، هر خط یک کد</span>
            <textarea
              value={importCodes}
              onChange={(event) => setImportCodes(event.target.value)}
              rows={4}
              dir="ltr"
              placeholder={"CODE-AAAA-BBBB\nCODE-CCCC-DDDD"}
              className="w-full resize-y border border-zinc-300 bg-white p-3 font-mono text-xs outline-none focus:border-zinc-950"
            />
          </label>
          <div className="flex items-end">
            <Button
              type="button"
              className="h-11 px-5 font-black"
              onClick={runImport}
              disabled={importing}
            >
              {importing ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <PackagePlus className="size-4" />
              )}
              افزودن کدها
            </Button>
          </div>
        </div>
        <p className="mt-2 text-xs text-zinc-500">
          کدهای خالی حذف و کدهای تکراری به‌صورت خودکار رد می‌شوند.
        </p>
      </section>

      {/* Per-variant stock summary */}
      <section className="border border-zinc-200 bg-white p-4">
        <h2 className="text-lg font-black">خلاصه موجودی هر تنوع</h2>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[680px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-zinc-200 text-right text-xs text-zinc-500">
                <th className="p-2 font-bold">محصول / تنوع</th>
                <th className="p-2 font-bold">موجود</th>
                <th className="p-2 font-bold">رزرو</th>
                <th className="p-2 font-bold">فروخته</th>
                <th className="p-2 font-bold">خراب</th>
                <th className="p-2 font-bold">کل</th>
                <th className="p-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {summary.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-4 text-center text-zinc-400">
                    تنوعی یافت نشد.
                  </td>
                </tr>
              ) : (
                summary.map((row) => (
                  <tr key={row.variantId} className="text-right">
                    <td className="p-2">
                      <div className="font-bold">{row.productTitleFa}</div>
                      <div className="text-xs text-zinc-500">{row.variantTitleFa}</div>
                      <div className="font-mono text-[11px] text-zinc-400" dir="ltr">
                        {row.variantSku}
                      </div>
                    </td>
                    <td className="p-2 font-bold text-emerald-700">{toFaNumber(row.available)}</td>
                    <td className="p-2 text-amber-700">{toFaNumber(row.reserved)}</td>
                    <td className="p-2 text-zinc-500">{toFaNumber(row.sold)}</td>
                    <td className="p-2 text-red-700">{toFaNumber(row.damaged)}</td>
                    <td className="p-2 font-bold">{toFaNumber(row.total)}</td>
                    <td className="p-2 text-left">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setVariantFilter(row.variantId);
                          setStatusFilter("");
                        }}
                      >
                        نمایش واحدها
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Unit list with filters */}
      <section className="border border-zinc-200 bg-white p-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h2 className="text-lg font-black">واحدهای موجودی</h2>
          <div className="flex flex-wrap items-end gap-2">
            <label className="block">
              <span className="mb-1 block text-xs font-bold text-zinc-500">تنوع</span>
              <select
                value={variantFilter}
                onChange={(event) => setVariantFilter(event.target.value)}
                className="h-10 w-56 border border-zinc-300 bg-white px-3 text-sm outline-none focus:border-zinc-950"
              >
                <option value="">همه تنوع‌ها</option>
                {variantOptions.map((option) => (
                  <option key={option.variantId} value={option.variantId}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-bold text-zinc-500">وضعیت</span>
              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
                className="h-10 w-36 border border-zinc-300 bg-white px-3 text-sm outline-none focus:border-zinc-950"
              >
                {STATUS_FILTER_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-bold text-zinc-500">جستجوی کد</span>
              <div className="flex items-stretch">
                <input
                  value={codeQuery}
                  onChange={(event) => setCodeQuery(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      loadPage(1);
                    }
                  }}
                  dir="ltr"
                  className="h-10 w-44 border border-zinc-300 bg-white px-3 text-sm outline-none focus:border-zinc-950"
                />
                <Button
                  type="button"
                  variant="outline"
                  className="h-10 px-3"
                  onClick={() => loadPage(1)}
                >
                  <Search className="size-4" />
                </Button>
              </div>
            </label>
          </div>
        </div>

        <div className="relative mt-4 overflow-x-auto">
          {loading ? (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/60">
              <Loader2 className="size-5 animate-spin text-zinc-500" />
            </div>
          ) : null}
          <table className="w-full min-w-[720px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-zinc-200 text-right text-xs text-zinc-500">
                <th className="p-2 font-bold">کد</th>
                <th className="p-2 font-bold">محصول / تنوع</th>
                <th className="p-2 font-bold">وضعیت</th>
                <th className="p-2 font-bold">سفارش</th>
                <th className="p-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {units.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-4 text-center text-zinc-400">
                    واحدی یافت نشد.
                  </td>
                </tr>
              ) : (
                units.map((unit) => {
                  const isRevealed = Boolean(revealed[unit.id]);
                  const locked = unit.status === "RESERVED" || unit.status === "SOLD";

                  return (
                    <tr key={unit.id} className="text-right align-top">
                      <td className="p-2">
                        <div className="flex items-center gap-2">
                          <code className="font-mono text-xs" dir="ltr">
                            {isRevealed ? unit.code : unit.maskedCode}
                          </code>
                          <button
                            type="button"
                            onClick={() => toggleReveal(unit.id)}
                            className="text-zinc-400 hover:text-zinc-700"
                            title={isRevealed ? "پنهان" : "نمایش"}
                          >
                            {isRevealed ? (
                              <EyeOff className="size-3.5" />
                            ) : (
                              <Eye className="size-3.5" />
                            )}
                          </button>
                        </div>
                      </td>
                      <td className="p-2">
                        <div className="font-bold">{unit.productTitleFa}</div>
                        <div className="text-xs text-zinc-500">{unit.variantTitleFa}</div>
                      </td>
                      <td className="p-2">
                        <span
                          className={`inline-block border px-2 py-0.5 text-xs ${
                            STATUS_BADGE[unit.status] ?? "border-zinc-200 text-zinc-600"
                          }`}
                        >
                          {statusLabel(unit.status)}
                        </span>
                      </td>
                      <td className="p-2 font-mono text-[11px] text-zinc-400" dir="ltr">
                        {unit.orderId ? unit.orderId.slice(0, 8) : "—"}
                      </td>
                      <td className="p-2 text-left">
                        {locked ? (
                          <span className="text-xs text-zinc-400">قفل‌شده</span>
                        ) : unit.status === "DAMAGED" ? (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            disabled={busyUnitId === unit.id}
                            onClick={() => setUnitStatus(unit, "AVAILABLE")}
                          >
                            <RotateCcw className="size-3.5" />
                            بازگردانی
                          </Button>
                        ) : (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            disabled={busyUnitId === unit.id}
                            onClick={() => setUnitStatus(unit, "DAMAGED")}
                          >
                            <TriangleAlert className="size-3.5" />
                            علامت خراب
                          </Button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <div className="mt-4 flex items-center justify-between gap-2 text-sm">
          <span className="text-zinc-500">
            {toFaNumber(pagination.total)} واحد · صفحه {toFaNumber(pagination.page)} از{" "}
            {toFaNumber(pagination.totalPages)}
          </span>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={loading || pagination.page <= 1}
              onClick={() => loadPage(pagination.page - 1)}
            >
              <ChevronRight className="size-4" />
              قبلی
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={loading || pagination.page >= pagination.totalPages}
              onClick={() => loadPage(pagination.page + 1)}
            >
              بعدی
              <ChevronLeft className="size-4" />
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}
