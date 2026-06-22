import type { OtpDeliveryResult } from "@/lib/sms/delivery";
import type { KavenegarChannel } from "@/lib/sms/kavenegar";
import { resolveProviderForChannel } from "@/lib/sms/providers";

/**
 * Dispatches an OTP via the registry-resolved provider.
 * - SMS channel: resolved by `resolveSmsProvider()` (SMS_PROVIDER → SMS_OTP_PROVIDER → kavenegar).
 * - Voice channel: resolved by `resolveVoiceProvider()` (VOICE_PROVIDER → kavenegar).
 *   If the resolved voice provider does not support voice, falls back to kavenegar.
 */
export async function sendOtp(
  phone: string,
  code: string,
  channel: KavenegarChannel,
): Promise<OtpDeliveryResult<unknown>> {
  const { provider } = await resolveProviderForChannel(channel === "call" ? "call" : "sms");
  return provider.sendOtp(phone, code, channel);
}
