import { CommsSettings } from "@/components/admin/comms/settings-view";
import { getSettingsForAdmin } from "@/lib/settings";

export default async function CommunicationsSettingsPage() {
  const all = await getSettingsForAdmin();
  const settings = all.filter((s) => s.group === "sms" || s.group === "email");
  return <CommsSettings settings={settings} />;
}
