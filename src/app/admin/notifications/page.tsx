import { redirect } from "next/navigation";

import { NotificationManagement } from "@/components/admin/notification-management";
import { listRecentNotifications } from "@/lib/admin/notifications";
import { requireAdmin } from "@/lib/auth";

export default async function AdminNotificationsPage() {
  const admin = await requireAdmin();

  if (!admin) {
    redirect("/login?redirect=/admin/notifications");
  }

  const initial = await listRecentNotifications();

  return <NotificationManagement initialData={initial} />;
}
