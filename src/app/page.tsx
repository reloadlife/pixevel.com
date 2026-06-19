import Link from "next/link";

import { FullscreenHorizontalGallery } from "@/components/shop/fullscreen-horizontal-gallery";
import { ProductCard } from "@/components/shop/product-card";
import { ShowcaseHero } from "@/components/shop/showcase-hero";
import { ShowcaseHeroImageOnly } from "@/components/shop/showcase-hero-image-only";
import { ShowcaseRandomGallery } from "@/components/shop/showcase-random-gallery";
import { getCurrentUser } from "@/lib/auth";
import { getHomepageView } from "@/lib/catalog";
import { formatToman } from "@/lib/format";

type HomeBlockView = Awaited<ReturnType<typeof getHomepageView>>[number];
type HomeBlockProduct = NonNullable<HomeBlockView["products"][number]>;

function isHomeBlockProduct(
  product: HomeBlockView["products"][number],
): product is HomeBlockProduct {
  return Boolean(product);
}

export default async function Home() {
  const user = await getCurrentUser();
  const blocks = await getHomepageView(user);

  return (
    <main className="bg-background pt-4 text-foreground">
      <div className="space-y-12">
        {blocks.map((block) => {
          if (block.products.length === 0) {
            return null;
          }

          if (block.type === "FULLSCREEN_HORIZONTAL_GALLERY") {
            return (
              <FullscreenHorizontalGallery
                key={block.id}
                titleFa={block.titleFa}
                subtitleFa={block.subtitleFa}
                products={block.products.filter(isHomeBlockProduct)}
              />
            );
          }

          if (block.type === "SHOWCASE_HERO") {
            return <ShowcaseHeroBlock key={block.id} block={block} />;
          }

          if (block.type === "SHOWCASE_HERO_NO_PRODUCT_INFO") {
            return <ShowcaseHeroImageOnlyBlock key={block.id} block={block} />;
          }

          if (block.type === "SHOWCASE_RANDOM") {
            const product = block.products[0];

            if (!product) {
              return null;
            }

            return (
              <div key={block.id} className="px-4 py-10 sm:px-8 lg:px-14">
                <ShowcaseRandomGallery
                  key={`${block.id}-${product.id}`}
                  titleFa={block.titleFa}
                  subtitleFa={block.subtitleFa}
                  product={product}
                />
              </div>
            );
          }

          if (block.type === "SHOWCASE") {
            return (
              <div key={block.id} className="px-4 py-10 sm:px-8 lg:px-14">
                <ShowcaseBlock block={block} />
              </div>
            );
          }

          return (
            <div key={block.id} className="px-4 py-10 sm:px-8 lg:px-14">
              <GalleryBlock block={block} />
            </div>
          );
        })}
      </div>
    </main>
  );
}

function SectionHeader({ block }: { block: HomeBlockView }) {
  return (
    <div className="mb-5 flex items-end justify-between gap-4">
      <div>
        <h2 className="text-2xl font-black sm:text-3xl">{block.titleFa}</h2>
        {block.subtitleFa ? (
          <p className="mt-1 text-sm text-muted-foreground">{block.subtitleFa}</p>
        ) : null}
      </div>
      <Link
        href="/products"
        className="text-sm font-bold text-foreground/70 underline decoration-gold/60 decoration-2 underline-offset-4 transition hover:text-foreground"
      >
        همه محصولات
      </Link>
    </div>
  );
}

function ShowcaseHeroBlock({ block }: { block: HomeBlockView }) {
  const product = block.products[0];

  if (!product) {
    return null;
  }

  const title = block.titleFa || product.titleFa;
  const subtitle = block.subtitleFa || product.summaryFa;

  return (
    <ShowcaseHero
      title={title}
      subtitle={subtitle}
      productTitle={product.titleFa}
      productSlug={product.slug}
      imageUrl={product.imageUrl ?? null}
      price={product.price}
    />
  );
}

function ShowcaseHeroImageOnlyBlock({ block }: { block: HomeBlockView }) {
  const product = block.products[0];

  if (!product) {
    return null;
  }

  const title = block.titleFa || product.titleFa;
  const subtitle = block.subtitleFa || product.summaryFa;

  return (
    <ShowcaseHeroImageOnly
      title={title}
      subtitle={subtitle}
      productTitle={product.titleFa}
      imageUrl={product.imageUrl ?? null}
    />
  );
}

function ShowcaseBlock({ block }: { block: HomeBlockView }) {
  const product = block.products[0];

  if (!product) {
    return null;
  }

  return (
    <section className="section-fade">
      <SectionHeader block={block} />
      <Link
        href={`/products/${product.slug}`}
        className="group grid overflow-hidden bg-foreground text-background md:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]"
      >
        <div className="relative aspect-[4/5] overflow-hidden bg-muted md:aspect-[16/11]">
          {product.imageUrl ? (
            <img
              src={product.imageUrl}
              alt={product.titleFa}
              className="h-full w-full object-cover transition duration-700 group-hover:scale-105"
            />
          ) : (
            <div className="grid h-full place-items-center bg-zinc-200 text-zinc-600">
              بدون تصویر
            </div>
          )}
        </div>
        <div className="flex flex-col justify-end p-5 sm:p-8">
          <p className="text-xs font-black uppercase tracking-[0.24em] opacity-60">Showcase</p>
          <h3 className="mt-3 text-3xl font-black leading-tight sm:text-5xl">{product.titleFa}</h3>
          {product.summaryFa ? (
            <p className="mt-3 leading-8 opacity-72">{product.summaryFa}</p>
          ) : null}
          <div className="mt-6 flex items-center justify-between gap-4">
            <span className="text-sm font-black">{formatToman(product.price)}</span>
            <span className="bg-background px-5 py-3 text-sm font-black text-foreground">
              مشاهده
            </span>
          </div>
        </div>
      </Link>
    </section>
  );
}

function GalleryBlock({ block }: { block: HomeBlockView }) {
  const products = block.products.filter(isHomeBlockProduct);

  return (
    <section className="section-fade">
      <SectionHeader block={block} />
      <div className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-3 sm:grid sm:grid-cols-3 sm:overflow-visible lg:grid-cols-4">
        {products.map((product, index) => (
          <div
            key={product.id}
            className="stagger-card min-w-[72vw] snap-start sm:min-w-0"
            style={{ animationDelay: `${Math.min(index, 8) * 70}ms` }}
          >
            <ProductCard product={product} />
          </div>
        ))}
      </div>
    </section>
  );
}
