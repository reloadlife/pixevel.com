"use client";

import { Minus, Plus, ShoppingBag, Trash2 } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import Link from "next/link";
import { useState } from "react";

import { type CartLine, useCart } from "@/components/shop/cart-provider";
import { formatToman, toFaNumber } from "@/lib/format";

/** Quick cart view shared by the drawer (mobile / desktop click) and the hover popover. */
export function MiniCart({ onNavigate }: { onNavigate?: () => void }) {
  const { cart } = useCart();
  const reduce = useReducedMotion();

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
        <AnimatePresence initial={false}>
          {cart.items.map((item) => (
            <motion.div
              key={item.variantId}
              layout={!reduce}
              initial={reduce ? false : { opacity: 0, height: 0 }}
              animate={reduce ? {} : { opacity: 1, height: "auto" }}
              exit={reduce ? { opacity: 0 } : { opacity: 0, height: 0 }}
              transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
              className="overflow-hidden"
            >
              <CartRow item={item} />
            </motion.div>
          ))}
        </AnimatePresence>
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

const stepBtn =
  "grid size-6 place-items-center rounded-full text-foreground transition hover:bg-muted disabled:opacity-40";

/** One cart line with its own qty stepper + remove control, guarded by a local busy flag. */
function CartRow({ item }: { item: CartLine }) {
  const { setQuantity, removeItem } = useCart();
  const [busy, setBusy] = useState(false);

  async function run(action: () => Promise<void>) {
    if (busy) return;
    setBusy(true);
    try {
      await action();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center gap-3 rounded-lg p-2">
      <div className="size-14 shrink-0 overflow-hidden rounded-md bg-muted">
        {item.imageUrl ? (
          <img src={item.imageUrl} alt={item.titleFa} className="h-full w-full object-cover" />
        ) : null}
      </div>

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-bold">{item.titleFa}</p>
        <p className="truncate text-xs text-muted-foreground">{item.variantTitleFa}</p>
        <div className="mt-1.5 inline-flex items-center gap-1 rounded-full border border-border p-0.5">
          <button
            type="button"
            aria-label="کاهش تعداد"
            disabled={busy}
            onClick={() => run(() => setQuantity(item.variantId, item.quantity - 1))}
            className={stepBtn}
          >
            <Minus className="size-3.5" />
          </button>
          <span className="min-w-5 text-center text-xs font-black tabular-nums">
            {toFaNumber(item.quantity)}
          </span>
          <button
            type="button"
            aria-label="افزایش تعداد"
            disabled={busy}
            onClick={() => run(() => setQuantity(item.variantId, item.quantity + 1))}
            className={stepBtn}
          >
            <Plus className="size-3.5" />
          </button>
        </div>
      </div>

      <div className="flex shrink-0 flex-col items-end gap-1.5">
        <span className="text-sm font-black">{formatToman(item.lineTotal)}</span>
        <button
          type="button"
          aria-label="حذف از سبد"
          disabled={busy}
          onClick={() => run(() => removeItem(item.variantId))}
          className="grid size-7 place-items-center rounded-md text-muted-foreground transition hover:bg-muted hover:text-destructive disabled:opacity-40"
        >
          <Trash2 className="size-4" />
        </button>
      </div>
    </div>
  );
}
