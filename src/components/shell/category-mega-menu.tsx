"use client";

import {
  Gamepad2,
  Gift,
  Globe,
  KeyRound,
  LayoutGrid,
  type LucideIcon,
  Server,
  Tag,
} from "lucide-react";
import Link from "next/link";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { Category } from "@/lib/nav-items";
import { categoryHref } from "@/lib/nav-items";
import { cn } from "@/lib/utils";

/**
 * Each top-level "world" maps to a lucide icon + a short tagline. Children
 * (sub-categories from the seed) inherit their world's icon so the four worlds
 * read clearly even though the nav receives a flat category list.
 */
type World = { icon: LucideIcon; taglineFa: string };

const WORLDS: Record<string, World> = {
  "gift-cards": { icon: Gift, taglineFa: "کدهای دیجیتال، تحویل آنی" },
  "cd-keys": { icon: KeyRound, taglineFa: "لایسنس اورجینال بازی‌ها" },
  "gaming-gear": { icon: Gamepad2, taglineFa: "کنترلر، هدست و سخت‌افزار" },
  domains: { icon: Globe, taglineFa: "ثبت و تمدید دامنه" },
  hosting: { icon: Server, taglineFa: "سرور مجازی و هاست" },
};

const WORLD_SLUGS = Object.keys(WORLDS);

function iconForCategory(slug: string): LucideIcon {
  if (WORLDS[slug]) {
    return WORLDS[slug].icon;
  }
  const world = WORLD_SLUGS.find((worldSlug) => slug.startsWith(worldSlug));
  return world ? WORLDS[world].icon : Tag;
}

export function CategoryMegaMenu({
  categories,
  className,
}: {
  categories: Category[];
  className?: string;
}) {
  const worlds = categories.filter((category) => WORLDS[category.slug]);
  const others = categories.filter((category) => !WORLDS[category.slug]);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(
          "inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-bold text-foreground/80 transition hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          className,
        )}
      >
        <LayoutGrid aria-hidden="true" className="size-4" />
        <span>همه دسته‌بندی‌ها</span>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="start"
        side="bottom"
        sideOffset={8}
        className="w-[min(92vw,720px)] p-3"
      >
        {categories.length === 0 ? (
          <p className="px-2 py-4 text-center text-sm text-muted-foreground">
            دسته‌بندی‌ای موجود نیست.
          </p>
        ) : (
          <>
            {worlds.length > 0 ? (
              <>
                <p className="mb-2 px-2 text-xs font-bold tracking-wide text-primary">
                  دنیای محصولات
                </p>
                <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
                  {worlds.map((category) => {
                    const world = WORLDS[category.slug];
                    const Icon = world.icon;
                    return (
                      <DropdownMenuItem
                        key={category.id}
                        nativeButton={false}
                        render={<Link href={categoryHref(category.slug)} />}
                        className="group flex items-center gap-3 rounded-xl border border-border bg-card px-3 py-2.5 text-sm font-bold text-foreground transition hover:border-primary/40 hover:bg-muted data-highlighted:border-primary/40 data-highlighted:bg-muted"
                      >
                        <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary transition group-hover:bg-primary/15">
                          <Icon aria-hidden="true" className="size-[18px]" />
                        </span>
                        <span className="min-w-0">
                          <span className="block truncate">{category.titleFa}</span>
                          <span className="block truncate text-xs font-medium text-muted-foreground">
                            {world.taglineFa}
                          </span>
                        </span>
                      </DropdownMenuItem>
                    );
                  })}
                </div>
              </>
            ) : null}

            {others.length > 0 ? (
              <>
                <p className="mt-3 mb-2 px-2 text-xs font-bold tracking-wide text-muted-foreground">
                  زیردسته‌ها
                </p>
                <div className="grid grid-cols-2 gap-1 lg:grid-cols-3">
                  {others.map((category) => {
                    const Icon = iconForCategory(category.slug);
                    return (
                      <DropdownMenuItem
                        key={category.id}
                        nativeButton={false}
                        render={<Link href={categoryHref(category.slug)} />}
                        className="flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium text-foreground/80 transition hover:text-primary data-highlighted:text-primary"
                      >
                        <Icon
                          aria-hidden="true"
                          className="size-3.5 shrink-0 text-muted-foreground"
                        />
                        <span className="truncate">{category.titleFa}</span>
                      </DropdownMenuItem>
                    );
                  })}
                </div>
              </>
            ) : null}
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
