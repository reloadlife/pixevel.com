import { LogsView } from "@/components/admin/comms/logs-view";

export default function CommunicationsCallsPage() {
  // VOICE rows are loaded client-side on mount (the view fetches by fixedChannel).
  return <LogsView initial={{ items: [], nextCursor: null }} fixedChannel="VOICE" />;
}
