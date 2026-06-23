"use client";

import { Clock } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

// ─── Types ────────────────────────────────────────────────────────────────────

type OrderEventRow = {
  id: string;
  type: string;
  fromStatus: string | null;
  toStatus: string | null;
  noteFa: string | null;
  isCustomerVisible: boolean;
  metadata: unknown;
  createdAt: string;
  author: { id: string; fullName: string | null; phone: string | null } | null;
};

interface Props {
  orderId: string;
  initialEvents?: OrderEventRow[];
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const FA_DATETIME = new Intl.DateTimeFormat("fa-IR", {
  dateStyle: "short",
  timeStyle: "short",
});

function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "—" : FA_DATETIME.format(d);
}

const EVENT_TYPE_LABEL: Record<string, string> = {
  STATUS_CHANGE: "تغییر وضعیت",
  PAYMENT: "پرداخت",
  SHIPMENT: "مرسوله",
  REFUND: "استرداد",
  NOTE: "یادداشت",
  SYSTEM: "سیستمی",
};

const EVENT_TYPE_COLOR: Record<string, string> = {
  STATUS_CHANGE: "bg-blue-100 text-blue-800",
  PAYMENT: "bg-green-100 text-green-800",
  SHIPMENT: "bg-purple-100 text-purple-800",
  REFUND: "bg-red-100 text-red-800",
  NOTE: "bg-zinc-100 text-zinc-700",
  SYSTEM: "bg-zinc-100 text-zinc-500",
};

const STATUS_LABELS: Record<string, string> = {
  PENDING: "در انتظار",
  PAID: "پرداخت‌شده",
  PROCESSING: "در حال پردازش",
  SHIPPED: "ارسال‌شده",
  DELIVERED: "تحویل‌شده",
  CANCELLED: "لغوشده",
  REFUNDED: "مسترد‌شده",
};

function statusLabel(s: string | null | undefined): string {
  if (!s) return "";
  return STATUS_LABELS[s] ?? s;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function OrderTimelinePanel({ orderId, initialEvents = [] }: Props) {
  const [events, setEvents] = useState<OrderEventRow[]>(initialEvents);
  const [loading, setLoading] = useState(false);

  // Fetch events when component mounts (SSR may not have them).
  useEffect(() => {
    if (initialEvents.length > 0) return;
    setLoading(true);
    fetch(`/api/admin/orders/${orderId}/events`)
      .then((r) => r.json())
      .then((json) => {
        if (json.ok) setEvents(json.data.rows ?? []);
      })
      .catch(() => toast.error("خطا در دریافت رویدادها."))
      .finally(() => setLoading(false));
  }, [orderId, initialEvents.length]);

  return (
    <div className="border border-zinc-200 bg-white p-4">
      <h3 className="mb-3 flex items-center gap-1.5 text-sm font-black">
        <Clock className="h-4 w-4" />
        تاریخچه سفارش
      </h3>

      {loading && <p className="text-sm text-zinc-400">در حال بارگذاری...</p>}

      {!loading && events.length === 0 && (
        <p className="text-sm text-zinc-400">رویدادی ثبت نشده.</p>
      )}

      {events.length > 0 && (
        <ol className="relative border-r-2 border-zinc-100 pr-4 space-y-4">
          {events.map((event) => (
            <li key={event.id} className="relative">
              {/* Timeline dot */}
              <span className="absolute -right-[1.15rem] top-0.5 h-3 w-3 rounded-full border-2 border-white bg-zinc-300 ring-2 ring-zinc-100" />

              <div className="flex flex-wrap items-start justify-between gap-1 text-xs">
                <div className="space-y-0.5">
                  {/* Type badge */}
                  <span
                    className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-bold ${
                      EVENT_TYPE_COLOR[event.type] ?? "bg-zinc-100 text-zinc-600"
                    }`}
                  >
                    {EVENT_TYPE_LABEL[event.type] ?? event.type}
                  </span>

                  {/* Status transition */}
                  {(event.fromStatus || event.toStatus) && (
                    <div className="flex items-center gap-1 text-zinc-600">
                      {event.fromStatus && (
                        <span className="rounded bg-zinc-100 px-1 py-0.5">
                          {statusLabel(event.fromStatus)}
                        </span>
                      )}
                      {event.fromStatus && event.toStatus && (
                        <span className="text-zinc-400">←</span>
                      )}
                      {event.toStatus && (
                        <span className="rounded bg-zinc-200 px-1 py-0.5 font-medium">
                          {statusLabel(event.toStatus)}
                        </span>
                      )}
                    </div>
                  )}

                  {/* Note */}
                  {event.noteFa && <p className="text-zinc-700">{event.noteFa}</p>}

                  {/* Author + customer-visible */}
                  <div className="flex flex-wrap items-center gap-1.5 text-zinc-400">
                    <span>{event.author?.fullName ?? event.author?.phone ?? "سیستم"}</span>
                    {event.isCustomerVisible && (
                      <span className="rounded bg-blue-50 px-1 py-px text-[10px] font-bold text-blue-600">
                        قابل رویت مشتری
                      </span>
                    )}
                  </div>
                </div>

                {/* Timestamp */}
                <time className="shrink-0 text-zinc-400">{formatDate(event.createdAt)}</time>
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
