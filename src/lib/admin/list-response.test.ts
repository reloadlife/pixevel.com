import { describe, expect, it } from "vitest";
import { normalizeListResponse } from "./list-response";

describe("normalizeListResponse", () => {
  it("passes through the canonical shape", () => {
    const r = normalizeListResponse({
      rows: [{ id: "a" }],
      pagination: { page: 1, pageSize: 20, total: 1, totalPages: 1 },
    });
    expect(r.rows).toHaveLength(1);
    expect(r.pagination.total).toBe(1);
  });

  it("adapts a legacy key (reviews → rows)", () => {
    const r = normalizeListResponse({ reviews: [{ id: "x" }] }, { rowsKey: "reviews" });
    expect(r.rows).toEqual([{ id: "x" }]);
    expect(r.pagination.page).toBe(1);
  });

  it("falls back to the first array value and synthesizes pagination", () => {
    const r = normalizeListResponse({ items: [1, 2, 3] });
    expect(r.rows).toEqual([1, 2, 3]);
    expect(r.pagination.total).toBe(3);
    expect(r.pagination.totalPages).toBe(1);
  });
});
