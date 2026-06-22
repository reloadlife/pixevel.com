import { getSetting, getSettingNumber } from "@/lib/settings";
import { formatDeliveryError, type OtpDeliveryResult } from "@/lib/sms/delivery";

type KavenegarLookupResponse = Array<{
  messageid?: number;
  status?: number;
  statustext?: string;
  message?: string;
  sender?: string;
  cost?: number;
}>;

type KavenegarPayload = {
  return?: { status?: number; message?: string };
  entries?: KavenegarLookupResponse;
  error?: string;
};

export type KavenegarChannel = "sms" | "call";

export async function sendKavenegarOtp(
  phone: string,
  code: string,
  channel: KavenegarChannel = "sms",
): Promise<OtpDeliveryResult<KavenegarPayload>> {
  const apiKey = await getSetting("KAVENEGAR_TOKEN");
  const template = (await getSetting("KAVENEGAR_OTP_TEMPLATE")) ?? "cancelappointmentotp";

  if (!apiKey) {
    return {
      status: "skipped",
      message: "KAVENEGAR_TOKEN is not configured.",
      payload: null,
    };
  }

  // verify/lookup `type`: "sms" delivers a text, "call" places a voice call that
  // reads the token aloud (TTS). Same endpoint + template.
  const body = new URLSearchParams({
    receptor: phone,
    template,
    type: channel === "call" ? "call" : "sms",
    token: code,
  });

  try {
    const response = await fetch(`https://api.kavenegar.com/v1/${apiKey}/verify/lookup.json`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body,
      signal: AbortSignal.timeout(await getSettingNumber("KAVENEGAR_TIMEOUT_MS", 10_000)),
    });

    let payload: KavenegarPayload;
    try {
      payload = (await response.json()) as KavenegarPayload;
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
