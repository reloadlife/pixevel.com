import { describe, expect, it } from "vitest";
import { computeOrderTaxes } from "./tax";

describe("computeOrderTaxes", () => {
  it("returns zero tax when the rate is 0 (disabled)", () => {
    const r = computeOrderTaxes([{ lineTotal: 100_000, taxExempt: false }], 0);
    expect(r.totalTax).toBe(0);
    expect(r.perLine[0]).toEqual({ taxAmount: 0, taxRatePercent: 0 });
  });

  it("applies a flat rate to a single line", () => {
    const r = computeOrderTaxes([{ lineTotal: 100_000, taxExempt: false }], 10);
    expect(r.totalTax).toBe(10_000);
    expect(r.perLine[0]).toEqual({ taxAmount: 10_000, taxRatePercent: 10 });
  });

  it("never taxes an exempt line", () => {
    const r = computeOrderTaxes(
      [
        { lineTotal: 100_000, taxExempt: true },
        { lineTotal: 50_000, taxExempt: false },
      ],
      10,
    );
    expect(r.perLine[0].taxAmount).toBe(0);
    expect(r.perLine[1].taxAmount).toBe(5_000);
    expect(r.totalTax).toBe(5_000);
  });

  it("spreads an order-level discount proportionally before taxing", () => {
    // Two equal lines, 60k total discount → 30k off each → taxed on 70k each.
    const r = computeOrderTaxes(
      [
        { lineTotal: 100_000, taxExempt: false },
        { lineTotal: 100_000, taxExempt: false },
      ],
      10,
      60_000,
    );
    expect(r.perLine[0].taxAmount).toBe(7_000);
    expect(r.perLine[1].taxAmount).toBe(7_000);
    expect(r.totalTax).toBe(14_000);
  });

  it("does not let a discount push the taxable base below zero", () => {
    const r = computeOrderTaxes([{ lineTotal: 50_000, taxExempt: false }], 10, 999_999);
    expect(r.totalTax).toBe(0);
  });

  it("rounds each line to whole Toman", () => {
    const r = computeOrderTaxes([{ lineTotal: 12_345, taxExempt: false }], 9);
    expect(r.totalTax).toBe(Math.round((12_345 * 9) / 100)); // 1111
  });
});
