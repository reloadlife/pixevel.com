"use client";

import Link from "next/link";

import type { CurrentUser } from "@/lib/auth";
import type { Category } from "@/lib/nav-items";
import { CategoryMegaMenu } from "./category-mega-menu";
import { HeaderMenus } from "./header-menus";
import { SpotlightSearch } from "./spotlight-search";

/**
 * Search-dominant storefront header (Digikala/Torob pattern). Spotlight (⌘K)
 * search, a hover account menu (with the theme switch), and a hover/drawer cart.
 * On mobile the search trigger drops to its own row.
 */
export function SiteHeader({
  user,
  categories,
}: {
  user: CurrentUser | null;
  categories: Category[];
}) {
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

        <SpotlightSearch className="hidden flex-1 sm:flex" />

        <HeaderMenus user={user} className="ms-auto sm:ms-0" />
      </div>

      <div className="px-4 pb-3 sm:hidden">
        <SpotlightSearch className="w-full" />
      </div>

      {topCategories.length > 0 ? (
        <div className="hidden border-t border-border lg:block">
          <div className="mx-auto flex h-11 w-full max-w-7xl items-center gap-5 px-6 text-sm">
            <CategoryMegaMenu
              categories={categories}
              className="flex shrink-0 items-center gap-2 font-bold text-foreground"
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
