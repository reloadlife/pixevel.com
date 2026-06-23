import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { TrackView } from "@/components/analytics/track-view";
import { ProductCard } from "@/components/shop/product-card";
import { ProductDetailClient } from "@/components/shop/product-detail-client";
import { getCurrentUser } from "@/lib/auth";
import { getProductDetailView } from "@/lib/catalog";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://pixevel.com";

type ProductView = NonNullable<Awaited<ReturnType<typeof getProductDetailView>>>;

/** Returns the absolute URL of the primary product image (or first available). */
function primaryImageUrl(product: ProductView): string | null {
  const fromProduct =
    product.images.find((image) => image.isPrimary)?.url ?? product.images[0]?.url ?? null;

  if (fromProduct) {
    return fromProduct;
  }

  for (const variant of product.variants) {
    const variantImage = variant.images.find((image) => image.isPrimary) ?? variant.images[0];

    if (variantImage?.url) {
      return variantImage.url;
    }
  }

  return product.primaryImageUrl ?? null;
}

/** Image used for OpenGraph/Twitter cards: explicit override first, else primary image. */
function ogImageUrl(product: ProductView): string | null {
  return product.ogImageUrl ?? primaryImageUrl(product);
}

/** Page <title>: SEO override first, else product title. */
function metaTitle(product: ProductView): string {
  return product.seoTitle?.trim() || product.titleFa;
}

/** Variant prices > 0 — the figures used for SEO offers and meta description. */
function variantPrices(product: ProductView): number[] {
  return product.variants.map((variant) => variant.price).filter((price) => price > 0);
}

/** A single variant is purchasable when the product is active and it has stock. */
function variantInStock(product: ProductView, variant: ProductView["variants"][number]): boolean {
  return product.status === "ACTIVE" && (variant.isUnlimited || variant.availableStock > 0);
}

/** Every distinct image URL across product- and variant-level images. */
function allImageUrls(product: ProductView): string[] {
  const urls = new Set<string>();

  for (const image of product.images) {
    if (image.url) {
      urls.add(image.url);
    }
  }

  for (const variant of product.variants) {
    for (const image of variant.images) {
      if (image.url) {
        urls.add(image.url);
      }
    }
  }

  return [...urls];
}

/** Maps an internal interval unit to a schema.org ISO-8601 duration token. */
const ISO_DURATION_BY_UNIT: Record<string, string> = {
  DAY: "D",
  WEEK: "W",
  MONTH: "M",
  YEAR: "Y",
};

/**
 * Best-effort schema.org UnitPriceSpecification describing the recurring cadence
 * of a subscription variant (e.g. billed every P1M). Returns null when the
 * variant carries no subscription plan.
 */
function subscriptionPriceSpec(
  variant: ProductView["variants"][number],
): Record<string, unknown> | null {
  const plan = variant.subscription;

  if (!plan) {
    return null;
  }

  const token = ISO_DURATION_BY_UNIT[plan.intervalUnit] ?? "M";
  // WEEK uses the date-position token (P1W); the rest use the standard PnX form.
  const duration = `P${plan.intervalCount}${token}`;

  return {
    priceSpecification: {
      "@type": "UnitPriceSpecification",
      price: String(variant.price),
      priceCurrency: "IRR",
      billingDuration: duration,
      billingIncrement: plan.intervalCount,
      referenceQuantity: {
        "@type": "QuantitativeValue",
        value: plan.intervalCount,
        unitCode: plan.intervalUnit,
      },
    },
  };
}

/**
 * Serializes JSON-LD for safe embedding inside a <script> tag. Escapes `<` so a
 * stray `</script>` inside product text cannot break out of the element.
 */
function jsonLd(data: unknown): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}

function isInStock(product: ProductView): boolean {
  return (
    product.status === "ACTIVE" && product.variants.some((variant) => variant.availableStock > 0)
  );
}

function metaDescription(product: ProductView): string {
  if (product.seoDescription?.trim()) {
    return product.seoDescription.trim();
  }

  if (product.summaryFa) {
    return product.summaryFa;
  }

  if (product.descriptionFa) {
    return product.descriptionFa.slice(0, 160);
  }

  return `خرید ${product.titleFa} از پیسکول با قیمت مناسب و تجربه خرید سریع و امن.`;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProductDetailView(slug, null);

  if (!product) {
    return { title: "محصول یافت نشد" };
  }

  const title = metaTitle(product);
  const description = metaDescription(product);
  const image = ogImageUrl(product);
  const canonical = `/products/${product.slug}`;

  return {
    title,
    description,
    alternates: { canonical },
    robots: { index: !product.noindex, follow: !product.noindex },
    openGraph: {
      type: "website",
      title,
      description,
      url: canonical,
      images: image ? [{ url: image, alt: product.titleFa }] : undefined,
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: image ? [image] : undefined,
    },
  };
}

