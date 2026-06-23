/**
 * Digital keys/licenses vault — data layer.
 *
 * Consolidates every SOLD inventory unit (a delivered digital code/license)
 * across a user's PAID orders into a flat, UI-ready structure grouped by order
 * (newest first) and, within each order, by product line.
 *
 * Codes are only ever a sellable secret for DIGITAL items. For PHYSICAL (or any
 * non-digital world) a SOLD unit's `code` is just an internal serial, so it must
 * never surface in the vault — we mirror the gating used by the order emails in
 * `src/lib/orders/payments.ts` and key delivery off the order line's
 * `fulfillmentType === "DIGITAL"`.
 */

import { getDb } from "@/lib/db";

export type VaultKey = {
  /** Inventory unit id — stable per delivered code. */
  id: string;
  /** The digital code/license itself (LTR). */
  code: string;
  /** When the unit was sold/assigned, if recorded. */
  soldAt: Date | null;
};

export type VaultProductGroup = {
  /** Variant id the codes belong to. */
  variantId: string;
  /** Product/line title (Persian). */
  titleFa: string;
  /** Variant descriptor, e.g. "منطقه: گلوبال · مدت: ماهانه" (null when not meaningful). */
  variantFa: string | null;
  /** Delivered codes for this product line within the order. */
  keys: VaultKey[];
};

export type VaultOrder = {
  orderId: string;
  orderNumber: string;
  createdAt: Date;
  /** Total delivered codes across all product lines in this order. */
  keyCount: number;
  /** Whether the order still has an email on file to resend codes to. */
  hasEmail: boolean;
  products: VaultProductGroup[];
};

export type KeysVault = {
  orders: VaultOrder[];
  /** Total delivered codes across every order. */
  totalKeys: number;
};

/**
 * Gather the keys vault for a user: every SOLD digital inventory unit across the
 * user's PAID orders, grouped by order (newest first) then by product line.
 */
export async function getKeysVault(userId: string): Promise<KeysVault> {
  const db = getDb();

  const orders = await db.query.orders.findMany({
    where: (o, { and, eq }) => and(eq(o.userId, userId), eq(o.paymentStatus, "PAID")),
    orderBy: (o, { desc }) => [desc(o.createdAt)],
    // Bound the scan — newest 200 PAID orders is far more than any real vault.
    limit: 200,
    columns: {
      id: true,
      orderNumber: true,
      createdAt: true,
      customerEmail: true,
      recipientEmail: true,
    },
    with: {
      items: {
        columns: {
          variantId: true,
          titleFa: true,
          optionsSummaryFa: true,
          fulfillmentType: true,
        },
      },
      inventoryUnits: {
        where: (u, { eq }) => eq(u.status, "SOLD"),
        columns: { id: true, variantId: true, code: true, soldAt: true },
      },
    },
  });

  const vaultOrders: VaultOrder[] = [];
  let totalKeys = 0;

  for (const order of orders) {
    // Only DIGITAL line variants ever expose their unit codes as keys.
    const digitalVariantIds = new Set<string>();
    const lineByVariant = new Map<
      string,
      {
        titleFa: string;
        optionsSummaryFa: string | null;
      }
    >();
    for (const item of order.items) {
      if (item.variantId && item.fulfillmentType === "DIGITAL") {
        digitalVariantIds.add(item.variantId);
        if (!lineByVariant.has(item.variantId)) {
          lineByVariant.set(item.variantId, {
            titleFa: item.titleFa,
            optionsSummaryFa: item.optionsSummaryFa,
          });
        }
      }
    }

    // Group SOLD digital codes by variant, preserving discovery order.
    const keysByVariant = new Map<string, VaultKey[]>();
    for (const unit of order.inventoryUnits) {
      if (!digitalVariantIds.has(unit.variantId)) {
        continue;
      }
      const existing = keysByVariant.get(unit.variantId) ?? [];
      existing.push({ id: unit.id, code: unit.code, soldAt: unit.soldAt });
      keysByVariant.set(unit.variantId, existing);
    }

    const products: VaultProductGroup[] = [];
    let orderKeyCount = 0;
    for (const [variantId, keys] of keysByVariant) {
      const line = lineByVariant.get(variantId);
      products.push({
        variantId,
        titleFa: line?.titleFa ?? "محصول دیجیتال",
        variantFa: line?.optionsSummaryFa ?? null,
        keys,
      });
      orderKeyCount += keys.length;
    }

    // Skip orders that delivered no digital keys (e.g. fully physical orders).
    if (orderKeyCount === 0) {
      continue;
    }

    totalKeys += orderKeyCount;
    vaultOrders.push({
      orderId: order.id,
      orderNumber: order.orderNumber,
      createdAt: order.createdAt,
      keyCount: orderKeyCount,
      hasEmail: Boolean(order.recipientEmail ?? order.customerEmail),
      products,
    });
  }

  return { orders: vaultOrders, totalKeys };
}
