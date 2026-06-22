import { CallbacksView } from "@/components/admin/comms/callbacks-view";
import { listWebhookEvents } from "@/lib/comms/queries";

export default async function CommunicationsCallbacksPage() {
  const cb = await listWebhookEvents({ limit: 50 });
  return (
    <CallbacksView
      initial={{
        items: cb.items.map((c) => ({ ...c, receivedAt: c.receivedAt.toISOString() })),
        nextCursor: cb.nextCursor,
      }}
    />
  );
}
