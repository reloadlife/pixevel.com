import "server-only";

import { type EmailDeliveryResult, type SendEmailParams, sendEmail } from "@/lib/email/client";
import type { OtpDeliveryResult } from "@/lib/sms/delivery";
import type { KavenegarChannel } from "@/lib/sms/kavenegar";
import { type OrderCodesSmsInput, sendOrderCodesSms } from "@/lib/sms/order-codes";
import { sendOtp } from "@/lib/sms/otp";
import {
  resolveSmsProvider,
  resolveSmsProviderId,
  resolveVoiceProviderId,
} from "@/lib/sms/providers";
import { sendTelegramLoginOtp } from "@/lib/sms/telegram";
import { recordOutbound } from "./record";

/**
 * Logged send wrappers. Each composes a pure provider client with a
 * fire-and-forget `recordOutbound` write, so every message lands in the ledger
 * without coupling the clients to the DB. Callers use these instead of the raw
 * client; the return value is the raw client result, unchanged.
 */

export async function sendOtpLogged(
  phone: string,
  code: string,
  channel: KavenegarChannel,
  opts?: { userId?: string | null },
): Promise<OtpDeliveryResult<unknown>> {
  const result = await sendOtp(phone, code, channel);
  const provider =
    channel === "call" ? await resolveVoiceProviderId() : await resolveSmsProviderId();
  await recordOutbound({
    channel: channel === "call" ? "VOICE" : "SMS",
    provider,
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
  const [result, provider] = await Promise.all([sendOrderCodesSms(input), resolveSmsProviderId()]);
  await recordOutbound({
    channel: "SMS",
    provider,
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

/** Admin "send test SMS" — generic free text via the resolved SMS provider, recorded as kind TEST. */
export async function sendTestSms(
  phone: string,
  text: string,
): Promise<OtpDeliveryResult<unknown>> {
  const [provider, providerId] = await Promise.all([resolveSmsProvider(), resolveSmsProviderId()]);
  const result = await provider.sendText(phone, text);
  const logId = await recordOutbound({
    channel: "SMS",
    provider: providerId,
    kind: "TEST",
    toAddress: phone,
    body: text,
    status: result.status,
    message: result.message,
    payload: result.payload,
  });
  return { ...result, payload: { ...(result.payload as object), logId } };
}
