"use client";

import { ArrowRight, Hash, Loader2, Search, Send, User } from "lucide-react";
import { useCallback, useState, useTransition } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { SupportTicketStatus } from "@/db/schema";
import type { AdminTicketDetail, AdminTicketRow, TicketStatusCounts } from "@/lib/admin/support";
import { toFaNumber } from "@/lib/format";
import { cn } from "@/lib/utils";

type TicketListData = {
  tickets: AdminTicketRow[];
  counts: TicketStatusCounts;
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
};

type TabKey = "ALL" | SupportTicketStatus;

const TABS: { key: TabKey; label: string }[] = [
  { key: "OPEN", label: "باز" },
  { key: "PENDING", label: "در انتظار پاسخ" },
  { key: "RESOLVED", label: "حل شده" },
  { key: "CLOSED", label: "بسته شده" },
  { key: "ALL", label: "همه" },
];

const STATUS_BADGE: Record<
  SupportTicketStatus,
  { label: string; variant: "default" | "secondary" | "destructive" | "outline" | "ghost" }
> = {
  OPEN: { label: "باز", variant: "default" },
  PENDING: { label: "در انتظار پاسخ", variant: "outline" },
  RESOLVED: { label: "حل شده", variant: "secondary" },
  CLOSED: { label: "بسته شده", variant: "ghost" },
};

const STATUS_OPTIONS: { value: SupportTicketStatus; label: string }[] = [
  { value: "OPEN", label: "باز" },
  { value: "PENDING", label: "در انتظار پاسخ" },
  { value: "RESOLVED", label: "حل شده" },
  { value: "CLOSED", label: "بسته شده" },
];

