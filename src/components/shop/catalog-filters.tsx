"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

import { cn } from "@/lib/utils";

type FilterOption = { slug: string; titleFa: string };

const SORT_OPTIONS: { value: string; label: string }[] = [
  { value: "newest", label: "جدیدترین" },
  { value: "price_asc", label: "ارزان‌ترین" },
  { value: "price_desc", label: "گران‌ترین" },
  { value: "stock_desc", label: "بیشترین موجودی" },
];

const fieldClass =
  "w-full rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-foreground focus:outline-none focus:ring-1 focus:ring-foreground";

export function CatalogFilters({
  categories,
  tags,
}: {
  categories: FilterOption[];
  tags: FilterOption[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [open, setOpen] = useState(false);

  const current = {
    sort: searchParams.get("sort") ?? "newest",
    category: searchParams.get("category") ?? "",
    tag: searchParams.get("tag") ?? "",
    minPrice: searchParams.get("minPrice") ?? "",
    maxPrice: searchParams.get("maxPrice") ?? "",
    inStock: searchParams.get("inStock") === "true",
  };

  // Build a fresh URL from the current params, override the given keys, and
  // reset pagination so the new filters always start at page 1.
  function pushWith(overrides: Record<string, string | null>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(overrides)) {
      if (value == null || value === "") {
        params.delete(key);
      } else {
        params.set(key, value);
      }
    }
    params.delete("page");
    const query = params.toString();
    router.push(query ? `/products?${query}` : "/products");
  }

  return (
    <section className="mb-8" dir="rtl">
      {/* Mobile: collapsible toggle */}
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className="mb-3 flex w-full items-center justify-between rounded-lg border border-border bg-muted/40 px-4 py-2.5 text-sm font-bold sm:hidden"
      >
        <span>فیلتر و مرتب‌سازی</span>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
          className={cn("transition-transform", open && "rotate-180")}
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>

      <div
        className={cn(
          "grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4",
          !open && "hidden sm:grid",
        )}
      >
        {/* Sort */}
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-bold text-muted-foreground">مرتب‌سازی</span>
          <select
            value={current.sort}
            onChange={(event) => pushWith({ sort: event.target.value })}
            className={fieldClass}
          >
            {SORT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        {/* Category */}
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-bold text-muted-foreground">دسته‌بندی</span>
          <select
            value={current.category}
            onChange={(event) => pushWith({ category: event.target.value })}
            className={fieldClass}
          >
            <option value="">همه دسته‌ها</option>
            {categories.map((category) => (
              <option key={category.slug} value={category.slug}>
                {category.titleFa}
              </option>
            ))}
          </select>
        </label>

        {/* Tag */}
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-bold text-muted-foreground">برچسب</span>
          <select
            value={current.tag}
            onChange={(event) => pushWith({ tag: event.target.value })}
            className={fieldClass}
          >
            <option value="">همه برچسب‌ها</option>
            {tags.map((tag) => (
              <option key={tag.slug} value={tag.slug}>
                {tag.titleFa}
              </option>
            ))}
          </select>
        </label>

        {/* Price range */}
        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-bold text-muted-foreground">محدوده قیمت (تومان)</span>
          <div className="flex items-center gap-2">
            <input
              type="number"
              inputMode="numeric"
              min={0}
              defaultValue={current.minPrice}
              placeholder="از"
              aria-label="حداقل قیمت"
              onBlur={(event) => pushWith({ minPrice: event.target.value })}
              onKeyDown={(event) => {
                if (event.key === "Enter") event.currentTarget.blur();
              }}
              className={fieldClass}
            />
            <span className="text-muted-foreground">—</span>
            <input
              type="number"
              inputMode="numeric"
              min={0}
              defaultValue={current.maxPrice}
              placeholder="تا"
              aria-label="حداکثر قیمت"
              onBlur={(event) => pushWith({ maxPrice: event.target.value })}
              onKeyDown={(event) => {
                if (event.key === "Enter") event.currentTarget.blur();
              }}
              className={fieldClass}
            />
          </div>
        </div>

        {/* In-stock toggle */}
        <label className="flex cursor-pointer items-center gap-2 sm:col-span-2 lg:col-span-1">
          <input
            type="checkbox"
            checked={current.inStock}
            onChange={(event) => pushWith({ inStock: event.target.checked ? "true" : null })}
            className="size-4 rounded border-border accent-foreground"
          />
          <span className="text-sm font-medium">فقط کالاهای موجود</span>
        </label>
      </div>
    </section>
  );
}
