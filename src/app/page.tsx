import { Gamepad2, Gift, Globe, KeyRound, type LucideIcon, Server } from "lucide-react";
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

/** The four+ product worlds, surfaced as entry-points above the dynamic blocks. */
type WorldEntry = {
  slug: string;
  titleFa: string;
  taglineFa: string;
  icon: LucideIcon;
};

const WORLD_ENTRIES: WorldEntry[] = [
  {
    slug: "gift-cards",
    titleFa: "گیفت کارت",
    taglineFa: "استریم، گیمینگ و اپ استور — تحویل آنی",
    icon: Gift,
  },
  {
    slug: "cd-keys",
    titleFa: "سی‌دی‌کی و بازی",
    taglineFa: "لایسنس اورجینال بازی‌ها",
    icon: KeyRound,
  },
  {
    slug: "gaming-gear",
    titleFa: "گیمینگ و لوازم جانبی",
    taglineFa: "کنترلر، هدست و سخت‌افزار",
    icon: Gamepad2,
  },
  {
    slug: "domains",
    titleFa: "دامنه",
    taglineFa: "ثبت و تمدید با پسوندهای متنوع",
    icon: Globe,
  },
  {
    slug: "hosting",
    titleFa: "سرور و هاست",
    taglineFa: "سرور مجازی و ابری، آپ‌تایم بالا",
    icon: Server,
  },
];

export default async function Home() {
  const user = await getCurrentUser();
  const blocks = await getHomepageView(user);

  // Hoist a leading full-bleed hero/gallery block (if any) above the worlds
  // grid so the page opens on a strong visual; the rest follows the worlds.
  const [firstBlock, ...restBlocks] = blocks;
  const heroBlockTypes = new Set([
    "SHOWCASE_HERO",
    "SHOWCASE_HERO_NO_PRODUCT_INFO",
    "FULLSCREEN_HORIZONTAL_GALLERY",
  ]);
  const leadHero =
    firstBlock && firstBlock.products.length > 0 && heroBlockTypes.has(firstBlock.type)
      ? firstBlock
      : null;
  const flowBlocks = leadHero ? restBlocks : blocks;

  return (
    <main className="bg-background pt-4 text-foreground">
      {leadHero ? <HomeBlock block={leadHero} /> : <FallbackHero />}

      <WorldsGrid />

      <div className="space-y-12">
        {flowBlocks.map((block) => (
          <HomeBlock key={block.id} block={block} />
        ))}
      </div>
    </main>
  );
}

function HomeBlock({ block }: { block: HomeBlockView }) {
  if (block.products.length === 0) {
    return null;
  }

  if (block.type === "FULLSCREEN_HORIZONTAL_GALLERY") {
    return (
      <FullscreenHorizontalGallery
        titleFa={block.titleFa}
        subtitleFa={block.subtitleFa}
        products={block.products.filter(isHomeBlockProduct)}
      />
    );
  }

  if (block.type === "SHOWCASE_HERO") {
    return <ShowcaseHeroBlock block={block} />;
  }

  if (block.type === "SHOWCASE_HERO_NO_PRODUCT_INFO") {
    return <ShowcaseHeroImageOnlyBlock block={block} />;
  }

  if (block.type === "SHOWCASE_RANDOM") {
    const product = block.products[0];

    if (!product) {
      return null;
    }

    return (
      <div className="px-4 py-2 sm:px-8 lg:px-14">
        <ShowcaseRandomGallery
          titleFa={block.titleFa}
          subtitleFa={block.subtitleFa}
          product={product}
        />
      </div>
    );
  }

  if (block.type === "SHOWCASE") {
    return (
      <div className="px-4 py-2 sm:px-8 lg:px-14">
        <ShowcaseBlock block={block} />
      </div>
    );
  }

  return (
    <div className="px-4 py-2 sm:px-8 lg:px-14">
      <GalleryBlock block={block} />
    </div>
  );
}

/** Server-rendered entry grid for the product worlds — the core navigation hook. */
function WorldsGrid() {
  return (
    <section className="px-4 py-10 sm:px-8 lg:px-14">
      <div className="mb-5 flex items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black sm:text-3xl">دنیای محصولات پیکسول</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            از کد دیجیتال تا سخت‌افزار، دامنه و سرور — همه در یک جا.
          </p>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {WORLD_ENTRIES.map((world) => {
          const Icon = world.icon;
          return (
            <Link
              key={world.slug}
              href={`/products?category=${world.slug}`}
              className="group flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 transition hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-lg"
            >
              <span className="grid size-11 place-items-center rounded-xl bg-primary/10 text-primary transition group-hover:bg-primary/15">
                <Icon aria-hidden="true" className="size-5" />
              </span>
              <span>
                <span className="block text-sm font-black text-foreground">{world.titleFa}</span>
                <span className="mt-1 block text-xs leading-5 text-muted-foreground">
                  {world.taglineFa}
                </span>
              </span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}

/** Shown when the admin has no hero/gallery block configured as the first block. */
function FallbackHero() {
  return (
    <section className="section-fade relative -mt-14 overflow-hidden bg-zinc-950 text-white">
      <div className="absolute inset-0 bg-[radial-gradient(60%_60%_at_50%_0%,oklch(0.45_0.18_135/0.35),transparent)]" />
      <div className="relative z-10 mx-auto flex min-h-[72svh] max-w-5xl flex-col items-center justify-center px-4 py-24 text-center sm:px-8">
        <p className="text-xs font-black uppercase tracking-[0.32em] text-primary">Pixevel</p>
        <h1 className="mt-4 text-5xl font-black leading-tight sm:text-7xl lg:text-8xl">
          هر چیزی که بازی می‌خواهد
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-base leading-8 text-white/75 sm:text-xl">
          گیفت کارت، سی‌دی‌کی، لوازم گیمینگ، دامنه و سرور — با تحویل سریع و پشتیبانی مطمئن.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/products"
            className="bg-primary px-6 py-3 text-sm font-black text-primary-foreground transition hover:bg-primary/90"
          >
            مشاهده همه محصولات
          </Link>
          <Link
            href="/products?category=gift-cards"
            className="border border-white/25 px-6 py-3 text-sm font-bold text-white transition hover:bg-white/10"
          >
            گیفت کارت‌ها
          </Link>
        </div>
      </div>
    </section>
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
        className="shrink-0 text-sm font-bold text-foreground/70 underline decoration-primary/60 decoration-2 underline-offset-4 transition hover:text-foreground"
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
        className="group grid overflow-hidden rounded-2xl bg-foreground text-background md:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]"
      >
        <div className="relative aspect-4/5 overflow-hidden bg-muted md:aspect-16/11">
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
          <p className="text-xs font-black uppercase tracking-[0.24em] text-primary">ویژه</p>
          <h3 className="mt-3 text-3xl font-black leading-tight sm:text-5xl">{product.titleFa}</h3>
          {product.summaryFa ? (
            <p className="mt-3 leading-8 opacity-72">{product.summaryFa}</p>
          ) : null}
          <div className="mt-6 flex items-center justify-between gap-4">
            <span className="text-sm font-black">{formatToman(product.price)}</span>
            <span className="rounded-lg bg-background px-5 py-3 text-sm font-black text-foreground">
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
