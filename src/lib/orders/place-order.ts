import { and, eq } from "drizzle-orm";
import { cartItems, carts, orderItems, orders, payments, users } from "@/db/schema";
import { getUserTier, variantPrice } from "@/lib/catalog";
import { getDb } from "@/lib/db";
import { getProvider, type PaymentMethod } from "@/lib/payments/provider";
// Self-register the MANUAL provider so it is always available.
import "@/lib/payments/manual";
import { OutOfStockError, releaseExpiredReservations, reserveUnits } from "./inventory";
import { generateOrderNumber } from "./order-number";

// ─── Error ────────────────────────────────────────────────────────────────────

export type OrderErrorCode =
  | "CART_EMPTY"
  | "SHIPPING_REQUIRED"
  | "OUT_OF_STOCK"
  | "PRODUCT_UNAVAILABLE";

export class OrderError extends Error {
  constructor(
    public readonly code: OrderErrorCode,
    message?: string,
  ) {
    super(message ?? code);
    this.name = "OrderError";
  }
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ShippingInput {
  customerName: string;
  addressLine: string;
  city: string;
  province: string;
  postalCode: string;
}

export interface PlaceOrderInput {
  paymentMethod: PaymentMethod;
  shipping?: ShippingInput;
}

export interface PlaceOrderResult {
  orderId: string;
  orderNumber: string;
  payment: {
    method: PaymentMethod;
    redirectUrl?: string;
    instructions?: unknown;
  };
}

interface PlaceOrderOptions {
  /** Inject an existing transaction (for tests that need rollback isolation). */
  tx?: any;
}

// ─── Service ──────────────────────────────────────────────────────────────────

/**
 * Places an order for the given user.
 *
 * Runs everything inside a single DB transaction:
 *  1. Release expired reservations.
 *  2. Load the user's ACTIVE cart + items.
 *  3. Validate each item's product status.
 *  4. Check if shipping is required.
 *  5. Insert the order row.
 *  6. Reserve inventory units per item.
 *  7. Insert order items.
 *  8. Insert payment row.
 *  9. Mark cart ORDERED.
 *
 * After the transaction commits, call provider.initiate() and return.
 */
export async function placeOrder(
  userId: string,
  input: PlaceOrderInput,
  opts: PlaceOrderOptions = {},
): Promise<PlaceOrderResult> {
  const { paymentMethod, shipping } = input;

  let orderId: string;
  let orderNumber: string;
  let paymentRow: typeof payments.$inferSelect;

  const run = async (tx: any) => {
    // 1. Release expired reservations.
    await releaseExpiredReservations(tx);

    // 2. Load user.
    const [user] = await tx
      .select({
        id: users.id,
        phone: users.phone,
        isPremium: users.isPremium,
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!user) {
      throw new OrderError("CART_EMPTY", "کاربر یافت نشد.");
    }

    // 3. Load the user's ACTIVE cart.
    const [cart] = await tx
      .select({ id: carts.id })
      .from(carts)
      .where(and(eq(carts.userId, userId), eq(carts.status, "ACTIVE")))
      .limit(1);

    if (!cart) {
      throw new OrderError("CART_EMPTY", "سبد خرید خالی است.");
    }

    // 4. Load cart items with variant + product.
    const rows = await tx.query.cartItems.findMany({
      where: (item: any, { eq: eqFn }: any) => eqFn(item.cartId, cart.id),
      with: {
        variant: {
          with: {
            product: {
              columns: {
                id: true,
                titleFa: true,
                status: true,
                fulfillmentType: true,
              },
            },
          },
        },
      },
    });

    if (rows.length === 0) {
      throw new OrderError("CART_EMPTY", "سبد خرید خالی است.");
    }

    // 5. Validate items + re-price.
    const tier = getUserTier(user);
    let subtotalToman = 0;

    type PricedRow = {
      variantId: string;
      quantity: number;
      unitPrice: number;
      lineTotal: number;
      titleFa: string;
      sku: string;
      colorNameFa: string;
      materialNameFa: string;
      size: string;
      fulfillmentType: string;
    };

    const pricedRows: PricedRow[] = [];

    for (const row of rows) {
      if (!row.variant) continue;
      const { variant } = row;
      const { product } = variant;

      if (product.status !== "ACTIVE") {
        throw new OrderError("PRODUCT_UNAVAILABLE", "محصول در دسترس نیست.");
      }

      const unitPrice = Math.round(variantPrice(variant, tier));
      const lineTotal = unitPrice * row.quantity;
      subtotalToman += lineTotal;

      pricedRows.push({
        variantId: row.variantId,
        quantity: row.quantity,
        unitPrice,
        lineTotal,
        titleFa: product.titleFa,
        sku: variant.sku,
        colorNameFa: variant.colorNameFa,
        materialNameFa: variant.materialNameFa,
        size: variant.size,
        fulfillmentType: product.fulfillmentType,
      });
    }

    // 6. Shipping check: if any item is PHYSICAL, shipping is required.
    const needsShipping = pricedRows.some((r) => r.fulfillmentType === "PHYSICAL");
    if (needsShipping && !shipping) {
      throw new OrderError("SHIPPING_REQUIRED", "اطلاعات ارسال الزامی است.");
    }

    // 7. Insert order.
    orderNumber = generateOrderNumber();
    const [insertedOrder] = await tx
      .insert(orders)
      .values({
        orderNumber,
        userId,
        status: "PENDING",
        paymentStatus: "UNPAID",
        currency: "IRR",
        subtotalAmount: String(subtotalToman),
        shippingAmount: "0",
        totalAmount: String(subtotalToman),
        customerPhone: user.phone ?? null,
        ...(shipping
          ? {
              customerName: shipping.customerName,
              addressLine: shipping.addressLine,
              city: shipping.city,
              province: shipping.province,
              postalCode: shipping.postalCode,
            }
          : {}),
      })
      .returning({ id: orders.id });

    orderId = insertedOrder.id;

    // 8. Reserve inventory units per item.
    for (const row of pricedRows) {
      try {
        await reserveUnits(tx, row.variantId, row.quantity, { orderId, userId });
      } catch (err) {
        if (err instanceof OutOfStockError) {
          throw new OrderError("OUT_OF_STOCK", "موجودی کافی نیست.");
        }
        throw err;
      }
    }

    // 9. Insert order items.
    await tx.insert(orderItems).values(
      pricedRows.map((row) => ({
        orderId,
        variantId: row.variantId,
        titleFa: row.titleFa,
        sku: row.sku,
        colorNameFa: row.colorNameFa,
        materialNameFa: row.materialNameFa,
        size: row.size,
        quantity: row.quantity,
        unitPrice: String(row.unitPrice),
        totalPrice: String(row.lineTotal),
      })),
    );

    // 10. Insert payment row.
    const [insertedPayment] = await tx
      .insert(payments)
      .values({
        userId,
        orderId,
        status: "UNPAID",
        provider: paymentMethod,
        amount: String(subtotalToman),
        currency: "IRR",
      })
      .returning();

    paymentRow = insertedPayment;

    // 11. Mark cart as ORDERED.
    await tx.update(carts).set({ status: "ORDERED" }).where(eq(carts.id, cart.id));
  };

  if (opts.tx) {
    await run(opts.tx);
  } else {
    const db = getDb();
    await db.transaction(run);
  }

  // After the transaction commits, initiate the payment.
  const provider = getProvider(paymentMethod);
  const orderRow = { id: orderId!, orderNumber: orderNumber! } as typeof orders.$inferSelect;
  const initiateResult = await provider.initiate(orderRow, paymentRow!);

  return {
    orderId: orderId!,
    orderNumber: orderNumber!,
    payment: {
      method: paymentMethod,
      ...initiateResult,
    },
  };
}
