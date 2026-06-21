"use client";

import { BellIcon, Loader2Icon, SendIcon, UserIcon, UsersIcon } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toFaNumber } from "@/lib/format";
import { cn } from "@/lib/utils";

/** Client-safe label map (the account lib pulls in the DB, so don't import it here). */
const NOTIFICATION_TYPE_LABELS: Record<string, string> = {
  ORDER: "سفارش",
  PAYMENT: "پرداخت",
  PROMO: "پیشنهاد ویژه",
  SYSTEM: "سیستمی",
  SECURITY: "امنیتی",
};

function notificationTypeLabel(type: string): string {
  return NOTIFICATION_TYPE_LABELS[type] ?? type;
}

// ─── Types ────────────────────────────────────────────────────────────────────

type BroadcastType = "PROMO" | "SYSTEM";
type Target = "user" | "all";

type AdminNotification = {
  id: string;
  userId: string;
  recipient: string;
  userPhone: string | null;
  type: string;
  titleFa: string;
  bodyFa: string | null;
  href: string | null;
  readAt: string | null;
  createdAt: string;
};

type Pagination = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

type ListData = {
  notifications: AdminNotification[];
  pagination: Pagination;
};

// ─── Helpers ────────────────────────────────────────────────────────────────────

const FA_DATETIME = new Intl.DateTimeFormat("fa-IR", {
  year: "numeric",
  month: "short",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

function formatDateTime(value: string) {
  return FA_DATETIME.format(new Date(value));
}

const fieldClass =
  "h-10 w-full rounded-2xl border border-border bg-input/50 px-3 text-sm outline-none transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30";

// ─── Main component ─────────────────────────────────────────────────────────────

export function NotificationManagement({ initialData }: { initialData: ListData }) {
  const [notifications, setNotifications] = useState(initialData.notifications);
  const [pagination, setPagination] = useState(initialData.pagination);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);

  // Compose form state.
  const [target, setTarget] = useState<Target>("user");
  const [userId, setUserId] = useState("");
  const [type, setType] = useState<BroadcastType>("PROMO");
  const [titleFa, setTitleFa] = useState("");
  const [bodyFa, setBodyFa] = useState("");
  const [href, setHref] = useState("");
  const [sending, setSending] = useState(false);

  const firstRender = useRef(true);

  const fetchList = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/notifications?page=${page}`);
      const json = await res.json();
      if (!json.ok) {
        toast.error(json.error?.message ?? "بارگذاری فهرست انجام نشد.");
        return;
      }
      setNotifications(json.data.notifications);
      setPagination(json.data.pagination);
    } catch {
      toast.error("خطا در ارتباط با سرور.");
    } finally {
      setLoading(false);
    }
  }, [page]);

  // Refetch on page change (skip first render — initial data is server-rendered).
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    fetchList();
  }, [fetchList]);

  async function send() {
    if (target === "user" && !userId.trim()) {
      toast.error("شناسه کاربر را وارد کنید.");
      return;
    }
    if (!titleFa.trim()) {
      toast.error("عنوان اعلان الزامی است.");
      return;
    }

    setSending(true);
    try {
      const res = await fetch("/api/admin/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          target,
          userId: target === "user" ? userId.trim() : undefined,
          type,
          titleFa: titleFa.trim(),
          bodyFa: bodyFa.trim() || undefined,
          href: href.trim() || undefined,
        }),
      });
      const json = await res.json();
      if (!json.ok) {
        toast.error(json.error?.message ?? "ارسال اعلان انجام نشد.");
        return;
      }

      const sent = Number(json.data?.sent ?? 0);
      toast.success(`اعلان برای ${toFaNumber(sent)} کاربر ارسال شد.`);
      setTitleFa("");
      setBodyFa("");
      setHref("");
      if (target === "user") {
        setUserId("");
      }

      // Refresh the audit list (reset to page 1 to surface the new rows).
      if (page === 1) {
        await fetchList();
      } else {
        setPage(1);
      }
    } catch {
      toast.error("خطا در ارتباط با سرور.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="grid gap-6" dir="rtl">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-black">
            <BellIcon className="size-5" />
            اعلان‌ها
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            ارسال اعلان به یک کاربر یا همه کاربران
          </p>
        </div>
        {loading && <Loader2Icon className="size-4 animate-spin text-muted-foreground" />}
      </div>

      {/* ── Compose form ──────────────────────────────────────────── */}
      <section className="rounded-2xl border border-border bg-card p-4">
        <h2 className="text-base font-black">اعلان جدید</h2>

        <div className="mt-4 grid gap-4">
          {/* Target radios */}
          <div>
            <span className="mb-1.5 block text-sm font-bold">مخاطب</span>
            <div className="flex flex-wrap gap-2">
              <TargetOption
                label="یک کاربر"
                icon={UserIcon}
                active={target === "user"}
                onClick={() => setTarget("user")}
              />
              <TargetOption
                label="همه کاربران"
                icon={UsersIcon}
                active={target === "all"}
                onClick={() => setTarget("all")}
              />
            </div>
          </div>

          {target === "user" && (
            <Field label="شناسه کاربر (UUID)">
              <input
                value={userId}
                onChange={(event) => setUserId(event.target.value)}
                placeholder="00000000-0000-0000-0000-000000000000"
                dir="ltr"
                className={cn(fieldClass, "font-mono text-xs")}
              />
            </Field>
          )}

          <div className="grid gap-4 md:grid-cols-2">
            <Field label="نوع اعلان">
              <select
                value={type}
                onChange={(event) => setType(event.target.value as BroadcastType)}
                className={fieldClass}
              >
                <option value="PROMO">پیشنهاد ویژه</option>
                <option value="SYSTEM">سیستمی</option>
              </select>
            </Field>

            <Field label="پیوند" hint="اختیاری">
              <input
                value={href}
                onChange={(event) => setHref(event.target.value)}
                placeholder="/products/..."
                dir="ltr"
                className={fieldClass}
              />
            </Field>
          </div>

          <Field label="عنوان">
            <input
              value={titleFa}
              onChange={(event) => setTitleFa(event.target.value)}
              placeholder="عنوان اعلان"
              className={fieldClass}
            />
          </Field>

          <Field label="متن" hint="اختیاری">
            <textarea
              value={bodyFa}
              onChange={(event) => setBodyFa(event.target.value)}
              placeholder="متن اعلان"
              rows={3}
              className={cn(fieldClass, "h-auto py-2 leading-6")}
            />
          </Field>
        </div>

        <Button className="mt-4 font-black" onClick={send} disabled={sending}>
          {sending ? (
            <Loader2Icon className="size-4 animate-spin" />
          ) : (
            <SendIcon className="size-4" />
          )}
          {target === "all" ? "ارسال به همه" : "ارسال اعلان"}
        </Button>
      </section>

      {/* ── Recent sent table ─────────────────────────────────────── */}
      <section className="overflow-hidden rounded-2xl border border-border bg-card">
        <div className="border-b border-border p-4">
          <h2 className="text-base font-black">اعلان‌های ارسال‌شده اخیر</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {toFaNumber(pagination.total)} اعلان · صفحه {toFaNumber(pagination.page)} از{" "}
            {toFaNumber(pagination.totalPages)}
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="bg-muted/50 text-xs text-muted-foreground">
              <tr className="[&>th]:p-3 [&>th]:text-start [&>th]:font-bold">
                <th>گیرنده</th>
                <th>نوع</th>
                <th>عنوان</th>
                <th>وضعیت</th>
                <th>تاریخ ارسال</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {notifications.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-muted-foreground">
                    هنوز اعلانی ارسال نشده است.
                  </td>
                </tr>
              ) : (
                notifications.map((item) => (
                  <tr key={item.id} className="[&>td]:p-3 [&>td]:align-top">
                    <td>
                      <div className="font-medium">{item.recipient}</div>
                      {item.userPhone && (
                        <div className="font-mono text-xs text-muted-foreground" dir="ltr">
                          {item.userPhone}
                        </div>
                      )}
                    </td>
                    <td>
                      <Badge variant="secondary">{notificationTypeLabel(item.type)}</Badge>
                    </td>
                    <td>
                      <div className="font-medium">{item.titleFa}</div>
                      {item.bodyFa && (
                        <div className="mt-0.5 max-w-[280px] truncate text-xs text-muted-foreground">
                          {item.bodyFa}
                        </div>
                      )}
                    </td>
                    <td>
                      {item.readAt ? (
                        <Badge variant="outline">خوانده‌شده</Badge>
                      ) : (
                        <Badge variant="default">خوانده‌نشده</Badge>
                      )}
                    </td>
                    <td className="whitespace-nowrap text-xs text-muted-foreground">
                      {formatDateTime(item.createdAt)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {pagination.totalPages > 1 && (
          <div className="flex items-center justify-between gap-2 border-t border-border p-3">
            <Button
              variant="outline"
              size="sm"
              disabled={pagination.page <= 1 || loading}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              قبلی
            </Button>
            <span className="text-xs text-muted-foreground">
              صفحه {toFaNumber(pagination.page)} از {toFaNumber(pagination.totalPages)}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={pagination.page >= pagination.totalPages || loading}
              onClick={() => setPage((p) => p + 1)}
            >
              بعدی
            </Button>
          </div>
        )}
      </section>
    </div>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────────────

function TargetOption({
  label,
  icon: Icon,
  active,
  onClick,
}: {
  label: string;
  icon: React.ElementType;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex items-center gap-2 rounded-2xl border px-4 py-2 text-sm font-bold transition-colors",
        active
          ? "border-primary bg-primary/10 text-foreground"
          : "border-border bg-background text-muted-foreground hover:bg-muted",
      )}
    >
      <Icon className="size-4" />
      {label}
    </button>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="block">
      <span className="mb-1.5 flex items-center gap-1.5 text-sm font-bold">
        {label}
        {hint && <span className="text-xs font-normal text-muted-foreground">({hint})</span>}
      </span>
      {children}
    </div>
  );
}
