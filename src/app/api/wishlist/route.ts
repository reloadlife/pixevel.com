import { addToWishlist, getWishlist, removeFromWishlist } from "@/lib/account/wishlist";
import { apiError, apiOk, readJson } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth";

type WishlistPayload = {
  productId?: string;
};

/** GET /api/wishlist — list the current user's wishlist with product info. */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return apiError("AUTH_REQUIRED", "ابتدا وارد شوید.", 401);
  }

  const items = await getWishlist(user);
  return apiOk({ items, count: items.length });
}

/** POST /api/wishlist { productId } — add a product. Idempotent. */
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return apiError("AUTH_REQUIRED", "ابتدا وارد شوید.", 401);
  }

  const body = await readJson<WishlistPayload>(request);
  const productId = body?.productId?.trim();
  if (!productId) {
    return apiError("INVALID_PRODUCT", "محصول مشخص نشده است.");
  }

  const added = await addToWishlist(user.id, productId);
  if (!added) {
    return apiError("PRODUCT_NOT_FOUND", "محصول یافت نشد.", 404);
  }

  return apiOk({ productId, wishlisted: true });
}

/** DELETE /api/wishlist { productId } — remove a product. No-op when absent. */
export async function DELETE(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return apiError("AUTH_REQUIRED", "ابتدا وارد شوید.", 401);
  }

  const body = await readJson<WishlistPayload>(request);
  const productId = body?.productId?.trim();
  if (!productId) {
    return apiError("INVALID_PRODUCT", "محصول مشخص نشده است.");
  }

  await removeFromWishlist(user.id, productId);
  return apiOk({ productId, wishlisted: false });
}
