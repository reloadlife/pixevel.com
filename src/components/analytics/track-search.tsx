"use client";

import { useEffect, useRef } from "react";

type TrackSearchProps = {
  query: string;
  resultCount: number;
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
 * Fires one SEARCH event per distinct query value. Re-fires only when the query
 * string actually changes (so a results page re-render doesn't double count).
 * Renders nothing. Dropped into search/listing pages by other agents.
 */
export function TrackSearch({ query, resultCount }: TrackSearchProps) {
  const lastQuery = useRef<string | null>(null);

  useEffect(() => {
    const trimmed = query.trim();

    if (!trimmed || lastQuery.current === trimmed) {
      return;
    }
    lastQuery.current = trimmed;

    sendBeacon({
      type: "SEARCH",
      query: trimmed,
      resultCount,
      path: typeof window !== "undefined" ? window.location.pathname : undefined,
    });
  }, [query, resultCount]);

  return null;
}

export default TrackSearch;
