import { getSetting, getSettingNumber } from "@/lib/settings";
import { formatDeliveryError, type OtpDeliveryResult } from "@/lib/sms/delivery";

/**
 * Generic free-text SMS via Kavenegar's `sms/send` endpoint. Mirrors
 * {@link import("./order-codes").sendOrderCodesSms} but with a caller-supplied
 * body — used by the admin "send test SMS" action to verify provider config.
 * Best-effort: env-gated, never throws, always resolves to a delivery status.
 */
type KavenegarSendResponse = {
  return?: { status?: number; message?: string };
  entries?: Array<{ messageid?: number; status?: number; statustext?: string; cost?: number }>;
  error?: string;
};

export async function sendSmsText(
  phone: string,
  message: string,
): Promise<OtpDeliveryResult<KavenegarSendResponse>> {
  const apiKey = await getSetting("KAVENEGAR_TOKEN");
  const sender = await getSetting("KAVENEGAR_SENDER");

  if (!apiKey) {
    return { status: "skipped", message: "KAVENEGAR_TOKEN is not configured.", payload: null };
  }
  if (!phone || !message) {
    return { status: "skipped", message: "Missing recipient or message.", payload: null };
  }

  const body = new URLSearchParams({ receptor: phone, message });
  if (sender) body.set("sender", sender);

  try {
    const response = await fetch(`https://api.kavenegar.com/v1/${apiKey}/sms/send.json`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
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
