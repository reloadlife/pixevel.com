import { eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { orders, payments } from "@/db/schema";
import { getDb } from "@/lib/db";
import { confirmPayment, failPayment } from "@/lib/orders/payments";
import { behpardakhtProvider } from "@/lib/payments/behpardakht";

/**
 * Behpardakht / Mellat callback.
 *
 * The gateway redirects the user's browser back here with an
 * application/x-www-form-urlencoded POST body containing:
 *   RefId, ResCode, SaleOrderId, SaleReferenceId, CardHolderInfo, …
 *
 * We load the order's payment, run the provider's verify (which calls
 * bpVerifyRequest + bpSettleRequest on ResCode "0"), then confirm or fail the
 * payment and redirect to `/payment/result?orderId=…&status=success|failed`.
 *
 * Idempotency: only UNPAID / AUTHORIZED payments are transitioned; a duplicate
 * callback for an already-resolved payment just reflects the known outcome.
 *
 * GET is accepted as a best-effort fallback (manual retries / misconfigured
 * terminals) and reuses the same logic with query-string params.
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
    RefId: read("RefId"),
    ResCode: read("ResCode"),
    SaleOrderId: read("SaleOrderId"),
    SaleReferenceId: read("SaleReferenceId"),
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

    const result = await behpardakhtProvider.verify(payment, params);

    if (result.status === "PAID") {
      try {
        await confirmPayment(orderId, { reference: result.reference });
        return resultPage("success");
      } catch (confirmErr) {
        console.error(
          `[behpardakht/callback] CAPTURED-BUT-UNCONFIRMED order ${orderId}`,
          confirmErr,
        );
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
    console.error("[behpardakht/callback] error:", err);
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
