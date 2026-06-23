"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

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

/** Admin is operational tooling — never counted as storefront traffic. */
function isTrackablePath(path: string): boolean {
  return !path.startsWith("/admin");
}

/**
 * Fires a generic `PAGE_VIEW` on every storefront route change (mount + each
 * `usePathname` change). The first event of a page load also carries the full
 * landing URL (for UTM parsing) and `document.referrer` (for acquisition) — the
 * track API only attaches acquisition data on a session's landing event anyway.
 *
 * Mounted once in the storefront root layout; it skips `/admin` paths itself so
 * a single mount point can sit above both trees. Renders nothing.
 */
export function RouteTracker() {
  const pathname = usePathname();
  // True only for the very first event of this document load.
  const firstFire = useRef(true);
  // Guard against double-firing the same path (e.g. StrictMode/effect replays).
  const lastPath = useRef<string | null>(null);

  useEffect(() => {
    if (!pathname || !isTrackablePath(pathname)) {
      return;
    }
    if (lastPath.current === pathname) {
      return;
    }
    lastPath.current = pathname;

    const isLanding = firstFire.current;
    firstFire.current = false;

    sendBeacon({
      type: "PAGE_VIEW",
      path: pathname,
      // Only the landing event needs the URL+referrer; later navigations don't.
      ...(isLanding && typeof window !== "undefined"
        ? {
            landingUrl: window.location.href,
            referrer: document.referrer || undefined,
          }
        : {}),
    });
  }, [pathname]);

  return null;
}

export default RouteTracker;
