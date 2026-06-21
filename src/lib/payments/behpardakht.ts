import { eq } from "drizzle-orm";
import { payments } from "@/db/schema";
import { getDb } from "@/lib/db";
import { type PaymentProvider, registerProvider } from "./provider";

// ─── Config ───────────────────────────────────────────────────────────────────

const TERMINAL_ID = process.env.BEHPARDAKHT_TERMINAL_ID ?? "";
const USERNAME = process.env.BEHPARDAKHT_USERNAME ?? "";
const PASSWORD = process.env.BEHPARDAKHT_PASSWORD ?? "";

const APP_BASE_URL = process.env.APP_BASE_URL ?? "http://localhost:4000";

// Operational SOAP endpoint (Shaparak). The WSDL lives at `${SERVICE_URL}?wsdl`.
const SERVICE_URL = "https://bpm.shaparak.ir/pgwchannel/services/pgw";
// The bank's hosted payment page. On success we POST `RefId` here (see the
// callback route, which renders a self-submitting form), but we also expose a
// GET fallback redirect URL with the RefId in the query string.
const STARTPAY_URL = "https://bpm.shaparak.ir/pgwchannel/startpay.mellat";

const SOAP_NS = "http://interfaces.core.sw.bps.com/";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isConfigured(): boolean {
  return Boolean(TERMINAL_ID && USERNAME && PASSWORD);
}

function configError(): never {
  throw new Error("درگاه پرداخت پیکربندی نشده است.");
}

/**
 * Behpardakht orderId must be a unique numeric reference per pay request. We
 * derive a stable-ish numeric id from the payment's row id by hashing its
 * characters — collisions across the int range are negligible for our volume,
 * and the same payment always maps to the same orderId (required so verify /
 * settle reference the correct sale). Falls back to a timestamp if needed.
 */
function numericOrderId(payment: { id: string }): number {
  let hash = 0;
  for (const ch of payment.id) {
    hash = (hash * 31 + ch.charCodeAt(0)) % 1_000_000_000;
  }
  // Keep it strictly positive and within a safe SOAP `long` range.
  return hash === 0 ? Date.now() % 1_000_000_000 : hash;
}

/** Jalali-agnostic local date `YYYYMMDD` (Gregorian, as the gateway expects). */
function localDate(d = new Date()): string {
  const y = d.getFullYear().toString().padStart(4, "0");
  const m = (d.getMonth() + 1).toString().padStart(2, "0");
  const day = d.getDate().toString().padStart(2, "0");
  return `${y}${m}${day}`;
}

/** Local time `HHMMSS`. */
function localTime(d = new Date()): string {
  const h = d.getHours().toString().padStart(2, "0");
  const m = d.getMinutes().toString().padStart(2, "0");
  const s = d.getSeconds().toString().padStart(2, "0");
  return `${h}${m}${s}`;
}

const XML_ESCAPES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&apos;",
};

/**
 * Escape XML special chars for SOAP request bodies. Every value we send is
 * server-controlled (terminal credentials, numeric amounts/order ids, our own
 * callback URL) — never user free-text — so this exists purely as defense in
 * depth against an unexpected char breaking the envelope, not as untrusted-HTML
 * sanitization.
 */
