"use client";

import { LayoutGrid, ShoppingBag } from "lucide-react";
import Link from "next/link";

import { useCart } from "@/components/shop/cart-provider";
import { ThemeToggle } from "@/components/shop/theme-toggle";
import type { CurrentUser } from "@/lib/auth";
import { toFaNumber } from "@/lib/format";
import type { Category } from "@/lib/nav-items";
import { AccountMenu } from "./account-menu";
import { CategoryMenu } from "./category-menu";
import { SearchBar } from "./search-bar";

const iconButton =
  "grid size-9 place-items-center rounded-md text-foreground transition hover:bg-muted";

/**
 * Search-dominant storefront header (Digikala/Torob pattern). On mobile the
 * search bar drops to its own row; on desktop it grows inline and a category
 * strip sits below.
 */
export function SiteHeader({
  user,
  categories,
}: {
  user: CurrentUser | null;
  categories: Category[];
}) {
  const { count } = useCart();
  const topCategories = categories.slice(0, 6);

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/90 backdrop-blur-xl">
      <div className="mx-auto flex h-14 w-full max-w-7xl items-center gap-3 px-4 sm:px-6">
        <Link href="/" className="flex shrink-0 items-baseline gap-1.5" aria-label="پیسکول، خانه">
          <span className="text-lg font-black tracking-wide text-gold">پیسکول</span>
          <span className="hidden text-[10px] tracking-[0.3em] text-muted-foreground sm:inline">
            DIGITAL
          </span>
        </Link>

        <SearchBar className="hidden flex-1 sm:block" />

        <div className="ms-auto flex items-center gap-1 sm:ms-0">
          <ThemeToggle className={iconButton} />
          <AccountMenu user={user} className={iconButton} />
          <Link href="/basket" aria-label="سبد خرید" className={`relative ${iconButton}`}>
            <ShoppingBag className="size-5" />
            {count > 0 ? (
              <span className="absolute end-1 top-1 grid h-4 min-w-4 place-items-center rounded-full bg-gold px-1 text-[10px] font-black text-background">
                {count > 9 ? "+۹" : toFaNumber(count)}
              </span>
            ) : null}
          </Link>
        </div>
      </div>

      <div className="px-4 pb-3 sm:hidden">
        <SearchBar />
      </div>

      {topCategories.length > 0 ? (
        <div className="hidden border-t border-border lg:block">
          <div className="mx-auto flex h-11 w-full max-w-7xl items-center gap-5 px-6 text-sm">
            <CategoryMenu
              categories={categories}
              trigger={
                <button
                  type="button"
                  className="flex shrink-0 items-center gap-2 font-bold text-foreground"
                >
                  <LayoutGrid className="size-4 text-gold" />
                  همه دسته‌بندی‌ها
                </button>
              }
            />
            {topCategories.map((category) => (
              <Link
                key={category.id}
                href={`/products?category=${category.slug}`}
                className="shrink-0 text-muted-foreground transition hover:text-foreground"
              >
                {category.titleFa}
              </Link>
            ))}
          </div>
        </div>
      ) : null}
    </header>
  );
}
