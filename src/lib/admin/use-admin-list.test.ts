import { describe, expect, it } from "vitest";
import { buildAdminListUrl } from "./use-admin-list";

describe("buildAdminListUrl", () => {
  it("returns the bare path with no filters", () => {
    expect(buildAdminListUrl("reviews")).toBe("/api/admin/reviews");
  });
  it("appends only defined, non-empty filters", () => {
    expect(buildAdminListUrl("orders", { status: "PAID", q: "", page: 2, x: undefined })).toBe(
      "/api/admin/orders?status=PAID&page=2",
    );
  });
});
