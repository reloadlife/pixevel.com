import { eq } from "drizzle-orm";
import { payments } from "@/db/schema";
import { getDb } from "@/lib/db";
import { getSetting } from "@/lib/settings";
import { type PaymentProvider, registerProvider } from "./provider";

/**
 * SnappPay installment payment provider (BNPL — «خرید اقساطی»).
 *
 * Flow (OAuth2 password grant → token → redirect → verify → settle):
 *  1. POST `oauth/token` with Basic(client_id:client_secret) + grant_type=password
 *     + username/password (+ scope=online-merchant) → access_token (cached).
 *  2. `initiate`: POST `payment/v1/token` with the amount in RIAL, a unique
 *     transactionId (the payment row id), returnURL (our callback) and a
 *     cartList → returns { paymentToken, paymentPageUrl }. We redirect the user
 *     to paymentPageUrl and persist the paymentToken on the payment row.
 *  3. `verify` (called from the callback): POST `payment/v1/verify` then, on
 *     success, POST `payment/v1/settle` to capture the funds → PAID/FAILED.
 *
 * Amounts: this app stores money as Toman; SnappPay expects RIAL → ×10.
 *
 * Reference (endpoints / wrapper shape confirmed against the official merchant
 * docs + community SDKs):
 *   https://documenter.getpostman.com/view/2724645/2s93mAVLRi
 *   https://github.com/backendprogramer/laravel-snapp-pay
 */

// ─── Config ───────────────────────────────────────────────────────────────────

const TOMAN_TO_RIAL = 10;

async function appBaseUrl(): Promise<string> {
  return (await getSetting("APP_BASE_URL")) ?? "http://localhost:4000";
}

// Production base. SnappPay does not expose a public sandbox host; an override
// is supported for staging/UAT without leaking it into the disabled-method gate.
async function baseUrl(): Promise<string> {
  return ((await getSetting("SNAPPPAY_BASE_URL")) ?? "https://api.snapppay.ir").replace(/\/+$/, "");
}

async function readConfig() {
  const clientId = await getSetting("SNAPPPAY_CLIENT_ID");
  const clientSecret = await getSetting("SNAPPPAY_CLIENT_SECRET");
  const username = await getSetting("SNAPPPAY_USERNAME");
  const password = await getSetting("SNAPPPAY_PASSWORD");

  if (!clientId || !clientSecret || !username || !password) {
    throw new Error("درگاه پرداخت پیکربندی نشده است.");
  }

  return { clientId, clientSecret, username, password };
}

// ─── OAuth token cache (module scope) ──────────────────────────────────────────

type CachedToken = { token: string; expiresAt: number };
let cachedToken: CachedToken | null = null;

/**
 * Fetch (and cache) an OAuth2 access token via the password grant.
 * The token is refreshed ~60s before its real expiry to avoid edge races.
 */
async function getAccessToken(): Promise<string> {
  const now = Date.now();
  if (cachedToken && cachedToken.expiresAt > now) {
    return cachedToken.token;
  }

  const { clientId, clientSecret, username, password } = await readConfig();
  const basic = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");

  const form = new URLSearchParams({
    grant_type: "password",
    scope: "online-merchant",
    username,
    password,
  });

  let json: { access_token?: string; expires_in?: number };

  try {
    const res = await fetch(`${await baseUrl()}/api/online/v1/oauth/token`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${basic}`,
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body: form.toString(),
    });

    json = (await res.json().catch(() => ({}))) as typeof json;

    if (!res.ok || !json?.access_token) {
      throw new Error("auth-failed");
    }
  } catch {
    throw new Error("ارتباط با درگاه اسنپ‌پی برقرار نشد.");
  }

  // expires_in is in seconds; default to 10 minutes if absent.
  const ttlMs = (json.expires_in ?? 600) * 1000;
  cachedToken = { token: json.access_token, expiresAt: now + ttlMs - 60_000 };
  return cachedToken.token;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

type SnappEnvelope<T> = {
  successful?: boolean;
  response?: T;
  errorData?: unknown;
};

async function snappFetch<T>(
  path: string,
  body: unknown,
  token: string,
): Promise<SnappEnvelope<T> | null> {
  const res = await fetch(`${await baseUrl()}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(body),
  });

  return (await res.json().catch(() => null)) as SnappEnvelope<T> | null;
}