const dateFormatter = new Intl.DateTimeFormat("fa-IR", {
  year: "numeric",
  month: "long",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

function formatDate(iso: string) {
  return dateFormatter.format(new Date(iso));
}

export function SupportManagement({ initialData }: { initialData: TicketListData }) {
  const [data, setData] = useState<TicketListData>(initialData);
  const [tab, setTab] = useState<TabKey>("ALL");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [loading, startTransition] = useTransition();

  const [openId, setOpenId] = useState<string | null>(null);
  const [thread, setThread] = useState<AdminTicketDetail | null>(null);
  const [threadLoading, setThreadLoading] = useState(false);
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);
  const [savingStatus, setSavingStatus] = useState(false);

  const refresh = useCallback((activeTab: TabKey, search: string, nextPage: number) => {
    startTransition(async () => {
      const params = new URLSearchParams();
      if (activeTab !== "ALL") {
        params.set("status", activeTab);
      }
      if (search.trim()) {
        params.set("q", search.trim());
      }
      if (nextPage > 1) {
        params.set("page", String(nextPage));
      }
      const qs = params.toString();
      const response = await fetch(`/api/admin/support${qs ? `?${qs}` : ""}`);
      const result = await response.json();

      if (!result.ok) {
        toast.error(result.error?.message ?? "دریافت تیکت‌ها انجام نشد.");
        return;
      }

      setData(result.data as TicketListData);
    });
  }, []);

  function selectTab(next: TabKey) {
    if (next === tab) {
      return;
    }
    setTab(next);
    setPage(1);
    refresh(next, query, 1);
  }

  function submitSearch(event: React.FormEvent) {
    event.preventDefault();
    setPage(1);
    refresh(tab, query, 1);
  }

  function goToPage(next: number) {
    if (next < 1 || next > data.pagination.totalPages || loading) {
      return;
    }
    setPage(next);
    refresh(tab, query, next);
  }

  const openTicket = useCallback(async (id: string) => {
    setOpenId(id);
    setThread(null);
    setReply("");
    setThreadLoading(true);
    const response = await fetch(`/api/admin/support/${id}`);
    const result = await response.json();
    setThreadLoading(false);

    if (!result.ok) {
      toast.error(result.error?.message ?? "دریافت تیکت انجام نشد.");
      setOpenId(null);
      return;
    }

    setThread(result.data.ticket as AdminTicketDetail);
  }, []);

  function closeThread() {
    setOpenId(null);
    setThread(null);
    setReply("");
  }

  async function sendReply(event: React.FormEvent) {
    event.preventDefault();
    if (!openId || !reply.trim() || sending) {
      return;
    }

    setSending(true);
    const response = await fetch(`/api/admin/support/${openId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bodyFa: reply.trim() }),
    });
    const result = await response.json();
    setSending(false);

    if (!result.ok) {
      toast.error(result.error?.message ?? "ارسال پاسخ انجام نشد.");
      return;
    }

    toast.success("پاسخ ارسال شد.");
    setReply("");
    setThread(result.data.ticket as AdminTicketDetail);
    refresh(tab, query, page);
  }

  async function changeStatus(status: SupportTicketStatus) {
    if (!openId || savingStatus || thread?.status === status) {
      return;
    }

    setSavingStatus(true);
    const response = await fetch(`/api/admin/support/${openId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    const result = await response.json();
    setSavingStatus(false);

    if (!result.ok) {
      toast.error(result.error?.message ?? "تغییر وضعیت انجام نشد.");
      return;
    }

    toast.success("وضعیت تیکت به‌روزرسانی شد.");
    setThread(result.data.ticket as AdminTicketDetail);
    refresh(tab, query, page);
  }

  function tabCount(key: TabKey) {
    if (key === "ALL") {
      return data.counts.total;
    }
    return data.counts[key];
  }

  // ─── Thread view ────────────────────────────────────────────────────────────
  if (openId) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" onClick={closeThread}>
          <ArrowRight className="size-4" />
          بازگشت به فهرست تیکت‌ها
        </Button>

        {threadLoading || !thread ? (
          <div className="flex items-center justify-center gap-2 rounded-2xl border border-border bg-card p-10 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            در حال بارگذاری…
          </div>
        ) : (
          <div className="space-y-4">
            <div className="rounded-2xl border border-border bg-card p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h1 className="text-lg font-black">{thread.subjectFa}</h1>
                    <Badge variant={STATUS_BADGE[thread.status].variant}>
                      {STATUS_BADGE[thread.status].label}
                    </Badge>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-1">
                      <User className="size-3.5" />
                      {thread.customer}
                    </span>
                    {thread.userPhone ? <span dir="ltr">{thread.userPhone}</span> : null}
                    {thread.orderNumber ? (
                      <span className="inline-flex items-center gap-1">
                        <Hash className="size-3.5" />
                        سفارش {thread.orderNumber}
                      </span>
                    ) : null}
                    <span>ایجاد: {formatDate(thread.createdAt)}</span>
                  </div>
                </div>

                <label className="flex items-center gap-2 text-xs font-bold">
                  وضعیت
                  <select
                    value={thread.status}
                    disabled={savingStatus}
                    onChange={(event) => changeStatus(event.target.value as SupportTicketStatus)}
                    className="h-8 rounded-2xl border border-border bg-input/50 px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30 disabled:opacity-50"
                  >
                    {STATUS_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </div>

            <ul className="space-y-3">
              {thread.messages.map((message) => (
                <li
                  key={message.id}
                  className={cn("flex flex-col", message.isStaff ? "items-start" : "items-end")}
                >
                  <div
                    className={cn(
                      "max-w-[85%] rounded-2xl border p-3 text-sm",
                      message.isStaff ? "border-primary/30 bg-primary/5" : "border-border bg-card",
                    )}
                  >
                    <div className="mb-1 flex items-center gap-2 text-xs font-bold text-muted-foreground">
                      {message.isStaff ? "پشتیبانی" : thread.customer}
                      <span className="font-normal">{formatDate(message.createdAt)}</span>
                    </div>
                    <p className="whitespace-pre-line text-foreground/90">{message.bodyFa}</p>
                  </div>
                </li>
              ))}
            </ul>

            <form
              onSubmit={sendReply}
              className="space-y-2 rounded-2xl border border-border bg-card p-4"
            >
              <label className="block text-sm font-bold" htmlFor="support-reply">
                پاسخ پشتیبانی
              </label>
              <textarea
                id="support-reply"
                value={reply}
                onChange={(event) => setReply(event.target.value)}
                disabled={sending}
                rows={4}
                placeholder="پاسخ خود را بنویسید…"
                className="min-h-24 w-full min-w-0 rounded-2xl border border-border bg-input/50 px-3 py-2 text-sm outline-none transition-[color,box-shadow] duration-200 placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30 disabled:opacity-50"
              />
              <div className="flex justify-end">
                <Button type="submit" size="sm" disabled={sending || !reply.trim()}>
                  {sending ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Send className="size-4" />
                  )}
                  ارسال پاسخ
                </Button>
              </div>
            </form>
          </div>
        )}
      </div>
    );
  }

  // ─── List view ─────────────────────────────────────────────────────────────
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-black">پشتیبانی</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          تیکت‌های پشتیبانی کاربران را بررسی و پاسخ دهید و وضعیت آن‌ها را مدیریت کنید.
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {TABS.map((item) => (
            <Button
              key={item.key}
              size="sm"
              variant={tab === item.key ? "default" : "outline"}
              disabled={loading}
              onClick={() => selectTab(item.key)}
            >
              {item.label}
              <span
                className={cn(
                  "ms-1 rounded-full px-1.5 text-xs",
                  tab === item.key
                    ? "bg-primary-foreground/20 text-primary-foreground"
                    : "bg-muted text-muted-foreground",
                )}
              >
                {toFaNumber(tabCount(item.key))}
              </span>
            </Button>
          ))}
        </div>

        <form onSubmit={submitSearch} className="flex items-center gap-2">
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="جستجو موضوع، نام یا شماره…"
            className="w-56"
          />
          <Button type="submit" variant="outline" size="icon" disabled={loading}>
            <Search className="size-4" />
          </Button>
        </form>
      </div>

      <div className="rounded-2xl border border-border bg-card">
        {loading ? (
          <div className="flex items-center justify-center gap-2 p-10 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            در حال بارگذاری…
          </div>
        ) : data.tickets.length === 0 ? (
          <div className="p-10 text-center text-sm text-muted-foreground">
            تیکتی برای نمایش وجود ندارد.
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {data.tickets.map((ticket) => {
              const badge = STATUS_BADGE[ticket.status];

              return (
                <li key={ticket.id}>
                  <button
                    type="button"
                    onClick={() => openTicket(ticket.id)}
                    className="flex w-full flex-col gap-2 p-4 text-start transition-colors hover:bg-muted/50"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex min-w-0 items-center gap-2">
                        <span className="truncate text-sm font-bold">{ticket.subjectFa}</span>
                        <Badge variant={badge.variant}>{badge.label}</Badge>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {formatDate(ticket.lastMessageAt)}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                      <span className="inline-flex items-center gap-1">
                        <User className="size-3.5" />
                        {ticket.customer}
                      </span>
                      {ticket.userPhone ? <span dir="ltr">{ticket.userPhone}</span> : null}
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          مجموع {toFaNumber(data.pagination.total)} تیکت
        </p>
        {data.pagination.totalPages > 1 ? (
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={loading || page <= 1}
              onClick={() => goToPage(page - 1)}
            >
              قبلی
            </Button>
            <span className="text-xs text-muted-foreground">
              صفحه {toFaNumber(data.pagination.page)} از {toFaNumber(data.pagination.totalPages)}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={loading || page >= data.pagination.totalPages}
              onClick={() => goToPage(page + 1)}
            >
              بعدی
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
