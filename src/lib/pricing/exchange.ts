import { type BaseCurrency, exchangeRates } from "@/db/schema";
import { getDb } from "@/lib/db";

/**
 * USD/EUR → Toman exchange rates. Products can be authored in USD or EUR; the
 * Toman price shown to customers (and charged) is derived from the current rate,
 * so prices always track the foreign price. Rates are set in the admin panel.
 *
 * A small module cache (TTL) lets the synchronous price resolver convert without
 * a DB round-trip per call. Server entrypoints call {@link loadExchangeRates}
 * once per request to keep the cache warm/fresh; the resolver then reads it.
 *
 * Rate source is manual today; the same {@link setExchangeRate} sink can later be
 * fed by a scheduled FX-API fetch with no caller changes.
 */

export type ForeignCurrency = "USD" | "EUR";
export type Rates = Record<ForeignCurrency, number>;

/** Fallbacks when no rate row exists yet — keeps pricing sane on a fresh DB. */
const DEFAULT_USD = Number(process.env.SPACESHIP_USD_TO_TOMAN ?? "70000") || 70000;
const DEFAULT_EUR = Number(process.env.EUR_TO_TOMAN ?? "") || Math.round(DEFAULT_USD * 1.08);

const RATE_TTL_MS = 5 * 60 * 1000;

let cache: Rates = { USD: DEFAULT_USD, EUR: DEFAULT_EUR };
let loadedAt = 0;

/** Reads rates from the DB into the module cache and returns them. */
export async function loadExchangeRates(): Promise<Rates> {
  const next: Rates = { USD: DEFAULT_USD, EUR: DEFAULT_EUR };
  try {
    const rows = await getDb().select().from(exchangeRates);
    for (const row of rows) {
      const value = Number(row.rateToman);
      if (row.currency === "USD" && value > 0) next.USD = value;
      if (row.currency === "EUR" && value > 0) next.EUR = value;
    }
  } catch {
    // DB unavailable — keep defaults; pricing must never throw here.
  }
  cache = next;
  loadedAt = Date.now();
  return next;
}

/** Ensures the cache is fresh (loads if stale), then returns it. */
export async function getFreshRates(): Promise<Rates> {
  if (Date.now() - loadedAt > RATE_TTL_MS) {
    return loadExchangeRates();
  }
  return cache;
}

/** Synchronous cached rate for a foreign currency (uses the last-loaded value). */
export function getCachedRate(currency: ForeignCurrency): number {
  return cache[currency];
}

/**
 * Convert an authored amount in `currency` to Toman using the cached rate.
 * IRT passes through unchanged. Result is rounded to a whole Toman.
 */
export function convertToToman(amount: number, currency: BaseCurrency): number {
  if (currency === "IRT" || !Number.isFinite(amount)) {
    return amount;
  }
  return Math.round(amount * getCachedRate(currency));
}

// ─── Admin ────────────────────────────────────────────────────────────────────

export type AdminRate = { currency: ForeignCurrency; rateToman: number; updatedAt: string | null };

/** All configured rates for the admin panel, falling back to defaults for display. */
export async function getRatesForAdmin(): Promise<AdminRate[]> {
  const rows = await getDb().select().from(exchangeRates);
  const byCurrency = new Map(rows.map((r) => [r.currency, r]));
  return (["USD", "EUR"] as const).map((currency) => {
    const row = byCurrency.get(currency);
    return {
      currency,
      rateToman: row ? Number(row.rateToman) : currency === "USD" ? DEFAULT_USD : DEFAULT_EUR,
      updatedAt: row?.updatedAt ? row.updatedAt.toISOString() : null,
    };
  });
}

/** Upsert a rate (manual admin entry today; an FX job can call this later). */
export async function setExchangeRate(
  currency: ForeignCurrency,
  rateToman: number,
  updatedByUserId: string | null,
): Promise<void> {
  await getDb()
    .insert(exchangeRates)
    .values({ currency, rateToman: String(rateToman), updatedByUserId, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: exchangeRates.currency,
      set: { rateToman: String(rateToman), updatedByUserId, updatedAt: new Date() },
    });
  // Refresh the cache so the new rate takes effect immediately.
  await loadExchangeRates();
}
