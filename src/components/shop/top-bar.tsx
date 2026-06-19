"use client";

import { Search, ShoppingBag, UserRound } from "lucide-react";
import Link from "next/link";
import { useCart } from "@/components/shop/cart-provider";
import type { CurrentUser } from "@/lib/auth";
import { toFaNumber } from "@/lib/format";
import { useHideOnScroll } from "@/lib/use-hide-on-scroll";

export function TopBar({ user }: { user: CurrentUser | null }) {
  const hidden = useHideOnScroll();
  const { count } = useCart();
  const accountHref = user ? "/account" : "/login";

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 border-b border-luxe-border bg-luxe/80 text-luxe-foreground backdrop-blur-xl transition-transform duration-300 ${
        hidden ? "-translate-y-full" : ""
      }`}
      aria-label="نوار بالا"
    >
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link href="/" className="flex items-baseline gap-1.5" aria-label="پیسکول، خانه">
          <span className="text-lg font-black tracking-wide text-gold">پیسکول</span>
          <span className="text-[10px] tracking-[0.3em] text-luxe-muted">DIGITAL</span>
        </Link>
        <nav className="flex items-center gap-5" aria-label="میانبرها">
          <Link href="/products" aria-label="جستجو" className="transition hover:text-gold">
            <Search className="size-5" />
          </Link>
          <Link href={accountHref} aria-label="حساب" className="transition hover:text-gold">
            <UserRound className="size-5" />
          </Link>
          <Link href="/basket" aria-label="سبد" className="relative transition hover:text-gold">
            <ShoppingBag className="size-5" />
            {count > 0 ? (
              <span className="absolute -left-2 -top-2 grid h-4 min-w-4 place-items-center rounded-full bg-gold px-1 text-[10px] font-black text-luxe">
                {count > 9 ? "+۹" : toFaNumber(count)}
              </span>
            ) : null}
          </Link>
        </nav>
      </div>
    </header>
  );
}
