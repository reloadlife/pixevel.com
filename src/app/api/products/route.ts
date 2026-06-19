import { apiOk } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth";
import { getProductsForListing } from "@/lib/catalog";

export async function GET() {
  const user = await getCurrentUser();
  return apiOk({ products: await getProductsForListing(user) });
}
