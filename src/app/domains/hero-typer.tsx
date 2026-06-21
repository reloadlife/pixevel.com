"use client";

import { useEffect, useState } from "react";

/** TLDs cycled in the hero motif — the registry's own vernacular. */
const TLDS = [".com", ".io", ".dev", ".shop", ".ai", ".store"];

/**
 * Animated hero motif: a fixed name with a cycling extension and a blinking
 * caret, evoking a domain-registry console. Falls back to a static line when
 * the user prefers reduced motion.
 */
export function HeroTyper() {
  const [index, setIndex] = useState(0);
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduceMotion(mq.matches);
    if (mq.matches) return;

    const id = setInterval(() => setIndex((prev) => (prev + 1) % TLDS.length), 1700);
    return () => clearInterval(id);
  }, []);

  return (
    <span
      dir="ltr"
      className="inline-flex items-baseline font-mono text-lg font-medium text-zinc-300 sm:text-xl"
    >
      yourname
      {reduceMotion ? (
        <span className="text-gold">.com</span>
      ) : (
        <>
          <span
            key={index}
            className="text-gold animate-in fade-in slide-in-from-bottom-1 duration-300"
          >
            {TLDS[index]}
          </span>
          <span
            className="ms-0.5 inline-block w-px animate-pulse self-stretch bg-gold"
            aria-hidden
          />
        </>
      )}
    </span>
  );
}
