import { and, count, eq, inArray } from "drizzle-orm";
import type { FulfillmentType, InventoryPolicy } from "@/db/schema";
import { cartItems, carts, inventoryUnits } from "@/db/schema";
import type { CurrentUser } from "@/lib/auth";
import { getUserTier, variantPrice } from "@/lib/catalog";
import { getDb } from "@/lib/db";
import { getVatRatePercent } from "@/lib/orders/tax";
import { computeOrderTaxes } from "@/lib/orders/tax-math";
import { loadExchangeRates } from "@/lib/pricing/exchange";

export const CART_COOKIE = "pixevel_cart";

export type CartIdentity = {
  user: CurrentUser | null;
  anonymousId: string | null;
};

export type CartLine = {
  variantId: string;
  productSlug: string;
  titleFa: string;
  /** Composed variant label from the selected option values, e.g. "گلوبال / ماهانه". */
  variantTitleFa: string;
  imageUrl: string | null;
  unitPrice: number;
  quantity: number;
  availableStock: number;
  lineTotal: number;
  fulfillmentType: FulfillmentType;
  /** When true the line carries no VAT (zero-rated product). */
  taxExempt: boolean;
};

/**
 * Effective add-to-cart capacity for INFINITE-inventory products (subscriptions,
 * services, digital-on-demand). They mint no inventory units, so the real unit
 * count is always 0 — we treat them as practically unlimited instead of out of
 * stock so they remain addable and their quantity is never clamped to 0.
 */
const INFINITE_STOCK = Number.MAX_SAFE_INTEGER;

/** Real available-unit count for TRACKED products; unlimited for INFINITE ones. */
function effectiveStock(realCount: number, policy: InventoryPolicy): number {
  return policy === "INFINITE" ? INFINITE_STOCK : realCount;
}

export type CartView = {
  id: string | null;
  items: CartLine[];
  itemCount: number;
  subtotal: number;
  /** No-coupon VAT amount in Toman (recomputed client-side on coupon change). */
  taxAmount: number;
  /** VAT rate percent used to compute taxAmount (0 = VAT disabled). */
  vatRatePercent: number;
};

const EMPTY_CART: CartView = {
  id: null,
  items: [],
  itemCount: 0,
  subtotal: 0,
  taxAmount: 0,
  vatRatePercent: 0,
};

async function availableStock(variantId: string) {
  return getDb().$count(
    inventoryUnits,
    and(eq(inventoryUnits.variantId, variantId), eq(inventoryUnits.status, "AVAILABLE")),
  );
}

/**
 * Batched available-stock counts for many variants in ONE grouped query — avoids
 * the per-line N+1 in {@link getCartView}. Returns a variantId → count map
 * (missing variants ⇒ 0).
 */
async function availableStockByVariants(variantIds: string[]): Promise<Map<string, number>> {
  if (variantIds.length === 0) {
    return new Map();
  }
  const rows = await getDb()
    .select({ variantId: inventoryUnits.variantId, n: count() })
    .from(inventoryUnits)
    .where(
      and(inArray(inventoryUnits.variantId, variantIds), eq(inventoryUnits.status, "AVAILABLE")),
    )
    .groupBy(inventoryUnits.variantId);
  return new Map(rows.map((r) => [r.variantId, Number(r.n)]));
}

/**
 * Finds the caller's ACTIVE cart. With `create`, makes one when absent.
 * Logged-in users own a cart by userId; anonymous shoppers by cookie id.
 */
async function resolveCart(identity: CartIdentity, create: boolean) {
  const db = getDb();

  if (identity.user) {
    const existing = await db.query.carts.findFirst({
      where: (cart, { and, eq }) =>
        and(eq(cart.userId, identity.user!.id), eq(cart.status, "ACTIVE")),
    });

    if (existing || !create) {
      return existing ?? null;
    }

    const [created] = await db.insert(carts).values({ userId: identity.user.id }).returning();
    return created;
  }

  if (identity.anonymousId) {
    const existing = await db.query.carts.findFirst({
      where: (cart, { and, eq }) =>
        and(eq(cart.anonymousId, identity.anonymousId!), eq(cart.status, "ACTIVE")),
    });

    if (existing || !create) {
      return existing ?? null;
    }

    const [created] = await db
      .insert(carts)
      .values({ anonymousId: identity.anonymousId })
      .returning();
    return created;
  }

  return null;
}

