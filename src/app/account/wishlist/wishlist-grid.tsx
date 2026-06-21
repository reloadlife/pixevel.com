"use client";

import { Heart, ShoppingBag, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { WishlistEntry } from "@/lib/account/wishlist";
import { formatToman } from "@/lib/format";
import { cn } from "@/lib/utils";

export function WishlistGrid({ items }: { items: WishlistEntry[] }) {
  const router = useRouter();
  // Optimistic local copy so removals feel instant.
  const [entries, setEntries] = useState(items);
  const [busy, setBusy] = useState<Record<string, boolean>>({});

  function setRowBusy(id: string, value: boolean) {
    setBusy((prev) => ({ ...prev, [id]: value }));
  }

  async function remove(entry: WishlistEntry) {
    setRowBusy(entry.id, true);
    const snapshot = entries;
    setEntries((prev) => prev.filter((item) => item.id !== entry.id));

    try {
      const res = await fetch("/api/wishlist", {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ productId: entry.productId }),
      });
      const payload = await res.json().catch(() => null);
      if (!res.ok || !payload?.ok) {
        setEntries(snapshot);
        toast.error(payload?.error?.message ?? "حذف ناموفق بود.");
        return;
      }
      toast.success("از علاقه‌مندی‌ها حذف شد.");
      router.refresh();
    } catch {
      setEntries(snapshot);
      toast.error("ارتباط با سرور برقرار نشد.");
    } finally {
      setRowBusy(entry.id, false);
    }
  }

  async function addToCart(entry: WishlistEntry) {
    if (!entry.addToCartVariantId) {
      return;
    }
    setRowBusy(entry.id, true);
    try {
      const res = await fetch("/api/cart", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ variantId: entry.addToCartVariantId, quantity: 1 }),
      });
      const payload = await res.json().catch(() => null);
      if (!res.ok || !payload?.ok) {
        toast.error(payload?.error?.message ?? "افزودن به سبد ناموفق بود.");
        return;
      }
      window.dispatchEvent(new CustomEvent("cart:changed"));
      toast.success("به سبد خرید اضافه شد.");
    } catch {
      toast.error("ارتباط با سرور برقرار نشد.");
    } finally {
      setRowBusy(entry.id, false);
    }
  }

  if (entries.length === 0) {
    return (
      <Card className="items-center gap-4 px-6 py-14 text-center">
        <div className="grid size-14 place-items-center rounded-full bg-gold/15 text-gold">
          <Heart className="size-6" aria-hidden />
        </div>
        <div>
          <p className="text-base font-black">لیست علاقه‌مندی‌های شما خالی است</p>
          <p className="mt-1 text-sm text-muted-foreground">
            محصولاتی که دوست دارید را ذخیره کنید تا بعداً سریع‌تر پیدایشان کنید.
          </p>
        </div>
        <Button nativeButton={false} render={<Link href="/products">مشاهده محصولات</Link>} />
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
      {entries.map((entry) => {
        const canBuy = entry.isActive && entry.availableStock > 0 && entry.addToCartVariantId;
        const rowBusy = Boolean(busy[entry.id]);
        return (
          <Card key={entry.id} className="gap-0 p-0">
            <div className="relative aspect-square w-full overflow-hidden bg-muted">
              <Link href={`/products/${entry.slug}`} className="block size-full">
                {entry.imageUrl ? (
                  <img
                    src={entry.imageUrl}
                    alt={entry.titleFa}
                    className="size-full object-cover transition duration-500 hover:scale-105"
                  />
                ) : (
                  <div className="grid size-full place-items-center text-muted-foreground">
                    <ShoppingBag className="size-8" aria-hidden />
                  </div>
                )}
              </Link>
              <button
                type="button"
                onClick={() => remove(entry)}
                disabled={rowBusy}
                aria-label="حذف از علاقه‌مندی‌ها"
                title="حذف از علاقه‌مندی‌ها"
                className="absolute end-2 top-2 grid size-8 place-items-center rounded-full bg-background/80 text-muted-foreground shadow-sm ring-1 ring-foreground/10 backdrop-blur transition-colors hover:text-destructive disabled:opacity-50"
              >
                <Trash2 className="size-4" aria-hidden />
              </button>
              {!entry.isActive ? (
                <Badge variant="secondary" className="absolute start-2 top-2 bg-muted">
                  غیرفعال
                </Badge>
              ) : entry.availableStock <= 0 ? (
                <Badge variant="secondary" className="absolute start-2 top-2 bg-muted">
                  ناموجود
                </Badge>
              ) : null}
            </div>

            <div className="flex flex-1 flex-col gap-2 p-3">
              <Link
                href={`/products/${entry.slug}`}
                className="line-clamp-2 text-sm font-black leading-6 hover:underline"
              >
                {entry.titleFa}
              </Link>
              <div className="mt-auto flex items-baseline gap-2">
                <span className="text-sm font-black">{formatToman(entry.price)}</span>
                {entry.compareAtAmount > entry.price ? (
                  <span className="text-xs text-muted-foreground line-through">
                    {formatToman(entry.compareAtAmount)}
                  </span>
                ) : null}
              </div>
              <Button
                type="button"
                size="sm"
                onClick={() => addToCart(entry)}
                disabled={!canBuy || rowBusy}
                className={cn("w-full", !canBuy && "opacity-60")}
              >
                <ShoppingBag className="size-4" aria-hidden />
                {canBuy ? "افزودن به سبد" : "ناموجود"}
              </Button>
            </div>
          </Card>
        );
      })}
    </div>
  );
}
