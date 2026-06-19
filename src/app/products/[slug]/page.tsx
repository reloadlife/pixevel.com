import type { Metadata } from "next";
import { notFound } from "next/navigation";

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

  return null;
}

/** Lowest variant price — the figure used for SEO offers and meta description. */
function lowestPrice(product: ProductView): number {
  const prices = product.variants.map((variant) => variant.price).filter((price) => price > 0);

  return prices.length > 0 ? Math.min(...prices) : 0;
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
  if (product.summaryFa) {
    return product.summaryFa;
  }

  if (product.descriptionFa) {
    return product.descriptionFa.slice(0, 160);
  }

  return `خرید ${product.titleFa} با تحویل آنی کد از پیسکول.`;
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

  const description = metaDescription(product);
  const image = primaryImageUrl(product);
  const canonical = `${siteUrl}/products/${product.slug}`;

  return {
    title: product.titleFa,
    description,
    alternates: { canonical },
    openGraph: {
      type: "website",
      title: product.titleFa,
      description,
      url: canonical,
      images: image ? [{ url: image, alt: product.titleFa }] : undefined,
    },
    twitter: {
      card: "summary_large_image",
      title: product.titleFa,
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
  const image = primaryImageUrl(product);
  const price = lowestPrice(product);
  const inStock = isInStock(product);

  const productJsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.titleFa,
    description: metaDescription(product),
    sku: product.variants[0]?.sku,
    url: canonical,
    ...(image ? { image: [image] } : {}),
    ...(product.category ? { category: product.category.titleFa } : {}),
    offers: {
      "@type": "Offer",
      url: canonical,
      priceCurrency: "IRR",
      price: String(price),
      availability: inStock ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
    },
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
