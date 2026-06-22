import { getSetting } from "@/lib/settings";
import type { OtpDeliveryResult } from "@/lib/sms/delivery";
import { sendIppanelOtp } from "@/lib/sms/ippanel";
import { type KavenegarChannel, sendKavenegarOtp } from "@/lib/sms/kavenegar";

/**
 * Dispatches an OTP to the configured SMS provider (`SMS_OTP_PROVIDER`:
 * "kavenegar" | "ippanel"). IPPanel handles SMS patterns only; voice ("call")
 * always goes through Kavenegar's lookup type=call.
 */
export async function sendOtp(
  phone: string,
  code: string,
  channel: KavenegarChannel,
): Promise<OtpDeliveryResult<unknown>> {
  const provider = (await getSetting("SMS_OTP_PROVIDER"))?.toLowerCase() ?? "kavenegar";

  if (provider === "ippanel" && channel === "sms") {
    return sendIppanelOtp(phone, code);
  }
  return sendKavenegarOtp(phone, code, channel);
}
