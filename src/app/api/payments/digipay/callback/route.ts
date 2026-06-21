import { eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { orders, payments } from "@/db/schema";
import { getDb } from "@/lib/db";
import { confirmPayment, failPayment } from "@/lib/orders/payments";
import { digipayProvider } from "@/lib/payments/digipay";

/**
 * DigiPay callback — `${APP_BASE_URL}/api/payments/digipay/callback?orderId=...`
 *
 * DigiPay redirects the user back after the installment flow completes. The
 * gateway may return parameters via the query string (GET) or a form POST
 * (trackingCode, result, type, providerId). We resolve the order's DIGIPAY
 * payment, run verify, then confirm/fail and funnel the user to
 * `/payment/result?orderId=…&status=success|failed`.
 *
 * Idempotency: only UNPAID / AUTHORIZED payments are processed; an already
 * resolved payment (duplicate redirect) reflects its known outcome.
 */

async function handle(req: NextRequest, params: Record<string, unknown>) {
  const { searchParams, origin } = req.nextUrl;
  const orderId = searchParams.get("orderId") ?? (params.orderId as string | undefined) ?? "";

  const redirect = (path: string) => NextResponse.redirect(new URL(path, origin));
  const resultPage = (status: "success" | "failed" | "pending") =>
    redirect(`/payment/result?orderId=${orderId}&status=${status}`);

  // Validate orderId before it is interpolated into any redirect URL — reject
  // anything that is not a UUID to prevent open-redirect / param injection.
  if (!orderId || !/^[0-9a-f-]{36}$/i.test(orderId)) {
    return redirect("/");
  }

  const orderPage = `/account/orders/${orderId}`;

  try {
    const db = getDb();

    const [order] = await db.select().from(orders).where(eq(orders.id, orderId));
    if (!order) {
      return redirect(orderPage);
    }

    const [payment] = await db
      .select()
      .from(payments)
      .where(eq(payments.orderId, orderId))
      .limit(1);
    if (!payment) {
      return redirect(orderPage);
    }

    // Idempotency guard: reflect the known outcome for already-resolved rows.
    if (payment.status !== "UNPAID" && payment.status !== "AUTHORIZED") {
      return resultPage(payment.status === "PAID" ? "success" : "failed");
    }

    const result = await digipayProvider.verify(payment, params);

    if (result.status === "PAID") {
      try {
        await confirmPayment(orderId, { reference: result.reference });
        return resultPage("success");
      } catch (confirmErr) {
        console.error(`[digipay/callback] CAPTURED-BUT-UNCONFIRMED order ${orderId}`, confirmErr);
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
    console.error("[digipay/callback] error:", err);
  }

  return redirect(orderPage);
}

export async function GET(req: NextRequest) {
  const params: Record<string, unknown> = {};
  req.nextUrl.searchParams.forEach((value, key) => {
    params[key] = value;
  });
  return handle(req, params);
}

export async function POST(req: NextRequest) {
  const params: Record<string, unknown> = {};
  // Collect query params first, then overlay the form/JSON body.
  req.nextUrl.searchParams.forEach((value, key) => {
    params[key] = value;
  });

  try {
    const contentType = req.headers.get("content-type") ?? "";
    if (contentType.includes("application/json")) {
      Object.assign(params, (await req.json().catch(() => ({}))) as Record<string, unknown>);
    } else {
      const form = await req.formData();
      form.forEach((value, key) => {
        params[key] = typeof value === "string" ? value : value.name;
      });
    }
  } catch {
    // Body parsing failures fall through with whatever query params we have.
  }

  return handle(req, params);
}
