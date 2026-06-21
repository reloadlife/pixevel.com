import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { TrackView } from "@/components/analytics/track-view";
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
import { getDb } from "@/lib/db";
import { formatToman } from "@/lib/format";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://pixevel.com";

type CategoryRecord = {
  id: string;
  slug: string;
  titleFa: string;
  descriptionFa: string | null;
  isVisible: boolean;
  seoTitle: string | null;
  seoDescription: string | null;
  ogImageUrl: string | null;
  noindex: boolean;
};

/**
 * Fetches a single category by slug with the fields needed for the listing
 * header and SEO. Returns null when the slug does not resolve.
 */
async function getCategoryBySlug(slug: string): Promise<CategoryRecord | null> {
  const category = await getDb().query.categories.findFirst({
    where: (item, { eq }) => eq(item.slug, slug),
    columns: {
      id: true,
      slug: true,
      titleFa: true,
      descriptionFa: true,
      isVisible: true,
      seoTitle: true,
      seoDescription: true,
      ogImageUrl: true,
      noindex: true,
    },
  });

  return category ?? null;
}

function parsePositiveAmount(raw: string | undefined): number | undefined {
  if (raw == null || raw.trim() === "") return undefined;
  const value = Number(raw);
  if (!Number.isFinite(value) || value < 0) return undefined;
  return value;
}

/**
 * Serializes JSON-LD for safe embedding inside a <script> tag. Escapes `<` so a
 * stray `</script>` inside category text cannot break out of the element.
 */
function jsonLd(data: unknown): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}

function categoryDescription(category: CategoryRecord): string {
  return (
    category.seoDescription ??
    category.descriptionFa ??
    `خرید ${category.titleFa} با تحویل آنی از پیکسول.`
  );
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const category = await getCategoryBySlug(slug);

  if (!category?.isVisible) {
    return { title: "دسته یافت نشد" };
  }

  const title = category.seoTitle ?? category.titleFa;
  const description = categoryDescription(category);
  const canonical = `${siteUrl}/category/${category.slug}`;
  const image = category.ogImageUrl;

  return {
    title,
    description,
    alternates: { canonical },
    robots: { index: !category.noindex, follow: true },
    openGraph: {
      type: "website",
      title,
      description,
      url: canonical,
      images: image ? [{ url: image, alt: title }] : undefined,
    },
    twitter: {
      card: image ? "summary_large_image" : "summary",
      title,
      description,
      images: image ? [image] : undefined,
    },
  };
}

export default async function CategoryPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{
    page?: string;
    tag?: string;
    sort?: string;
    minPrice?: string;
    maxPrice?: string;
    inStock?: string;
  }>;
}) {
  const { slug } = await params;
  const category = await getCategoryBySlug(slug);

  if (!category?.isVisible) {
    notFound();
  }

  // Hoist past the null-narrowing so nested closures (buildUrl) keep the type.
  const categorySlug = category.slug;

  const {
    page: pageParam,
    tag,
    sort: sortParam,
    minPrice: minPriceParam,
    maxPrice: maxPriceParam,
    inStock: inStockParam,
  } = await searchParams;

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
      category: category.slug,
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

  const activeTagTitle = tag ? (allTags.find((t) => t.slug === tag)?.titleFa ?? tag) : null;

  // Build a URL that preserves all current filters and overrides the given keys.
  // The category is fixed by the route, so it is never part of the query string.
  function buildUrl(overrides: Record<string, string | number | null | undefined>) {
    const params = new URLSearchParams();
    const base: Record<string, string | undefined> = {
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
    const basePath = `/category/${categorySlug}`;
    return query ? `${basePath}?${query}` : basePath;
  }

  const hasActiveFilters = Boolean(tag || minPrice != null || maxPrice != null || inStock || sort);

  const canonical = `${siteUrl}/category/${category.slug}`;
  const description = categoryDescription(category);

  const collectionJsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: category.seoTitle ?? category.titleFa,
    description,
    url: canonical,
    ...(category.ogImageUrl ? { image: [category.ogImageUrl] } : {}),
  };

  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "خانه", item: siteUrl },
      { "@type": "ListItem", position: 2, name: "دسته‌ها", item: `${siteUrl}/products` },
      { "@type": "ListItem", position: 3, name: category.titleFa, item: canonical },
    ],
  };

  return (
    <main className="bg-background px-4 pt-4 text-foreground sm:px-8 lg:px-14" dir="rtl">
      <TrackView type="CATEGORY_VIEW" categoryId={category.id} />

      <script
        type="application/ld+json"
        // biome-ignore lint/security/noDangerouslySetInnerHtml: JSON-LD structured data is server-generated and escaped via jsonLd().
        dangerouslySetInnerHTML={{ __html: jsonLd(collectionJsonLd) }}
      />
      <script
        type="application/ld+json"
        // biome-ignore lint/security/noDangerouslySetInnerHtml: JSON-LD structured data is server-generated and escaped via jsonLd().
        dangerouslySetInnerHTML={{ __html: jsonLd(breadcrumbJsonLd) }}
      />

      <nav className="mb-4 text-xs text-muted-foreground" aria-label="مسیر">
        <ol className="flex flex-wrap items-center gap-1">
          <li>
            <a href="/" className="hover:text-foreground">
              خانه
            </a>
          </li>
          <li aria-hidden="true">›</li>
          <li>
            <a href="/products" className="hover:text-foreground">
              دسته‌ها
            </a>
          </li>
          <li aria-hidden="true">›</li>
          <li className="font-bold text-foreground">{category.titleFa}</li>
        </ol>
      </nav>

      <header className="mb-6">
        <p className="text-xs font-black uppercase tracking-[0.24em] text-muted-foreground">
          Pixevel Shop
        </p>
        <h1 className="mt-3 text-4xl font-black">{category.titleFa}</h1>
        {category.descriptionFa ? (
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">{category.descriptionFa}</p>
        ) : null}
      </header>

      <CatalogFilters categories={allCategories} tags={allTags} />

      {/* Active filter chips + results count */}
      <div className="mb-6 flex flex-wrap items-center gap-2">
        <span className="text-sm font-bold text-muted-foreground">{meta.total} نتیجه</span>

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
            href={`/category/${category.slug}`}
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
      ) : (
        <div className="grid min-h-[50dvh] place-items-center border border-dashed border-border text-center">
          <div>
            <h2 className="text-2xl font-black">
              {hasActiveFilters ? "نتیجه‌ای یافت نشد" : "هنوز محصولی در این دسته نیست"}
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              {hasActiveFilters
                ? "فیلترهای دیگری امتحان کنید."
                : "به‌زودی محصولات این دسته اضافه می‌شوند."}
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
