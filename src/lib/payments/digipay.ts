import { eq } from "drizzle-orm";
import { payments } from "@/db/schema";
import { getDb } from "@/lib/db";
import { getSetting } from "@/lib/settings";
import { type PaymentProvider, registerProvider } from "./provider";

/**
 * DigiPay installment payment provider (BNPL — «خرید اقساطی دیجی‌پی»).
 *
 * Flow (OAuth2 password grant → ticket → redirect → verify):
 *  1. POST `/oauth/token` with Basic(client_id:client_secret) + grant_type=password
 *     + username/password → access_token (cached in-module).
 *  2. `initiate`: POST `/tickets/business?type=<TYPE>` with amount in RIAL,
 *     providerId (the payment row id), callbackUrl (our callback) → returns
 *     { ticket, redirectUrl }. We redirect the user to redirectUrl and persist
 *     the ticket on the payment row.
 *  3. `verify` (called from the callback): POST `/purchases/verify?type=<TYPE>`
 *     with trackingCode + providerId → result.status === 0 ⇒ PAID, else FAILED.
 *
 * `type` selects the gateway product. 13 = BNPL (خرید اقساطی) per the merchant
 * docs; overridable via DIGIPAY_PAYMENT_TYPE.
 *
 * Amounts: this app stores money as Toman; DigiPay expects RIAL → ×10.
 *
 * Reference (official merchant platform docs):
 *   https://www.mydigipay.com/developers/docs/upg/
 */

// ─── Config ───────────────────────────────────────────────────────────────────

const TOMAN_TO_RIAL = 10;

async function appBaseUrl(): Promise<string> {
  return (await getSetting("APP_BASE_URL")) ?? "http://localhost:4000";
}

// Production base; override for UAT (https://uat.mydigipay.info/digipay/api).
async function baseUrl(): Promise<string> {
  return (
    (await getSetting("DIGIPAY_BASE_URL")) ?? "https://api.mydigipay.com/digipay/api"
  ).replace(/\/+$/, "");
}

// Gateway product type. 13 = BNPL / خرید اقساطی.
async function paymentType(): Promise<string> {
  return (await getSetting("DIGIPAY_PAYMENT_TYPE")) ?? "13";
}

async function readConfig() {
  const clientId = await getSetting("DIGIPAY_CLIENT_ID");
  const clientSecret = await getSetting("DIGIPAY_CLIENT_SECRET");
  const username = await getSetting("DIGIPAY_USERNAME");
  const password = await getSetting("DIGIPAY_PASSWORD");

  if (!clientId || !clientSecret || !username || !password) {
    throw new Error("درگاه پرداخت پیکربندی نشده است.");
  }

  return { clientId, clientSecret, username, password };
}

// ─── OAuth token cache (module scope) ──────────────────────────────────────────

type CachedToken = { token: string; expiresAt: number };
let cachedToken: CachedToken | null = null;

async function getAccessToken(): Promise<string> {
  const now = Date.now();
  if (cachedToken && cachedToken.expiresAt > now) {
    return cachedToken.token;
  }

  const { clientId, clientSecret, username, password } = await readConfig();
  const basic = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");

  const form = new URLSearchParams({
    grant_type: "password",
    username,
    password,
  });

  let json: { access_token?: string; expires_in?: number };

  try {
    const res = await fetch(`${await baseUrl()}/oauth/token`, {
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
    throw new Error("ارتباط با درگاه دیجی‌پی برقرار نشد.");
  }

  const ttlMs = (json.expires_in ?? 600) * 1000;
  cachedToken = { token: json.access_token, expiresAt: now + ttlMs - 60_000 };
  return cachedToken.token;
}

// ─── Provider ─────────────────────────────────────────────────────────────────

type DigiResult = { status?: number; level?: string; message?: string };

export const digipayProvider: PaymentProvider = {
  method: "DIGIPAY",

  async initiate(order, payment) {
    // Throws the Persian config error if credentials are missing.
    const token = await getAccessToken();

    const amountRial = Math.round(Number(order.totalAmount)) * TOMAN_TO_RIAL;
    // providerId is our merchant-side unique reference; the payment row id is
    // stable and lets the callback resolve the payment deterministically.
    const providerId = payment.id;
    const callbackUrl = `${await appBaseUrl()}/api/payments/digipay/callback?orderId=${order.id}`;

    const requestBody = {
      amount: amountRial,
      providerId,
      callbackUrl,
    };

    type DigiTicketResponse = {
      result?: DigiResult;
      ticket?: string;
      redirectUrl?: string;
    };
    let json: DigiTicketResponse | null = null;

    try {
      const res = await fetch(`${await baseUrl()}/tickets/business?type=${await paymentType()}`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(requestBody),
      });

      json = (await res.json().catch(() => null)) as DigiTicketResponse | null;
    } catch {
      throw new Error("ارتباط با درگاه دیجی‌پی برقرار نشد.");
    }

    const redirectUrl = json?.redirectUrl;
    const ticket = json?.ticket;
    // DigiPay signals success with result.status === 0.
    const ok = json?.result?.status === 0;

    if (!ok || !redirectUrl) {
      throw new Error("ایجاد تراکنش دیجی‌پی ناموفق بود.");
    }

    // Persist the ticket so the callback can correlate if needed.
    if (ticket) {
      const db = getDb();
      await db.update(payments).set({ reference: ticket }).where(eq(payments.id, payment.id));
    }

    return { redirectUrl };
  },

  async verify(payment, params) {
    // DigiPay redirects back (GET/POST) with trackingCode + result/type. The
    // providerId we sent at initiate is the payment row id.
    const trackingCode =
      (typeof params.trackingCode === "string" && params.trackingCode) ||
      (typeof params.trackingcode === "string" && params.trackingcode) ||
      "";

    // A failed/cancelled redirect (result != 0) short-circuits the API call.
    const redirectResult = params.result;
    if (redirectResult !== undefined && redirectResult !== null && String(redirectResult) !== "0") {
      return { status: "FAILED" };
    }

    if (!trackingCode) {
      return { status: "FAILED" };
    }

    const providerId = payment.id;

    try {
      const token = await getAccessToken();

      const res = await fetch(`${await baseUrl()}/purchases/verify?type=${await paymentType()}`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({ trackingCode, providerId }),
      });

      const json = (await res.json().catch(() => null)) as {
        result?: DigiResult;
        trackingCode?: string;
        paymentGateway?: string;
      } | null;

      // result.status === 0 ⇒ verified/paid.
      if (!res.ok || json?.result?.status !== 0) {
        return { status: "FAILED" };
      }

      // Bind the verify result to the trackingCode we sent: if the gateway
      // echoes a trackingCode it must match, otherwise this response belongs to
      // a different purchase (the request was bound to our server payment.id via
      // providerId, but cross-check the echo as defense in depth).
      if (typeof json?.trackingCode === "string" && json.trackingCode !== trackingCode) {
        console.error(
          `[digipay] trackingCode mismatch: expected=${trackingCode} got=${json.trackingCode}`,
        );
        return { status: "FAILED" };
      }

      return { status: "PAID", reference: json.trackingCode ?? trackingCode };
    } catch {
      return { status: "FAILED" };
    }
  },
};

// Self-register when this module is imported.
registerProvider(digipayProvider);

export { digipayProvider as default };
