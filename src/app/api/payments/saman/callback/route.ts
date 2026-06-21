import { eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { orders, payments } from "@/db/schema";
import { getDb } from "@/lib/db";
import { confirmPayment, failPayment } from "@/lib/orders/payments";
import { samanProvider } from "@/lib/payments/saman";

/**
 * Saman / SEP callback.
 *
 * SEP redirects the user's browser back here with an
 * application/x-www-form-urlencoded POST body containing:
 *   State, Status, RefNum, ResNum, TraceNo, TerminalId, …
 *
 * We load the order's payment, run the provider's verify (which calls the SEP
 * VerifyTransaction endpoint when State is OK), then confirm or fail the payment
 * and redirect to `/payment/result?orderId=…&status=success|failed`.
 *
 * Idempotency: only UNPAID / AUTHORIZED payments are transitioned; a duplicate
 * callback for an already-resolved payment just reflects the known outcome.
 *
 * GET is accepted as a best-effort fallback and reuses the same logic.
 */
async function handle(req: NextRequest, read: (key: string) => string): Promise<NextResponse> {
  const orderId = req.nextUrl.searchParams.get("orderId");

  const redirect = (path: string) => NextResponse.redirect(new URL(path, req.nextUrl.origin), 303);

  // Validate orderId before it is interpolated into any redirect URL — reject
  // anything that is not a UUID to prevent open-redirect / param injection.
  if (!orderId || !/^[0-9a-f-]{36}$/i.test(orderId)) {
    return redirect("/");
  }

  const resultPage = (status: "success" | "failed" | "pending") =>
    redirect(`/payment/result?orderId=${orderId}&status=${status}`);
  const orderPage = `/account/orders/${orderId}`;

  const params: Record<string, unknown> = {
    State: read("State"),
    Status: read("Status"),
    RefNum: read("RefNum"),
    ResNum: read("ResNum"),
  };

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

    // Idempotency guard.
    if (payment.status !== "UNPAID" && payment.status !== "AUTHORIZED") {
      return resultPage(payment.status === "PAID" ? "success" : "failed");
    }

    const result = await samanProvider.verify(payment, params);

    if (result.status === "PAID") {
      try {
        await confirmPayment(orderId, { reference: result.reference });
        return resultPage("success");
      } catch (confirmErr) {
        console.error(`[saman/callback] CAPTURED-BUT-UNCONFIRMED order ${orderId}`, confirmErr);
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
    console.error("[saman/callback] error:", err);
  }

  return redirect(orderPage);
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    // Body unreadable — fall back to query-string params.
    return handle(req, (key) => req.nextUrl.searchParams.get(key) ?? "");
  }
  return handle(req, (key) => String(form.get(key) ?? ""));
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  return handle(req, (key) => req.nextUrl.searchParams.get(key) ?? "");
}
