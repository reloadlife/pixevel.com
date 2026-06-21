import { getCachedRate } from "@/lib/pricing/exchange";

/**
 * Domain price conversion. Spaceship quotes in USD; Pixevel stores money as
 * integer TOMAN. We convert with the admin-managed USD→Toman rate (same rate
 * used for USD-priced products) and apply a reseller markup, then round.
 */

/** Multiplicative reseller markup applied on top of the registrar quote. */
const MARKUP = Number(process.env.DOMAIN_PRICE_MARKUP ?? "1.2");

/** Fallback yearly price (Toman) when the registrar gives no quote. */
const FALLBACK_TOMAN = Number(process.env.DOMAIN_FALLBACK_PRICE_TOMAN ?? "990000");

/**
 * Converts a registrar USD quote (per year) into an integer Toman price for a
 * given number of years. Returns the fallback price when `priceUsd` is null.
 */
export function quoteToToman(priceUsd: number | null, years: number): number {
  const safeYears = Math.min(10, Math.max(1, Math.trunc(years) || 1));

  if (priceUsd == null || !Number.isFinite(priceUsd) || priceUsd <= 0) {
    return roundToman(FALLBACK_TOMAN * safeYears);
  }

  return roundToman(priceUsd * getCachedRate("USD") * MARKUP * safeYears);
}

/** Rounds up to the nearest 1,000 Toman for a tidy displayed price. */
function roundToman(value: number): number {
  return Math.max(0, Math.ceil(value / 1000) * 1000);
}