export async function getCartView(identity: CartIdentity): Promise<CartView> {
  const cart = await resolveCart(identity, false);

  if (!cart) {
    return EMPTY_CART;
  }

  const db = getDb();
  const rows = await db.query.cartItems.findMany({
    where: (item, { eq }) => eq(item.cartId, cart.id),
    orderBy: (item, { asc }) => [asc(item.createdAt)],
    with: {
      variant: {
        with: {
          product: {
            columns: {
              slug: true,
              titleFa: true,
              primaryImageUrl: true,
              status: true,
              fulfillmentType: true,
              inventoryPolicy: true,
              taxExempt: true,
            },
          },
        },
      },
    },
  });

  // One grouped stock query for all lines (no per-line N+1).
  const stockMap = await availableStockByVariants(
    rows.filter((row) => row.variant).map((row) => row.variantId),
  );

  const items: CartLine[] = [];

  for (const row of rows) {
    if (!row.variant) {
      continue;
    }

    const stock = effectiveStock(
      stockMap.get(row.variantId) ?? 0,
      row.variant.product.inventoryPolicy,
    );
    const unitPrice = Number(row.unitPrice);

    items.push({
      variantId: row.variantId,
      productSlug: row.variant.product.slug,
      titleFa: row.variant.product.titleFa,
      variantTitleFa: row.variant.titleFa,
      imageUrl: row.variant.product.primaryImageUrl,
      unitPrice,
      quantity: row.quantity,
      availableStock: stock,
      lineTotal: unitPrice * row.quantity,
      fulfillmentType: row.variant.product.fulfillmentType,
      taxExempt: row.variant.product.taxExempt ?? false,
    });
  }

  const subtotal = items.reduce((sum, item) => sum + item.lineTotal, 0);
  const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);

  // Compute no-coupon VAT so the client can show it and recompute on coupon change.
  const vatRatePercent = await getVatRatePercent();
  const { totalTax: taxAmount } = computeOrderTaxes(
    items.map((item) => ({ lineTotal: item.lineTotal, taxExempt: item.taxExempt })),
    vatRatePercent,
    0,
  );

  return { id: cart.id, items, itemCount, subtotal, taxAmount, vatRatePercent };
}

export class CartError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

/**
 * Adds (or increments) a variant in the caller's cart. Validates that the
 * product is ACTIVE and there is available stock; clamps quantity to stock.
 */
export async function addToCart(
  identity: CartIdentity,
  variantId: string,
  quantity = 1,
): Promise<CartView> {
  const db = getDb();
  const qty = Math.max(1, Math.trunc(quantity) || 1);

  const variant = await db.query.productVariants.findFirst({
    where: (item, { eq }) => eq(item.id, variantId),
    with: {
      product: { columns: { status: true, baseCurrency: true, inventoryPolicy: true } },
    },
  });

  if (!variant) {
    throw new CartError("VARIANT_NOT_FOUND", "تنوع انتخاب‌شده پیدا نشد.");
  }

  if (variant.product.status !== "ACTIVE") {
    throw new CartError("PRODUCT_UNAVAILABLE", "این محصول قابل افزودن به سبد نیست.");
  }

  // INFINITE products (subscriptions/services/on-demand) mint no units; never
  // block them on stock. TRACKED products still need a free unit.
  const stock = effectiveStock(await availableStock(variantId), variant.product.inventoryPolicy);

  if (stock < 1) {
    throw new CartError("OUT_OF_STOCK", "موجودی این تنوع تمام شده است.");
  }

  const cart = (await resolveCart(identity, true))!;
  const tier = getUserTier(identity.user);
  // Snapshot the converted Toman price (USD/EUR products use the live rate).
  await loadExchangeRates();
  const unitPrice = variantPrice(variant, tier, variant.product.baseCurrency);

  const existing = await db.query.cartItems.findFirst({
    where: (item, { and, eq }) => and(eq(item.cartId, cart.id), eq(item.variantId, variantId)),
  });

  const nextQuantity = Math.min((existing?.quantity ?? 0) + qty, stock);

  await db
    .insert(cartItems)
    .values({
      cartId: cart.id,
      variantId,
      quantity: nextQuantity,
      unitPrice: String(unitPrice),
    })
    .onConflictDoUpdate({
      target: [cartItems.cartId, cartItems.variantId],
      set: { quantity: nextQuantity, unitPrice: String(unitPrice) },
    });

  return getCartView(identity);
}

export async function setItemQuantity(
  identity: CartIdentity,
  variantId: string,
  quantity: number,
): Promise<CartView> {
  const db = getDb();
  const cart = await resolveCart(identity, false);

  if (!cart) {
    return EMPTY_CART;
  }

  const qty = Math.trunc(quantity);

  if (qty < 1) {
    return removeItem(identity, variantId);
  }

  const variant = await db.query.productVariants.findFirst({
    where: (item, { eq }) => eq(item.id, variantId),
    with: { product: { columns: { inventoryPolicy: true } } },
  });
  const policy = variant?.product.inventoryPolicy ?? "TRACKED";
  const stock = effectiveStock(await availableStock(variantId), policy);
  const clamped = Math.min(qty, Math.max(stock, 1));

  await db
    .update(cartItems)
    .set({ quantity: clamped })
    .where(and(eq(cartItems.cartId, cart.id), eq(cartItems.variantId, variantId)));

  return getCartView(identity);
}

