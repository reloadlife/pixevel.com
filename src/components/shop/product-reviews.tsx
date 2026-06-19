"use client";

import { Star } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { toFaNumber } from "@/lib/format";
import { cn } from "@/lib/utils";

type Review = {
  id: string;
  rating: number;
  titleFa: string | null;
  bodyFa: string;
  authorName: string;
  createdAt: string;
};

type Aggregate = {
  count: number;
  average: number;
};

type ProductReviewsProps = {
  productId: string;
  isAuthenticated: boolean;
  initialAggregate?: Aggregate;
  onAggregateChange?: (aggregate: Aggregate) => void;
};

const dateFormatter = new Intl.DateTimeFormat("fa-IR", {
  year: "numeric",
  month: "long",
  day: "numeric",
});

function formatReviewDate(iso: string) {
  const date = new Date(iso);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return dateFormatter.format(date);
}

/**
 * Renders `value` filled stars out of `max`. When `interactive` is true the
 * stars become buttons so the user can pick a rating.
 */
function StarRating({
  value,
  max = 5,
  size = "md",
  interactive = false,
  onChange,
}: {
  value: number;
  max?: number;
  size?: "sm" | "md" | "lg";
  interactive?: boolean;
  onChange?: (value: number) => void;
}) {
  const starSize = size === "lg" ? "size-7" : size === "sm" ? "size-3.5" : "size-5";

  return (
    // Stars read left→right (1..5) even in RTL — keep them LTR for clarity.
    <div dir="ltr" className="inline-flex items-center gap-0.5">
      {Array.from({ length: max }, (_, index) => index + 1).map((position) => {
        const filled = position <= value;
        const star = (
          <Star
            className={cn(
              starSize,
              filled
                ? "fill-amber-400 text-amber-400"
                : "fill-transparent text-muted-foreground/40",
            )}
            aria-hidden="true"
          />
        );

        if (interactive) {
          return (
            <button
              key={position}
              type="button"
              onClick={() => onChange?.(position)}
              className="rounded-sm p-0.5 transition hover:scale-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring"
            >
              <span className="sr-only">{toFaNumber(position)} ستاره</span>
              {star}
            </button>
          );
        }

        return <span key={position}>{star}</span>;
      })}
    </div>
  );
}

