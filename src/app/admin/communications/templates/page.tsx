import { TemplatesView } from "@/components/admin/comms/templates-view";
import { listTemplatesForAdmin } from "@/lib/admin/comm-templates";

export default async function CommunicationsTemplatesPage() {
  const events = await listTemplatesForAdmin();
  return <TemplatesView initialEvents={events} />;
}
