import { getSetting, getSettingNumber } from "@/lib/settings";
import { formatDeliveryError, type OtpDeliveryResult } from "@/lib/sms/delivery";

/**
 * IPPanel (ippanel.com) pattern SMS — the OTP equivalent of Kavenegar's lookup.
 * POST https://edge.ippanel.com/v1/api/send  (auth: Authorization: <api key>)
 *   { sending_type: "pattern", from_number, code, recipients: ["+98…"], params: { <var>: <otp> } }
 * Success: meta.status === true, message id in data.message_outbox_ids[0].
 * Docs: https://docs.ippanel.com/docs/send/pattern
 */

export type IppanelPayload = {
  data?: { message_outbox_ids?: number[] };
  meta?: { status?: boolean; message?: string; message_code?: string };
  error?: string;
};

const ENDPOINT = "https://edge.ippanel.com/v1/api/send";

/** App stores Iran numbers as "09…"; IPPanel wants E.164 ("+98…"). */
export function toE164Iran(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("98")) return `+${digits}`;
  if (digits.startsWith("0")) return `+98${digits.slice(1)}`;
  return `+98${digits}`;
}

export async function sendIppanelOtp(
  phone: string,
  code: string,
): Promise<OtpDeliveryResult<IppanelPayload>> {
  const apiKey = await getSetting("IPPANEL_API_KEY");
  const patternCode = await getSetting("IPPANEL_PATTERN_CODE");
  const fromNumber = await getSetting("IPPANEL_SENDER");
  const variable = (await getSetting("IPPANEL_PATTERN_VAR")) ?? "code";

  if (!apiKey || !patternCode || !fromNumber) {
    return { status: "skipped", message: "IPPanel is not configured.", payload: null };
  }

  const body = {
    sending_type: "pattern",
    from_number: fromNumber,
    code: patternCode,
    recipients: [toE164Iran(phone)],
    params: { [variable]: code },
  };

  try {
    const response = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Authorization: apiKey,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(await getSettingNumber("IPPANEL_TIMEOUT_MS", 10_000)),
    });

    let payload: IppanelPayload;
    try {
      payload = (await response.json()) as IppanelPayload;
    } catch {
      return {
        status: "failed",
        message: "IPPanel response was not valid JSON.",
        payload: { error: "Invalid IPPanel JSON response." },
      };
    }

    if (!response.ok || payload.meta?.status !== true) {
      return {
        status: "failed",
        message: payload.meta?.message ?? "IPPanel request failed.",
        payload,
      };
    }

    return {
      status: "sent",
      message: payload.meta?.message ?? "SMS sent.",
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
