"use client";

import { Minus, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import type { CartView } from "@/lib/cart";
import { formatToman, toFaNumber } from "@/lib/format";

async function mutate(method: "PATCH" | "DELETE", variantId: string, quantity?: number) {
  const response = await fetch("/api/cart/item", {
    method,
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ variantId, quantity }),
  });
  const payload = await response.json();

  if (!response.ok || !payload.ok) {
    throw new Error(payload?.error?.message ?? "خطا در به‌روزرسانی سبد.");
  }

  return payload.data.cart as CartView;
}

export function BasketItems({
  initialCart,
  isLoggedIn,
}: {
  initialCart: CartView;
  isLoggedIn: boolean;
}) {
  const [cart, setCart] = useState(initialCart);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run(variantId: string, action: () => Promise<CartView>) {
    setPendingId(variantId);
    setError(null);

    try {
      const next = await action();
      setCart(next);
      window.dispatchEvent(new CustomEvent("cart:changed"));
    } catch (err) {
      setError(err instanceof Error ? err.message : "خطای ناشناخته.");
    } finally {
      setPendingId(null);
    }
  }

  if (cart.items.length === 0) {
    return (
      <div className="border border-border bg-card p-8 text-center">
        <p className="text-muted-foreground">سبد خرید شما خالی است.</p>
        <Link
          href="/products"
          className="mt-4 inline-block rounded-full bg-foreground px-6 py-3 text-sm font-black text-background"
        >
          مشاهده محصولات
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="space-y-3">
        {cart.items.map((item) => {
          const busy = pendingId === item.variantId;

          return (
            <div
              key={item.variantId}
              className="flex gap-4 border border-border bg-card p-3"
              data-busy={busy}
            >
              <div className="size-20 shrink-0 overflow-hidden bg-muted">
                {item.imageUrl ? (
                  <img
                    src={item.imageUrl}
                    alt={item.titleFa}
                    className="h-full w-full object-cover"
                  />
                ) : null}
              </div>
              <div className="flex flex-1 flex-col justify-between">
                <div>
                  <Link href={`/products/${item.productSlug}`} className="font-black">
                    {item.titleFa}
                  </Link>
                  <p className="text-xs text-muted-foreground">{item.size}</p>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      aria-label="کاهش"
                      disabled={busy}
                      onClick={() =>
                        run(item.variantId, () =>
                          mutate("PATCH", item.variantId, item.quantity - 1),
                        )
                      }
                      className="grid size-8 place-items-center border border-border disabled:opacity-50"
                    >
                      <Minus className="size-4" />
                    </button>
                    <span className="min-w-6 text-center font-bold">
                      {toFaNumber(item.quantity)}
                    </span>
                    <button
                      type="button"
                      aria-label="افزایش"
                      disabled={busy || item.quantity >= item.availableStock}
                      onClick={() =>
                        run(item.variantId, () =>
                          mutate("PATCH", item.variantId, item.quantity + 1),
                        )
                      }
                      className="grid size-8 place-items-center border border-border disabled:opacity-50"
                    >
                      <Plus className="size-4" />
                    </button>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-black">{formatToman(item.lineTotal)}</span>
                    <button
                      type="button"
                      aria-label="حذف"
                      disabled={busy}
                      onClick={() => run(item.variantId, () => mutate("DELETE", item.variantId))}
                      className="text-muted-foreground hover:text-destructive disabled:opacity-50"
                    >
                      <Trash2 className="size-5" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {error ? <p className="text-sm font-bold text-destructive">{error}</p> : null}

      <div className="border-t border-border pt-4">
        <div className="flex items-center justify-between text-lg font-black">
          <span>جمع کل</span>
          <span>{formatToman(cart.subtotal)}</span>
        </div>
        {isLoggedIn ? (
          <Link
            href="/checkout"
            className="mt-4 grid h-12 w-full place-items-center rounded-full bg-foreground text-base font-black text-background"
          >
            ثبت سفارش
          </Link>
        ) : (
          <Link
            href="/login?redirect=/basket"
            className="mt-4 grid h-12 w-full place-items-center rounded-full bg-foreground text-base font-black text-background"
          >
            ورود و ادامه خرید
          </Link>
        )}
      </div>
    </div>
  );
}
