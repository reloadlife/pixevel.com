"use client";

import { Loader2, Star, Trash2 } from "lucide-react";
import { useState } from "react";
import { AdminPage, StatusChip, useConfirm } from "@/components/admin/kit";
import { Button } from "@/components/ui/button";
import type { ReviewStatus } from "@/db/schema";
import type { AdminListResponse } from "@/lib/admin/list-response";
import type { AdminReviewRow, ReviewStatusCounts } from "@/lib/admin/reviews";
import { useAdminList } from "@/lib/admin/use-admin-list";
import { useAdminMutation } from "@/lib/admin/use-admin-mutation";
import { toFaNumber } from "@/lib/format";
import { cn } from "@/lib/utils";

// ─── Types ───────────────────────────────────────────────────────────────────

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

// ─── Constants ───────────────────────────────────────────────────────────────

const TABS: { key: TabKey; label: string }[] = [
  { key: "PENDING", label: "در انتظار" },
  { key: "APPROVED", label: "تأیید شده" },
  { key: "REJECTED", label: "رد شده" },
  { key: "ALL", label: "همه" },
];

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

// ─── Stars ───────────────────────────────────────────────────────────────────

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

// ─── Main Component ───────────────────────────────────────────────────────────

export function ReviewManagement({ initialData }: { initialData: ReviewListData }) {
  const [tab, setTab] = useState<TabKey>("PENDING");
  const { confirm, dialog } = useConfirm();

  // Normalize initialData to the shape useAdminList / normalizeListResponse expects.
  // The API returns { reviews, counts, pagination }; rowsKey:"reviews" handles the array.
  const normalizedInitial: AdminListResponse<AdminReviewRow> = {
    rows: initialData.reviews,
    pagination: initialData.pagination,
    counts: initialData.counts as unknown as Record<string, number>,
  };

  const statusFilter = tab === "ALL" ? undefined : tab;

  // initialData was server-fetched for the PENDING tab; only seed it for that
  // query key so other tabs don't render PENDING rows before their own fetch.
  const result = useAdminList<AdminReviewRow>(
    "reviews",
    { status: statusFilter },
    { initialData: tab === "PENDING" ? normalizedInitial : undefined, rowsKey: "reviews" },
  );

  // Pull reviews + counts back out of the normalized shape.
  const reviews = result.data?.rows ?? [];
  const counts = (result.data?.counts ?? {
    PENDING: 0,
    APPROVED: 0,
    REJECTED: 0,
    total: 0,
  }) as ReviewStatusCounts;
  const pagination = result.data?.pagination;
  const isLoading = result.isLoading || result.isFetching;

  // ─── Mutations ─────────────────────────────────────────────────────────────

  const statusMutation = useAdminMutation<{ id: string; status: ReviewStatus }>({
    url: (v) => `/api/admin/reviews/${v.id}`,
    method: "PATCH",
    body: (v) => ({ status: v.status }),
    invalidate: ["reviews"],
    successMessage: "وضعیت نظر به‌روز شد.",
  });

  const deleteMutation = useAdminMutation<{ id: string }>({
    url: (v) => `/api/admin/reviews/${v.id}`,
    method: "DELETE",
    invalidate: ["reviews"],
    successMessage: "نظر حذف شد.",
  });

  // ─── Handlers ──────────────────────────────────────────────────────────────

  async function handleChangeStatus(review: AdminReviewRow, status: ReviewStatus) {
    await statusMutation.mutateAsync({ id: review.id, status });
  }

  async function handleDelete(review: AdminReviewRow) {
    const confirmed = await confirm({
      title: "حذف نظر",
      description: "این نظر برای همیشه حذف شود؟ این عمل قابل برگشت نیست.",
      confirmLabel: "حذف",
      cancelLabel: "لغو",
      destructive: true,
    });

    if (confirmed) {
      await deleteMutation.mutateAsync({ id: review.id });
    }
  }

  function tabCount(key: TabKey): number {
    if (key === "ALL") return counts.total;
    return counts[key] ?? 0;
  }

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <>
      <AdminPage
        title="مدیریت نظرها"
        subtitle="نظرهای کاربران را بررسی، تأیید، رد یا حذف کنید. فقط نظرهای تأییدشده در فروشگاه نمایش داده می‌شوند."
      >
        {/* Status count tabs */}
        <div className="flex flex-wrap gap-2">
          {TABS.map((item) => (
            <Button
              key={item.key}
              size="sm"
              variant={tab === item.key ? "default" : "outline"}
              disabled={isLoading}
              onClick={() => setTab(item.key)}
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

        {/* Review list */}
        <div className="rounded-2xl border border-border bg-card">
          {isLoading ? (
            <div className="flex items-center justify-center gap-2 p-10 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              در حال بارگذاری…
            </div>
          ) : reviews.length === 0 ? (
            <div className="p-10 text-center text-sm text-muted-foreground">
              نظری برای نمایش وجود ندارد.
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {reviews.map((review) => {
                const busy =
                  (statusMutation.isPending || deleteMutation.isPending) &&
                  (statusMutation.variables?.id === review.id ||
                    deleteMutation.variables?.id === review.id);

                return (
                  <li key={review.id} className="flex flex-col gap-3 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0 space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <Stars rating={review.rating} />
                          <StatusChip kind="review" value={review.status} />
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
                    <p className="text-sm whitespace-pre-line text-foreground/90">
                      {review.bodyFa}
                    </p>

                    <div className="flex flex-wrap gap-2">
                      <Button
                        size="xs"
                        variant="outline"
                        disabled={busy || review.status === "APPROVED"}
                        onClick={() => handleChangeStatus(review, "APPROVED")}
                      >
                        {busy && statusMutation.variables?.id === review.id ? (
                          <Loader2 className="size-3 animate-spin" />
                        ) : null}
                        تأیید
                      </Button>
                      <Button
                        size="xs"
                        variant="outline"
                        disabled={busy || review.status === "REJECTED"}
                        onClick={() => handleChangeStatus(review, "REJECTED")}
                      >
                        رد
                      </Button>
                      <Button
                        size="xs"
                        variant="destructive"
                        disabled={busy}
                        onClick={() => handleDelete(review)}
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

        {pagination ? (
          <p className="text-xs text-muted-foreground">مجموع {toFaNumber(pagination.total)} نظر</p>
        ) : null}
      </AdminPage>

      {dialog}
    </>
  );
}
