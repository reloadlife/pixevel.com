import { sendKavenegarOtp } from "@/lib/sms/kavenegar";
import { sendSmsText } from "@/lib/sms/text";
import type { SmsChannel, SmsProvider, SmsProviderId } from "./types";

export const kavenegarProvider: SmsProvider = {
  id: "kavenegar" satisfies SmsProviderId,
  supportsVoice: true,

  sendOtp(phone, code, channel: SmsChannel) {
    return sendKavenegarOtp(phone, code, channel);
  },

  sendText(phone, message) {
    return sendSmsText(phone, message);
  },
};
