import { getSetting } from "@/lib/settings";
import { ippanelProvider } from "./ippanel";
import { kavenegarProvider } from "./kavenegar";
import { selfhostedProvider } from "./selfhosted";
import type { SmsProvider, SmsProviderId } from "./types";

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
