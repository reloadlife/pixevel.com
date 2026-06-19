"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { formatToman, toFaNumber } from "@/lib/format";

type FullscreenGalleryProduct = {
  id: string;
  slug: string;
  titleFa: string;
  summaryFa: string | null;
  imageUrl?: string | null;
  price: number;
};

type FrozenGallerySize = {
  width: number;
  height: number;
};

function getInitialGallerySize(): FrozenGallerySize | null {
  if (typeof window === "undefined") {
    return null;
  }

  const viewport = window.visualViewport;
  const width = Math.round(viewport?.width ?? window.innerWidth);
  const height = Math.round((viewport?.height ?? window.innerHeight) * 0.86);

  return { width, height };
}

export function FullscreenHorizontalGallery({
  titleFa,
  subtitleFa,
  products,
}: {
  titleFa: string;
  subtitleFa: string | null;
  products: FullscreenGalleryProduct[];
}) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [gallerySize, setGallerySize] = useState<FrozenGallerySize | null>(null);
  const galleryRef = useRef<HTMLDivElement | null>(null);
  const frozenSize = gallerySize
    ? {
        height: `${gallerySize.height}px`,
        minHeight: `${gallerySize.height}px`,
        width: `${gallerySize.width}px`,
      }
    : {
        minHeight: "86svh",
        width: "100vw",
      };

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      setGallerySize(getInitialGallerySize());
    });

    return () => window.cancelAnimationFrame(frame);
  }, []);

  function handleScroll() {
    const gallery = galleryRef.current;

    if (!gallery || gallery.clientWidth <= 0) {
      return;
    }

    const nextIndex = Math.round(gallery.scrollLeft / gallery.clientWidth);
    setActiveIndex(Math.max(0, Math.min(nextIndex, products.length - 1)));
  }

  function scrollToProduct(index: number) {
    const gallery = galleryRef.current;

    if (!gallery) {
      return;
    }

    gallery.scrollTo({ left: gallery.clientWidth * index, behavior: "smooth" });
    setActiveIndex(index);
  }

  function goNext() {
    scrollToProduct(Math.min(activeIndex + 1, products.length - 1));
  }

  function goPrevious() {
    scrollToProduct(Math.max(activeIndex - 1, 0));
  }

  if (products.length === 0) {
    return null;
  }

  return (
    <section
      className="section-fade relative -mx-0 overflow-hidden bg-zinc-950 text-white"
      style={frozenSize}
      suppressHydrationWarning
    >
      <div
        ref={galleryRef}
        dir="ltr"
        onScroll={handleScroll}
        className="flex snap-x snap-mandatory overflow-x-auto scroll-smooth [&::-webkit-scrollbar]:hidden"
        style={frozenSize}
        aria-label={titleFa}
      >
        {products.map((product) => (
          <article
            key={product.id}
            className="relative min-w-full snap-center overflow-hidden"
            style={frozenSize}
          >
            {product.imageUrl ? (
              <img
                src={product.imageUrl}
                alt={product.titleFa}
                className="absolute inset-0 h-full w-full object-cover opacity-80"
              />
            ) : (
              <div className="absolute inset-0 grid place-items-center bg-zinc-900 text-zinc-400">
                بدون تصویر
              </div>
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black via-black/28 to-black/10" />
            <div
              className="relative z-10 flex flex-col justify-end px-4 pb-20 sm:px-8 lg:px-14"
              style={frozenSize}
            >
              <p className="text-xs font-black uppercase tracking-[0.24em] text-white/70">
                {titleFa}
              </p>
              {subtitleFa ? (
                <p className="mt-2 max-w-xl text-sm leading-7 text-white/72">{subtitleFa}</p>
              ) : null}
              <h2 className="mt-4 max-w-3xl text-4xl font-black leading-tight sm:text-6xl">
                {product.titleFa}
              </h2>
              {product.summaryFa ? (
                <p className="mt-3 max-w-xl text-base leading-8 text-white/78">
                  {product.summaryFa}
                </p>
              ) : null}
              <div className="mt-6 flex flex-wrap items-center gap-3">
                <Link
                  href={`/products/${product.slug}`}
                  className="bg-white px-6 py-3 text-sm font-black text-black transition hover:bg-white/88"
                >
                  مشاهده محصول
                </Link>
                <span className="text-sm font-bold text-white/82">
                  از {formatToman(product.price)}
                </span>
              </div>
            </div>
          </article>
        ))}
      </div>

      {products.length > 1 ? (
        <>
          <button
            type="button"
            onClick={goPrevious}
            disabled={activeIndex === 0}
            className="absolute left-5 top-1/2 z-20 hidden size-11 -translate-y-1/2 place-items-center bg-white/92 text-black shadow-2xl transition hover:bg-white disabled:opacity-35 lg:grid"
            aria-label="محصول قبلی"
          >
            <ChevronLeft className="size-5" />
          </button>
          <button
            type="button"
            onClick={goNext}
            disabled={activeIndex === products.length - 1}
            className="absolute right-5 top-1/2 z-20 hidden size-11 -translate-y-1/2 place-items-center bg-white/92 text-black shadow-2xl transition hover:bg-white disabled:opacity-35 lg:grid"
            aria-label="محصول بعدی"
          >
            <ChevronRight className="size-5" />
          </button>
          <div
            dir="ltr"
            className="absolute bottom-5 left-1/2 z-20 flex -translate-x-1/2 items-center gap-3 rounded-full bg-background/92 px-4 py-3 text-foreground shadow-2xl backdrop-blur-sm"
            aria-label="صفحات گالری"
          >
            {products.map((product, index) => (
              <button
                key={`${product.id}-dot`}
                type="button"
                onClick={() => scrollToProduct(index)}
                className={`h-2 rounded-full transition-all ${
                  activeIndex === index
                    ? "w-9 bg-foreground/75"
                    : "w-2 bg-foreground/20 hover:bg-foreground/35"
                }`}
              >
                <span className="sr-only">
                  محصول {toFaNumber(index + 1)} از {toFaNumber(products.length)}
                </span>
              </button>
            ))}
          </div>
        </>
      ) : null}
    </section>
  );
}
