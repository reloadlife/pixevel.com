"use client";

import { Loader2, Star, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { ReviewStatus } from "@/db/schema";
import type { AdminReviewRow, ReviewStatusCounts } from "@/lib/admin/reviews";
import { toFaNumber } from "@/lib/format";
import { cn } from "@/lib/utils";

type ReviewListData = {
  reviews: AdminReviewRow[];
  counts: ReviewStatusCounts;
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
};

type TabKey = "ALL" | ReviewStatus;

const TABS: { key: TabKey; label: string }[] = [
  { key: "PENDING", label: "در انتظار" },
  { key: "APPROVED", label: "تأیید شده" },
  { key: "REJECTED", label: "رد شده" },
  { key: "ALL", label: "همه" },
];

const STATUS_BADGE: Record<
  ReviewStatus,
  { label: string; variant: "default" | "secondary" | "destructive" | "outline" }
> = {
  PENDING: { label: "در انتظار", variant: "outline" },
  APPROVED: { label: "تأیید شده", variant: "default" },
  REJECTED: { label: "رد شده", variant: "destructive" },
};

const dateFormatter = new Intl.DateTimeFormat("fa-IR", {
  year: "numeric",
  month: "long",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

function formatDate(iso: string) {
  return dateFormatter.format(new Date(iso));
}

function Stars({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5" role="img" aria-label={`${toFaNumber(rating)} از ۵`}>
      {[1, 2, 3, 4, 5].map((index) => (
        <Star
          key={index}
          className={cn(
            "size-4",
            index <= rating ? "fill-amber-400 text-amber-400" : "fill-transparent text-zinc-300",
          )}
        />
      ))}
    </div>
  );
}

export function ReviewManagement({ initialData }: { initialData: ReviewListData }) {
  const [data, setData] = useState<ReviewListData>(initialData);
  const [tab, setTab] = useState<TabKey>("PENDING");
  const [actingId, setActingId] = useState<string | null>(null);
  const [loading, startTransition] = useTransition();

  const refresh = useCallback((activeTab: TabKey) => {
    startTransition(async () => {
      const params = new URLSearchParams();
      if (activeTab !== "ALL") {
        params.set("status", activeTab);
      }
      const query = params.toString();
      const response = await fetch(`/api/admin/reviews${query ? `?${query}` : ""}`);
      const result = await response.json();

      if (!result.ok) {
        toast.error(result.error?.message ?? "دریافت نظرها انجام نشد.");
        return;
      }

      setData(result.data as ReviewListData);
    });
  }, []);

  // Initial server data is unfiltered (ALL); align it with the default PENDING tab.
  useEffect(() => {
    refresh("PENDING");
  }, [refresh]);

  function selectTab(next: TabKey) {
    if (next === tab) {
      return;
    }
    setTab(next);
    refresh(next);
  }

  async function changeStatus(review: AdminReviewRow, status: ReviewStatus) {
    setActingId(review.id);
    const response = await fetch(`/api/admin/reviews/${review.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    const result = await response.json();
    setActingId(null);

    if (!result.ok) {
      toast.error(result.error?.message ?? "ثبت وضعیت انجام نشد.");
      return;
    }

    toast.success(status === "APPROVED" ? "نظر تأیید شد." : "نظر رد شد.");
    refresh(tab);
  }

  async function removeReview(review: AdminReviewRow) {
    if (!window.confirm("این نظر برای همیشه حذف شود؟")) {
      return;
    }

    setActingId(review.id);
    const response = await fetch(`/api/admin/reviews/${review.id}`, { method: "DELETE" });
    const result = await response.json();
    setActingId(null);

    if (!result.ok) {
      toast.error(result.error?.message ?? "حذف نظر انجام نشد.");
      return;
    }

    toast.success("نظر حذف شد.");
    refresh(tab);
  }

  function tabCount(key: TabKey) {
    if (key === "ALL") {
      return data.counts.total;
    }
    return data.counts[key];
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-black">مدیریت نظرها</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          نظرهای کاربران را بررسی، تأیید، رد یا حذف کنید. فقط نظرهای تأییدشده در فروشگاه نمایش داده
          می‌شوند.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {TABS.map((item) => (
          <Button
            key={item.key}
            size="sm"
            variant={tab === item.key ? "default" : "outline"}
            disabled={loading}
            onClick={() => selectTab(item.key)}
          >
            {item.label}
            <span
              className={cn(
                "ms-1 rounded-full px-1.5 text-xs",
                tab === item.key
                  ? "bg-primary-foreground/20 text-primary-foreground"
                  : "bg-muted text-muted-foreground",
              )}
            >
              {toFaNumber(tabCount(item.key))}
            </span>
          </Button>
        ))}
      </div>

      <div className="rounded-2xl border border-border bg-card">
        {loading ? (
          <div className="flex items-center justify-center gap-2 p-10 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            در حال بارگذاری…
          </div>
        ) : data.reviews.length === 0 ? (
          <div className="p-10 text-center text-sm text-muted-foreground">
            نظری برای نمایش وجود ندارد.
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {data.reviews.map((review) => {
              const badge = STATUS_BADGE[review.status];
              const busy = actingId === review.id;

              return (
                <li key={review.id} className="flex flex-col gap-3 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Stars rating={review.rating} />
                        <Badge variant={badge.variant}>{badge.label}</Badge>
                      </div>
                      <div className="text-sm font-bold">{review.productTitleFa}</div>
                      <div className="text-xs text-muted-foreground">
                        {review.author} • {formatDate(review.createdAt)}
                      </div>
                    </div>
                  </div>

                  {review.titleFa ? (
                    <div className="text-sm font-bold">{review.titleFa}</div>
                  ) : null}
                  <p className="text-sm whitespace-pre-line text-foreground/90">{review.bodyFa}</p>

                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="xs"
                      variant="outline"
                      disabled={busy || review.status === "APPROVED"}
                      onClick={() => changeStatus(review, "APPROVED")}
                    >
                      {busy ? <Loader2 className="size-3 animate-spin" /> : null}
                      تأیید
                    </Button>
                    <Button
                      size="xs"
                      variant="outline"
                      disabled={busy || review.status === "REJECTED"}
                      onClick={() => changeStatus(review, "REJECTED")}
                    >
                      رد
                    </Button>
                    <Button
                      size="xs"
                      variant="destructive"
                      disabled={busy}
                      onClick={() => removeReview(review)}
                    >
                      <Trash2 className="size-3" />
                      حذف
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <p className="text-xs text-muted-foreground">مجموع {toFaNumber(data.pagination.total)} نظر</p>
    </div>
  );
}
