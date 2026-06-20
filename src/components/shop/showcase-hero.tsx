"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { formatToman } from "@/lib/format";

type FrozenHeroSize = {
  width: number;
  height: number;
};

type ShowcaseHeroProps = {
  title: string;
  subtitle: string | null;
  productTitle: string;
  productSlug: string;
  imageUrl: string | null;
  price: number;
};

function getInitialHeroSize(): FrozenHeroSize | null {
  if (typeof window === "undefined") {
    return null;
  }

  const viewport = window.visualViewport;
  const width = Math.round(viewport?.width ?? window.innerWidth);
  const height = Math.round((viewport?.height ?? window.innerHeight) * 0.86);

  return { width, height };
}

export function ShowcaseHero({
  title,
  subtitle,
  productTitle,
  productSlug,
  imageUrl,
  price,
}: ShowcaseHeroProps) {
  const [heroSize, setHeroSize] = useState<FrozenHeroSize | null>(null);
  const frozenSize = heroSize
    ? {
        height: `${heroSize.height}px`,
        minHeight: `${heroSize.height}px`,
        width: `${heroSize.width}px`,
      }
    : {
        minHeight: "86svh",
        width: "100vw",
      };

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      setHeroSize(getInitialHeroSize());
    });

    return () => window.cancelAnimationFrame(frame);
  }, []);

  return (
    <section
      className="section-fade relative -mt-14 overflow-hidden bg-zinc-950 text-white"
      style={frozenSize}
      suppressHydrationWarning
    >
      {imageUrl ? (
        <img
          src={imageUrl}
          alt={productTitle}
          className="absolute inset-0 h-full w-full object-cover opacity-76"
        />
      ) : (
        <div className="absolute inset-0 grid place-items-center bg-zinc-900 text-zinc-400">
          بدون تصویر
        </div>
      )}
      <div className="absolute inset-0 bg-black/45" />
      <div
        className="relative z-10 grid place-items-center px-4 py-14 text-center sm:px-8 lg:px-14"
        style={frozenSize}
      >
        <div className="max-w-4xl">
          <p className="text-xs font-black uppercase tracking-[0.32em] text-primary">Pixevel</p>
          <h2 className="mt-4 text-5xl font-black leading-tight sm:text-7xl lg:text-8xl">
            {title}
          </h2>
          {subtitle ? (
            <p className="mx-auto mt-5 max-w-2xl text-base leading-8 text-white/78 sm:text-xl">
              {subtitle}
            </p>
          ) : null}
          <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
            <Link
              href={`/products/${productSlug}`}
              className="bg-primary px-6 py-3 text-sm font-black text-primary-foreground transition hover:bg-primary/90"
            >
              مشاهده محصول
            </Link>
            <span className="text-sm font-bold text-white/70">
              از <span className="text-primary">{formatToman(price)}</span>
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
