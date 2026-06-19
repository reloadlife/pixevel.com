"use client";

import { LayoutGrid } from "lucide-react";
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

/**
 * Categories browser. Opens a Sheet (from the start/right edge in RTL) listing
 * every active category. Each item links to /products?category=<slug>.
 * `trigger` is the element that opens it (a header button or a bottom tab).
 */
export function CategoryMenu({
  categories,
  trigger,
}: {
  categories: Category[];
  trigger: React.ReactElement;
}) {
  return (
    <Sheet>
      <SheetTrigger render={trigger} />
      <SheetContent side="right" className="w-80 max-w-[85vw] gap-0 p-0">
        <SheetHeader className="border-b p-5">
          <SheetTitle className="text-gold">دسته‌بندی‌ها</SheetTitle>
        </SheetHeader>
        <ScrollArea className="h-[calc(100dvh-5rem)]">
          <nav className="flex flex-col p-2">
            {categories.length === 0 ? (
              <p className="px-3 py-8 text-center text-sm text-muted-foreground">
                هنوز دسته‌بندی‌ای ثبت نشده است.
              </p>
            ) : (
              categories.map((category) => (
                <SheetClose
                  key={category.id}
                  nativeButton={false}
                  render={
                    <Link
                      href={`/products?category=${category.slug}`}
                      className="flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-bold text-foreground/80 transition hover:bg-muted hover:text-foreground"
                    />
                  }
                >
                  <LayoutGrid aria-hidden="true" className="size-4 text-muted-foreground" />
                  {category.titleFa}
                </SheetClose>
              ))
            )}
          </nav>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
