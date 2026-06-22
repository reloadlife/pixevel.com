import { redirect } from "next/navigation";

import { CommunicationsDashboard } from "@/components/admin/communications-dashboard";
import { getCurrentUser } from "@/lib/auth";
import { commStats, listCommLogs, listWebhookEvents } from "@/lib/comms/queries";
import { getSettingsForAdmin } from "@/lib/settings";

/** Serialize Date fields so the data crosses the server→client boundary cleanly. */
function serializeLog<T extends { createdAt: Date; updatedAt: Date }>(row: T) {
  return { ...row, createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString() };
}

export default async function AdminCommunicationsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?redirect=/admin/communications");
  if (user.role !== "ADMIN") redirect("/admin");

  const [logs, callbacks, stats, allSettings] = await Promise.all([
    listCommLogs({ limit: 50 }),
    listWebhookEvents({ limit: 50 }),
    commStats(),
    getSettingsForAdmin(),
  ]);

  // Comms settings live here now (moved out of /admin/settings).
  const commSettings = allSettings.filter((s) => s.group === "sms" || s.group === "email");

  return (
    <div className="grid gap-6" dir="rtl">
      <header>
        <h1 className="text-xl font-black">ارتباطات</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          گزارش کامل پیامک، تماس، ایمیل و تلگرام — ارسال‌ها، دریافت‌ها، کال‌بک‌ها و کلیدها.
        </p>
      </header>

      <CommunicationsDashboard
        initialLogs={{ items: logs.items.map(serializeLog), nextCursor: logs.nextCursor }}
        initialCallbacks={{
          items: callbacks.items.map((c) => ({ ...c, receivedAt: c.receivedAt.toISOString() })),
          nextCursor: callbacks.nextCursor,
        }}
        stats={stats}
        settings={commSettings}
      />
    </div>
  );
}
