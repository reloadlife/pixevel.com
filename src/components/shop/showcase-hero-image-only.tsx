"use client";

import { useEffect, useState } from "react";

type FrozenViewport = {
  width: number;
  height: number;
};

type ShowcaseHeroImageOnlyProps = {
  title: string;
  subtitle: string | null;
  productTitle: string;
  imageUrl: string | null;
};

function getInitialViewport(): FrozenViewport | null {
  if (typeof window === "undefined") {
    return null;
  }

  const viewport = window.visualViewport;

  return {
    width: Math.round(viewport?.width ?? window.innerWidth),
    height: Math.round(viewport?.height ?? window.innerHeight),
  };
}

export function ShowcaseHeroImageOnly({
  title,
  subtitle,
  productTitle,
  imageUrl,
}: ShowcaseHeroImageOnlyProps) {
  const [viewport, setViewport] = useState<FrozenViewport | null>(null);
  const frozenSize = viewport
    ? {
        height: `${viewport.height}px`,
        minHeight: `${viewport.height}px`,
        width: `${viewport.width}px`,
      }
    : {
        height: "100svh",
        minHeight: "100svh",
        width: "100vw",
      };

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      setViewport(getInitialViewport());
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
      <div className="relative z-10 grid h-full min-h-full place-items-center px-4 py-14 text-center sm:px-8 lg:px-14">
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
        </div>
      </div>
    </section>
  );
}
