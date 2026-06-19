"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Home, LayoutDashboard, Search, ShoppingBag, UserRound } from "lucide-react";

import type { CurrentUser } from "@/lib/auth";
import { toFaNumber } from "@/lib/format";

const navItems = [
  { href: "/", label: "خانه", icon: Home },
  { href: "/products", label: "محصولات", icon: Search },
  { href: "/login", label: "حساب", icon: UserRound },
  { href: "/basket", label: "سبد", icon: ShoppingBag },
];

const SCROLL_DELTA = 8;
const TOP_REVEAL_OFFSET = 80;
const BOTTOM_REVEAL_OFFSET = 24;

export function BottomNav({ user }: { user: CurrentUser | null }) {
  const [hidden, setHidden] = useState(false);
  const [cartCount, setCartCount] = useState(0);

  useEffect(() => {
    let active = true;

    async function loadCount() {
      try {
        const response = await fetch("/api/cart", { cache: "no-store" });
        const payload = await response.json();

        if (active && payload?.ok) {
          setCartCount(payload.data.cart.itemCount ?? 0);
        }
      } catch {
        // Ignore — badge stays at its last known value.
      }
    }

    loadCount();
    window.addEventListener("cart:changed", loadCount);
    window.addEventListener("focus", loadCount);

    return () => {
      active = false;
      window.removeEventListener("cart:changed", loadCount);
      window.removeEventListener("focus", loadCount);
    };
  }, []);
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

  useEffect(() => {
    let lastY = window.scrollY;
    let frame: number | null = null;

    function updateVisibility() {
      frame = null;

      const currentY = Math.max(0, window.scrollY);
      const maxY = Math.max(
        0,
        document.documentElement.scrollHeight - window.innerHeight
      );
      const delta = currentY - lastY;
      const nearTop = currentY < TOP_REVEAL_OFFSET;
      const nearBottom = currentY > maxY - BOTTOM_REVEAL_OFFSET;

      if (nearTop || nearBottom || delta < -SCROLL_DELTA) {
        setHidden(false);
      } else if (delta > SCROLL_DELTA) {
        setHidden(true);
      }

      lastY = currentY;
    }

    function onScroll() {
      if (frame !== null) {
        return;
      }

      frame = window.requestAnimationFrame(updateVisibility);
    }

    window.addEventListener("scroll", onScroll, { passive: true });

    return () => {
      if (frame !== null) {
        window.cancelAnimationFrame(frame);
      }

      window.removeEventListener("scroll", onScroll);
    };
  }, []);

  return (
    <nav
      className={`fixed inset-x-3 bottom-3 z-50 border border-border/70 bg-background/92 shadow-2xl backdrop-blur-xl transition-transform duration-300 sm:inset-x-auto sm:right-1/2 sm:w-[420px] sm:translate-x-1/2 ${
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

          const showBadge = item.label === "سبد" && cartCount > 0;

          return (
            <Link
              key={item.label}
              href={href}
              className="flex flex-col items-center justify-center gap-1 text-xs font-bold text-muted-foreground transition hover:text-foreground"
            >
              <span className="relative">
                <Icon className="size-5" />
                {showBadge ? (
                  <span className="absolute -right-2 -top-2 grid h-4 min-w-4 place-items-center rounded-full bg-primary px-1 text-[10px] font-black text-primary-foreground">
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
