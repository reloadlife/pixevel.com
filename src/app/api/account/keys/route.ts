import { getKeysVault } from "@/lib/account/keys";
import { apiError, apiOk } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth";

/**
 * GET /api/account/keys
 *
 * Returns the authenticated user's digital keys/licenses grouped by order
 * (newest first) then by product line. Mirrors the data the `/account/keys`
 * vault page renders, in a stable shape for the web frontend and a future
 * Android client.
 */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return apiError("AUTH_REQUIRED", "ابتدا وارد شوید.", 401);
  }

  const vault = await getKeysVault(user.id);

  return apiOk({
    totalKeys: vault.totalKeys,
    orders: vault.orders.map((order) => ({
      orderId: order.orderId,
      orderNumber: order.orderNumber,
      createdAt: order.createdAt.toISOString(),
      keyCount: order.keyCount,
      hasEmail: order.hasEmail,
      products: order.products.map((product) => ({
        variantId: product.variantId,
        titleFa: product.titleFa,
        variantFa: product.variantFa,
        keys: product.keys.map((key) => ({
          id: key.id,
          code: key.code,
          soldAt: key.soldAt ? key.soldAt.toISOString() : null,
        })),
      })),
    })),
  });
}
