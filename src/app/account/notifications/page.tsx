import { Bell } from "lucide-react";
import { redirect } from "next/navigation";

import { getNotificationsOverview } from "@/lib/account/notifications";
import { getCurrentUser } from "@/lib/auth";
import { type InboxNotification, NotificationsInbox } from "./inbox";

export default async function NotificationsPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login?redirect=/account/notifications");
  }

  const { notifications, unreadCount } = await getNotificationsOverview(user.id);

  const initial: InboxNotification[] = notifications.map((n) => ({
    id: n.id,
    type: n.type,
    titleFa: n.titleFa,
    bodyFa: n.bodyFa,
    href: n.href,
    readAt: n.readAt,
    createdAt: n.createdAt,
  }));

  return (
    <main dir="rtl">
      <header className="mb-6">
        <p className="text-xs font-black uppercase tracking-[0.24em] text-muted-foreground">
          Pixevel Account
        </p>
        <h1 className="mt-2 flex items-center gap-2 text-2xl font-black sm:text-3xl">
          <Bell className="size-6 text-gold" aria-hidden />
          اعلان‌ها
        </h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          وضعیت سفارش‌ها، پرداخت‌ها، هشدارهای امنیتی و پیشنهادهای ویژه در یک جا.
        </p>
      </header>

      <NotificationsInbox initial={initial} initialUnread={unreadCount} />
    </main>
  );
}
