import "server-only";

import { type EmailDeliveryResult, type SendEmailParams, sendEmail } from "@/lib/email/client";
import type { OtpDeliveryResult } from "@/lib/sms/delivery";
import type { KavenegarChannel } from "@/lib/sms/kavenegar";
import { buildOrderCodesSms, type OrderCodesSmsInput } from "@/lib/sms/order-codes";
import { getSmsProvider, resolveProviderForChannel, type SmsProviderId } from "@/lib/sms/providers";
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
  // Single resolution — the same provider id used to send is what gets logged.
  // For voice, resolveProviderForChannel applies the kavenegar fallback when the
  // configured voice provider has supportsVoice === false, so the logged id is
  // always the provider that actually placed the call.
  const { provider, id: providerId } = await resolveProviderForChannel(
    channel === "call" ? "call" : "sms",
  );
  const result = await provider.sendOtp(phone, code, channel);
  await recordOutbound({
    channel: channel === "call" ? "VOICE" : "SMS",
    provider: providerId,
    kind: "OTP",
    toAddress: phone,
    body: code,
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
      body: params.code,
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
  // Single resolution — provider and id come from the same call.
  const { provider, id: providerId } = await resolveProviderForChannel("sms");

  if (!input.phone) {
    const result: OtpDeliveryResult<unknown> = {
      status: "skipped",
      message: "No recipient phone number provided.",
      payload: null,
    };
    await recordOutbound({
      channel: "SMS",
      provider: providerId,
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

  if (input.codes.length === 0) {
    const result: OtpDeliveryResult<unknown> = {
      status: "skipped",
      message: "No codes to deliver.",
      payload: null,
    };
    await recordOutbound({
      channel: "SMS",
      provider: providerId,
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

  const result = await provider.sendText(
    input.phone,
    buildOrderCodesSms(input.orderNumber, input.codes),
  );
  await recordOutbound({
    channel: "SMS",
    provider: providerId,
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

/**
 * Admin "send test SMS" — generic free text, recorded as kind TEST. Sends via a
 * specific provider when `forceProvider` is given (per-provider test button),
 * otherwise via the resolved active SMS provider.
 */
export async function sendTestSms(
  phone: string,
  text: string,
  forceProvider?: SmsProviderId,
): Promise<OtpDeliveryResult<unknown>> {
  const { provider, id: providerId } = forceProvider
    ? { provider: getSmsProvider(forceProvider), id: forceProvider }
    : await resolveProviderForChannel("sms");
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
