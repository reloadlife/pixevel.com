"use client";

import {
  ChevronLeft,
  Gamepad2,
  Gift,
  Globe,
  KeyRound,
  type LucideIcon,
  Server,
  Tag,
} from "lucide-react";
import Link from "next/link";

import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import type { Category } from "@/lib/nav-items";
import { categoryHref } from "@/lib/nav-items";

/** Top-level worlds → lucide icon + tagline. Children inherit their icon. */
type World = { icon: LucideIcon; taglineFa: string };

const WORLDS: Record<string, World> = {
  "gift-cards": { icon: Gift, taglineFa: "کدهای دیجیتال، تحویل آنی" },
  "cd-keys": { icon: KeyRound, taglineFa: "لایسنس اورجینال بازی‌ها" },
  "gaming-gear": { icon: Gamepad2, taglineFa: "کنترلر، هدست و سخت‌افزار" },
  domains: { icon: Globe, taglineFa: "ثبت و تمدید دامنه" },
  hosting: { icon: Server, taglineFa: "سرور مجازی و هاست" },
};

const WORLD_SLUGS = Object.keys(WORLDS);

function worldSlugFor(slug: string): string | null {
  if (WORLDS[slug]) {
    return slug;
  }
  return WORLD_SLUGS.find((worldSlug) => slug.startsWith(worldSlug)) ?? null;
}

type WorldGroup = { world: Category; children: Category[] };

/**
 * Group the flat category list into worlds + their children, preserving the
 * incoming (sortOrder) order. Categories that don't belong to any known world
 * land in `loose`.
 */
function groupByWorld(categories: Category[]): { groups: WorldGroup[]; loose: Category[] } {
  const groups = new Map<string, WorldGroup>();
  const loose: Category[] = [];

  for (const category of categories) {
    if (WORLDS[category.slug]) {
      const existing = groups.get(category.slug);
      if (existing) {
        existing.world = category;
      } else {
        groups.set(category.slug, { world: category, children: [] });
      }
    }
  }

  for (const category of categories) {
    if (WORLDS[category.slug]) {
      continue;
    }
    const worldSlug = worldSlugFor(category.slug);
    const group = worldSlug ? groups.get(worldSlug) : undefined;
    if (group) {
      group.children.push(category);
    } else {
      loose.push(category);
    }
  }

  return { groups: [...groups.values()], loose };
}

/**
 * Mobile categories browser. Opens a Sheet (from the start/right edge in RTL)
 * grouped by the product worlds. Each entry links to /products?category=<slug>.
 * `trigger` is the element that opens it (a header button or a bottom tab).
 */
export function CategoryMenu({
  categories,
  trigger,
}: {
  categories: Category[];
  trigger: React.ReactElement;
}) {
  const { groups, loose } = groupByWorld(categories);

  return (
    <Sheet>
      <SheetTrigger render={trigger} />
      <SheetContent side="right" className="w-80 max-w-[85vw] gap-0 p-0">
        <SheetHeader className="border-b border-border p-5">
          <SheetTitle className="text-primary">دسته‌بندی‌ها</SheetTitle>
        </SheetHeader>
        <ScrollArea className="h-[calc(100dvh-5rem)]">
          <nav className="flex flex-col gap-5 p-3">
            {categories.length === 0 ? (
              <p className="px-3 py-8 text-center text-sm text-muted-foreground">
                هنوز دسته‌بندی‌ای ثبت نشده است.
              </p>
            ) : null}

            {groups.map(({ world, children }) => {
              const Icon = WORLDS[world.slug].icon;
              return (
                <div key={world.id}>
                  <SheetClose
                    nativeButton={false}
                    render={
                      <Link
                        href={categoryHref(world.slug)}
                        className="flex items-center gap-3 rounded-xl bg-muted/60 px-3 py-3 transition hover:bg-muted"
                      />
                    }
                  >
                    <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                      <Icon aria-hidden="true" className="size-[18px]" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-black text-foreground">
                        {world.titleFa}
                      </span>
                      <span className="block truncate text-xs font-medium text-muted-foreground">
                        {WORLDS[world.slug].taglineFa}
                      </span>
                    </span>
                    <ChevronLeft
                      aria-hidden="true"
                      className="size-4 shrink-0 text-muted-foreground"
                    />
                  </SheetClose>

                  {children.length > 0 ? (
                    <div className="mt-1 flex flex-col gap-0.5 ps-3">
                      {children.map((child) => (
                        <SheetClose
                          key={child.id}
                          nativeButton={false}
                          render={
                            <Link
                              href={categoryHref(child.slug)}
                              className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-foreground/75 transition hover:bg-muted hover:text-foreground"
                            />
                          }
                        >
                          <span aria-hidden="true" className="size-1 rounded-full bg-primary/50" />
                          {child.titleFa}
                        </SheetClose>
                      ))}
                    </div>
                  ) : null}
                </div>
              );
            })}

            {loose.length > 0 ? (
              <div className="flex flex-col gap-0.5">
                {loose.map((category) => (
                  <SheetClose
                    key={category.id}
                    nativeButton={false}
                    render={
                      <Link
                        href={categoryHref(category.slug)}
                        className="flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-bold text-foreground/80 transition hover:bg-muted hover:text-foreground"
                      />
                    }
                  >
                    <Tag aria-hidden="true" className="size-4 text-muted-foreground" />
                    {category.titleFa}
                  </SheetClose>
                ))}
              </div>
            ) : null}
          </nav>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
