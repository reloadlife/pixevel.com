import { and, eq } from "drizzle-orm";
import {
  cartItems,
  carts,
  type FulfillmentType,
  orderItems,
  orders,
  payments,
  users,
} from "@/db/schema";
import { getUserTier, variantPrice } from "@/lib/catalog";
import { notify } from "@/lib/comms/dispatch";
import { decrementCouponUsage, incrementCouponUsage, validateCoupon } from "@/lib/coupons";
import { getDb } from "@/lib/db";
import { formatToman } from "@/lib/format";
import { isPaymentMethod } from "@/lib/payments/methods";
import { getProvider, type PaymentMethod } from "@/lib/payments/provider";
import { isValidIranPhone, normalizeIranPhone } from "@/lib/phone";
import { loadExchangeRates } from "@/lib/pricing/exchange";
// Self-register every payment provider so getProvider() always resolves.
import "@/lib/payments/register";
import { OutOfStockError, releaseExpiredReservations, reserveUnits } from "./inventory";
import { generateOrderNumber } from "./order-number";
import { failPayment } from "./payments";

// ─── Error ────────────────────────────────────────────────────────────────────

export type OrderErrorCode =
  | "CART_EMPTY"
  | "SHIPPING_REQUIRED"
  | "OUT_OF_STOCK"
  | "PRODUCT_UNAVAILABLE"
  | "INVALID_EMAIL"
  | "INVALID_PHONE"
  | "INVALID_PAYMENT_METHOD"
  | "GIFT_CONTACT_REQUIRED"
  | "INVALID_COUPON"
  | "PAYMENT_INIT_FAILED";

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
  /** Recipient's mobile number for SMS code delivery (Iran format). */
  recipientPhone?: string;
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
  // Reject removed/invalid payment methods up front (MANUAL was removed).
  if (!isPaymentMethod(paymentMethod)) {
    throw new OrderError("INVALID_PAYMENT_METHOD", "روش پرداخت انتخاب‌شده معتبر نیست.");
  }

  const customerEmail = input.customerEmail?.trim() || null;
  if (customerEmail && !isValidEmail(customerEmail)) {
    throw new OrderError("INVALID_EMAIL", "ایمیل خریدار معتبر نیست.");
  }

  const isGift = gift?.isGift === true;
  const recipientEmail = isGift ? gift?.recipientEmail?.trim() || null : null;
  if (recipientEmail && !isValidEmail(recipientEmail)) {
    throw new OrderError("INVALID_EMAIL", "ایمیل گیرنده هدیه معتبر نیست.");
  }

  // Recipient phone: normalize to 09xxxxxxxxx and validate (Iran format).
  let recipientPhone: string | null = null;
  if (isGift) {
    const rawPhone = gift?.recipientPhone?.trim();
    if (rawPhone) {
      const normalized = normalizeIranPhone(rawPhone);
      if (!isValidIranPhone(normalized)) {
        throw new OrderError("INVALID_PHONE", "شماره موبایل گیرنده هدیه معتبر نیست.");
      }
      recipientPhone = normalized;
    }
  }

  // A gift must reach the recipient somehow: email or phone (at least one).
  if (isGift && !recipientEmail && !recipientPhone) {
    throw new OrderError(
      "GIFT_CONTACT_REQUIRED",
      "برای ارسال هدیه، ایمیل یا شماره موبایل گیرنده الزامی است.",
    );
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
                baseCurrency: true,
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
      fulfillmentType: FulfillmentType;
      metadata: unknown;
    };

    const pricedRows: PricedRow[] = [];

    // Convert USD/EUR-priced products to live Toman for the charge.
    await loadExchangeRates();

    for (const row of rows) {
      if (!row.variant) continue;
      const { variant } = row;
      const { product } = variant;

      if (product.status !== "ACTIVE") {
        throw new OrderError("PRODUCT_UNAVAILABLE", "محصول در دسترس نیست.");
      }

      const unitPrice = Math.round(variantPrice(variant, tier, product.baseCurrency));
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
        metadata: variant.metadata,
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
        recipientPhone,
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
        fulfillmentType: row.fulfillmentType,
        metadata: row.metadata,
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

  // After the transaction commits, initiate the payment. Reload the full order
  // row so the provider sees real values (totalAmount, customerPhone, …) rather
  // than a stub — passing a partial stub leaves order.totalAmount undefined and
  // every gateway computes NaN for the charge amount. When a tx was injected the
  // row is not yet visible on a fresh connection, so read it back on that tx.
  const provider = getProvider(paymentMethod);
  const reader = opts.tx ?? getDb();
  const orderRow = await reader.query.orders.findFirst({
    where: eq(orders.id, orderId!),
  });
  if (!orderRow) {
    throw new Error("ORDER_NOT_FOUND");
  }

  // The order/payment/reservation are already committed. If gateway initiation
  // fails now, compensate: release the reserved units, fail the payment, cancel
  // the order, and give back the coupon use — otherwise stock and coupon
  // capacity leak into a phantom PENDING order that no callback will ever clean.
  let initiateResult: Awaited<ReturnType<typeof provider.initiate>>;
  try {
    initiateResult = await provider.initiate(orderRow, paymentRow!);
  } catch (error) {
    const txOpt = opts.tx ? { tx: opts.tx } : {};
    try {
      await failPayment(orderId!, txOpt);
      if (appliedCoupon) {
        await decrementCouponUsage(opts.tx ?? getDb(), appliedCoupon);
      }
    } catch (cleanupError) {
      console.error(`[place-order] compensation failed for order ${orderId!}`, cleanupError);
    }
    throw new OrderError(
      "PAYMENT_INIT_FAILED",
      "اتصال به درگاه پرداخت ممکن نشد. دوباره تلاش کنید.",
    );
  }

  // Best-effort "order created" notification — committed (non-composed) path
  // only, after gateway init succeeds. Never throws.
  if (!opts.tx) {
    await notify(
      "ORDER_CREATED",
      { userId, email: customerEmail, phone: orderRow.customerPhone, orderId: orderId! },
      {
        order_number: orderNumber!,
        customer_name: orderRow.customerName ?? "",
        total: formatToman(resolvedTotal),
        status: orderRow.status,
        href: `/account/orders/${orderId!}`,
      },
    );
  }

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
