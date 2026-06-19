import { formatDeliveryError, type OtpDeliveryResult, resolveTimeoutMs } from "@/lib/sms/delivery";

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

export async function sendKavenegarOtp(
  phone: string,
  code: string,
): Promise<OtpDeliveryResult<KavenegarPayload>> {
  const apiKey = process.env.KAVENEGAR_TOKEN;
  const template = process.env.KAVENEGAR_OTP_TEMPLATE ?? "cancelappointmentotp";

  if (!apiKey) {
    return {
      status: "skipped",
      message: "KAVENEGAR_TOKEN is not configured.",
      payload: null,
    };
  }

  const body = new URLSearchParams({
    receptor: phone,
    template,
    type: "sms",
    token: code,
  });

  try {
    const response = await fetch(`https://api.kavenegar.com/v1/${apiKey}/verify/lookup.json`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body,
      signal: AbortSignal.timeout(resolveTimeoutMs(process.env.KAVENEGAR_TIMEOUT_MS, 10_000)),
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