export function ProductReviews({
  productId,
  isAuthenticated,
  initialAggregate,
  onAggregateChange,
}: ProductReviewsProps) {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [aggregate, setAggregate] = useState<Aggregate>(
    initialAggregate ?? { count: 0, average: 0 },
  );
  const [loading, setLoading] = useState(true);

  const [rating, setRating] = useState(5);
  const [titleFa, setTitleFa] = useState("");
  const [bodyFa, setBodyFa] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const loadReviews = useCallback(async () => {
    setLoading(true);

    try {
      const response = await fetch(`/api/reviews?productId=${encodeURIComponent(productId)}`, {
        cache: "no-store",
      });
      const payload = await response.json();

      if (response.ok && payload.ok) {
        setReviews(payload.data.reviews as Review[]);
        const nextAggregate = payload.data.aggregate as Aggregate;
        setAggregate(nextAggregate);
        onAggregateChange?.(nextAggregate);
      }
    } catch {
      // Silent — the empty/error state is handled by the rendered list.
    } finally {
      setLoading(false);
    }
  }, [productId, onAggregateChange]);

  useEffect(() => {
    loadReviews();
  }, [loadReviews]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (submitting) {
      return;
    }

    if (!bodyFa.trim()) {
      toast.error("متن دیدگاه را وارد کنید.");
      return;
    }

    setSubmitting(true);

    try {
      const response = await fetch("/api/reviews", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ productId, rating, titleFa: titleFa.trim(), bodyFa: bodyFa.trim() }),
      });
      const payload = await response.json();

      if (!response.ok || !payload.ok) {
        toast.error(payload?.error?.message ?? "ثبت دیدگاه ناموفق بود.");
        return;
      }

      toast.success("دیدگاه شما ثبت شد. سپاسگزاریم!");
      setTitleFa("");
      setBodyFa("");
      setRating(5);
      await loadReviews();
    } catch {
      toast.error("ارتباط با سرور برقرار نشد.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="mt-16 border-t border-border pt-8" aria-labelledby="reviews-heading">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.24em] text-muted-foreground">
            Pixevel
          </p>
          <h2 id="reviews-heading" className="mt-2 text-2xl font-black sm:text-3xl">
            دیدگاه کاربران
          </h2>
        </div>

        {aggregate.count > 0 ? (
          <div className="flex items-center gap-3">
            <StarRating value={Math.round(aggregate.average)} size="md" />
            <span className="text-sm font-bold">
              {toFaNumber(aggregate.average)} از ۵
              <span className="text-muted-foreground"> ({toFaNumber(aggregate.count)} دیدگاه)</span>
            </span>
          </div>
        ) : null}
      </div>

      {/* Write-review form / login prompt */}
      <div className="mb-10 rounded-2xl border border-border bg-muted/30 p-5">
        {isAuthenticated ? (
          <form onSubmit={handleSubmit} className="space-y-4">
            <h3 className="text-base font-black">دیدگاه خود را بنویسید</h3>

            <div>
              <p className="mb-2 text-sm font-bold">امتیاز شما</p>
              <StarRating value={rating} size="lg" interactive onChange={setRating} />
            </div>

            <div>
              <label htmlFor="review-title" className="mb-2 block text-sm font-bold">
                عنوان (اختیاری)
              </label>
              <input
                id="review-title"
                type="text"
                value={titleFa}
                onChange={(event) => setTitleFa(event.target.value)}
                maxLength={120}
                placeholder="یک عنوان کوتاه برای دیدگاه"
                className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30"
              />
            </div>

            <div>
              <label htmlFor="review-body" className="mb-2 block text-sm font-bold">
                متن دیدگاه
              </label>
              <textarea
                id="review-body"
                value={bodyFa}
                onChange={(event) => setBodyFa(event.target.value)}
                required
                rows={4}
                maxLength={2000}
                placeholder="تجربه خود از این محصول را با دیگران در میان بگذارید…"
                className="w-full resize-y rounded-xl border border-border bg-background px-3 py-2.5 text-sm leading-7 outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30"
              />
            </div>

            <Button
              type="submit"
              disabled={submitting}
              className="h-11 rounded-full bg-foreground px-6 text-sm font-black text-background"
            >
              {submitting ? "در حال ثبت…" : "ثبت دیدگاه"}
            </Button>
          </form>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm font-bold text-muted-foreground">
              برای ثبت دیدگاه لطفاً وارد حساب کاربری خود شوید.
            </p>
            <Link
              href="/login"
              className="rounded-full bg-foreground px-5 py-2.5 text-sm font-black text-background transition hover:opacity-90"
            >
              برای ثبت دیدگاه وارد شوید
            </Link>
          </div>
        )}
      </div>

      {/* Review list */}
      {loading ? (
        <p className="text-sm text-muted-foreground">در حال بارگذاری دیدگاه‌ها…</p>
      ) : reviews.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border px-5 py-10 text-center">
          <p className="text-sm font-bold text-muted-foreground">
            هنوز دیدگاهی برای این محصول ثبت نشده است.
          </p>
          <p className="mt-1 text-xs text-muted-foreground">اولین نفری باشید که نظر می‌دهد.</p>
        </div>
      ) : (
        <ul className="space-y-5">
          {reviews.map((review) => (
            <li key={review.id} className="rounded-2xl border border-border p-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-3">
                  <StarRating value={review.rating} size="sm" />
                  <span className="text-sm font-black">{review.authorName}</span>
                </div>
                <time className="text-xs text-muted-foreground" dateTime={review.createdAt}>
                  {formatReviewDate(review.createdAt)}
                </time>
              </div>

              {review.titleFa ? (
                <h4 className="mt-3 text-sm font-black">{review.titleFa}</h4>
              ) : null}
              <p className="mt-2 text-sm leading-7 text-muted-foreground">{review.bodyFa}</p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
