import { describe, expect, it } from "vitest";
import { statusMeta } from "./status-chip";

describe("statusMeta", () => {
  it("maps a known order status to a Persian label", () => {
    expect(statusMeta("order", "PAID").label).toBe("پرداخت‌شده");
  });
  it("maps payment FAILED to destructive variant", () => {
    expect(statusMeta("payment", "FAILED").variant).toBe("destructive");
  });
  it("falls back for an unknown value", () => {
    expect(statusMeta("order", "WAT")).toEqual({ label: "WAT", variant: "outline" });
  });
});
