"use client";

import {
  CalendarClockIcon,
  Loader2Icon,
  RefreshCwIcon,
  RepeatIcon,
  SearchIcon,
  XCircleIcon,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatToman, toFaNumber } from "@/lib/format";

// ─── Types ────────────────────────────────────────────────────────────────────

type SubscriptionStatus = "TRIALING" | "ACTIVE" | "PAST_DUE" | "CANCELED" | "EXPIRED" | "PAUSED";

type AdminSubscription = {
  id: string;
  titleFa: string;
  status: string;
  userId: string;
  userPhone: string | null;
  userName: string | null;
  priceAmount: number;
  currency: string;
  autoRenew: boolean;
  currentPeriodEnd: string;
  nextBillingAt: string | null;
  createdAt: string;
};

type ListData = {
  rows: AdminSubscription[];
  total: number;
  page: number;
  pageSize: number;
};

// ─── Status presentation ────────────────────────────────────────────────────────

const STATUS_LABEL: Record<SubscriptionStatus, string> = {
  TRIALING: "آزمایشی",
  ACTIVE: "فعال",
  PAST_DUE: "معوق",
  CANCELED: "لغو‌شده",
  EXPIRED: "منقضی",
  PAUSED: "متوقف",
};

const STATUS_VARIANT: Record<
  SubscriptionStatus,
  "default" | "secondary" | "outline" | "destructive"
> = {
  TRIALING: "secondary",
  ACTIVE: "default",
  PAST_DUE: "destructive",
  CANCELED: "outline",
  EXPIRED: "outline",
  PAUSED: "outline",
};

const STATUS_FILTER_OPTIONS: { value: "" | SubscriptionStatus; label: string }[] = [
  { value: "", label: "همه وضعیت‌ها" },
  { value: "TRIALING", label: "آزمایشی" },
  { value: "ACTIVE", label: "فعال" },
  { value: "PAST_DUE", label: "معوق" },
  { value: "PAUSED", label: "متوقف" },
  { value: "CANCELED", label: "لغو‌شده" },
  { value: "EXPIRED", label: "منقضی" },
];

// ─── Helpers ────────────────────────────────────────────────────────────────────

const FA_DATE = new Intl.DateTimeFormat("fa-IR", {
  year: "numeric",
  month: "short",
  day: "numeric",
});

function formatDate(value: string | null) {
  if (!value) return "—";
  return FA_DATE.format(new Date(value));
}

function statusLabel(status: string) {
  return STATUS_LABEL[status as SubscriptionStatus] ?? status;
}

function statusVariant(status: string) {
  return STATUS_VARIANT[status as SubscriptionStatus] ?? "outline";
}

// ─── Main component ─────────────────────────────────────────────────────────────

