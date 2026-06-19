import { eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { orders, payments } from "@/db/schema";
import { getDb } from "@/lib/db";
import { confirmPayment, failPayment } from "@/lib/orders/payments";
import { zarinpalProvider } from "@/lib/payments/zarinpal";

/**
 * GET /api/payments/zarinpal/callback
 *
 * Zarinpal redirects here after the user completes (or cancels) payment.
 * Query params: Authority=<token>, Status=OK|NOK, orderId=<uuid>
 *
 * Idempotency: we only act on a payment whose status is still UNPAID or
 * AUTHORIZED. If the payment was already PAID or FAILED (e.g. a duplicate
 * redirect), we skip the transition and redirect the browser normally.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;

  const orderId = searchParams.get("orderId");
  const authority = searchParams.get("Authority") ?? searchParams.get("authority") ?? "";
  const status = searchParams.get("Status") ?? searchParams.get("status") ?? "NOK";

  // Always redirect to the order page so the user ends up somewhere meaningful.
  const fallbackRedirect = (path: string) =>
    NextResponse.redirect(new URL(path, req.nextUrl.origin));

  if (!orderId) {
    return fallbackRedirect("/");
  }

  const orderPage = `/account/orders/${orderId}`;

  try {
    const db = getDb();

    // Load the order and its most recent ZARINPAL payment row.
    const [order] = await db.select().from(orders).where(eq(orders.id, orderId));

    if (!order) {
      return fallbackRedirect(orderPage);
    }

    const [payment] = await db
      .select()
      .from(payments)
      .where(eq(payments.orderId, orderId))
      .limit(1);

    if (!payment) {
      return fallbackRedirect(orderPage);
    }

    // Idempotency guard: only process UNPAID / AUTHORIZED payments.
    if (payment.status !== "UNPAID" && payment.status !== "AUTHORIZED") {
      return fallbackRedirect(orderPage);
    }

    const result = await zarinpalProvider.verify(payment, { authority, status });

    if (result.status === "PAID") {
      await confirmPayment(orderId, { reference: result.reference });
    } else {
      await failPayment(orderId);
    }
  } catch (err) {
    // Log but do not crash — always redirect so the user reaches the order page.
    console.error("[zarinpal/callback] error:", err);
  }

  return fallbackRedirect(orderPage);
}
