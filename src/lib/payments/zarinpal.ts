import { eq } from "drizzle-orm";
import { payments } from "@/db/schema";
import { getDb } from "@/lib/db";
import { getSetting, getSettingBool } from "@/lib/settings";
import { type PaymentProvider, registerProvider } from "./provider";

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
    const merchantId =
      (await getSetting("ZARINPAL_MERCHANT_ID")) ?? "00000000-0000-0000-0000-000000000000";
    const isSandbox = await getSettingBool("ZARINPAL_SANDBOX", false);
    const baseUrl = isSandbox
      ? "https://sandbox.zarinpal.com/pg"
      : "https://payment.zarinpal.com/pg";
    const appBaseUrl = (await getSetting("APP_BASE_URL")) ?? "http://localhost:4000";

    // Zarinpal v4 accepts amounts in Toman.
    const amount = Math.round(Number(order.totalAmount));

    const callbackUrl = `${appBaseUrl}/api/payments/zarinpal/callback?orderId=${order.id}`;

    const body = {
      merchant_id: merchantId,
      amount,
      callback_url: callbackUrl,
      description: `Order ${order.orderNumber}`,
    };

    const res = await fetch(`${baseUrl}/v4/payment/request.json`, {
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

    const redirectUrl = `${baseUrl}/StartPay/${authority}`;
    return { redirectUrl };
  },

  async verify(payment, params) {
    const merchantId =
      (await getSetting("ZARINPAL_MERCHANT_ID")) ?? "00000000-0000-0000-0000-000000000000";
    const isSandbox = await getSettingBool("ZARINPAL_SANDBOX", false);
    const baseUrl = isSandbox
      ? "https://sandbox.zarinpal.com/pg"
      : "https://payment.zarinpal.com/pg";

    const { authority, status } = params as { authority: string; status: string };

    // If the user cancelled / gateway returned NOK, no need to call verify.
    if (status !== "OK") {
      return { status: "FAILED" };
    }

    const amount = Math.round(Number(payment.amount));

    const body = {
      merchant_id: merchantId,
      amount,
      authority,
    };

    let json: { data?: { code?: number; ref_id?: number | string }; errors?: unknown };

    try {
      const res = await fetch(`${baseUrl}/v4/payment/verify.json`, {
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

// ─── Refund ─────────────────────────────────────────────────────────────────

export type ZarinpalRefundResult = {
  /**
   * - `refunded`: the gateway accepted the refund request.
   * - `manual`: refunds are not configured (or no reference) → operator must
   *   refund manually; this is a no-op, not an error.
   * - `failed`: the gateway was called but rejected/errored the request.
   */
  status: "refunded" | "manual" | "failed";
  message: string;
};

/**
 * Best-effort Zarinpal refund over the GraphQL refund HTTP API (no SDK).
 *
 * Env-gated: requires `ZARINPAL_ACCESS_TOKEN` (an OAuth/PAT token from the
 * Zarinpal dashboard). When the token or the payment `reference` (the gateway
 * authority) is missing, returns `{ status: "manual" }` so the caller can still
 * mark the order REFUNDED locally and flag a manual gateway refund.
 *
 * NEVER throws — any network/parse error is reported as `failed`.
 *
 * Reference: https://docs.zarinpal.com/paymentGateway/refund.html
 */
export async function refundZarinpalPayment({
  reference,
  amount,
}: {
  reference: string | null | undefined;
  amount: number | string;
}): Promise<ZarinpalRefundResult> {
  const accessToken = await getSetting("ZARINPAL_ACCESS_TOKEN");

  if (!accessToken) {
    return {
      status: "manual",
      message: "ZARINPAL_ACCESS_TOKEN تنظیم نشده؛ استرداد باید دستی انجام شود.",
    };
  }

  if (!reference) {
    return {
      status: "manual",
      message: "مرجع پرداخت زرین‌پال موجود نیست؛ استرداد باید دستی انجام شود.",
    };
  }

  const toman = Math.round(Number(amount));

  if (!Number.isFinite(toman) || toman <= 0) {
    return { status: "failed", message: "مبلغ استرداد نامعتبر است." };
  }

  const isSandbox = await getSettingBool("ZARINPAL_SANDBOX", false);
  const graphqlEndpoint = isSandbox
    ? "https://next.sandbox.zarinpal.com/api/v4/graphql"
    : "https://next.zarinpal.com/api/v4/graphql";

  const query = `mutation { AddRefund(input: { session: "${reference}", amount: ${toman}, description: "admin refund" }) { id status } }`;

  try {
    const res = await fetch(graphqlEndpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ query }),
    });

    const json = (await res.json().catch(() => null)) as {
      data?: { AddRefund?: { id?: string; status?: string } };
      errors?: unknown;
    } | null;

    if (!res.ok || !json) {
      return {
        status: "failed",
        message: `درگاه زرین‌پال استرداد را نپذیرفت (HTTP ${res.status}).`,
      };
    }

    if (json.errors) {
      return {
        status: "failed",
        message: `خطای درگاه زرین‌پال در استرداد: ${JSON.stringify(json.errors)}`,
      };
    }

    const refundId = json.data?.AddRefund?.id;

    if (refundId) {
      return { status: "refunded", message: `استرداد در زرین‌پال ثبت شد (#${refundId}).` };
    }

    return { status: "failed", message: "پاسخ درگاه زرین‌پال نامشخص بود." };
  } catch (error) {
    return {
      status: "failed",
      message: `ارتباط با درگاه زرین‌پال برقرار نشد: ${error instanceof Error ? error.message : "خطای ناشناخته"}`,
    };
  }
}

// Self-register when this module is imported.
registerProvider(zarinpalProvider);

export { zarinpalProvider as default };
