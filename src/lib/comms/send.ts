import "server-only";

import { type EmailDeliveryResult, type SendEmailParams, sendEmail } from "@/lib/email/client";
import { getSetting } from "@/lib/settings";
import type { OtpDeliveryResult } from "@/lib/sms/delivery";
import type { KavenegarChannel } from "@/lib/sms/kavenegar";
import { type OrderCodesSmsInput, sendOrderCodesSms } from "@/lib/sms/order-codes";
import { sendOtp } from "@/lib/sms/otp";
import { sendTelegramLoginOtp } from "@/lib/sms/telegram";
import { sendSmsText } from "@/lib/sms/text";
import { recordOutbound } from "./record";

/**
 * Logged send wrappers. Each composes a pure provider client with a
 * fire-and-forget `recordOutbound` write, so every message lands in the ledger
 * without coupling the clients to the DB. Callers use these instead of the raw
 * client; the return value is the raw client result, unchanged.
 */

/** Which provider `sendOtp` dispatches to, for ledger attribution. */
async function otpProvider(channel: KavenegarChannel): Promise<string> {
  if (channel === "call") return "kavenegar"; // voice always goes through Kavenegar
  return (await getSetting("SMS_OTP_PROVIDER"))?.toLowerCase() ?? "kavenegar";
}

export async function sendOtpLogged(
  phone: string,
  code: string,
  channel: KavenegarChannel,
  opts?: { userId?: string | null },
): Promise<OtpDeliveryResult<unknown>> {
  const result = await sendOtp(phone, code, channel);
  await recordOutbound({
    channel: channel === "call" ? "VOICE" : "SMS",
    provider: await otpProvider(channel),
    kind: "OTP",
    toAddress: phone,
    status: result.status,
    message: result.message,
    payload: result.payload,
    userId: opts?.userId ?? null,
  });
  return result;
}

export async function sendTelegramLoginOtpLogged(params: {
  phone: string;
  code: string;
  host: string;
}): Promise<OtpDeliveryResult<unknown>> {
  const result = await sendTelegramLoginOtp(params);
  // Skipped Telegram is the common production case (relay disabled) — don't
  // clutter the ledger with no-ops.
  if (result.status !== "skipped") {
    await recordOutbound({
      channel: "TELEGRAM",
      provider: "telegram",
      kind: "OTP",
      toAddress: params.phone,
      status: result.status,
      message: result.message,
      payload: result.payload,
    });
  }
  return result;
}

export async function sendOrderCodesLogged(
  input: OrderCodesSmsInput,
  opts?: { userId?: string | null; orderId?: string | null },
): Promise<OtpDeliveryResult<unknown>> {
  const result = await sendOrderCodesSms(input);
  await recordOutbound({
    channel: "SMS",
    provider: "kavenegar",
    kind: "ORDER_CODES",
    toAddress: input.phone,
    body: `سفارش ${input.orderNumber}: ${input.codes.length} کد`,
    status: result.status,
    message: result.message,
    payload: result.payload,
    userId: opts?.userId ?? null,
    orderId: opts?.orderId ?? null,
  });
  return result;
}

export async function sendEmailLogged(
  params: SendEmailParams,
  opts?: { userId?: string | null; orderId?: string | null; kind?: "NOTIFICATION" | "OTHER" },
): Promise<EmailDeliveryResult> {
  const result = await sendEmail(params);
  const to = Array.isArray(params.to) ? params.to.join(", ") : params.to;
  await recordOutbound({
    channel: "EMAIL",
    provider: "resend",
    kind: opts?.kind ?? "NOTIFICATION",
    toAddress: to,
    body: params.subject,
    status: result.status,
    message: result.message,
    providerMessageId: result.id,
    userId: opts?.userId ?? null,
    orderId: opts?.orderId ?? null,
  });
  return result;
}

/** Admin "send test SMS" — generic free text via Kavenegar, recorded as kind TEST. */
export async function sendTestSms(
  phone: string,
  text: string,
): Promise<OtpDeliveryResult<unknown>> {
  const result = await sendSmsText(phone, text);
  const logId = await recordOutbound({
    channel: "SMS",
    provider: "kavenegar",
    kind: "TEST",
    toAddress: phone,
    body: text,
    status: result.status,
    message: result.message,
    payload: result.payload,
  });
  return { ...result, payload: { ...(result.payload as object), logId } };
}
