import { apiOk } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth";
import { getProductsForListing, PRODUCT_SORT_KEYS, type ProductSortKey } from "@/lib/catalog";

function parsePositiveAmount(raw: string | null): number | undefined {
  if (raw == null || raw.trim() === "") return undefined;
  const value = Number(raw);
  if (!Number.isFinite(value) || value < 0) return undefined;
  return value;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q") ?? undefined;
  const category = searchParams.get("category") ?? undefined;
  const tag = searchParams.get("tag") ?? undefined;
  const page = Math.max(1, Number(searchParams.get("page") ?? "1") || 1);
  const pageSize = Math.min(100, Math.max(1, Number(searchParams.get("pageSize") ?? "24") || 24));

  const sortRaw = searchParams.get("sort");
  const sort = PRODUCT_SORT_KEYS.includes(sortRaw as ProductSortKey)
    ? (sortRaw as ProductSortKey)
    : undefined;

  let minPrice = parsePositiveAmount(searchParams.get("minPrice"));
  let maxPrice = parsePositiveAmount(searchParams.get("maxPrice"));
  // Keep the range coherent: if min > max, swap so callers don't get empty results.
  if (minPrice != null && maxPrice != null && minPrice > maxPrice) {
    [minPrice, maxPrice] = [maxPrice, minPrice];
  }

  const inStock = searchParams.get("inStock") === "true";

  const user = await getCurrentUser();
  const { items, meta } = await getProductsForListing(user, {
    q,
    category,
    tag,
    sort,
    minPrice,
    maxPrice,
    inStock,
    page,
    pageSize,
  });
  return apiOk({ products: items, meta });
}
