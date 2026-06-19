"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

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
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 backdrop-blur-xl lg:hidden"
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
