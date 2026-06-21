import type { Metadata } from "next";
import { permanentRedirect, redirect } from "next/navigation";

import { TrackSearch } from "@/components/analytics/track-search";
import { CatalogFilters } from "@/components/shop/catalog-filters";
import { ProductCard } from "@/components/shop/product-card";
import { getCurrentUser } from "@/lib/auth";
import {
  getProductsForListing,
  listCategories,
  listTags,
  PRODUCT_SORT_KEYS,
  type ProductSortKey,
} from "@/lib/catalog";
import { formatToman } from "@/lib/format";
import { WORLD_ROUTES } from "@/lib/nav-items";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://pixevel.com";

type ListingSearchParams = {
  q?: string;
  page?: string;
  category?: string;
  tag?: string;
  sort?: string;
  minPrice?: string;
  maxPrice?: string;
  inStock?: string;
};

function parsePositiveAmount(raw: string | undefined): number | undefined {
  if (raw == null || raw.trim() === "") return undefined;
  const value = Number(raw);
  if (!Number.isFinite(value) || value < 0) return undefined;
  return value;
}

/**
 * Canonical URL for the current listing: only the SEO-meaningful params
 * (q/category/tag/sort) are kept, in a stable order, so paginated/price-filtered
 * variants of the same search consolidate onto one canonical.
 */
