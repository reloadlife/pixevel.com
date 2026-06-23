import { describe, expect, test } from "vitest";

import {
  deriveEntryPages,
  deriveExitPages,
  deriveSessionKpis,
  deriveTransitions,
  type FlowEvent,
} from "./flow";

/** Build an event with an incrementing timestamp so input order = time order. */
function ev(sessionId: string, path: string, minute: number): FlowEvent {
  return { sessionId, path, createdAt: new Date(2026, 5, 24, 12, minute, 0) };
}

// Two sessions:
//  s1: / → /products → /products/a → /cart   (4 pages)
//  s2: / → /products                          (2 pages)
//  s3: /                                       (1 page, bounce)
const fixture: FlowEvent[] = [
  ev("s1", "/", 0),
  ev("s1", "/products", 1),
  ev("s1", "/products/a", 2),
  ev("s1", "/cart", 3),
  ev("s2", "/", 0),
  ev("s2", "/products", 5),
  ev("s3", "/", 0),
];

describe("deriveTransitions", () => {
  test("derives consecutive path pairs across sessions, aggregated", () => {
    const t = deriveTransitions(fixture);
    const homeToProducts = t.find((x) => x.from === "/" && x.to === "/products");
    expect(homeToProducts?.count).toBe(2); // s1 and s2
    expect(t.find((x) => x.from === "/products" && x.to === "/products/a")?.count).toBe(1);
    expect(t.find((x) => x.from === "/products/a" && x.to === "/cart")?.count).toBe(1);
  });

  test("skips self-loops (same path back-to-back)", () => {
    const t = deriveTransitions([ev("s", "/x", 0), ev("s", "/x", 1), ev("s", "/y", 2)]);
    expect(t.find((x) => x.from === "/x" && x.to === "/x")).toBeUndefined();
    expect(t.find((x) => x.from === "/x" && x.to === "/y")?.count).toBe(1);
  });

  test("orders by count desc and respects the limit", () => {
    const t = deriveTransitions(fixture, 1);
    expect(t).toHaveLength(1);
    expect(t[0]).toMatchObject({ from: "/", to: "/products", count: 2 });
  });
});

describe("deriveEntryPages / deriveExitPages", () => {
  test("entry pages are the first path of each session", () => {
    const entries = deriveEntryPages(fixture);
    expect(entries.find((e) => e.path === "/")?.count).toBe(3); // all three start at /
  });

  test("exit pages are the last path of each session", () => {
    const exits = deriveExitPages(fixture);
    expect(exits.find((e) => e.path === "/cart")?.count).toBe(1); // s1
    expect(exits.find((e) => e.path === "/products")?.count).toBe(1); // s2
    expect(exits.find((e) => e.path === "/")?.count).toBe(1); // s3 bounce
  });
});

describe("deriveSessionKpis", () => {
  test("counts sessions, avg pages/session and bounce rate", () => {
    const kpis = deriveSessionKpis(fixture);
    expect(kpis.sessions).toBe(3);
    // (4 + 2 + 1) / 3 = 2.33 → 2.3
    expect(kpis.pagesPerSession).toBe(2.3);
    // 1 of 3 sessions bounced (s3) → 33%
    expect(kpis.bounceRate).toBe(33);
  });

  test("handles empty input", () => {
    expect(deriveSessionKpis([])).toEqual({ sessions: 0, pagesPerSession: 0, bounceRate: 0 });
  });
});
