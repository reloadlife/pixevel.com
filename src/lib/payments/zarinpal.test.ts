import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { zarinpalProvider } from "./zarinpal";

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Minimal Payment stub sufficient for verify(). */
const fakePayment = {
  id: "pay-1",
  orderId: "ord-1",
  userId: "usr-1",
  status: "UNPAID" as const,
  provider: "ZARINPAL",
  reference: null,
  receiptUrl: null,
  amount: "500000", // 500,000 Toman
  currency: "IRT" as const,
  paidAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("zarinpalProvider.verify", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test("status NOK → FAILED without calling fetch", async () => {
    const result = await zarinpalProvider.verify(fakePayment, {
      authority: "A00000000000000000000000000123456789",
      status: "NOK",
    });

    expect(result).toEqual({ status: "FAILED" });
    expect(fetch).not.toHaveBeenCalled();
  });

  test("status OK + code 100 → PAID with ref_id as reference", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: { code: 100, ref_id: 987654 },
        errors: [],
      }),
    });

    const result = await zarinpalProvider.verify(fakePayment, {
      authority: "A00000000000000000000000000123456789",
      status: "OK",
    });

    expect(result).toEqual({ status: "PAID", reference: "987654" });
    expect(fetch).toHaveBeenCalledOnce();
  });

  test("status OK + code 101 (already verified) → PAID", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: { code: 101, ref_id: 111222 },
        errors: [],
      }),
    });

    const result = await zarinpalProvider.verify(fakePayment, {
      authority: "A00000000000000000000000000123456789",
      status: "OK",
    });

    expect(result).toEqual({ status: "PAID", reference: "111222" });
  });

  test("status OK + unexpected code → FAILED", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: { code: -22, ref_id: 0 },
        errors: [],
      }),
    });

    const result = await zarinpalProvider.verify(fakePayment, {
      authority: "A00000000000000000000000000123456789",
      status: "OK",
    });

    expect(result).toEqual({ status: "FAILED" });
  });

  test("status OK + non-ok HTTP response → FAILED", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: false,
      json: async () => ({ data: {}, errors: { code: -9 } }),
    });

    const result = await zarinpalProvider.verify(fakePayment, {
      authority: "A00000000000000000000000000123456789",
      status: "OK",
    });

    expect(result).toEqual({ status: "FAILED" });
  });
});
