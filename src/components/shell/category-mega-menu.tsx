"use client";

import { LayoutGrid } from "lucide-react";
import Link from "next/link";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { Category } from "@/lib/nav-items";
import { cn } from "@/lib/utils";

export function CategoryMegaMenu({
  categories,
  className,
}: {
  categories: Category[];
  className?: string;
}) {
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
        className="w-[min(90vw,640px)] p-3"
      >
        {/* Header row */}
        <p className="mb-2 px-2 text-xs font-bold text-gold">دسته‌بندی‌ها</p>

        {categories.length === 0 ? (
          <p className="px-2 py-4 text-center text-sm text-muted-foreground">
            دسته‌بندی‌ای موجود نیست.
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-1 lg:grid-cols-3">
            {categories.map((category) => (
              <DropdownMenuItem
                key={category.id}
                nativeButton={false}
                render={<Link href={`/products?category=${category.slug}`} />}
                className="flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium text-foreground/80 hover:text-gold data-highlighted:text-gold"
              >
                <LayoutGrid
                  aria-hidden="true"
                  className="size-3.5 shrink-0 text-muted-foreground"
                />
                <span className="truncate">{category.titleFa}</span>
              </DropdownMenuItem>
            ))}
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
