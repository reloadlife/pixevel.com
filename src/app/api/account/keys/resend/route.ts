import { apiError, apiOk, readJson } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { resendOrderCodes } from "@/lib/orders/payments";
import { rateLimit } from "@/lib/rate-limit";

type ResendBody = {
  orderId?: string;
};

/**
 * POST /api/account/keys/resend  { orderId }
 *
 * Re-emails (and re-SMSes, best-effort) the digital codes for one of the
 * authenticated user's PAID orders. Ownership is verified here before delegating
 * to `resendOrderCodes`, which validates the PAID state and performs delivery.
 */
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return apiError("AUTH_REQUIRED", "ابتدا وارد شوید.", 401);
  }

  const body = (await readJson<ResendBody>(request)) ?? {};
  const orderId = typeof body.orderId === "string" ? body.orderId.trim() : "";
  if (!orderId) {
    return apiError("INVALID_INPUT", "شناسه سفارش الزامی است.", 400);
  }

  const db = getDb();
  const order = await db.query.orders.findFirst({
    where: (o, { eq }) => eq(o.id, orderId),
    columns: {
      id: true,
      userId: true,
      paymentStatus: true,
      customerEmail: true,
      recipientEmail: true,
    },
  });

  // Do not reveal existence of other users' orders.
  if (!order || order.userId !== user.id) {
    return apiError("NOT_FOUND", "سفارش یافت نشد.", 404);
  }

  if (order.paymentStatus !== "PAID") {
    return apiError("ORDER_NOT_PAID", "این سفارش پرداخت نشده است.", 400);
  }

  // Each resend fires an email + a billed SMS (and may target a gift recipient).
  // Cap to a few per order per 5 minutes to prevent a bombing/cost-abuse loop.
  if (!rateLimit(`keys-resend:${user.id}:${orderId}`, 3, 5 * 60_000).ok) {
    return apiError("RATE_LIMITED", "ارسال بیش از حد. کمی بعد دوباره تلاش کنید.", 429);
  }

  if (!(order.recipientEmail ?? order.customerEmail)) {
    return apiError(
      "NO_EMAIL",
      "ایمیلی برای این سفارش ثبت نشده است. ایمیل خود را در تنظیمات حساب اضافه کنید.",
      400,
    );
  }

  try {
    await resendOrderCodes(orderId);
  } catch {
    // resendOrderCodes throws only on state checks (re-validated above); email
    // delivery itself is best-effort. Never leak internals.
    return apiError("RESEND_FAILED", "ارسال مجدد کدها ممکن نشد.", 500);
  }

  return apiOk({ sent: true });
}
