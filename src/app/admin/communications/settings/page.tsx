import { CommsSettings } from "@/components/admin/comms/settings-view";
import { COMMS_PROVIDER_CARDS } from "@/lib/comms/provider-settings";
import { type AdminSettingRow, getSetting, getSettingsForAdmin } from "@/lib/settings";

export default async function CommunicationsSettingsPage() {
  const [all, smsP, voiceP, legacy, baseUrl] = await Promise.all([
    getSettingsForAdmin(),
    getSetting("SMS_PROVIDER"),
    getSetting("VOICE_PROVIDER"),
    getSetting("SMS_OTP_PROVIDER"),
    getSetting("APP_BASE_URL"),
  ]);

  const byKey = new Map(all.map((r) => [r.key, r]));
  const activeSms = (smsP ?? legacy ?? "kavenegar").toLowerCase();
  const activeVoice = (voiceP ?? "kavenegar").toLowerCase();

  const cards = COMMS_PROVIDER_CARDS.map((meta) => ({
    meta,
    rows: meta.keys.map((k) => byKey.get(k)).filter((r): r is AdminSettingRow => Boolean(r)),
    configured: meta.requiredKeys.every((k) => byKey.get(k)?.isSet === true),
  }));

  const routingRows = ["SMS_PROVIDER", "VOICE_PROVIDER"]
    .map((k) => byKey.get(k))
    .filter((r): r is AdminSettingRow => Boolean(r));

  return (
    <CommsSettings
      cards={cards}
      routingRows={routingRows}
      activeSms={activeSms}
      activeVoice={activeVoice}
      appBaseUrl={baseUrl ?? ""}
    />
  );
}