export function SubscriptionManagement({ initialData }: { initialData: ListData }) {
  const [rows, setRows] = useState(initialData.rows);
  const [total, setTotal] = useState(initialData.total);
  const [page, setPage] = useState(initialData.page);
  const [pageSize] = useState(initialData.pageSize);
  const [status, setStatus] = useState<"" | SubscriptionStatus>("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState("");

  const firstRender = useRef(true);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const fetchData = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (status) params.set("status", status);
    params.set("page", String(page));

    try {
      const res = await fetch(`/api/admin/subscriptions?${params.toString()}`);
      const json = await res.json();
      if (!json.ok) {
        toast.error(json.error?.message ?? "بارگذاری اشتراک‌ها انجام نشد.");
        return;
      }
      setRows(json.data.rows);
      setTotal(json.data.total);
    } catch {
      toast.error("خطا در ارتباط با سرور.");
    } finally {
      setLoading(false);
    }
  }, [status, page]);

  // Debounced refetch when status/page change (skip first render — initial data
  // is server-rendered).
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    const handle = setTimeout(fetchData, 200);
    return () => clearTimeout(handle);
  }, [fetchData]);

  // Client-side filter over the current page (phone / name / title).
  const query = search.trim().toLowerCase();
  const visibleRows = query
    ? rows.filter(
        (row) =>
          row.titleFa.toLowerCase().includes(query) ||
          (row.userPhone ?? "").toLowerCase().includes(query) ||
          (row.userName ?? "").toLowerCase().includes(query),
      )
    : rows;

  async function runAction(
    sub: AdminSubscription,
    body: Record<string, unknown>,
    successMessage: string,
  ) {
    setBusyId(sub.id);
    try {
      const res = await fetch(`/api/admin/subscriptions/${sub.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!json.ok) {
        toast.error(json.error?.message ?? "عملیات انجام نشد.");
        return;
      }
      toast.success(successMessage);
      await fetchData();
    } catch {
      toast.error("خطا در ارتباط با سرور.");
    } finally {
      setBusyId("");
    }
  }

  function cancelSub(sub: AdminSubscription) {
    if (!globalThis.confirm(`لغو اشتراک «${sub.titleFa}»؟`)) return;
    void runAction(sub, { action: "cancel", immediate: false }, "اشتراک لغو شد.");
  }

  function toggleAutoRenew(sub: AdminSubscription) {
    void runAction(
      sub,
      { action: "setAutoRenew", autoRenew: !sub.autoRenew },
      sub.autoRenew ? "تمدید خودکار غیرفعال شد." : "تمدید خودکار فعال شد.",
    );
  }

  function renewNow(sub: AdminSubscription) {
    if (!globalThis.confirm(`تمدید فوری «${sub.titleFa}» از کیف پول کاربر؟`)) return;
    void runAction(sub, { action: "renewNow", method: "WALLET" }, "تمدید انجام شد.");
  }

  return (
    <div className="space-y-4" dir="rtl">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-black">
            <RepeatIcon className="size-5" />
            اشتراک‌ها
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">مدیریت اشتراک‌های دوره‌ای کاربران</p>
        </div>
        {loading && <Loader2Icon className="size-4 animate-spin text-muted-foreground" />}
      </div>

      {/* ── Filters ───────────────────────────────────────────────── */}
      <div className="flex flex-wrap gap-2">
        <div className="relative min-w-[200px] flex-1">
          <SearchIcon className="pointer-events-none absolute right-2 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            className="h-10 w-full rounded-2xl border border-border bg-input/50 py-1.5 pr-8 pl-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30"
            placeholder="جستجوی عنوان، تلفن یا نام..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select
          className="h-10 rounded-2xl border border-border bg-input/50 px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30"
          value={status}
          onChange={(e) => {
            setStatus(e.target.value as "" | SubscriptionStatus);
            setPage(1);
          }}
        >
          {STATUS_FILTER_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      {/* ── Table ─────────────────────────────────────────────────── */}
      <section className="overflow-hidden rounded-2xl border border-border bg-card">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[880px] text-sm">
            <thead className="bg-muted/50 text-xs text-muted-foreground">
              <tr className="[&>th]:p-3 [&>th]:text-start [&>th]:font-bold">
                <th>اشتراک</th>
                <th>کاربر</th>
                <th>وضعیت</th>
                <th>مبلغ</th>
                <th>تمدید بعدی</th>
                <th>تمدید خودکار</th>
                <th className="text-end">عملیات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {visibleRows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-muted-foreground">
                    اشتراکی یافت نشد.
                  </td>
                </tr>
              ) : (
                visibleRows.map((sub) => {
                  const busy = busyId === sub.id;
                  const terminal = sub.status === "CANCELED" || sub.status === "EXPIRED";

                  return (
                    <tr key={sub.id} className="[&>td]:p-3 [&>td]:align-top">
                      <td>
                        <div className="font-medium">{sub.titleFa}</div>
                        <div className="text-xs text-muted-foreground">
                          از {formatDate(sub.createdAt)}
                        </div>
                      </td>
                      <td>
                        <div className="font-medium">{sub.userName ?? "—"}</div>
                        {sub.userPhone && (
                          <div className="font-mono text-xs text-muted-foreground" dir="ltr">
                            {sub.userPhone}
                          </div>
                        )}
                      </td>
                      <td>
                        <Badge variant={statusVariant(sub.status)}>{statusLabel(sub.status)}</Badge>
                      </td>
                      <td className="whitespace-nowrap font-bold tabular-nums">
                        {formatToman(sub.priceAmount)}
                      </td>
                      <td className="whitespace-nowrap text-xs text-muted-foreground">
                        <span className="inline-flex items-center gap-1">
                          <CalendarClockIcon className="size-3.5" />
                          {formatDate(sub.nextBillingAt ?? sub.currentPeriodEnd)}
                        </span>
                      </td>
                      <td>
                        <Badge variant={sub.autoRenew ? "secondary" : "outline"}>
                          {sub.autoRenew ? "روشن" : "خاموش"}
                        </Badge>
                      </td>
                      <td>
                        <div className="flex flex-wrap justify-end gap-1.5">
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={busy || terminal}
                            onClick={() => toggleAutoRenew(sub)}
                          >
                            <RefreshCwIcon className="size-3.5" />
                            {sub.autoRenew ? "قطع تمدید" : "فعال تمدید"}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={busy || terminal}
                            onClick={() => renewNow(sub)}
                          >
                            <RepeatIcon className="size-3.5" />
                            تمدید فوری
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={busy || terminal}
                            onClick={() => cancelSub(sub)}
                          >
                            {busy ? (
                              <Loader2Icon className="size-3.5 animate-spin" />
                            ) : (
                              <XCircleIcon className="size-3.5" />
                            )}
                            لغو
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between gap-2 border-t border-border p-3">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1 || loading}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              قبلی
            </Button>
            <span className="text-xs text-muted-foreground">
              صفحه {toFaNumber(page)} از {toFaNumber(totalPages)}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages || loading}
              onClick={() => setPage((p) => p + 1)}
            >
              بعدی
            </Button>
          </div>
        )}
      </section>
    </div>
  );
}
