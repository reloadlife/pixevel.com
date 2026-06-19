import { apiOk } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth";
import { getProductsForListing } from "@/lib/catalog";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q") ?? undefined;
  const category = searchParams.get("category") ?? undefined;
  const page = Math.max(1, Number(searchParams.get("page") ?? "1") || 1);
  const pageSize = Math.min(100, Math.max(1, Number(searchParams.get("pageSize") ?? "24") || 24));
  const user = await getCurrentUser();
  const { items, meta } = await getProductsForListing(user, { q, category, page, pageSize });
  return apiOk({ products: items, meta });
}
