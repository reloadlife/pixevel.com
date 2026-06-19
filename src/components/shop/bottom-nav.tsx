"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, LayoutDashboard, Search, ShoppingBag, UserRound } from "lucide-react";

import type { CurrentUser } from "@/lib/auth";
import { useCart } from "@/components/shop/cart-provider";
import { useHideOnScroll } from "@/lib/use-hide-on-scroll";
import { toFaNumber } from "@/lib/format";

const navItems = [
  { href: "/", label: "خانه", icon: Home },
  { href: "/products", label: "محصولات", icon: Search },
  { href: "/login", label: "حساب", icon: UserRound },
  { href: "/basket", label: "سبد", icon: ShoppingBag },
];

export function BottomNav({ user }: { user: CurrentUser | null }) {
  const hidden = useHideOnScroll();
  const { count: cartCount } = useCart();
  const pathname = usePathname();

  const items =
    user?.role === "ADMIN"
      ? [
          navItems[0],
          navItems[1],
          { href: "/admin", label: "مدیریت", icon: LayoutDashboard },
          navItems[2],
          navItems[3],
        ]
      : navItems;

  return (
    <nav
      className={`fixed inset-x-3 bottom-3 z-50 rounded-2xl border border-luxe-border bg-luxe/90 text-luxe-muted shadow-2xl backdrop-blur-xl transition-transform duration-300 sm:inset-x-auto sm:right-1/2 sm:w-[420px] sm:translate-x-1/2 ${
        hidden ? "translate-y-24 sm:translate-x-1/2" : ""
      }`}
      aria-label="منوی اصلی"
    >
      <div
        className="grid h-16"
        style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}
      >
        {items.map((item) => {
          const Icon = item.icon;
          const href = item.label === "حساب" && user ? "/account" : item.href;
          const isActive =
            href === "/" ? pathname === "/" : pathname.startsWith(href);
          const showBadge = item.label === "سبد" && cartCount > 0;

          return (
            <Link
              key={item.label}
              href={href}
              aria-current={isActive ? "page" : undefined}
              className={`flex flex-col items-center justify-center gap-1 text-xs font-bold transition ${
                isActive ? "text-gold" : "text-luxe-muted hover:text-luxe-foreground"
              }`}
            >
              <span className="relative">
                <Icon className="size-5" />
                {showBadge ? (
                  <span className="absolute -right-2 -top-2 grid h-4 min-w-4 place-items-center rounded-full bg-gold px-1 text-[10px] font-black text-luxe">
                    {cartCount > 9 ? "+۹" : toFaNumber(cartCount)}
                  </span>
                ) : null}
              </span>
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
