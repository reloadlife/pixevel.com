import type { OtpDeliveryResult } from "@/lib/sms/delivery";

export type SmsChannel = "sms" | "call";
export type SmsProviderId = "kavenegar" | "ippanel" | "selfhosted";

export interface SmsProvider {
  readonly id: SmsProviderId;
  readonly supportsVoice: boolean;
  /** OTP delivery — text (sms) or a voice call that reads the code (call). */
  sendOtp(phone: string, code: string, channel: SmsChannel): Promise<OtpDeliveryResult<unknown>>;
  /** Free-text SMS (order codes, admin test, generic). */
  sendText(phone: string, message: string): Promise<OtpDeliveryResult<unknown>>;
}