// ─── Provider ─────────────────────────────────────────────────────────────────

export const snapppayProvider: PaymentProvider = {
  method: "SNAPPPAY",

  async initiate(order, payment) {
    // Throws the Persian config error if credentials are missing.
    const token = await getAccessToken();

    const amountRial = Math.round(Number(order.totalAmount)) * TOMAN_TO_RIAL;
    // We key the gateway transaction on the payment row id so the callback can
    // resolve the correct payment deterministically.
    const transactionId = payment.id;
    const returnURL = `${await appBaseUrl()}/api/payments/snapppay/callback?orderId=${order.id}`;

    // SnappPay requires a cartList. With no per-line breakdown surfaced here we
    // send a single cart holding the whole order; amounts are in RIAL.
    const cartList = [
      {
        cartId: 1,
        totalAmount: amountRial,
        shippingAmount: 0,
        taxAmount: 0,
        isShipmentIncluded: false,
        isTaxIncluded: false,
        items: [
          {
            id: order.id,
            amount: amountRial,
            count: 1,
            category: "DIGITAL_GOODS",
            commissionType: 100,
            name: `Order ${order.orderNumber}`,
          },
        ],
      },
    ];

    const requestBody = {
      amount: amountRial,
      discountAmount: 0,
      externalSourceAmount: 0,
      paymentMethodTypeDto: "INSTALLMENT",
      transactionId,
      returnURL,
      cartList,
    };

    let envelope: SnappEnvelope<{ paymentToken?: string; paymentPageUrl?: string }> | null;

    try {
      envelope = await snappFetch("/api/online/payment/v1/token", requestBody, token);
    } catch {
      throw new Error("ارتباط با درگاه اسنپ‌پی برقرار نشد.");
    }

    const paymentToken = envelope?.response?.paymentToken;
    const paymentPageUrl = envelope?.response?.paymentPageUrl;

    if (!envelope?.successful || !paymentToken || !paymentPageUrl) {
      throw new Error("ایجاد تراکنش اسنپ‌پی ناموفق بود.");
    }

    // Persist the gateway paymentToken so verify/settle can reference it.
    const db = getDb();
    await db.update(payments).set({ reference: paymentToken }).where(eq(payments.id, payment.id));

    return { redirectUrl: paymentPageUrl };
  },

  async verify(payment, params) {
    // SnappPay redirects back with the payment status + transactionId; the
    // paymentToken we need for verify/settle was persisted on the payment row.
    const state =
      typeof params.state === "string"
        ? params.state
        : typeof params.status === "string"
          ? params.status
          : "";

    // A user-cancelled / failed redirect short-circuits without an API call.
    if (state && state.toUpperCase() !== "OK" && state.toUpperCase() !== "SUCCESS") {
      return { status: "FAILED" };
    }

    // Use ONLY the server-stored token persisted at initiate — never the
    // callback's paymentToken, which an attacker could swap for another order's.
    const paymentToken = payment.reference;

    if (!paymentToken) {
      return { status: "FAILED" };
    }

    try {
      const token = await getAccessToken();

      // 1. Verify the transaction.
      const verifyEnv = await snappFetch<{ transactionId?: string; status?: string }>(
        "/api/online/payment/v1/verify",
        { paymentToken },
        token,
      );

      if (!verifyEnv?.successful) {
        return { status: "FAILED" };
      }

      // 2. Settle (capture) the verified transaction.
      const settleEnv = await snappFetch<{ transactionId?: string }>(
        "/api/online/payment/v1/settle",
        { paymentToken },
        token,
      );

      if (!settleEnv?.successful) {
        return { status: "FAILED" };
      }

      const reference =
        settleEnv.response?.transactionId ?? verifyEnv.response?.transactionId ?? paymentToken;

      return { status: "PAID", reference };
    } catch {
      return { status: "FAILED" };
    }
  },
};

// Self-register when this module is imported.
registerProvider(snapppayProvider);

export { snapppayProvider as default };
