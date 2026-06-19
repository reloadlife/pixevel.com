"use client";

import { ShoppingBag } from "lucide-react";
import Link from "next/link";

import { useCart } from "@/components/shop/cart-provider";
import { formatToman, toFaNumber } from "@/lib/format";

/** Quick cart view shared by the drawer (mobile / desktop click) and the hover preview. */
export function MiniCart({ onNavigate }: { onNavigate?: () => void }) {
  const { cart } = useCart();

  if (cart.items.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 px-6 py-10 text-center">
        <ShoppingBag className="size-8 text-muted-foreground" aria-hidden="true" />
        <p className="text-sm text-muted-foreground">سبد خرید شما خالی است.</p>
        <Link
          href="/products"
          onClick={onNavigate}
          className="rounded-full bg-foreground px-5 py-2.5 text-sm font-black text-background"
        >
          مشاهده محصولات
        </Link>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto px-2 py-1">
        {cart.items.map((item) => (
          <div key={item.variantId} className="flex items-center gap-3 rounded-lg p-2">
            <div className="size-14 shrink-0 overflow-hidden rounded-md bg-muted">
              {item.imageUrl ? (
                // biome-ignore lint/performance/noImgElement: admin-entered media URLs.
                <img
                  src={item.imageUrl}
                  alt={item.titleFa}
                  className="h-full w-full object-cover"
                />
              ) : null}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold">{item.titleFa}</p>
              <p className="truncate text-xs text-muted-foreground">{item.variantTitleFa}</p>
              <p className="text-xs text-muted-foreground">{toFaNumber(item.quantity)} عدد</p>
            </div>
            <span className="shrink-0 text-sm font-black">{formatToman(item.lineTotal)}</span>
          </div>
        ))}
      </div>
      <div className="space-y-3 border-t border-border p-4">
        <div className="flex items-center justify-between font-black">
          <span>جمع کل</span>
          <span className="text-gold">{formatToman(cart.subtotal)}</span>
        </div>
        <Link
          href="/checkout"
          onClick={onNavigate}
          className="block rounded-full bg-foreground py-3 text-center text-sm font-black text-background"
        >
          تسویه حساب
        </Link>
        <Link
          href="/basket"
          onClick={onNavigate}
          className="block text-center text-sm font-bold text-muted-foreground transition hover:text-foreground"
        >
          مشاهده سبد کامل
        </Link>
      </div>
    </div>
  );
}