export async function removeItem(identity: CartIdentity, variantId: string): Promise<CartView> {
  const db = getDb();
  const cart = await resolveCart(identity, false);

  if (!cart) {
    return EMPTY_CART;
  }

  await db
    .delete(cartItems)
    .where(and(eq(cartItems.cartId, cart.id), eq(cartItems.variantId, variantId)));

  return getCartView(identity);
}

/**
 * On login, fold an anonymous cart into the user's cart. If the user has no
 * active cart, the anonymous cart is simply re-owned; otherwise its lines are
 * merged (summed, clamped to stock) and the anonymous cart is dropped.
 *
 * Each item is re-priced at the authenticated user's tier so prices reflect
 * the user's entitlement (registered/premium), not the public/anonymous tier
 * that was snapshotted when the anonymous user added the item.
 */
export async function mergeAnonymousCart(userId: string, anonymousId: string) {
  const db = getDb();

  const anonCart = await db.query.carts.findFirst({
    where: (cart, { and, eq }) => and(eq(cart.anonymousId, anonymousId), eq(cart.status, "ACTIVE")),
    with: { items: true },
  });

  if (!anonCart) {
    return;
  }

  // Load the user so we can determine their pricing tier.
  const userRow = await db.query.users.findFirst({
    where: (u, { eq }) => eq(u.id, userId),
    columns: { isPremium: true },
  });
  const tier = getUserTier(userRow ?? null);

  const userCart = await db.query.carts.findFirst({
    where: (cart, { and, eq }) => and(eq(cart.userId, userId), eq(cart.status, "ACTIVE")),
  });

  if (!userCart) {
    // No existing user cart — re-own the anonymous cart, then re-price every
    // line at the authenticated tier.
    await db.update(carts).set({ userId, anonymousId: null }).where(eq(carts.id, anonCart.id));

    // Re-price each item for the newly authenticated tier.
    await loadExchangeRates();
    const variantIds = anonCart.items.map((i) => i.variantId);
    const variants = variantIds.length
      ? await db.query.productVariants.findMany({
          where: (v, { inArray: inArr }) => inArr(v.id, variantIds),
          with: { product: { columns: { baseCurrency: true } } },
        })
      : [];
    const variantMap = new Map(variants.map((v) => [v.id, v]));

    for (const item of anonCart.items) {
      const variant = variantMap.get(item.variantId);
      if (!variant) continue;
      const unitPrice = variantPrice(variant, tier, variant.product.baseCurrency);
      await db
        .update(cartItems)
        .set({ unitPrice: String(unitPrice) })
        .where(eq(cartItems.id, item.id));
    }
    return;
  }

  // User already has an active cart — merge lines into it, re-pricing each
  // at the authenticated tier and using batched stock counts.
  const variantIds = anonCart.items.map((i) => i.variantId);
  const stockMap = await availableStockByVariants(variantIds);

  // Load all variants in one query.
  await loadExchangeRates();
  const variants = variantIds.length
    ? await db.query.productVariants.findMany({
        where: (v, { inArray: inArr }) => inArr(v.id, variantIds),
        with: { product: { columns: { baseCurrency: true, inventoryPolicy: true } } },
      })
    : [];
  const variantMap = new Map(variants.map((v) => [v.id, v]));

  for (const item of anonCart.items) {
    const variant = variantMap.get(item.variantId);
    const policy = variant?.product.inventoryPolicy ?? "TRACKED";
    const stock = effectiveStock(stockMap.get(item.variantId) ?? 0, policy);

    if (stock < 1) {
      continue;
    }

    const unitPrice = variant
      ? variantPrice(variant, tier, variant.product.baseCurrency)
      : Number(item.unitPrice);

    const existing = await db.query.cartItems.findFirst({
      where: (row, { and, eq }) =>
        and(eq(row.cartId, userCart.id), eq(row.variantId, item.variantId)),
    });

    const nextQuantity = Math.min((existing?.quantity ?? 0) + item.quantity, stock);

    await db
      .insert(cartItems)
      .values({
        cartId: userCart.id,
        variantId: item.variantId,
        quantity: nextQuantity,
        unitPrice: String(unitPrice),
      })
      .onConflictDoUpdate({
        target: [cartItems.cartId, cartItems.variantId],
        set: { quantity: nextQuantity, unitPrice: String(unitPrice) },
      });
  }

  await db.delete(carts).where(eq(carts.id, anonCart.id));
}
