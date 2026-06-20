import { apiError, apiOk, readJson } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth";
import { OrderError, placeOrder } from "@/lib/orders/place-order";
import { isPaymentMethod } from "@/lib/payments/methods";
import type { PaymentMethod } from "@/lib/payments/provider";

// ─── POST /api/orders ─────────────────────────────────────────────────────────

interface OrderBody {
  paymentMethod: PaymentMethod;
  shipping?: {
    customerName: string;
    addressLine: string;
    city: string;
    province: string;
    postalCode: string;
  };
  customerEmail?: string;
  gift?: {
    isGift: boolean;
    recipientEmail?: string;
    recipientPhone?: string;
    giftMessage?: string;
  };
  couponCode?: string;
}

export async function POST(request: Request) {
  const user = await getCurrentUser();

  if (!user) {
    return apiError("AUTH_REQUIRED", "برای ثبت سفارش ابتدا وارد شوید.", 401);
  }

  const body = await readJson<OrderBody>(request);

  if (!body || !body.paymentMethod) {
    return apiError("BAD_REQUEST", "اطلاعات درخواست ناقص است.", 400);
  }

  // Reject removed/invalid payment methods before touching the order service.
  if (!isPaymentMethod(body.paymentMethod)) {
    return apiError("INVALID_PAYMENT_METHOD", "روش پرداخت انتخاب‌شده معتبر نیست.", 422);
  }

  try {
    const result = await placeOrder(user.id, {
      paymentMethod: body.paymentMethod,
      shipping: body.shipping,
      customerEmail: body.customerEmail,
      gift: body.gift,
      couponCode: body.couponCode,
    });

    return apiOk(
      {
        orderId: result.orderId,
        orderNumber: result.orderNumber,
        subtotalAmount: result.subtotalAmount,
        discountAmount: result.discountAmount,
        totalAmount: result.totalAmount,
        couponCode: result.couponCode,
        payment: result.payment,
      },
      { status: 201 },
    );
  } catch (err) {
    if (err instanceof OrderError) {
      const clientError = mapOrderError(err);
      return apiError(clientError.code, clientError.message, clientError.status);
    }

    console.error("[POST /api/orders] unexpected error:", err);
    return apiError("INTERNAL_ERROR", "خطای داخلی سرور. لطفاً مجدداً تلاش کنید.", 500);
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function mapOrderError(err: OrderError): { code: string; message: string; status: number } {
  switch (err.code) {
    case "CART_EMPTY":
      return { code: "CART_EMPTY", message: "سبد خرید خالی است.", status: 400 };
    case "SHIPPING_REQUIRED":
      return {
        code: "SHIPPING_REQUIRED",
        message: "اطلاعات ارسال برای محصولات فیزیکی الزامی است.",
        status: 400,
      };
    case "OUT_OF_STOCK":
      return { code: "OUT_OF_STOCK", message: "موجودی کافی نیست.", status: 409 };
    case "PRODUCT_UNAVAILABLE":
      return {
        code: "PRODUCT_UNAVAILABLE",
        message: "یک یا چند محصول در دسترس نیست.",
        status: 409,
      };
    case "INVALID_EMAIL":
      return { code: "INVALID_EMAIL", message: err.message, status: 400 };
    case "INVALID_PHONE":
      return { code: "INVALID_PHONE", message: err.message, status: 400 };
    case "GIFT_CONTACT_REQUIRED":
      return { code: "GIFT_CONTACT_REQUIRED", message: err.message, status: 400 };
    case "INVALID_PAYMENT_METHOD":
      return { code: "INVALID_PAYMENT_METHOD", message: err.message, status: 422 };
    case "INVALID_COUPON":
      return { code: "INVALID_COUPON", message: err.message, status: 422 };
    default:
      return { code: "ORDER_ERROR", message: "خطا در ثبت سفارش.", status: 400 };
  }
}
