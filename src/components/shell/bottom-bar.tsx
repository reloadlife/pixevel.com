"use client";

import { Menu } from "lucide-react";
import Link from "next/link";

import { useCart } from "@/components/shop/cart-provider";
import { toFaNumber } from "@/lib/format";
import { isActiveNav, type ShellNav } from "@/lib/nav-items";
import { cn } from "@/lib/utils";

export function BottomBar({
  nav,
  pathname,
  onMenu,
}: {
  nav: ShellNav;
  pathname: string;
  onMenu: () => void;
}) {
  const { count } = useCart();

  return (
    <nav
      aria-label="ناوبری پایین"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 backdrop-blur-xl lg:hidden"
    >
      <div
        className="mx-auto grid max-w-md"
        style={{ gridTemplateColumns: `repeat(${nav.bottomBar.length + 1}, minmax(0,1fr))` }}
      >
        {nav.bottomBar.map((item) => {
          const Icon = item.icon;
          const active = isActiveNav(item, pathname);
          const showBadge = item.href === "/basket" && count > 0;
          return (
            <Link
              key={item.href + item.label}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex flex-col items-center justify-center gap-1 py-2 text-[11px] font-bold transition",
                active ? "text-gold" : "text-muted-foreground hover:text-foreground",
              )}
            >
              <span className="relative">
                <Icon className="size-5" />
                {showBadge ? (
                  <span className="absolute -end-2 -top-1.5 grid h-4 min-w-4 place-items-center rounded-full bg-gold px-1 text-[9px] font-black text-background">
                    {count > 9 ? "+۹" : toFaNumber(count)}
                  </span>
                ) : null}
              </span>
              {item.label}
            </Link>
          );
        })}
        <button
          type="button"
          onClick={onMenu}
          aria-label="منو"
          className="flex flex-col items-center justify-center gap-1 py-2 text-[11px] font-bold text-muted-foreground transition hover:text-foreground"
        >
          <Menu className="size-5" />
          منو
        </button>
      </div>
    </nav>
  );
}
