import { and, eq } from "drizzle-orm";
import { cartItems, carts, orderItems, orders, payments, users } from "@/db/schema";
import { getUserTier, variantPrice } from "@/lib/catalog";
import { incrementCouponUsage, validateCoupon } from "@/lib/coupons";
import { getDb } from "@/lib/db";
import { getProvider, type PaymentMethod } from "@/lib/payments/provider";
// Self-register providers so they are always available.
import "@/lib/payments/manual";
import "@/lib/payments/card-to-card";
import { OutOfStockError, releaseExpiredReservations, reserveUnits } from "./inventory";
import { generateOrderNumber } from "./order-number";

// ─── Error ────────────────────────────────────────────────────────────────────

export type OrderErrorCode =
  | "CART_EMPTY"
  | "SHIPPING_REQUIRED"
  | "OUT_OF_STOCK"
  | "PRODUCT_UNAVAILABLE"
  | "INVALID_EMAIL"
  | "INVALID_COUPON";

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

export interface GiftInput {
  /** When true, codes/receipt are delivered to the recipient. */
  isGift: boolean;
  recipientEmail?: string;
  giftMessage?: string;
}

export interface PlaceOrderInput {
  paymentMethod: PaymentMethod;
  shipping?: ShippingInput;
  /** Buyer's email for the purchase receipt / digital codes. */
  customerEmail?: string;
  gift?: GiftInput;
  /** Optional coupon code; re-validated server-side against the real subtotal. */
  couponCode?: string;
}

// Pragmatic email shape check — server is authoritative, this just rejects
// obviously malformed input before we persist it.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmail(value: string): boolean {
  return EMAIL_RE.test(value.trim());
}

export interface PlaceOrderResult {
  orderId: string;
  orderNumber: string;
  subtotalAmount: number;
  discountAmount: number;
  totalAmount: number;
  couponCode: string | null;
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
  const { paymentMethod, shipping, gift } = input;

  // ── Capture-field normalization + validation (before any DB work). ──────────
  const customerEmail = input.customerEmail?.trim() || null;
  if (customerEmail && !isValidEmail(customerEmail)) {
    throw new OrderError("INVALID_EMAIL", "ایمیل خریدار معتبر نیست.");
  }

  const isGift = gift?.isGift === true;
  const recipientEmail = isGift ? gift?.recipientEmail?.trim() || null : null;
  if (recipientEmail && !isValidEmail(recipientEmail)) {
    throw new OrderError("INVALID_EMAIL", "ایمیل گیرنده هدیه معتبر نیست.");
  }
  const giftMessage = isGift ? gift?.giftMessage?.trim() || null : null;
  const requestedCoupon = input.couponCode?.trim() || null;

  let orderId: string;
  let orderNumber: string;
  let paymentRow: typeof payments.$inferSelect;
  let resolvedSubtotal = 0;
  let resolvedDiscount = 0;
  let resolvedTotal = 0;
  let appliedCoupon: string | null = null;

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

    // 7. Coupon: re-validate server-side against the REAL subtotal. The client
    //    preview is never trusted. Shipping is currently free (0 toman).
    const shippingToman = 0;
    let discountToman = 0;

    if (requestedCoupon) {
      const couponResult = await validateCoupon(requestedCoupon, subtotalToman, tx);
      if (!couponResult.ok) {
        throw new OrderError("INVALID_COUPON", couponResult.message);
      }
      discountToman = couponResult.discountAmount;
      appliedCoupon = couponResult.code;
    }

    const totalToman = Math.max(0, subtotalToman + shippingToman - discountToman);

    resolvedSubtotal = subtotalToman;
    resolvedDiscount = discountToman;
    resolvedTotal = totalToman;

    // 8. Insert order.
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
        shippingAmount: String(shippingToman),
        discountAmount: String(discountToman),
        totalAmount: String(totalToman),
        customerPhone: user.phone ?? null,
        customerEmail,
        recipientEmail,
        giftMessage,
        couponCode: appliedCoupon,
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

    // 9. Bump coupon usage atomically inside this transaction. A re-checked
    //    usageLimit in the UPDATE makes the increment race-safe; if the coupon
    //    was exhausted between validation and now, reject the order.
    if (appliedCoupon) {
      const bumped = await incrementCouponUsage(tx, appliedCoupon);
      if (!bumped) {
        throw new OrderError("INVALID_COUPON", "ظرفیت استفاده از این کد تخفیف به پایان رسیده است.");
      }
    }

    // 10. Reserve inventory units per item.
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

    // 11. Insert order items.
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

    // 12. Insert payment row — charge the discounted total, not the subtotal.
    const [insertedPayment] = await tx
      .insert(payments)
      .values({
        userId,
        orderId,
        status: "UNPAID",
        provider: paymentMethod,
        amount: String(totalToman),
        currency: "IRR",
      })
      .returning();

    paymentRow = insertedPayment;

    // 13. Mark cart as ORDERED.
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
    subtotalAmount: resolvedSubtotal,
    discountAmount: resolvedDiscount,
    totalAmount: resolvedTotal,
    couponCode: appliedCoupon,
    payment: {
      method: paymentMethod,
      ...initiateResult,
    },
  };
}
