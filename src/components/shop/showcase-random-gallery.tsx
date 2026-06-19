/* eslint-disable @next/next/no-img-element -- Product media can be admin-entered URLs until a CDN allowlist exists. */
"use client";

import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useMemo, useRef, useState } from "react";

import { formatToman, toFaNumber } from "@/lib/format";

type ShowcaseRandomImage = {
  id: string;
  url: string;
  altFa: string | null;
};

type ShowcaseRandomProduct = {
  id: string;
  slug: string;
  titleFa: string;
  summaryFa: string | null;
  imageUrl?: string | null;
  images: ShowcaseRandomImage[];
  price: number;
};

export function ShowcaseRandomGallery({
  titleFa,
  subtitleFa,
  product,
}: {
  titleFa: string;
  subtitleFa: string | null;
  product: ShowcaseRandomProduct;
}) {
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const galleryRef = useRef<HTMLDivElement | null>(null);
  const galleryImages = useMemo(
    () =>
      product.images.length
        ? product.images
        : [{ id: "empty", url: product.imageUrl ?? "", altFa: product.titleFa }],
    [product.imageUrl, product.images, product.titleFa]
  );

  function handleGalleryScroll() {
    const gallery = galleryRef.current;

    if (!gallery || gallery.clientWidth <= 0) {
      return;
    }

    const nextIndex = Math.round(gallery.scrollLeft / gallery.clientWidth);
    setActiveImageIndex(Math.max(0, Math.min(nextIndex, galleryImages.length - 1)));
  }

  function scrollGalleryTo(index: number) {
    const gallery = galleryRef.current;

    if (!gallery) {
      return;
    }

    gallery.scrollTo({ left: gallery.clientWidth * index, behavior: "smooth" });
    setActiveImageIndex(index);
  }

  function goNext() {
    scrollGalleryTo(Math.min(activeImageIndex + 1, galleryImages.length - 1));
  }

  function goPrevious() {
    scrollGalleryTo(Math.max(activeImageIndex - 1, 0));
  }

  return (
    <section className="section-fade" data-showcase-random-gallery>
      <div className="mb-5 flex items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black sm:text-3xl">{titleFa}</h2>
          {subtitleFa ? (
            <p className="mt-1 text-sm text-muted-foreground">{subtitleFa}</p>
          ) : null}
        </div>
        <Link href="/products" className="text-sm font-bold underline underline-offset-4">
          همه محصولات
        </Link>
      </div>

      <div className="grid overflow-hidden bg-foreground text-background md:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]">
        <div className="relative aspect-[4/5] overflow-hidden bg-muted md:aspect-[16/11]">
          <div
            ref={galleryRef}
            dir="ltr"
            onScroll={handleGalleryScroll}
            className="flex h-full snap-x snap-mandatory overflow-x-auto scroll-smooth [&::-webkit-scrollbar]:hidden"
            aria-label={titleFa}
          >
            {galleryImages.map((image) => (
              <div
                key={image.id}
                className="h-full min-w-full snap-center overflow-hidden bg-zinc-200"
              >
                {image.url ? (
                  <img
                    src={image.url}
                    alt={image.altFa ?? product.titleFa}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="grid h-full place-items-center text-zinc-600">بدون تصویر</div>
                )}
              </div>
            ))}
          </div>

          {galleryImages.length > 1 ? (
            <>
              <button
                type="button"
                onClick={goPrevious}
                disabled={activeImageIndex === 0}
                className="absolute left-4 top-1/2 z-20 hidden size-10 -translate-y-1/2 place-items-center bg-background/92 text-foreground shadow-2xl transition hover:bg-background disabled:opacity-35 md:grid"
                aria-label="تصویر قبلی"
              >
                <ChevronLeft className="size-5" />
              </button>
              <button
                type="button"
                onClick={goNext}
                disabled={activeImageIndex === galleryImages.length - 1}
                className="absolute right-4 top-1/2 z-20 hidden size-10 -translate-y-1/2 place-items-center bg-background/92 text-foreground shadow-2xl transition hover:bg-background disabled:opacity-35 md:grid"
                aria-label="تصویر بعدی"
              >
                <ChevronRight className="size-5" />
              </button>
              <div
                dir="ltr"
                className="absolute bottom-4 left-1/2 z-20 flex -translate-x-1/2 items-center gap-3 rounded-full bg-background/92 px-4 py-3 text-foreground shadow-2xl backdrop-blur-sm"
                aria-label="گالری تصاویر محصول"
              >
                {galleryImages.map((image, index) => (
                  <button
                    key={`${image.id}-dot`}
                    type="button"
                    onClick={() => scrollGalleryTo(index)}
                    className={`h-2 rounded-full transition-all ${
                      activeImageIndex === index
                        ? "w-9 bg-foreground/75"
                        : "w-2 bg-foreground/20 hover:bg-foreground/35"
                    }`}
                  >
                    <span className="sr-only">
                      تصویر {toFaNumber(index + 1)} از {toFaNumber(galleryImages.length)}
                    </span>
                  </button>
                ))}
              </div>
            </>
          ) : null}
        </div>

        <div className="flex flex-col justify-end p-5 sm:p-8">
          <p className="text-xs font-black uppercase tracking-[0.24em] opacity-60">Showcase</p>
          <h3 className="mt-3 text-3xl font-black leading-tight sm:text-5xl">
            {product.titleFa}
          </h3>
          {product.summaryFa ? (
            <p className="mt-3 leading-8 opacity-72">{product.summaryFa}</p>
          ) : null}
          <div className="mt-6 flex items-center justify-between gap-4">
            <span className="text-sm font-black">{formatToman(product.price)}</span>
            <Link
              href={`/products/${product.slug}`}
              className="bg-background px-5 py-3 text-sm font-black text-foreground transition hover:bg-background/90"
            >
              مشاهده
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
