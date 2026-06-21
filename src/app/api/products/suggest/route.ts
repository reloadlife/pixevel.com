import { getOrSetAnonId, recordEvent } from "@/lib/analytics/track";
import { apiOk } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth";
import { getSearchSuggestions } from "@/lib/catalog";

/**
 * GET /api/products/suggest?q=<term>
 *
 * Live search autocomplete. Returns up to ~6 matching ACTIVE products and ~4
 * matching categories for the storefront search. Requires at least 2 characters
 * — shorter queries return an empty result set without hitting the database.
 *
 * Product suggestions carry only what the dropdown renders (id, slug, titleFa,
 * a public/non-VIP primary image, and the public-tier price in toman). The
 * shape is intentionally stable for reuse by web + a future Android client.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = (searchParams.get("q") ?? "").trim();

  if (q.length < 2) {
    return apiOk({ query: q, products: [], categories: [] });
  }

  const { products, categories } = await getSearchSuggestions(q);

  // Fire-and-forget SEARCH capture — never awaited, never blocks the response.
  void (async () => {
    const [user, anonId] = await Promise.all([
      getCurrentUser().catch(() => null),
      getOrSetAnonId().catch(() => null),
    ]);
    await recordEvent({
      type: "SEARCH",
      userId: user?.id ?? null,
      anonId,
      query: q,
      resultCount: products.length + categories.length,
      path: "/api/products/suggest",
    });
  })();

  return apiOk({ query: q, products, categories });
}
