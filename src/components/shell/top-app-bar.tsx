"use client";

import { Menu, Search, ShoppingBag } from "lucide-react";
import Link from "next/link";

import { useCart } from "@/components/shop/cart-provider";
import { ThemeToggle } from "@/components/shop/theme-toggle";
import type { CurrentUser } from "@/lib/auth";
import { toFaNumber } from "@/lib/format";

export function TopAppBar({
  user: _user,
  onMenu,
}: {
  user: CurrentUser | null;
  onMenu: () => void;
}) {
  const { count } = useCart();

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/90 backdrop-blur-xl">
      <div className="mx-auto flex h-14 w-full max-w-7xl items-center gap-3 px-4 sm:px-6">
        <button
          type="button"
          onClick={onMenu}
          aria-label="باز کردن منو"
          className="grid size-9 place-items-center rounded-md text-foreground transition hover:bg-muted lg:hidden"
        >
          <Menu className="size-5" />
        </button>

        <Link href="/" className="flex items-baseline gap-1.5" aria-label="پیسکول، خانه">
          <span className="text-lg font-black tracking-wide text-gold">پیسکول</span>
          <span className="text-[10px] tracking-[0.3em] text-muted-foreground">DIGITAL</span>
        </Link>

        <form action="/products" role="search" className="hidden flex-1 justify-center sm:flex">
          <label className="relative block w-full max-w-sm">
            <Search className="pointer-events-none absolute inset-y-0 start-3 my-auto size-4 text-muted-foreground" />
            <input
              name="q"
              type="search"
              placeholder="جستجوی محصول…"
              className="h-9 w-full rounded-md border border-border bg-muted/40 pe-3 ps-9 text-sm outline-none transition focus:border-gold"
            />
          </label>
        </form>

        <nav className="ms-auto flex items-center gap-1" aria-label="میانبرها">
          <Link
            href="/products"
            aria-label="جستجو"
            className="grid size-9 place-items-center rounded-md transition hover:bg-muted sm:hidden"
          >
            <Search className="size-5" />
          </Link>
          <ThemeToggle className="grid size-9 place-items-center rounded-md text-foreground transition hover:bg-muted" />
          <Link
            href="/basket"
            aria-label="سبد خرید"
            className="relative grid size-9 place-items-center rounded-md transition hover:bg-muted"
          >
            <ShoppingBag className="size-5" />
            {count > 0 ? (
              <span className="absolute end-1 top-1 grid h-4 min-w-4 place-items-center rounded-full bg-gold px-1 text-[10px] font-black text-background">
                {count > 9 ? "+۹" : toFaNumber(count)}
              </span>
            ) : null}
          </Link>
        </nav>
      </div>
    </header>
  );
}
