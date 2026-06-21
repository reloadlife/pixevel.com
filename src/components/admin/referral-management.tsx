"use client";

import {
  AwardIcon,
  CheckCircle2Icon,
  ClockIcon,
  GiftIcon,
  Loader2Icon,
  SearchIcon,
  Share2Icon,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toFaNumber } from "@/lib/format";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

type ReferralStatus = "PENDING" | "QUALIFIED" | "REWARDED";

type AdminReferral = {
  id: string;
  status: ReferralStatus;
  rewardPoints: number;
  rewardedAt: string | null;
  createdAt: string;
  referrer: string;
  referrerPhone: string | null;
  referee: string | null;
  refereePhone: string | null;
};

type Pagination = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

type Stats = {
  total: number;
  pending: number;
  qualified: number;
  rewarded: number;
  totalRewardPoints: number;
};

type ListData = {
  referrals: AdminReferral[];
  pagination: Pagination;
};

// ─── Status presentation ────────────────────────────────────────────────────────

const STATUS_LABEL: Record<ReferralStatus, string> = {
  PENDING: "در انتظار",
  QUALIFIED: "واجد شرایط",
  REWARDED: "پاداش‌داده‌شده",
};

const STATUS_VARIANT: Record<ReferralStatus, "default" | "secondary" | "outline"> = {
  PENDING: "outline",
  QUALIFIED: "secondary",
  REWARDED: "default",
};

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

// ─── Main component ─────────────────────────────────────────────────────────────

export function ReferralManagement({
  initialData,
  initialStats,
}: {
  initialData: ListData;
  initialStats: Stats;
}) {
  const [referrals, setReferrals] = useState(initialData.referrals);
  const [pagination, setPagination] = useState(initialData.pagination);
  const [stats, setStats] = useState(initialStats);
  const [loading, setLoading] = useState(false);

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<"" | ReferralStatus>("");
  const [page, setPage] = useState(1);

  const firstRender = useRef(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (search.trim()) params.set("q", search.trim());
    if (status) params.set("status", status);
    params.set("page", String(page));

    try {
      const res = await fetch(`/api/admin/referrals?${params.toString()}`);
      const json = await res.json();
      if (!json.ok) {
        toast.error(json.error?.message ?? "بارگذاری معرفی‌ها انجام نشد.");
        return;
      }
      setReferrals(json.data.referrals);
      setPagination(json.data.pagination);
      setStats(json.data.stats);
    } catch {
      toast.error("خطا در ارتباط با سرور.");
    } finally {
      setLoading(false);
    }
  }, [search, status, page]);

  // Debounced refetch when filters/page change (skip first render — initial
  // data is server-rendered).
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    const handle = setTimeout(fetchData, 300);
    return () => clearTimeout(handle);
  }, [fetchData]);

  function onFilterChange(fn: () => void) {
    fn();
    setPage(1);
  }

  return (
    <div className="space-y-4" dir="rtl">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-black">
            <Share2Icon className="size-5" />
            معرفی دوستان
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">گزارش فعالیت برنامه معرفی</p>
        </div>
        {loading && <Loader2Icon className="size-4 animate-spin text-muted-foreground" />}
      </div>

      {/* ── Stats ─────────────────────────────────────────────────── */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard title="کل معرفی‌ها" value={stats.total} icon={Share2Icon} />
        <StatCard title="در انتظار" value={stats.pending} icon={ClockIcon} />
        <StatCard title="واجد شرایط" value={stats.qualified} icon={CheckCircle2Icon} accent="ok" />
        <StatCard
          title="مجموع امتیاز پاداش"
          value={stats.totalRewardPoints}
          icon={AwardIcon}
          accent="gold"
        />
      </div>

      {/* ── Filters ───────────────────────────────────────────────── */}
      <div className="flex flex-wrap gap-2">
        <div className="relative min-w-[200px] flex-1">
          <SearchIcon className="pointer-events-none absolute right-2 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            className="h-10 w-full rounded-2xl border border-border bg-input/50 py-1.5 pr-8 pl-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30"
            placeholder="جستجوی نام یا تلفن..."
            value={search}
            onChange={(e) => onFilterChange(() => setSearch(e.target.value))}
          />
        </div>
        <select
          className="h-10 rounded-2xl border border-border bg-input/50 px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30"
          value={status}
          onChange={(e) => onFilterChange(() => setStatus(e.target.value as "" | ReferralStatus))}
        >
          <option value="">همه وضعیت‌ها</option>
          <option value="PENDING">در انتظار</option>
          <option value="QUALIFIED">واجد شرایط</option>
          <option value="REWARDED">پاداش‌داده‌شده</option>
        </select>
      </div>

      {/* ── Table ─────────────────────────────────────────────────── */}
      <section className="overflow-hidden rounded-2xl border border-border bg-card">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="bg-muted/50 text-xs text-muted-foreground">
              <tr className="[&>th]:p-3 [&>th]:text-start [&>th]:font-bold">
                <th>معرفی‌کننده</th>
                <th>معرفی‌شده</th>
                <th>وضعیت</th>
                <th>امتیاز پاداش</th>
                <th>تاریخ معرفی</th>
                <th>تاریخ پاداش</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {referrals.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-muted-foreground">
                    معرفی‌ای یافت نشد.
                  </td>
                </tr>
              ) : (
                referrals.map((item) => (
                  <tr key={item.id} className="[&>td]:p-3 [&>td]:align-top">
                    <td>
                      <div className="font-medium">{item.referrer}</div>
                      {item.referrerPhone && (
                        <div className="font-mono text-xs text-muted-foreground" dir="ltr">
                          {item.referrerPhone}
                        </div>
                      )}
                    </td>
                    <td>
                      {item.referee ? (
                        <>
                          <div className="font-medium">{item.referee}</div>
                          {item.refereePhone && (
                            <div className="font-mono text-xs text-muted-foreground" dir="ltr">
                              {item.refereePhone}
                            </div>
                          )}
                        </>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td>
                      <Badge variant={STATUS_VARIANT[item.status]}>
                        {STATUS_LABEL[item.status]}
                      </Badge>
                    </td>
                    <td>
                      <span className="inline-flex items-center gap-1 font-bold tabular-nums">
                        <GiftIcon className="size-3.5 text-muted-foreground" />
                        {toFaNumber(item.rewardPoints)}
                      </span>
                    </td>
                    <td className="whitespace-nowrap text-xs text-muted-foreground">
                      {formatDate(item.createdAt)}
                    </td>
                    <td className="whitespace-nowrap text-xs text-muted-foreground">
                      {formatDate(item.rewardedAt)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {pagination.totalPages > 1 && (
          <div className="flex items-center justify-between gap-2 border-t border-border p-3">
            <Button
              variant="outline"
              size="sm"
              disabled={pagination.page <= 1 || loading}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              قبلی
            </Button>
            <span className="text-xs text-muted-foreground">
              صفحه {toFaNumber(pagination.page)} از {toFaNumber(pagination.totalPages)}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={pagination.page >= pagination.totalPages || loading}
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

// ─── Sub-components ──────────────────────────────────────────────────────────────

function StatCard({
  title,
  value,
  icon: Icon,
  accent,
}: {
  title: string;
  value: number;
  icon: React.ElementType;
  accent?: "ok" | "gold";
}) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
          <Icon
            className={cn(
              "h-4 w-4 text-muted-foreground",
              accent === "ok" && "text-green-600",
              accent === "gold" && "text-amber-500",
            )}
          />
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-black tabular-nums">{toFaNumber(value)}</p>
      </CardContent>
    </Card>
  );
}
