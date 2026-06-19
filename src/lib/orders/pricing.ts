import { variantPrice } from "@/lib/catalog";

type UserTier = "PUBLIC" | "REGISTERED" | "PREMIUM";

type PricingVariant = {
  publicPriceAmount: unknown;
  registeredPriceAmount?: unknown;
  premiumPriceAmount?: unknown;
};

export type CartItem<V extends PricingVariant = PricingVariant> = {
  variant: V;
  quantity: number;
};

export type PricedItem<V extends PricingVariant = PricingVariant> = {
  variant: V;
  quantity: number;
  unitPrice: string;
  lineTotal: string;
};

export type PricedCart<V extends PricingVariant = PricingVariant> = {
  items: PricedItem<V>[];
  subtotal: string;
  total: string;
};

/**
 * Re-prices cart items by user tier and sums totals.
 *
 * Prices are returned as integer Toman strings to match `numeric` DB columns.
 * No shipping or discount is applied here — total === subtotal.
 */
export function priceCartForUser<V extends PricingVariant>(
  cartItems: CartItem<V>[],
  tier: UserTier,
): PricedCart<V> {
  let subtotalToman = 0;

  const items: PricedItem<V>[] = cartItems.map((item) => {
    // variantPrice returns a number (from decimalToNumber); treat as integer Toman
    const unitToman = Math.round(variantPrice(item.variant, tier));
    const lineToman = unitToman * item.quantity;
    subtotalToman += lineToman;

    return {
      variant: item.variant,
      quantity: item.quantity,
      unitPrice: String(unitToman),
      lineTotal: String(lineToman),
    };
  });

  return {
    items,
    subtotal: String(subtotalToman),
    total: String(subtotalToman),
  };
}
