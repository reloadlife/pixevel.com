"use client";

import { useEffect, useRef } from "react";

import type { AnalyticsEventType } from "@/db/schema";

type TrackViewProps = {
  type: AnalyticsEventType;
  productId?: string;
  categoryId?: string;
  path?: string;
};

const ENDPOINT = "/api/analytics/track";

/** POST a small JSON payload to the beacon endpoint, preferring sendBeacon. */
function sendBeacon(payload: Record<string, unknown>) {
  try {
    const body = JSON.stringify(payload);

    if (typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
      const blob = new Blob([body], { type: "application/json" });
      if (navigator.sendBeacon(ENDPOINT, blob)) {
        return;
      }
    }

    void fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      keepalive: true,
    }).catch(() => {});
  } catch {
    // Tracking must never throw into the render tree.
  }
}

/**
 * Fires a single analytics event on mount (PRODUCT_VIEW, CATEGORY_VIEW,
 * PAGE_VIEW, …). Renders nothing. Dropped into server-rendered pages by other
 * agents; keep the prop contract stable.
 */
export function TrackView({ type, productId, categoryId, path }: TrackViewProps) {
  const fired = useRef(false);

  useEffect(() => {
    if (fired.current) {
      return;
    }
    fired.current = true;

    sendBeacon({
      type,
      productId,
      categoryId,
      path: path ?? (typeof window !== "undefined" ? window.location.pathname : undefined),
    });
  }, [type, productId, categoryId, path]);

  return null;
}

export default TrackView;
