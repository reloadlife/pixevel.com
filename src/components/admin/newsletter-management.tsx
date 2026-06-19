"use client";

import { DownloadIcon, Loader2Icon, MailIcon, Trash2Icon } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toFaNumber } from "@/lib/format";
import { cn } from "@/lib/utils";

export type NewsletterSubscriber = {
  id: string;
  email: string;
  isActive: boolean;
  unsubscribedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

const dateFormatter = new Intl.DateTimeFormat("fa-IR", {
  year: "numeric",
  month: "short",
  day: "numeric",
});

function formatDate(value: string) {
  return dateFormatter.format(new Date(value));
}

type Filter = "all" | "active" | "inactive";

export function NewsletterManagement({
  initialSubscribers,
}: {
  initialSubscribers: NewsletterSubscriber[];
}) {
  const [subscribers, setSubscribers] = useState(initialSubscribers);
  const [filter, setFilter] = useState<Filter>("all");
  const [busyId, setBusyId] = useState<string | null>(null);

  const counts = useMemo(() => {
    const active = subscribers.filter((s) => s.isActive).length;
    return { total: subscribers.length, active, inactive: subscribers.length - active };
  }, [subscribers]);

  const visible = useMemo(() => {
    if (filter === "active") return subscribers.filter((s) => s.isActive);
    if (filter === "inactive") return subscribers.filter((s) => !s.isActive);
    return subscribers;
  }, [subscribers, filter]);

  async function toggleActive(subscriber: NewsletterSubscriber) {
    setBusyId(subscriber.id);
    const nextActive = !subscriber.isActive;
    try {
      const response = await fetch("/api/admin/newsletter", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: subscriber.id, isActive: nextActive }),
      });
      const result = await response.json();
      if (!result.ok) {
        toast.error(result.error?.message ?? "بروزرسانی انجام نشد.");
        return;
      }
      setSubscribers((current) =>
        current.map((item) => (item.id === subscriber.id ? result.data.subscriber : item)),
      );
      toast.success(nextActive ? "مشترک دوباره فعال شد." : "اشتراک لغو شد.");
    } catch {
      toast.error("خطا در ارتباط با سرور.");
    } finally {
      setBusyId(null);
    }
  }

  async function remove(subscriber: NewsletterSubscriber) {
    if (!confirm(`حذف «${subscriber.email}» از فهرست خبرنامه؟`)) {
      return;
    }
    setBusyId(subscriber.id);
    try {
      const response = await fetch("/api/admin/newsletter", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: subscriber.id }),
      });
      const result = await response.json();
      if (!result.ok) {
        toast.error(result.error?.message ?? "حذف انجام نشد.");
        return;
      }
      setSubscribers((current) => current.filter((item) => item.id !== subscriber.id));
      toast.success("مشترک حذف شد.");
    } catch {
      toast.error("خطا در ارتباط با سرور.");
    } finally {
      setBusyId(null);
    }
  }

  function exportCsv() {
    const active = subscribers.filter((s) => s.isActive);
    if (active.length === 0) {
      toast.error("مشترک فعالی برای خروجی وجود ندارد.");
      return;
    }

    // Build CSV: header + one email per row. CRLF + BOM so Excel reads UTF-8.
    const header = "email,subscribed_at";
    const rows = active.map((s) => {
      const email = s.email.includes(",") ? `"${s.email}"` : s.email;
      return `${email},${s.createdAt}`;
    });
    const csv = `﻿${[header, ...rows].join("\r\n")}`;

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `newsletter-subscribers-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success(`${toFaNumber(active.length)} ایمیل خروجی گرفته شد.`);
  }

  return (
    <div dir="rtl" className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-3">
        <CountCard title="کل مشترکین" value={counts.total} icon={MailIcon} />
        <CountCard title="فعال" value={counts.active} icon={MailIcon} accent="ok" />
        <CountCard title="لغو شده" value={counts.inactive} icon={MailIcon} accent="muted" />
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <CardTitle className="text-base font-black">مشترکین خبرنامه</CardTitle>
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1 rounded-2xl bg-muted p-0.5">
                <FilterTab label="همه" active={filter === "all"} onClick={() => setFilter("all")} />
                <FilterTab
                  label="فعال"
                  active={filter === "active"}
                  onClick={() => setFilter("active")}
                />
                <FilterTab
                  label="لغو شده"
                  active={filter === "inactive"}
                  onClick={() => setFilter("inactive")}
                />
              </div>
              <Button variant="outline" size="sm" onClick={exportCsv}>
                <DownloadIcon />
                خروجی CSV (فعال‌ها)
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {visible.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">موردی برای نمایش نیست.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-sm">
                <thead className="text-right text-xs font-black text-muted-foreground">
                  <tr className="border-b border-border">
                    <th className="p-2">ایمیل</th>
                    <th className="p-2">وضعیت</th>
                    <th className="p-2">تاریخ عضویت</th>
                    <th className="p-2">عملیات</th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((subscriber) => (
                    <tr
                      key={subscriber.id}
                      className="border-b border-border/60 last:border-0 hover:bg-muted/40"
                    >
                      <td className="p-2 font-mono text-xs" dir="ltr">
                        {subscriber.email}
                      </td>
                      <td className="p-2">
                        <span
                          className={cn(
                            "rounded px-2 py-0.5 text-xs font-bold",
                            subscriber.isActive
                              ? "bg-green-100 text-green-800"
                              : "bg-zinc-100 text-zinc-600",
                          )}
                        >
                          {subscriber.isActive ? "فعال" : "لغو شده"}
                        </span>
                      </td>
                      <td className="p-2 whitespace-nowrap text-xs text-muted-foreground">
                        {formatDate(subscriber.createdAt)}
                      </td>
                      <td className="p-2">
                        <div className="flex flex-wrap gap-1.5">
                          <Button
                            variant="outline"
                            size="xs"
                            disabled={busyId === subscriber.id}
                            onClick={() => toggleActive(subscriber)}
                          >
                            {busyId === subscriber.id ? (
                              <Loader2Icon className="animate-spin" />
                            ) : null}
                            {subscriber.isActive ? "لغو اشتراک" : "فعال‌سازی"}
                          </Button>
                          <Button
                            variant="destructive"
                            size="xs"
                            disabled={busyId === subscriber.id}
                            onClick={() => remove(subscriber)}
                          >
                            <Trash2Icon />
                            حذف
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function FilterTab({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-2xl px-3 py-1 text-xs font-bold transition-colors",
        active ? "bg-background text-foreground shadow-sm" : "text-muted-foreground",
      )}
    >
      {label}
    </button>
  );
}

function CountCard({
  title,
  value,
  icon: Icon,
  accent,
}: {
  title: string;
  value: number;
  icon: React.ElementType;
  accent?: "ok" | "muted";
}) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
          <Icon
            className={cn("h-4 w-4 text-muted-foreground", accent === "ok" && "text-green-600")}
          />
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-black tabular-nums">{toFaNumber(value)}</p>
      </CardContent>
    </Card>
  );
}
