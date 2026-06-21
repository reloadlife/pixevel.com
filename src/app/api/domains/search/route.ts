import { apiError, apiOk } from "@/lib/api";
import { quoteToToman } from "@/lib/domains/pricing";
import { searchDomain } from "@/lib/domains/spaceship";
import { loadExchangeRates } from "@/lib/pricing/exchange";

/**
 * GET /api/domains/search?q=<name>&years=<n>
 *
 * Checks availability + price for the search term. A bare term ("myshop") is
 * checked across common TLDs; a full domain ("myshop.com") checks just that one.
 * Prices are returned in integer Toman (registrar USD quote × rate × markup).
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = (searchParams.get("q") ?? "").trim();
  const years = Math.min(10, Math.max(1, Number(searchParams.get("years") ?? "1") || 1));

  if (q.length < 2) {
    return apiError("QUERY_TOO_SHORT", "حداقل دو حرف وارد کنید.");
  }

  await loadExchangeRates();
  const result = await searchDomain(q);

  if (!result.configured) {
    return apiOk({ configured: false, years, results: [] });
  }

  const results = result.quotes.map((quote) => ({
    domainName: quote.domainName,
    tld: quote.tld,
    available: quote.available,
    premium: quote.premium,
    priceToman: quote.available ? quoteToToman(quote.priceUsd, years) : null,
  }));

  return apiOk({ configured: true, years, results });
}
