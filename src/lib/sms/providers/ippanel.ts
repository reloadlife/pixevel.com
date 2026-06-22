import { getSetting, getSettingNumber } from "@/lib/settings";
import { formatDeliveryError, type OtpDeliveryResult } from "@/lib/sms/delivery";
import { type IppanelPayload, sendIppanelOtp, toE164Iran } from "@/lib/sms/ippanel";
import type { SmsChannel, SmsProvider, SmsProviderId } from "./types";

const ENDPOINT = "https://edge.ippanel.com/v1/api/send";

export const ippanelProvider: SmsProvider = {
  id: "ippanel" satisfies SmsProviderId,
  supportsVoice: false,

  async sendOtp(
    phone: string,
    code: string,
    channel: SmsChannel,
  ): Promise<OtpDeliveryResult<unknown>> {
    if (channel === "call") {
      return { status: "skipped", message: "IPPanel does not support voice.", payload: null };
    }
    return sendIppanelOtp(phone, code);
  },

  async sendText(phone: string, message: string): Promise<OtpDeliveryResult<unknown>> {
    const apiKey = await getSetting("IPPANEL_API_KEY");
    const fromNumber = await getSetting("IPPANEL_SENDER");

    if (!apiKey || !fromNumber) {
      return { status: "skipped", message: "IPPanel is not configured.", payload: null };
    }

    const body = {
      sending_type: "webservice",
      from_number: fromNumber,
      message,
      recipients: [toE164Iran(phone)],
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
  },
};
