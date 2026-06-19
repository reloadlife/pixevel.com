import { apiOk } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth";
import { getProductsForListing } from "@/lib/catalog";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q") ?? undefined;
  const user = await getCurrentUser();
  return apiOk({ products: await getProductsForListing(user, { q }) });
}
