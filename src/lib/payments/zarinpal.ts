import { eq } from "drizzle-orm";
import { payments } from "@/db/schema";
import { getDb } from "@/lib/db";
import { type PaymentProvider, registerProvider } from "./provider";

// ─── Config ───────────────────────────────────────────────────────────────────

const MERCHANT_ID = process.env.ZARINPAL_MERCHANT_ID ?? "00000000-0000-0000-0000-000000000000";

const isSandbox = process.env.ZARINPAL_SANDBOX !== "false";

const BASE_URL = isSandbox ? "https://sandbox.zarinpal.com/pg" : "https://payment.zarinpal.com/pg";

const APP_BASE_URL = process.env.APP_BASE_URL ?? "http://localhost:4000";

// ─── Provider ─────────────────────────────────────────────────────────────────

/**
 * Zarinpal payment provider (v4 JSON API).
 *
 * Sandbox by default (ZARINPAL_SANDBOX=false to switch to production).
 * Amount stored in the DB is in Toman; Zarinpal v4 expects Toman directly
 * (the IRR×10 rule applied to older v3 only). We pass the stored amount as-is.
 *
 * Reference: https://docs.zarinpal.com/paymentGateway/
 */
export const zarinpalProvider: PaymentProvider = {
  method: "ZARINPAL",

  async initiate(order, payment) {
    // Zarinpal v4 accepts amounts in Toman.
    const amount = Math.round(Number(order.totalAmount));

    const callbackUrl = `${APP_BASE_URL}/api/payments/zarinpal/callback?orderId=${order.id}`;

    const body = {
      merchant_id: MERCHANT_ID,
      amount,
      callback_url: callbackUrl,
      description: `Order ${order.orderNumber}`,
    };

    const res = await fetch(`${BASE_URL}/v4/payment/request.json`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(body),
    });

    const json = (await res.json()) as {
      data?: { code?: number; authority?: string };
      errors?: unknown;
    };

    const authority = json?.data?.authority;
    const code = json?.data?.code;

    if (!res.ok || code !== 100 || !authority) {
      throw new Error(
        `Zarinpal initiate failed: code=${code ?? "?"} errors=${JSON.stringify(json?.errors ?? {})}`,
      );
    }

    // Store the authority in the payment reference field.
    const db = getDb();
    await db.update(payments).set({ reference: authority }).where(eq(payments.id, payment.id));

    const redirectUrl = `${BASE_URL}/StartPay/${authority}`;
    return { redirectUrl };
  },

  async verify(payment, params) {
    const { authority, status } = params as { authority: string; status: string };

    // If the user cancelled / gateway returned NOK, no need to call verify.
    if (status !== "OK") {
      return { status: "FAILED" };
    }

    const amount = Math.round(Number(payment.amount));

    const body = {
      merchant_id: MERCHANT_ID,
      amount,
      authority,
    };

    let json: { data?: { code?: number; ref_id?: number | string }; errors?: unknown };

    try {
      const res = await fetch(`${BASE_URL}/v4/payment/verify.json`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(body),
      });

      json = (await res.json()) as typeof json;

      if (!res.ok) {
        return { status: "FAILED" };
      }
    } catch {
      return { status: "FAILED" };
    }

    const code = json?.data?.code;

    // 100 = success, 101 = already verified (idempotent)
    if (code === 100 || code === 101) {
      const refId = String(json.data?.ref_id ?? "");
      return { status: "PAID", reference: refId };
    }

    return { status: "FAILED" };
  },
};

// Self-register when this module is imported.
registerProvider(zarinpalProvider);

export { zarinpalProvider as default };
