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
 * redirect), we skip the transition and reflect the known outcome.
 *
 * On a resolved outcome we redirect to `/payment/result?orderId=…&status=…`
 * (success | failed). The result page links back to the order detail page.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;

  const orderId = searchParams.get("orderId");
  const authority = searchParams.get("Authority") ?? searchParams.get("authority") ?? "";
  const status = searchParams.get("Status") ?? searchParams.get("status") ?? "NOK";

  // Always redirect to a meaningful page.
  const fallbackRedirect = (path: string) =>
    NextResponse.redirect(new URL(path, req.nextUrl.origin));

  // The payment result page presents success/failure/pending state and links
  // back to the order. We funnel every resolved outcome through it.
  const resultPage = (resultStatus: "success" | "failed" | "pending") =>
    fallbackRedirect(`/payment/result?orderId=${orderId}&status=${resultStatus}`);

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

    // Idempotency guard: only process UNPAID / AUTHORIZED payments. If the
    // payment was already resolved (duplicate redirect), reflect its known
    // outcome on the result page rather than re-running the transition.
    if (payment.status !== "UNPAID" && payment.status !== "AUTHORIZED") {
      return resultPage(payment.status === "PAID" ? "success" : "failed");
    }

    const result = await zarinpalProvider.verify(payment, { authority, status });

    if (result.status === "PAID") {
      try {
        await confirmPayment(orderId, { reference: result.reference });
        return resultPage("success");
      } catch (confirmErr) {
        // Funds captured at the gateway but local confirmation failed. Persist a
        // recoverable AUTHORIZED marker (never leave it UNPAID/lost) so a
        // reconcile job/admin can finish fulfillment; show the user "pending".
        console.error(`[zarinpal/callback] CAPTURED-BUT-UNCONFIRMED order ${orderId}`, confirmErr);
        await db
          .update(payments)
          .set({ status: "AUTHORIZED", reference: result.reference ?? null })
          .where(eq(payments.orderId, orderId))
          .catch(() => {});
        return resultPage("pending");
      }
    }

    await failPayment(orderId);
    return resultPage("failed");
  } catch (err) {
    // Log but do not crash — fall back to the order page so the user still
    // reaches something meaningful.
    console.error("[zarinpal/callback] error:", err);
  }

  return fallbackRedirect(orderPage);
}