function escapeXml(value: string | number): string {
  return String(value).replace(/[&<>"']/g, (ch) => XML_ESCAPES[ch] ?? ch);
}

function soapEnvelope(method: string, params: Array<[string, string | number]>): string {
  const body = params.map(([name, value]) => `<${name}>${escapeXml(value)}</${name}>`).join("");
  return (
    `<?xml version="1.0" encoding="UTF-8"?>` +
    `<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:int="${SOAP_NS}">` +
    `<soapenv:Header/>` +
    `<soapenv:Body>` +
    `<int:${method}>${body}</int:${method}>` +
    `</soapenv:Body>` +
    `</soapenv:Envelope>`
  );
}

/**
 * Call a SOAP method and return the inner `<return>` text. The Behpardakht
 * services wrap every result in `<ns:methodResponse><return>…</return>`. We
 * parse the `<return>` payload with a regex (no XML lib / no SDK by house rule).
 * Throws on transport / SOAP fault so callers can wrap with a Persian message.
 */
async function callSoap(method: string, params: Array<[string, string | number]>): Promise<string> {
  const envelope = soapEnvelope(method, params);

  const res = await fetch(SERVICE_URL, {
    method: "POST",
    headers: {
      "Content-Type": "text/xml; charset=utf-8",
      // Behpardakht accepts an empty SOAPAction; keep the header present.
      SOAPAction: "",
    },
    body: envelope,
  });

  const text = await res.text();

  if (!res.ok) {
    throw new Error(`Behpardakht SOAP HTTP ${res.status}`);
  }

  const fault = /<faultstring>([\s\S]*?)<\/faultstring>/i.exec(text);
  if (fault) {
    throw new Error(`Behpardakht SOAP fault: ${fault[1]}`);
  }

  const match = /<return[^>]*>([\s\S]*?)<\/return>/i.exec(text);
  if (!match) {
    throw new Error("Behpardakht SOAP: missing <return> in response");
  }

  return match[1].trim();
}

// ─── Provider ─────────────────────────────────────────────────────────────────

/**
 * Behpardakht / Mellat (BPM) payment provider — SOAP over plain `fetch`.
 *
 * Amounts in the app are stored in Toman; the gateway works in RIAL, so every
 * amount sent/verified is multiplied by 10.
 *
 * Flow:
 *  - initiate → `bpPayRequest` → on ResCode "0", store RefId on the payment and
 *    return a redirect to the startpay page. The bank expects RefId via POST, so
 *    `instructions` carries the POST target/fields, while the GET redirectUrl
 *    with `?RefId=` works as a fallback. The numeric SaleOrderId is re-derived
 *    deterministically from payment.id at verify time, not persisted.
 *  - verify → on callback ResCode "0", `bpVerifyRequest` then `bpSettleRequest`;
 *    reference = SaleReferenceId.
 *
 * Reference (official manual + service):
 *   https://bpm.shaparak.ir/pgwchannel/services/pgw?wsdl
 *   https://docs.banktest.ir/doc/mellat (parameter/ResCode reference)
 */
export const behpardakhtProvider: PaymentProvider = {
  method: "BEHPARDAKHT",

  async initiate(order, payment) {
    if (!isConfigured()) {
      configError();
    }

    // Toman → Rial.
    const amountRial = Math.round(Number(order.totalAmount)) * 10;
    const saleOrderId = numericOrderId(payment);
    const callBackUrl = `${APP_BASE_URL}/api/payments/behpardakht/callback?orderId=${order.id}`;

    let resCode: string;
    let refId: string;

    try {
      // Arg order per the WSDL: terminalId, userName, userPassword, orderId,
      // amount, localDate, localTime, callBackUrl, payerId.
      const result = await callSoap("bpPayRequest", [
        ["terminalId", TERMINAL_ID],
        ["userName", USERNAME],
        ["userPassword", PASSWORD],
        ["orderId", saleOrderId],
        ["amount", amountRial],
        ["localDate", localDate()],
        ["localTime", localTime()],
        ["callBackUrl", callBackUrl],
        ["payerId", 0],
      ]);

      // Response is a comma-separated string "ResCode,RefId" on success,
      // or just "ResCode" on failure.
      const [code = "", ref = ""] = result.split(",");
      resCode = code.trim();
      refId = ref.trim();
    } catch (err) {
      console.error("[behpardakht] bpPayRequest error:", err);
      throw new Error("اتصال به درگاه به‌پرداخت ملت برقرار نشد.");
    }

    if (resCode !== "0" || !refId) {
      throw new Error(`درخواست پرداخت به‌پرداخت ملت ناموفق بود (کد ${resCode || "نامشخص"}).`);
    }

    // Persist RefId on the payment row. The numeric SaleOrderId is NOT stored —
    // it is re-derived deterministically from payment.id at verify time (see
    // numericOrderId), so a single column (`reference`) is all we need.
    const db = getDb();
    await db.update(payments).set({ reference: refId }).where(eq(payments.id, payment.id));

    // The bank's page expects a POST with RefId; the callback/initiation form
    // handles that. We return both the canonical POST target via instructions
    // and a GET redirectUrl fallback (`?RefId=`).
    return {
      redirectUrl: `${STARTPAY_URL}?RefId=${encodeURIComponent(refId)}`,
      instructions: {
        method: "POST",
        action: STARTPAY_URL,
        fields: { RefId: refId },
      },
    };
  },

  async verify(payment, params) {
    if (!isConfigured()) {
      // Defensive: should never reach verify if not configured.
      return { status: "FAILED" };
    }

    const resCode = String(params.ResCode ?? params.resCode ?? "");
    // Always derive the SaleOrderId server-side from the payment row — never
    // trust the callback param, which an attacker could point at another sale.
    const saleOrderId = String(numericOrderId(payment));
    const saleReferenceId = String(params.SaleReferenceId ?? params.saleReferenceId ?? "");

    // If the callback carries a SaleOrderId, it must match the derived one.
    const callbackSaleOrderId = params.SaleOrderId ?? params.saleOrderId;
    if (
      callbackSaleOrderId !== undefined &&
      callbackSaleOrderId !== null &&
      String(callbackSaleOrderId) !== saleOrderId
    ) {
      console.error(
        `[behpardakht] SaleOrderId mismatch: expected=${saleOrderId} got=${String(callbackSaleOrderId)}`,
      );
      return { status: "FAILED" };
    }

    // The bank already rejected / the user cancelled — nothing to verify.
    if (resCode !== "0" || !saleReferenceId) {
      return { status: "FAILED" };
    }

    const verifyArgs: Array<[string, string | number]> = [
      ["terminalId", TERMINAL_ID],
      ["userName", USERNAME],
      ["userPassword", PASSWORD],
      ["orderId", saleOrderId],
      ["saleOrderId", saleOrderId],
      ["saleReferenceId", saleReferenceId],
    ];

    try {
      // bpVerifyRequest → single numeric ResCode ("0" = success).
      const verifyCode = (await callSoap("bpVerifyRequest", verifyArgs)).trim();
      if (verifyCode !== "0") {
        // Common: "43" already verified — still not settled here, treat as failed
        // unless the gateway explicitly returns 0. We do not auto-reverse; the
        // operator can reconcile via the bank portal.
        return { status: "FAILED" };
      }

      // bpSettleRequest finalizes the transaction. "0" or "45" (already settled)
      // both mean the money is captured.
      const settleCode = (await callSoap("bpSettleRequest", verifyArgs)).trim();
      if (settleCode !== "0" && settleCode !== "45") {
        return { status: "FAILED" };
      }

      return { status: "PAID", reference: saleReferenceId };
    } catch (err) {
      console.error("[behpardakht] verify/settle error:", err);
      return { status: "FAILED" };
    }
  },
};

// Self-register when this module is imported.
registerProvider(behpardakhtProvider);

export { behpardakhtProvider as default };
