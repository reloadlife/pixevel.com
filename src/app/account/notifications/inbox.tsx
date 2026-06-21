"use client";

import {
  Bell,
  CheckCheck,
  CreditCard,
  type LucideIcon,
  Megaphone,
  Package,
  Settings2,
  ShieldAlert,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

// Persian label for a notification type, used as a small badge/category.
// Inlined here (kept in sync with the server-side helper in
// "@/lib/account/notifications") so this client component never imports that
// module — doing so would transitively pull the Node-only "pg" client into the
// browser bundle.
function notificationTypeLabel(type: string): string {
  const map: Record<string, string> = {
    ORDER: "سفارش",
    PAYMENT: "پرداخت",
    PROMO: "پیشنهاد ویژه",
    SYSTEM: "سیستمی",
    SECURITY: "امنیتی",
  };
  return map[type] ?? type;
}

export type InboxNotification = {
  id: string;
  type: string;
  titleFa: string;
  bodyFa: string | null;
  href: string | null;
  readAt: Date | string | null;
  createdAt: Date | string;
};

function faDate(value: Date | string): string {
  return new Date(value).toLocaleDateString("fa-IR", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

const TYPE_ICON: Record<string, LucideIcon> = {
  ORDER: Package,
  PAYMENT: CreditCard,
  PROMO: Megaphone,
  SYSTEM: Settings2,
  SECURITY: ShieldAlert,
};

// Accent color per notification type — kept subtle, gold reserved for PROMO.
const TYPE_TONE: Record<string, string> = {
  ORDER: "bg-sky-500/15 text-sky-600 dark:text-sky-400",
  PAYMENT: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
  PROMO: "bg-gold/15 text-gold",
  SYSTEM: "bg-muted text-muted-foreground",
  SECURITY: "bg-red-500/15 text-red-600 dark:text-red-400",
};

export function NotificationsInbox({
  initial,
  initialUnread,
}: {
  initial: InboxNotification[];
  initialUnread: number;
}) {
  const router = useRouter();
  const [items, setItems] = useState<InboxNotification[]>(initial);
  const [unread, setUnread] = useState(initialUnread);
  const [pendingAll, setPendingAll] = useState(false);

  async function markOne(id: string) {
    // Optimistic: flip locally, reconcile from server response.
    setItems((prev) =>
      prev.map((n) => (n.id === id && !n.readAt ? { ...n, readAt: new Date() } : n)),
    );
    setUnread((u) => Math.max(0, u - 1));

    const res = await fetch("/api/account/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    const json = await res.json().catch(() => null);
    if (!res.ok) {
      toast.error(json?.error?.message ?? "به‌روزرسانی اعلان ممکن نشد.");
      router.refresh();
      return;
    }
    if (typeof json?.data?.unreadCount === "number") {
      setUnread(json.data.unreadCount);
    }
  }

  async function markAll() {
    if (unread === 0) {
      return;
    }
    setPendingAll(true);
    const res = await fetch("/api/account/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ all: true }),
    });
    const json = await res.json().catch(() => null);
    setPendingAll(false);
    if (!res.ok) {
      toast.error(json?.error?.message ?? "به‌روزرسانی اعلان‌ها ممکن نشد.");
      return;
    }
    const now = new Date();
    setItems((prev) => prev.map((n) => (n.readAt ? n : { ...n, readAt: now })));
    setUnread(0);
    toast.success("همه اعلان‌ها خوانده‌شده شدند.");
  }

  // Empty state with a CTA back to the storefront.
  if (items.length === 0) {
    return (
      <Card className="items-center p-8 text-center">
        <div className="grid size-12 place-items-center rounded-full bg-gold/15 text-gold">
          <Bell className="size-6" aria-hidden />
        </div>
        <p className="mt-3 text-sm font-black">اعلانی ندارید</p>
        <p className="mt-1 text-sm text-muted-foreground">
          خبرها، وضعیت سفارش‌ها و پیشنهادهای ویژه اینجا نمایش داده می‌شوند.
        </p>
        <a
          href="/products"
          className="mt-4 inline-flex items-center rounded-full bg-foreground px-5 py-2 text-sm font-black text-background transition hover:opacity-90"
        >
          مشاهده محصولات
        </a>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {unread > 0 ? `${unread.toLocaleString("fa-IR")} اعلان خوانده‌نشده` : "همه خوانده شده‌اند"}
        </p>
        <Button variant="outline" size="sm" onClick={markAll} disabled={unread === 0 || pendingAll}>
          <CheckCheck className="size-4" aria-hidden />
          {pendingAll ? "در حال انجام…" : "خواندن همه"}
        </Button>
      </div>

      <Card className="divide-y divide-border p-0">
        {items.map((n) => {
          const Icon = TYPE_ICON[n.type] ?? Bell;
          const tone = TYPE_TONE[n.type] ?? "bg-muted text-muted-foreground";
          const isUnread = !n.readAt;

          const inner = (
            <div
              className={cn(
                "flex items-start gap-3 px-4 py-3.5 transition-colors sm:px-5",
                isUnread && "bg-gold/5",
                n.href && "hover:bg-muted/60",
              )}
            >
              <span className={cn("grid size-9 shrink-0 place-items-center rounded-full", tone)}>
                <Icon className="size-5" aria-hidden />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  {isUnread ? (
                    <span
                      className="size-2 shrink-0 rounded-full bg-gold"
                      role="img"
                      aria-label="خوانده‌نشده"
                    />
                  ) : null}
                  <p className={cn("truncate text-sm", isUnread ? "font-black" : "font-bold")}>
                    {n.titleFa}
                  </p>
                </div>
                {n.bodyFa ? (
                  <p className="mt-0.5 text-sm text-muted-foreground">{n.bodyFa}</p>
                ) : null}
                <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                  <span className="rounded bg-muted px-1.5 py-0.5 font-medium">
                    {notificationTypeLabel(n.type)}
                  </span>
                  <span>{faDate(n.createdAt)}</span>
                </div>
              </div>
              {isUnread ? (
                <button
                  type="button"
                  onClick={(e) => {
                    // Don't follow the row link when only marking read.
                    e.preventDefault();
                    e.stopPropagation();
                    void markOne(n.id);
                  }}
                  className="shrink-0 self-center rounded-md px-2 py-1 text-xs font-bold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  خواندن
                </button>
              ) : null}
            </div>
          );

          if (n.href) {
            return (
              <a
                key={n.id}
                href={n.href}
                onClick={() => {
                  if (isUnread) {
                    void markOne(n.id);
                  }
                }}
                className="block"
              >
                {inner}
              </a>
            );
          }

          return <div key={n.id}>{inner}</div>;
        })}
      </Card>
    </div>
  );
}