export default async function ProductDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const user = await getCurrentUser();
  const { slug } = await params;
  const product = await getProductDetailView(slug, user);

  if (!product) {
    notFound();
  }

  const canonical = `${siteUrl}/products/${product.slug}`;
  const hasRating = product.ratingAvg != null && product.ratingCount > 0;

  const prices = variantPrices(product);
  const lowPrice = prices.length > 0 ? Math.min(...prices) : 0;
  const highPrice = prices.length > 0 ? Math.max(...prices) : 0;
  const images = allImageUrls(product);

  // One Offer per variant: each carries its own price, sku, availability, and —
  // for subscriptions — a recurring price specification. Wrapped in an
  // AggregateOffer so a range (lowPrice/highPrice) is exposed at the top level.
  const variantOffers = product.variants.map((variant) => ({
    "@type": "Offer",
    url: canonical,
    priceCurrency: "IRR",
    price: String(variant.price),
    sku: variant.sku,
    ...(variant.titleFa ? { name: variant.titleFa } : {}),
    availability: variantInStock(product, variant)
      ? "https://schema.org/InStock"
      : "https://schema.org/OutOfStock",
    ...(subscriptionPriceSpec(variant) ?? {}),
  }));

  // Each configured option becomes a PropertyValue listing its value labels.
  const additionalProperty = product.options.map((option) => ({
    "@type": "PropertyValue",
    name: option.nameFa,
    value: option.values.map((value) => value.valueFa).join("، "),
  }));

  const productJsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.titleFa,
    description: metaDescription(product),
    sku: product.variants[0]?.sku,
    url: canonical,
    ...(images.length > 0 ? { image: images } : {}),
    ...(product.category ? { category: product.category.titleFa } : {}),
    ...(additionalProperty.length > 0 ? { additionalProperty } : {}),
    offers: {
      "@type": "AggregateOffer",
      url: canonical,
      priceCurrency: "IRR",
      lowPrice: String(lowPrice),
      highPrice: String(highPrice),
      offerCount: variantOffers.length,
      availability: isInStock(product)
        ? "https://schema.org/InStock"
        : "https://schema.org/OutOfStock",
      offers: variantOffers,
    },
    ...(hasRating
      ? {
          aggregateRating: {
            "@type": "AggregateRating",
            ratingValue: String(product.ratingAvg),
            reviewCount: String(product.ratingCount),
          },
        }
      : {}),
  };

  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "خانه", item: siteUrl },
      ...(product.category
        ? [
            {
              "@type": "ListItem",
              position: 2,
              name: product.category.titleFa,
              item: `${siteUrl}/products?category=${encodeURIComponent(product.category.slug)}`,
            },
          ]
        : []),
      {
        "@type": "ListItem",
        position: product.category ? 3 : 2,
        name: product.titleFa,
        item: canonical,
      },
    ],
  };

  return (
    <main className="bg-background px-4 pt-4 text-foreground sm:px-8 lg:px-14">
      <script
        type="application/ld+json"
        // biome-ignore lint/security/noDangerouslySetInnerHtml: JSON-LD structured data is server-generated and escaped via jsonLd().
        dangerouslySetInnerHTML={{ __html: jsonLd(productJsonLd) }}
      />
      <script
        type="application/ld+json"
        // biome-ignore lint/security/noDangerouslySetInnerHtml: JSON-LD structured data is server-generated and escaped via jsonLd().
        dangerouslySetInnerHTML={{ __html: jsonLd(breadcrumbJsonLd) }}
      />

      <TrackView type="PRODUCT_VIEW" productId={product.id} />

      <ProductDetailClient product={product} isAuthenticated={Boolean(user)} />
      {product.relatedProducts.length > 0 ? (
        <section className="mt-16 border-t border-border pt-8">
          <div className="mb-5 flex items-end justify-between gap-4">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.24em] text-muted-foreground">
                Pixevel
              </p>
              <h2 className="mt-2 text-2xl font-black sm:text-3xl">محصولات مشابه</h2>
            </div>
          </div>
          <div className="-mx-4 overflow-x-auto px-4 pb-3 sm:-mx-8 sm:px-8 lg:-mx-14 lg:px-14 [&::-webkit-scrollbar]:hidden">
            <div className="grid grid-flow-col grid-rows-2 gap-x-3 gap-y-6 auto-cols-[minmax(160px,44vw)] sm:auto-cols-[minmax(190px,28vw)] lg:auto-cols-[minmax(220px,18vw)]">
              {product.relatedProducts.map((relatedProduct) => (
                <ProductCard key={relatedProduct.id} product={relatedProduct} />
              ))}
            </div>
          </div>
        </section>
      ) : null}
    </main>
  );
}
