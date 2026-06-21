"use client";

import { Pencil, Star, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { MyReviewDto } from "@/lib/account/reviews";
import { type StatusTone, toneClass } from "@/lib/status-labels";
import { cn } from "@/lib/utils";

const STATUS_META: Record<MyReviewDto["status"], { label: string; tone: StatusTone }> = {
  PENDING: { label: "در انتظار بررسی", tone: "warning" },
  APPROVED: { label: "تأیید شده", tone: "success" },
  REJECTED: { label: "رد شده", tone: "danger" },
};

function faDate(value: string): string {
  return new Date(value).toLocaleDateString("fa-IR", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function Stars({ value, onChange }: { value: number; onChange?: (next: number) => void }) {
  const interactive = typeof onChange === "function";
  return (
    <div className="flex items-center gap-0.5" dir="ltr">
      {[1, 2, 3, 4, 5].map((n) =>
        interactive ? (
          <button
            key={n}
            type="button"
            onClick={() => onChange?.(n)}
            className="p-0.5"
            aria-label={`امتیاز ${n} از ۵`}
          >
            <Star
              className={cn(
                "size-5 transition-colors",
                n <= value ? "fill-gold text-gold" : "text-muted-foreground/40",
              )}
            />
          </button>
        ) : (
          <Star
            key={n}
            className={cn(
              "size-4",
              n <= value ? "fill-gold text-gold" : "text-muted-foreground/30",
            )}
          />
        ),
      )}
    </div>
  );
}

export function ReviewRow({ review }: { review: MyReviewDto }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [pending, setPending] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rating, setRating] = useState(review.rating);
  const [titleFa, setTitleFa] = useState(review.titleFa ?? "");
  const [bodyFa, setBodyFa] = useState(review.bodyFa);

  const status = STATUS_META[review.status];
  const productHref = review.product?.slug ? `/products/${review.product.slug}` : null;
  const productTitle = review.product?.titleFa ?? "محصول حذف‌شده";

  function resetForm() {
    setRating(review.rating);
    setTitleFa(review.titleFa ?? "");
    setBodyFa(review.bodyFa);
    setError(null);
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    const res = await fetch(`/api/account/reviews/${review.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rating, titleFa, bodyFa }),
    });
    const json = await res.json().catch(() => null);
    setPending(false);
    if (!res.ok) {
      setError(json?.error?.message ?? "ذخیره دیدگاه ممکن نشد.");
      return;
    }
    setEditing(false);
    toast.success("دیدگاه ویرایش شد و دوباره در صف بررسی قرار گرفت.");
    router.refresh();
  }

  async function remove() {
    if (!window.confirm("این دیدگاه حذف شود؟ این کار قابل بازگشت نیست.")) {
      return;
    }
    setDeleting(true);
    const res = await fetch(`/api/account/reviews/${review.id}`, { method: "DELETE" });
    const json = await res.json().catch(() => null);
    if (!res.ok) {
      setDeleting(false);
      toast.error(json?.error?.message ?? "حذف دیدگاه ممکن نشد.");
      return;
    }
    toast.success("دیدگاه حذف شد.");
    router.refresh();
  }

  return (
    <Card className="p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          {review.product?.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={review.product.imageUrl}
              alt={productTitle}
              className="size-12 shrink-0 rounded-md object-cover"
            />
          ) : (
            <div className="grid size-12 shrink-0 place-items-center rounded-md bg-muted text-xs text-muted-foreground">
              بدون تصویر
            </div>
          )}
          <div className="min-w-0">
            {productHref ? (
              <Link
                href={productHref}
                className="line-clamp-1 font-black hover:underline underline-offset-4"
              >
                {productTitle}
              </Link>
            ) : (
              <p className="line-clamp-1 font-black text-muted-foreground">{productTitle}</p>
            )}
            <p className="mt-0.5 text-xs text-muted-foreground">{faDate(review.createdAt)}</p>
          </div>
        </div>
        <Badge className={cn("border-0", toneClass(status.tone))}>{status.label}</Badge>
      </div>

      {editing ? (
        <form onSubmit={save} className="mt-4 space-y-4">
          <div className="space-y-1.5">
            <Label>امتیاز</Label>
            <Stars value={rating} onChange={setRating} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`title-${review.id}`}>عنوان (اختیاری)</Label>
            <Input
              id={`title-${review.id}`}
              value={titleFa}
              maxLength={120}
              onChange={(e) => setTitleFa(e.target.value)}
              placeholder="عنوان کوتاه دیدگاه"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`body-${review.id}`}>متن دیدگاه</Label>
            <textarea
              id={`body-${review.id}`}
              value={bodyFa}
              maxLength={2000}
              rows={4}
              onChange={(e) => setBodyFa(e.target.value)}
              className="flex min-h-20 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm outline-none transition-colors placeholder:text-muted-foreground focus-visible:ring-1 focus-visible:ring-ring"
              placeholder="تجربه‌ی خود از این محصول را بنویسید"
            />
          </div>

          <p className="text-xs text-muted-foreground">
            با ویرایش، دیدگاه دوباره برای تأیید بررسی می‌شود.
          </p>

          {error ? <p className="text-sm font-bold text-red-600">{error}</p> : null}

          <div className="flex gap-2">
            <Button type="submit" size="sm" disabled={pending}>
              {pending ? "در حال ذخیره…" : "ذخیره"}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => {
                setEditing(false);
                resetForm();
              }}
            >
              انصراف
            </Button>
          </div>
        </form>
      ) : (
        <div className="mt-3">
          <Stars value={review.rating} />
          {review.titleFa ? <p className="mt-2 font-bold">{review.titleFa}</p> : null}
          <p className="mt-1 whitespace-pre-line text-sm text-muted-foreground">{review.bodyFa}</p>

          <div className="mt-4 flex gap-2">
            <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
              <Pencil className="size-4" />
              ویرایش
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="text-red-600 hover:text-red-700"
              onClick={remove}
              disabled={deleting}
            >
              <Trash2 className="size-4" />
              {deleting ? "در حال حذف…" : "حذف"}
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}
