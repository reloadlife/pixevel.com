import { getSetting, getSettingNumber } from "@/lib/settings";
import { formatDeliveryError, type OtpDeliveryResult } from "@/lib/sms/delivery";
import type { SmsChannel, SmsProvider, SmsProviderId } from "./types";

type SelfhostedPayload = {
  status?: string;
  id?: string | number;
  error?: string;
  [key: string]: unknown;
};

export const selfhostedProvider: SmsProvider = {
  id: "selfhosted" satisfies SmsProviderId,
  supportsVoice: true,

  async sendOtp(
    phone: string,
    code: string,
    channel: SmsChannel,
  ): Promise<OtpDeliveryResult<unknown>> {
    return sendSelfhosted(phone, { type: channel, message: code });
  },

  async sendText(phone: string, message: string): Promise<OtpDeliveryResult<unknown>> {
    return sendSelfhosted(phone, { type: "sms", message });
  },
};

async function sendSelfhosted(
  phone: string,
  fields: { type: string; message: string },
): Promise<OtpDeliveryResult<SelfhostedPayload>> {
  const baseUrl = await getSetting("SELFHOSTED_SMS_BASE_URL");
  const token = await getSetting("SELFHOSTED_SMS_TOKEN");

  if (!baseUrl || !token) {
    return {
      status: "skipped",
      message: "Selfhosted SMS gateway is not configured.",
      payload: null,
    };
  }

  const sendPath = (await getSetting("SELFHOSTED_SMS_SEND_PATH")) ?? "/messages";
  const fromSender = await getSetting("SELFHOSTED_SENDER");
  const timeoutMs = await getSettingNumber("SELFHOSTED_SMS_TIMEOUT_MS", 10_000);

  const body: Record<string, string> = {
    to: phone,
    type: fields.type,
    message: fields.message,
  };
  if (fromSender) body.from = fromSender;

  const url = `${baseUrl.replace(/\/$/, "")}${sendPath}`;

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
    });

    let payload: SelfhostedPayload;
    try {
      payload = (await response.json()) as SelfhostedPayload;
    } catch {
      return {
        status: "failed",
        message: "Selfhosted gateway response was not valid JSON.",
        payload: { error: "Invalid gateway JSON response." },
      };
    }

    if (!response.ok) {
      return {
        status: "failed",
        message: payload.error ?? `Gateway returned HTTP ${response.status}.`,
        payload,
      };
    }

    if (payload.status === "failed") {
      return {
        status: "failed",
        message: payload.error ?? "Gateway reported failure.",
        payload,
      };
    }

    if (payload.status === "queued") {
      return { status: "pending", message: "Message queued by gateway.", payload };
    }

    return { status: "sent", message: "SMS sent via selfhosted gateway.", payload };
  } catch (error) {
    return {
      status: "failed",
      message: formatDeliveryError(error),
      payload: { error: formatDeliveryError(error) },
    };
  }
}
