import { getSetting } from "@/lib/settings";
import { ippanelProvider } from "./ippanel";
import { kavenegarProvider } from "./kavenegar";
import { selfhostedProvider } from "./selfhosted";
import type { SmsChannel, SmsProvider, SmsProviderId } from "./types";

export type { SmsChannel, SmsProvider, SmsProviderId } from "./types";

const REGISTRY = new Map<SmsProviderId, SmsProvider>([
  ["kavenegar", kavenegarProvider],
  ["ippanel", ippanelProvider],
  ["selfhosted", selfhostedProvider],
]);

/** Returns the provider for a given id. Throws on unknown id. */
export function getSmsProvider(id: string): SmsProvider {
  const provider = REGISTRY.get(id as SmsProviderId);
  if (!provider) throw new Error(`Unknown SMS provider: "${id}"`);
  return provider;
}

/** Reads SMS_PROVIDER → SMS_OTP_PROVIDER → "kavenegar". Unknown values fall back to kavenegar. */
export async function resolveSmsProviderId(): Promise<SmsProviderId> {
  const raw =
    (await getSetting("SMS_PROVIDER"))?.toLowerCase() ??
    (await getSetting("SMS_OTP_PROVIDER"))?.toLowerCase() ??
    "kavenegar";
  return REGISTRY.has(raw as SmsProviderId) ? (raw as SmsProviderId) : "kavenegar";
}

/** Reads VOICE_PROVIDER → "kavenegar". Unknown values fall back to kavenegar. */
export async function resolveVoiceProviderId(): Promise<SmsProviderId> {
  const raw = (await getSetting("VOICE_PROVIDER"))?.toLowerCase() ?? "kavenegar";
  return REGISTRY.has(raw as SmsProviderId) ? (raw as SmsProviderId) : "kavenegar";
}

export async function resolveSmsProvider(): Promise<SmsProvider> {
  return getSmsProvider(await resolveSmsProviderId());
}

export async function resolveVoiceProvider(): Promise<SmsProvider> {
  return getSmsProvider(await resolveVoiceProviderId());
}

/**
 * Single-resolution helper used by logged send wrappers.
 *
 * For "call": resolves the VOICE_PROVIDER and applies the kavenegar fallback
 * when the resolved provider has `supportsVoice === false`, so the returned
 * `id` always equals the provider that will actually place the call.
 *
 * For "sms": resolves SMS_PROVIDER → SMS_OTP_PROVIDER → kavenegar.
 */
export async function resolveProviderForChannel(
  channel: SmsChannel,
): Promise<{ provider: SmsProvider; id: SmsProviderId }> {
  if (channel === "call") {
    const voiceProvider = await resolveVoiceProvider();
    if (voiceProvider.supportsVoice) {
      return { provider: voiceProvider, id: voiceProvider.id };
    }
    // Configured voice provider doesn't support voice — hard-fall to kavenegar.
    const fallback = getSmsProvider("kavenegar");
    return { provider: fallback, id: "kavenegar" };
  }
  const provider = await resolveSmsProvider();
  return { provider, id: provider.id };
}
