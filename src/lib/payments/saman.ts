import { eq } from "drizzle-orm";
import { payments } from "@/db/schema";
import { getDb } from "@/lib/db";
import { type PaymentProvider, registerProvider } from "./provider";

// ─── Config ───────────────────────────────────────────────────────────────────

const TERMINAL_ID = process.env.SAMAN_TERMINAL_ID ?? "";

const APP_BASE_URL = process.env.APP_BASE_URL ?? "http://localhost:4000";

// SEP (Saman Electronic Payment) REST endpoints.
const TOKEN_URL = "https://sep.shaparak.ir/onlinepg/onlinepg";
// The hosted payment page; the token is POSTed (or GET-appended) here.
const GATEWAY_URL = "https://sep.shaparak.ir/OnlinePG/OnlinePG";
const VERIFY_URL = "https://sep.shaparak.ir/verifyTxnRandomSessionkey/ipg/VerifyTransaction";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isConfigured(): boolean {
  return Boolean(TERMINAL_ID);
}

function configError(): never {
  throw new Error("درگاه پرداخت پیکربندی نشده است.");
}

/**
 * SEP ResNum must be a unique reference per request. We use the payment row id
 * (a UUID string) directly — SEP accepts string ResNum and echoes it back in the
 * callback, which lets us cross-check the callback against the payment.
 */
function resNum(payment: { id: string }): string {
  return payment.id;
}

// ─── Provider ─────────────────────────────────────────────────────────────────

/**
 * Saman / SEP payment provider — REST over plain `fetch`.
 *
 * Amounts in the app are stored in Toman; SEP works in RIAL, so amounts are
 * multiplied by 10 on the way out and (implicitly) compared in Rial on verify.
 *
 * Flow:
 *  - initiate → POST `{ Action: "token", TerminalId, Amount, ResNum, RedirectUrl,
 *    CellNumber? }` to the token endpoint. On `status === 1` we get a `token`;
 *    redirect the user to the gateway with `?token=…`.
 *  - verify → SEP POSTs the callback (RefNum, State, ResNum, …). On a successful
 *    State we POST `{ RefNum, TerminalNumber }` to VerifyTransaction; a truthy
 *    `Success` / `ResultCode === 0` means PAID. reference = RefNum.
 *
 * Reference:
 *   https://docs.banktest.ir/doc/saman (SEP token/verify field reference)
 *   Token: https://sep.shaparak.ir/onlinepg/onlinepg
 *   Verify: https://sep.shaparak.ir/verifyTxnRandomSessionkey/ipg/VerifyTransaction
 */
export const samanProvider: PaymentProvider = {
  method: "SAMAN",

  async initiate(order, payment) {
    if (!isConfigured()) {
      configError();
    }

    // Toman → Rial.
    const amountRial = Math.round(Number(order.totalAmount)) * 10;
    const redirectUrl = `${APP_BASE_URL}/api/payments/saman/callback?orderId=${order.id}`;

    const body: Record<string, unknown> = {
      Action: "token",
      TerminalId: TERMINAL_ID,
      Amount: amountRial,
      ResNum: resNum(payment),
      RedirectUrl: redirectUrl,
    };

    // CellNumber is optional; include it when we have the buyer's phone so the
    // gateway can pre-fill / show saved cards.
    if (order.customerPhone) {
      body.CellNumber = order.customerPhone;
    }

    let json: {
      status?: number;
      token?: string;
      errorCode?: number | string;
      errorDesc?: string;
    };

    try {
      const res = await fetch(TOKEN_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(body),
      });

      json = (await res.json()) as typeof json;

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
    } catch (err) {
      console.error("[saman] token request error:", err);
      throw new Error("اتصال به درگاه سامان برقرار نشد.");
    }

    // SEP returns status 1 + a token on success. Any other status carries an
    // errorCode/errorDesc we must NOT leak to the client.
    if (json.status !== 1 || !json.token) {
      console.error(
        `[saman] token rejected: status=${json.status} code=${json.errorCode} desc=${json.errorDesc}`,
      );
      throw new Error("درخواست پرداخت درگاه سامان ناموفق بود.");
    }

    // Store the token as the payment reference (also useful for support lookups).
    const db = getDb();
    await db.update(payments).set({ reference: json.token }).where(eq(payments.id, payment.id));

    // SEP accepts the token via GET (?token=) on the gateway URL.
    return {
      redirectUrl: `${GATEWAY_URL}?token=${encodeURIComponent(json.token)}`,
      instructions: {
        method: "POST",
        action: GATEWAY_URL,
        fields: { Token: json.token },
      },
    };
  },

  async verify(payment, params) {
    if (!isConfigured()) {
      return { status: "FAILED" };
    }

    const state = String(params.State ?? params.state ?? "");
    const refNum = String(params.RefNum ?? params.refNum ?? "");
    const status = String(params.Status ?? params.status ?? "");

    // Bind the callback to THIS payment: ResNum was set to payment.id at
    // initiate and SEP echoes it back. If present and mismatched, reject —
    // never verify a transaction belonging to another payment row.
    const resNumParam = params.ResNum ?? params.resNum;
    if (resNumParam !== undefined && resNumParam !== null && String(resNumParam) !== payment.id) {
      console.error(`[saman] ResNum mismatch: expected=${payment.id} got=${String(resNumParam)}`);
      return { status: "FAILED" };
    }

    // SEP signals user-side success with State "OK" (and Status "2" on some
    // terminals). Anything else (CanceledByUser, Failed, etc.) → no verify.
    const stateOk = state === "OK" || status === "2";
    if (!stateOk || !refNum) {
      return { status: "FAILED" };
    }

    let json: {
      Success?: boolean;
      ResultCode?: number;
      ResultDescription?: string;
      TransactionDetail?: { RefNum?: string; OriginalAmount?: number; AffectiveAmount?: number };
    };

    try {
      // TerminalNumber is numeric here (vs string TerminalId on the token call).
      const res = await fetch(VERIFY_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ RefNum: refNum, TerminalNumber: Number(TERMINAL_ID) }),
      });

      json = (await res.json()) as typeof json;

      if (!res.ok) {
        return { status: "FAILED" };
      }
    } catch (err) {
      console.error("[saman] verify error:", err);
      return { status: "FAILED" };
    }

    // Success === true (ResultCode 0) means the amount is captured. Some SEP
    // deployments also return ResultCode 2 ("already verified") as idempotent
    // success — accept it so a duplicate callback does not flip a paid order.
    const verified = json.Success === true || json.ResultCode === 0 || json.ResultCode === 2;

    if (!verified) {
      console.error(
        `[saman] verify failed: code=${json.ResultCode} desc=${json.ResultDescription}`,
      );
      return { status: "FAILED" };
    }

    // Amount cross-check (Rial): the gateway MUST report an amount and it must
    // equal what we charged. A missing amount is treated as a failure too, so a
    // verify response without TransactionDetail can never confirm an order.
    const expectedRial = Math.round(Number(payment.amount)) * 10;
    const paidRial =
      json.TransactionDetail?.AffectiveAmount ?? json.TransactionDetail?.OriginalAmount;
    if (typeof paidRial !== "number" || paidRial !== expectedRial) {
      console.error(`[saman] amount mismatch: expected=${expectedRial} got=${String(paidRial)}`);
      return { status: "FAILED" };
    }

    return { status: "PAID", reference: refNum };
  },
};

// Self-register when this module is imported.
registerProvider(samanProvider);

export { samanProvider as default };
