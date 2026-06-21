import { and, eq } from "drizzle-orm";

import { wishlistItems } from "@/db/schema";
import { getUserTier, variantPrice } from "@/lib/catalog";
import { getDb } from "@/lib/db";
import { decimalToNumber } from "@/lib/format";
import { convertToToman, loadExchangeRates } from "@/lib/pricing/exchange";

type UserTier = ReturnType<typeof getUserTier>;

/**
 * A single wishlist entry decorated with the product info the UI needs:
 * title, primary image (tier-aware), the cheapest in-stock variant for
 * add-to-cart, price (resolved for the viewer's tier) and availability.
 */
export type WishlistEntry = {
  id: string;
  productId: string;
  slug: string;
  titleFa: string;
  imageUrl: string | null;
  price: number;
  compareAtAmount: number;
  /** Variant used by the "add to cart" action (default/first variant). */
  addToCartVariantId: string | null;
  availableStock: number;
  /** false when the product is disabled (DRAFT/ARCHIVED) — block add-to-cart. */
  isActive: boolean;
  createdAt: Date;
};

/**
 * Picks the image the viewer is allowed to see. VIP images are premium-only.
 * Falls back to product.primaryImageUrl when there are no image rows.
 */
function pickImageUrl(
  product: {
    primaryImageUrl: string | null;
    images: Array<{ url: string; vipImage: boolean; isPrimary: boolean; sortOrder: number }>;
  },
  tier: UserTier,
): string | null {
  const visible = product.images.filter((image) => tier === "PREMIUM" || !image.vipImage);
  const primary = visible.find((image) => image.isPrimary);
  return primary?.url ?? visible[0]?.url ?? product.primaryImageUrl ?? null;
}

/**
 * Loads the viewer's wishlist, newest first, with everything the page and
 * the wishlist button need. Pricing is resolved for the viewer's tier.
 */
export async function getWishlist(user: {
  id: string;
  isPremium: boolean;
}): Promise<WishlistEntry[]> {
  const db = getDb();
  const tier = getUserTier(user);
  await loadExchangeRates();

  const rows = await db.query.wishlistItems.findMany({
    where: (item, { eq: eqOp }) => eqOp(item.userId, user.id),
    orderBy: (item, { desc: descOp }) => [descOp(item.createdAt)],
    with: {
      product: {
        with: {
          images: {
            orderBy: (image, { asc }) => [asc(image.sortOrder)],
          },
          variants: {
            with: {
              inventoryUnits: {
                where: (unit, { eq: eqOp }) => eqOp(unit.status, "AVAILABLE"),
                columns: { id: true },
              },
            },
            orderBy: (variant, { asc, desc: descOp }) => [
              descOp(variant.isDefault),
              asc(variant.createdAt),
            ],
          },
        },
      },
    },
  });

  return rows.flatMap((row) => {
    const product = row.product;
    if (!product) {
      return [];
    }

    const variantsWithStock = product.variants.map((variant) => ({
      id: variant.id,
      isDefault: variant.isDefault,
      price: variantPrice(variant, tier, product.baseCurrency),
      compareAtAmount: convertToToman(
        decimalToNumber(variant.compareAtAmount),
        product.baseCurrency,
      ),
      availableStock: variant.inventoryUnits.length,
    }));

    const availableStock = variantsWithStock.reduce(
      (sum, variant) => sum + variant.availableStock,
      0,
    );

    // Prefer a variant that is actually in stock for the add-to-cart action,
    // otherwise fall back to the default/first variant so the price still shows.
    const cartVariant =
      variantsWithStock.find((variant) => variant.availableStock > 0) ?? variantsWithStock[0];

    return [
      {
        id: row.id,
        productId: product.id,
        slug: product.slug,
        titleFa: product.titleFa,
        imageUrl: pickImageUrl(product, tier),
        price: cartVariant?.price ?? 0,
        compareAtAmount: cartVariant?.compareAtAmount ?? 0,
        addToCartVariantId: cartVariant?.id ?? null,
        availableStock,
        isActive: product.status === "ACTIVE",
        createdAt: row.createdAt,
      },
    ];
  });
}

/** Returns the set of productIds the user has wishlisted (for toggle state). */
export async function getWishlistProductIds(userId: string): Promise<Set<string>> {
  const db = getDb();
  const rows = await db.query.wishlistItems.findMany({
    where: (item, { eq: eqOp }) => eqOp(item.userId, userId),
    columns: { productId: true },
  });
  return new Set(rows.map((row) => row.productId));
}

/** True when this product is already in the user's wishlist. */
export async function isWishlisted(userId: string, productId: string): Promise<boolean> {
  const db = getDb();
  const existing = await db.query.wishlistItems.findFirst({
    where: (item, { and: andOp, eq: eqOp }) =>
      andOp(eqOp(item.userId, userId), eqOp(item.productId, productId)),
    columns: { id: true },
  });
  return Boolean(existing);
}

/**
 * Idempotently adds a product to the user's wishlist. Relies on the unique
 * (userId, productId) index; conflicts are ignored so repeated calls are safe.
 * Returns false when the productId does not reference a real product.
 */
export async function addToWishlist(userId: string, productId: string): Promise<boolean> {
  const db = getDb();

  const product = await db.query.products.findFirst({
    where: (p, { eq: eqOp }) => eqOp(p.id, productId),
    columns: { id: true },
  });
  if (!product) {
    return false;
  }

  await db
    .insert(wishlistItems)
    .values({ userId, productId })
    .onConflictDoNothing({ target: [wishlistItems.userId, wishlistItems.productId] });

  return true;
}

/** Removes a product from the user's wishlist. No-op when absent. */
export async function removeFromWishlist(userId: string, productId: string): Promise<void> {
  const db = getDb();
  await db
    .delete(wishlistItems)
    .where(and(eq(wishlistItems.userId, userId), eq(wishlistItems.productId, productId)));
}
