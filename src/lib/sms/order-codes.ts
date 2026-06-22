import { getSetting, getSettingNumber } from "@/lib/settings";
import { formatDeliveryError, type OtpDeliveryResult } from "@/lib/sms/delivery";

// Kavenegar plain-text send endpoint response shape. Unlike the OTP
// verify/lookup flow, order codes are free-text and go through `sms/send.json`.
type KavenegarSendResponse = {
  return?: { status?: number; message?: string };
  entries?: Array<{
    messageid?: number;
    status?: number;
    statustext?: string;
    message?: string;
    receptor?: string;
    cost?: number;
  }>;
  error?: string;
};

export interface OrderCodesSmsInput {
  /** Iranian mobile number in normalized 09xxxxxxxxx form. */
  phone: string;
  /** Human-facing order number (e.g. PX-XXXX). */
  orderNumber: string;
  /** Digital codes to deliver. */
  codes: string[];
}

/**
 * Build a concise Persian SMS body for an order's digital codes.
 *
 * Kept short on purpose — SMS bodies are length-billed, so we list the order
 * number followed by the code(s), one per line.
 */
export function buildOrderCodesSms(orderNumber: string, codes: string[]): string {
  const lines = [`پیکسوِل`, `کد(های) سفارش ${orderNumber}:`, ...codes];
  return lines.join("\n");
}

/**
 * Send an order's digital code(s) to a phone number via Kavenegar.
 *
 * Mirrors {@link sendKavenegarOtp}: env-gated (returns `skipped` when
 * KAVENEGAR_TOKEN / sender are absent), never throws, and always resolves to a
 * delivery status so callers can treat it as best-effort. A missing SMS config
 * must never break checkout or payment.
 */
export async function sendOrderCodesSms(
  input: OrderCodesSmsInput,
): Promise<OtpDeliveryResult<KavenegarSendResponse>> {
  const { phone, orderNumber, codes } = input;

  const apiKey = await getSetting("KAVENEGAR_TOKEN");
  const sender = await getSetting("KAVENEGAR_SENDER");

  if (!apiKey) {
    return {
      status: "skipped",
      message: "KAVENEGAR_TOKEN is not configured.",
      payload: null,
    };
  }

  if (!phone) {
    return {
      status: "skipped",
      message: "No recipient phone number provided.",
      payload: null,
    };
  }

  if (codes.length === 0) {
    return {
      status: "skipped",
      message: "No codes to deliver.",
      payload: null,
    };
  }

  const body = new URLSearchParams({
    receptor: phone,
    message: buildOrderCodesSms(orderNumber, codes),
  });
  // Sender line is optional on most Kavenegar accounts (a default is used when
  // omitted); include it only when configured.
  if (sender) {
    body.set("sender", sender);
  }

  try {
    const response = await fetch(`https://api.kavenegar.com/v1/${apiKey}/sms/send.json`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body,
      signal: AbortSignal.timeout(await getSettingNumber("KAVENEGAR_TIMEOUT_MS", 10_000)),
    });

    let payload: KavenegarSendResponse;
    try {
      payload = (await response.json()) as KavenegarSendResponse;
    } catch {
      return {
        status: "failed",
        message: "Kavenegar response was not valid JSON.",
        payload: { error: "Invalid Kavenegar JSON response." },
      };
    }

    if (!response.ok || payload.return?.status !== 200) {
      return {
        status: "failed",
        message: payload.return?.message ?? "Kavenegar request failed.",
        payload,
      };
    }

    const firstEntry = payload.entries?.[0];

    return {
      status: firstEntry?.status && [4, 5].includes(firstEntry.status) ? "pending" : "sent",
      message: firstEntry?.statustext ?? payload.return?.message ?? "SMS sent.",
      payload,
    };
  } catch (error) {
    return {
      status: "failed",
      message: formatDeliveryError(error),
      payload: { error: formatDeliveryError(error) },
    };
  }
}
