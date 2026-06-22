import { LogsView } from "@/components/admin/comms/logs-view";
import { listCommLogs } from "@/lib/comms/queries";

function serialize<T extends { createdAt: Date; updatedAt: Date }>(row: T) {
  return { ...row, createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString() };
}

export default async function CommunicationsLogsPage() {
  const logs = await listCommLogs({ limit: 50 });
  return <LogsView initial={{ items: logs.items.map(serialize), nextCursor: logs.nextCursor }} />;
}
