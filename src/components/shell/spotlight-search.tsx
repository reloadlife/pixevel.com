"use client";

import { Dialog } from "@base-ui/react/dialog";
import { Command } from "cmdk";
import { LayoutGrid, Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useDeferredValue, useEffect, useState } from "react";
import { useHotkeys } from "react-hotkeys-hook";

import { formatToman } from "@/lib/format";
import { categoryHref } from "@/lib/nav-items";
import { cn } from "@/lib/utils";

type ProductHit = {
  id: string;
  slug: string;
  titleFa: string;
  primaryImageUrl?: string | null;
  priceToman: number;
};

type CategoryHit = {
  slug: string;
  titleFa: string;
};

type SuggestResponse = {
  ok: boolean;
  data?: {
    products?: ProductHit[];
    categories?: CategoryHit[];
  };
};

export function SpotlightSearch({ className }: { className?: string }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [products, setProducts] = useState<ProductHit[]>([]);
  const [categories, setCategories] = useState<CategoryHit[]>([]);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  useHotkeys(
    ["meta+k", "ctrl+k"],
    (e) => {
      e.preventDefault();
      setOpen(true);
    },
    { enableOnFormTags: true, preventDefault: true },
  );

  const deferredQuery = useDeferredValue(query);

  useEffect(() => {
    const term = deferredQuery.trim();
    if (term.length < 2) {
      setProducts([]);
      setCategories([]);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/products/suggest?q=${encodeURIComponent(term)}`);
        if (!res.ok) return;
        const body = (await res.json()) as SuggestResponse;
        if (!cancelled) {
          setProducts(body.data?.products ?? []);
          setCategories(body.data?.categories ?? []);
        }
      } catch {
        // silently ignore network errors in the palette
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 200);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [deferredQuery]);

  function close() {
    setOpen(false);
    setQuery("");
    setProducts([]);
    setCategories([]);
  }

  function navigateTo(path: string) {
    router.push(path);
    close();
  }

  function handleInputKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" && query.trim().length >= 2) {
      navigateTo(`/products?q=${encodeURIComponent(query.trim())}`);
    }
  }

  const trimmed = deferredQuery.trim();
  const hasResults = products.length > 0 || categories.length > 0;
  const showHint = trimmed.length < 2 && !loading;
  const showLoading = loading && !hasResults;
  const showEmpty = !loading && trimmed.length >= 2 && !hasResults;
  const showAllRow = query.trim().length >= 2;

  return (
    <>
      {/* Trigger button styled as a search field */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          "flex h-9 w-full items-center gap-2 rounded-lg border border-input bg-background px-3 py-2 text-sm text-muted-foreground shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground",
          className,
        )}
      >
        <Search className="size-4 shrink-0" aria-hidden="true" />
        <span className="flex-1 truncate text-start">جستجو…</span>
        <kbd className="pointer-events-none hidden rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[10px] font-medium text-muted-foreground sm:inline-flex">
          ⌘K
        </kbd>
      </button>

      <Dialog.Root open={open} onOpenChange={setOpen}>
        <Dialog.Portal>
          {/* Backdrop */}
          <Dialog.Backdrop
            className={cn(
              "fixed inset-0 z-50 bg-black/40 transition-opacity duration-150",
              "data-starting-style:opacity-0 data-ending-style:opacity-0",
              "supports-backdrop-filter:backdrop-blur-sm",
            )}
          />

          {/* Centered popup */}
          <Dialog.Popup
            className={cn(
              "fixed left-1/2 top-[20%] z-50 w-[calc(100vw-2rem)] max-w-lg -translate-x-1/2 rounded-xl border bg-popover text-popover-foreground shadow-xl outline-none",
              "transition duration-150 data-starting-style:opacity-0 data-starting-style:-translate-x-1/2 data-starting-style:scale-95",
              "data-ending-style:opacity-0 data-ending-style:-translate-x-1/2 data-ending-style:scale-95",
            )}
            dir="rtl"
          >
            <Command className="flex flex-col overflow-hidden rounded-xl" shouldFilter={false}>
              {/* Search input */}
              <div className="flex items-center border-b px-3">
                <Search
                  className="ms-0 me-2 size-4 shrink-0 text-muted-foreground"
                  aria-hidden="true"
                />
                <Command.Input
                  autoFocus
                  value={query}
                  onValueChange={setQuery}
                  onKeyDown={handleInputKeyDown}
                  placeholder="نام محصول را بنویسید…"
                  className="flex h-12 w-full bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50"
                />
                {loading ? (
                  <span
                    className="ms-2 size-4 shrink-0 animate-spin rounded-full border-2 border-muted border-t-foreground"
                    aria-hidden="true"
                  />
                ) : null}
              </div>

              <Command.List className="max-h-80 overflow-y-auto overscroll-contain p-2">
                {/* Hint state */}
                {showHint && (
                  <Command.Empty className="py-8 text-center text-sm text-muted-foreground">
                    برای جستجو تایپ کنید
                  </Command.Empty>
                )}

                {/* Loading state */}
                {showLoading && (
                  <Command.Empty className="py-8 text-center text-sm text-muted-foreground">
                    در حال جستجو…
                  </Command.Empty>
                )}

                {/* No results */}
                {showEmpty && (
                  <Command.Empty className="py-8 text-center text-sm text-muted-foreground">
                    نتیجه‌ای یافت نشد
                  </Command.Empty>
                )}

                {/* Product suggestions */}
                {products.length > 0 && (
                  <Command.Group
                    heading="محصولات"
                    className="[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-bold [&_[cmdk-group-heading]]:text-muted-foreground"
                  >
                    {products.map((product) => (
                      <Command.Item
                        key={product.id}
                        value={`product-${product.id}`}
                        onSelect={() => navigateTo(`/products/${product.slug}`)}
                        className="flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 text-sm aria-selected:bg-accent aria-selected:text-accent-foreground"
                      >
                        {/* Thumbnail */}
                        {product.primaryImageUrl ? (
                          <div className="size-10 shrink-0 overflow-hidden rounded-md border bg-muted">
                            <img
                              src={product.primaryImageUrl}
                              alt={product.titleFa}
                              className="h-full w-full object-cover"
                            />
                          </div>
                        ) : (
                          <div className="size-10 shrink-0 rounded-md border bg-muted" />
                        )}

                        {/* Title + price */}
                        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                          <span className="truncate font-medium">{product.titleFa}</span>
                          {product.priceToman > 0 ? (
                            <span className="text-xs text-muted-foreground">
                              {formatToman(product.priceToman)}
                            </span>
                          ) : null}
                        </div>
                      </Command.Item>
                    ))}
                  </Command.Group>
                )}

                {/* Category suggestions */}
                {categories.length > 0 && (
                  <Command.Group
                    heading="دسته‌بندی‌ها"
                    className="[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-bold [&_[cmdk-group-heading]]:text-muted-foreground"
                  >
                    {categories.map((category) => (
                      <Command.Item
                        key={category.slug}
                        value={`category-${category.slug}`}
                        onSelect={() => navigateTo(categoryHref(category.slug))}
                        className="flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 text-sm aria-selected:bg-accent aria-selected:text-accent-foreground"
                      >
                        <div className="grid size-10 shrink-0 place-items-center rounded-md border bg-muted text-muted-foreground">
                          <LayoutGrid className="size-4" aria-hidden="true" />
                        </div>
                        <span className="truncate font-medium">{category.titleFa}</span>
                      </Command.Item>
                    ))}
                  </Command.Group>
                )}

                {/* "See all results" row */}
                {showAllRow && (
                  <Command.Item
                    value={`__all__${query}`}
                    onSelect={() => navigateTo(`/products?q=${encodeURIComponent(query.trim())}`)}
                    className="mt-1 flex cursor-pointer items-center justify-center rounded-lg border-t px-3 py-2.5 text-xs text-muted-foreground aria-selected:bg-accent aria-selected:text-accent-foreground"
                  >
                    همه نتایج برای «{query.trim()}»
                  </Command.Item>
                )}
              </Command.List>
            </Command>
          </Dialog.Popup>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  );
}