function canonicalListingUrl(params: ListingSearchParams): string {
  const search = new URLSearchParams();
  if (params.q?.trim()) search.set("q", params.q.trim());
  if (params.category) search.set("category", params.category);
  if (params.tag) search.set("tag", params.tag);
  if (params.sort) search.set("sort", params.sort);
  const query = search.toString();
  return query ? `${siteUrl}/products?${query}` : `${siteUrl}/products`;
}

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<ListingSearchParams>;
}): Promise<Metadata> {
  const params = await searchParams;
  const { q, category, tag } = params;

  const [allCategories, allTags] = await Promise.all([listCategories(), listTags()]);
  const categoryTitle = category
    ? (allCategories.find((c) => c.slug === category)?.titleFa ?? null)
    : null;
  const tagTitle = tag ? (allTags.find((t) => t.slug === tag)?.titleFa ?? null) : null;

  const titleParts: string[] = [];
  if (q?.trim()) titleParts.push(`جستجو: ${q.trim()}`);
  if (categoryTitle) titleParts.push(categoryTitle);
  if (tagTitle) titleParts.push(tagTitle);

  const title = titleParts.length > 0 ? titleParts.join(" - ") : "محصولات";

  let description: string;
  if (q?.trim()) {
    description = `نتایج جستجوی «${q.trim()}» در فروشگاه دیجیتال پیسکول؛ گیفت کارت، سی‌دی‌کی و سرویس‌های آنلاین.`;
  } else if (categoryTitle) {
    description = `خرید ${categoryTitle} با تحویل آنی از پیسکول؛ بهترین قیمت و پرداخت امن.`;
  } else if (tagTitle) {
    description = `محصولات دیجیتال با برچسب ${tagTitle} در پیسکول؛ تحویل آنی و پرداخت امن.`;
  } else {
    description =
      "همه محصولات دیجیتال پیسکول؛ گیفت کارت، سی‌دی‌کی بازی و سرویس‌های آنلاین با تحویل آنی.";
  }

  const canonical = canonicalListingUrl(params);

  return {
    title,
    description,
    alternates: { canonical },
    openGraph: {
      type: "website",
      title,
      description,
      url: canonical,
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
  };
}

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<ListingSearchParams>;
}) {
  const {
    q,
    page: pageParam,
    category,
    tag,
    sort: sortParam,
    minPrice: minPriceParam,
    maxPrice: maxPriceParam,
    inStock: inStockParam,
  } = await searchParams;

  // World categories own dedicated storefronts (domains → /domains). Bounce those
  // slugs there instead of rendering an empty/hidden product listing.
  if (category && WORLD_ROUTES[category]) {
    redirect(WORLD_ROUTES[category]);
  }

  // Non-world categories have a dedicated SEO route (/category/<slug>). Permanently
  // (308) consolidate ?category= onto it, preserving the other listing params so the
  // dedicated route can honor an active search/tag/sort.
  if (category) {
    const carried = new URLSearchParams();
    if (q?.trim()) carried.set("q", q.trim());
    if (tag) carried.set("tag", tag);
    if (sortParam) carried.set("sort", sortParam);
    if (minPriceParam) carried.set("minPrice", minPriceParam);
    if (maxPriceParam) carried.set("maxPrice", maxPriceParam);
    if (inStockParam === "true") carried.set("inStock", "true");
    const query = carried.toString();
    // 308 permanent redirect — consolidates link equity onto the dedicated route.
    permanentRedirect(`/category/${category}${query ? `?${query}` : ""}`);
  }

  const page = Math.max(1, Number(pageParam ?? "1") || 1);
  const sort = PRODUCT_SORT_KEYS.includes(sortParam as ProductSortKey)
    ? (sortParam as ProductSortKey)
    : undefined;

  let minPrice = parsePositiveAmount(minPriceParam);
  let maxPrice = parsePositiveAmount(maxPriceParam);
  if (minPrice != null && maxPrice != null && minPrice > maxPrice) {
    [minPrice, maxPrice] = [maxPrice, minPrice];
  }

  const inStock = inStockParam === "true";

  const user = await getCurrentUser();
  const [{ items: products, meta }, allCategories, allTags] = await Promise.all([
    getProductsForListing(user, {
      q,
      category,
      tag,
      sort,
      minPrice,
      maxPrice,
      inStock,
      page,
    }),
    listCategories(),
    listTags(),
  ]);

  const activeCategoryTitle = category
    ? (allCategories.find((c) => c.slug === category)?.titleFa ?? category)
    : null;
  const activeTagTitle = tag ? (allTags.find((t) => t.slug === tag)?.titleFa ?? tag) : null;

  // Build a URL that preserves all current filters and overrides the given keys.
  function buildUrl(overrides: Record<string, string | number | null | undefined>) {
    const params = new URLSearchParams();
    const base: Record<string, string | undefined> = {
      q,
      category,
      tag,
      sort: sortParam,
      minPrice: minPriceParam,
      maxPrice: maxPriceParam,
      inStock: inStock ? "true" : undefined,
    };
    for (const [key, value] of Object.entries(base)) {
      if (value != null && value !== "") params.set(key, value);
    }
    for (const [key, value] of Object.entries(overrides)) {
      if (value == null || value === "") params.delete(key);
      else params.set(key, String(value));
    }
    const query = params.toString();
    return query ? `/products?${query}` : "/products";
  }

  const hasActiveFilters = Boolean(
    category || tag || minPrice != null || maxPrice != null || inStock || sort,
  );

  return (
    <main className="bg-background px-4 pt-4 text-foreground sm:px-8 lg:px-14" dir="rtl">
      {q?.trim() ? <TrackSearch query={q.trim()} resultCount={meta.total} /> : null}
      <header className="mb-6">
        <p className="text-xs font-black uppercase tracking-[0.24em] text-muted-foreground">
          Pixevel Shop
        </p>
        <h1 className="mt-3 text-4xl font-black">محصولات</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          محصولات غیرفعال و ناموجود هم قابل مشاهده‌اند، اما به سبد اضافه نمی‌شوند.
        </p>
      </header>

      {/* Search form — GET, RTL, submits ?q= */}
      <form method="GET" action="/products" className="mb-8">
        {/* Preserve active filters across a new search */}
        {category ? <input type="hidden" name="category" value={category} /> : null}
        {tag ? <input type="hidden" name="tag" value={tag} /> : null}
        {sortParam ? <input type="hidden" name="sort" value={sortParam} /> : null}
        {minPriceParam ? <input type="hidden" name="minPrice" value={minPriceParam} /> : null}
        {maxPriceParam ? <input type="hidden" name="maxPrice" value={maxPriceParam} /> : null}
        {inStock ? <input type="hidden" name="inStock" value="true" /> : null}
        <div className="relative">
          <input
            type="search"
            name="q"
            defaultValue={q ?? ""}
            placeholder="جستجوی محصولات..."
            className="w-full rounded-lg border border-border bg-muted/40 py-3 pe-4 ps-10 text-sm text-foreground placeholder:text-muted-foreground focus:border-foreground focus:outline-none focus:ring-1 focus:ring-foreground"
            dir="rtl"
          />
          <span className="pointer-events-none absolute inset-y-0 start-0 flex items-center ps-3 text-muted-foreground">
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
            >
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.3-4.3" />
            </svg>
          </span>
        </div>
      </form>

      <CatalogFilters categories={allCategories} tags={allTags} />

      {/* Active filter chips + results count */}
      <div className="mb-6 flex flex-wrap items-center gap-2">
        <span className="text-sm font-bold text-muted-foreground">{meta.total} نتیجه</span>

        {activeCategoryTitle && (
          <FilterChip label={`دسته: ${activeCategoryTitle}`} href={buildUrl({ category: null })} />
        )}
        {activeTagTitle && (
          <FilterChip label={`برچسب: ${activeTagTitle}`} href={buildUrl({ tag: null })} />
        )}
        {minPrice != null && (
          <FilterChip label={`از ${formatToman(minPrice)}`} href={buildUrl({ minPrice: null })} />
        )}
        {maxPrice != null && (
          <FilterChip label={`تا ${formatToman(maxPrice)}`} href={buildUrl({ maxPrice: null })} />
        )}
        {inStock && <FilterChip label="فقط موجود" href={buildUrl({ inStock: null })} />}

        {hasActiveFilters && (
          <a
            href={q ? `/products?q=${encodeURIComponent(q)}` : "/products"}
            className="text-sm font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
          >
            حذف همه فیلترها
          </a>
        )}
      </div>

      {products.length > 0 ? (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {products.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>

          {/* Pager — only shown when there is more than one page */}
          {meta.total > meta.pageSize && (
            <nav className="mt-10 flex items-center justify-center gap-4" aria-label="صفحه‌بندی">
              {meta.page > 1 ? (
                <a
                  href={buildUrl({ page: meta.page - 1 })}
                  className="rounded-lg border border-border px-4 py-2 text-sm font-medium transition-colors hover:bg-muted"
                >
                  ← قبلی
                </a>
              ) : (
                <span className="rounded-lg border border-border px-4 py-2 text-sm font-medium opacity-40">
                  ← قبلی
                </span>
              )}

              <span className="text-sm text-muted-foreground">
                صفحه {meta.page} از {Math.ceil(meta.total / meta.pageSize)}
              </span>

              {meta.hasNext ? (
                <a
                  href={buildUrl({ page: meta.page + 1 })}
                  className="rounded-lg border border-border px-4 py-2 text-sm font-medium transition-colors hover:bg-muted"
                >
                  بعدی →
                </a>
              ) : (
                <span className="rounded-lg border border-border px-4 py-2 text-sm font-medium opacity-40">
                  بعدی →
                </span>
              )}
            </nav>
          )}
        </>
      ) : q || hasActiveFilters ? (
        <div className="grid min-h-[50dvh] place-items-center border border-dashed border-border text-center">
          <div>
            <h2 className="text-2xl font-black">نتیجه‌ای یافت نشد</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              فیلترها یا جستجوی دیگری امتحان کنید.
            </p>
          </div>
        </div>
      ) : (
        <div className="grid min-h-[50dvh] place-items-center border border-dashed border-border text-center">
          <div>
            <h2 className="text-2xl font-black">هنوز محصولی ثبت نشده</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              از پنل ادمین اولین محصول را بسازید.
            </p>
          </div>
        </div>
      )}
    </main>
  );
}

function FilterChip({ label, href }: { label: string; href: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/60 px-3 py-1 text-sm font-medium">
      {label}
      <a
        href={href}
        aria-label={`حذف فیلتر ${label}`}
        className="ms-1 text-muted-foreground hover:text-foreground"
      >
        ×
      </a>
    </span>
  );
}
