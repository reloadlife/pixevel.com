"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { useCart } from "@/components/shop/cart-provider";
import type { CurrentUser } from "@/lib/auth";
import { toFaNumber } from "@/lib/format";
import { type BottomTab, bottomTabs, type Category, isActivePath } from "@/lib/nav-items";
import { cn } from "@/lib/utils";
import { CategoryMenu } from "./category-menu";

const tabClass = (active: boolean) =>
  cn(
    "flex flex-col items-center justify-center gap-1 py-2 text-[11px] font-bold transition",
    active ? "text-gold" : "text-muted-foreground hover:text-foreground",
  );

/** Minimum scroll delta (px) before we register a direction change. */
const DELTA_THRESHOLD = 6;
/** Scroll position (px from top) below which we always show the bar. */
const TOP_THRESHOLD = 60;

function useScrollDirection() {
  const [hidden, setHidden] = useState(false);
  const lastScrollY = useRef(0);
  const rafId = useRef<number | null>(null);

  useEffect(() => {
    // Respect prefers-reduced-motion: skip animation, always show
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reducedMotion) return;

    const onScroll = () => {
      if (rafId.current !== null) return; // already scheduled

      rafId.current = requestAnimationFrame(() => {
        rafId.current = null;
        const currentY = window.scrollY;
        const delta = currentY - lastScrollY.current;

        if (Math.abs(delta) < DELTA_THRESHOLD) return; // ignore tiny jitter

        if (currentY <= TOP_THRESHOLD) {
          // Near the top — always visible
          setHidden(false);
        } else if (delta > 0) {
          // Scrolling down — hide
          setHidden(true);
        } else {
          // Scrolling up — show
          setHidden(false);
        }

        lastScrollY.current = currentY;
      });
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (rafId.current !== null) {
        cancelAnimationFrame(rafId.current);
        rafId.current = null;
      }
    };
  }, []);

  return hidden;
}

export function BottomTabs({
  user,
  categories,
}: {
  user: CurrentUser | null;
  categories: Category[];
}) {
  const pathname = usePathname();
  const { count } = useCart();
  const tabs = bottomTabs(user);
  const hidden = useScrollDirection();

  function inner(tab: BottomTab) {
    const Icon = tab.icon;
    const showBadge = tab.key === "basket" && count > 0;
    return (
      <>
        <span className="relative">
          <Icon className="size-5" />
          {showBadge ? (
            <span className="absolute -end-2 -top-1.5 grid h-4 min-w-4 place-items-center rounded-full bg-gold px-1 text-[9px] font-black text-background">
              {count > 9 ? "+۹" : toFaNumber(count)}
            </span>
          ) : null}
        </span>
        {tab.label}
      </>
    );
  }

  return (
    <nav
      aria-label="ناوبری پایین"
      className={cn(
        "fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 backdrop-blur-xl lg:hidden",
        "transition-transform duration-300 ease-in-out",
        hidden && "translate-y-full",
      )}
    >
      <div className="mx-auto grid max-w-md grid-cols-4">
        {tabs.map((tab) => {
          const active = tab.href ? isActivePath(tab.href, pathname, tab.exact) : false;

          if (tab.key === "categories") {
            return (
              <CategoryMenu
                key={tab.key}
                categories={categories}
                trigger={
                  <button type="button" aria-label="دسته‌بندی‌ها" className={tabClass(false)}>
                    {inner(tab)}
                  </button>
                }
              />
            );
          }

          return (
            <Link
              key={tab.key}
              href={tab.href as string}
              aria-current={active ? "page" : undefined}
              className={tabClass(active)}
            >
              {inner(tab)}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
