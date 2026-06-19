"use client";

import { useEffect, useState } from "react";

const SCROLL_DELTA = 8;
const TOP_REVEAL_OFFSET = 80;
const BOTTOM_REVEAL_OFFSET = 24;

export function useHideOnScroll(): boolean {
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    let lastY = window.scrollY;
    let frame: number | null = null;

    function update() {
      frame = null;

      const currentY = Math.max(0, window.scrollY);
      const maxY = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
      const delta = currentY - lastY;
      const nearTop = currentY < TOP_REVEAL_OFFSET;
      const nearBottom = currentY > maxY - BOTTOM_REVEAL_OFFSET;

      if (nearTop || nearBottom || delta < -SCROLL_DELTA) {
        setHidden(false);
      } else if (delta > SCROLL_DELTA) {
        setHidden(true);
      }

      lastY = currentY;
    }

    function onScroll() {
      if (frame !== null) {
        return;
      }

      frame = window.requestAnimationFrame(update);
    }

    window.addEventListener("scroll", onScroll, { passive: true });

    return () => {
      if (frame !== null) {
        window.cancelAnimationFrame(frame);
      }

      window.removeEventListener("scroll", onScroll);
    };
  }, []);

  return hidden;
}
