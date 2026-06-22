"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

// ─── Types (server Dates arrive as ISO strings) ────────────────────────────────

export type LogRow = {
  id: string;
  direction: "OUTBOUND" | "INBOUND";
  channel: "SMS" | "VOICE" | "EMAIL" | "TELEGRAM";
  provider: string;
  kind: string;
  status: string;
  toAddress: string;
  fromAddress: string | null;
  body: string | null;
  providerMessageId: string | null;
  errorMessage: string | null;
  cost: string | null;
  payload: unknown;
  createdAt: string;
  updatedAt: string;
};

export type CallbackRow = {
  id: string;
  provider: string;
  channel: string;
  type: string;
  rawPayload: unknown;
  matchedLogId: string | null;
  signatureValid: boolean;
  receivedAt: string;
};

export type Page<T> = { items: T[]; nextCursor: string | null };

export type Stats = {
  windowHours: number;
  outbound: number;
  delivered: number;
  failed: number;
  inbound: number;
};

// ─── Labels & styling ──────────────────────────────────────────────────────────

export const CHANNEL_FA: Record<string, string> = {
  SMS: "پیامک",
  VOICE: "تماس",
  EMAIL: "ایمیل",
  TELEGRAM: "تلگرام",
};

export const STATUS_FA: Record<string, string> = {
  QUEUED: "در صف",
  SENT: "ارسال شد",
  PENDING: "در انتظار",
  DELIVERED: "تحویل شد",
  FAILED: "ناموفق",
  SKIPPED: "رد شد",
  RECEIVED: "دریافت شد",
  UNDELIVERED: "تحویل نشد",
};

export const KIND_FA: Record<string, string> = {
  OTP: "کد ورود",
  ORDER_CODES: "کد سفارش",
  NOTIFICATION: "اعلان",
  INBOUND: "دریافتی",
  TEST: "تست",
  OTHER: "سایر",
};

export function statusVariant(status: string): "default" | "secondary" | "destructive" | "outline" {
  if (status === "DELIVERED" || status === "SENT" || status === "RECEIVED") return "default";
  if (status === "FAILED" || status === "UNDELIVERED") return "destructive";
  if (status === "SKIPPED") return "outline";
  return "secondary";
}

export function fmt(iso: string): string {
  try {
    return new Date(iso).toLocaleString("fa-IR", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

// ─── Shared widgets ──────────────────────────────────────────────────────────

export function StatCards({ stats }: { stats: Stats }) {
  const cards = [
    { label: "ارسالی (۲۴ساعت)", value: stats.outbound, tone: "" },
    { label: "تحویل‌شده", value: stats.delivered, tone: "text-emerald-500" },
    { label: "ناموفق", value: stats.failed, tone: "text-destructive" },
    { label: "دریافتی", value: stats.inbound, tone: "text-sky-500" },
  ];
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {cards.map((c) => (
        <div key={c.label} className="rounded-2xl border border-border p-4">
          <p className="text-xs text-muted-foreground">{c.label}</p>
          <p className={`mt-1 text-2xl font-black ${c.tone}`}>{c.value.toLocaleString("fa-IR")}</p>
        </div>
      ))}
    </div>
  );
}

export function NativeSelect({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: [string, string][];
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="h-9 rounded-xl border border-border bg-muted/30 px-2 text-sm focus:border-gold/50 focus:outline-none"
    >
      {options.map(([v, label]) => (
        <option key={v} value={v}>
          {label}
        </option>
      ))}
    </select>
  );
}

export function LoadMore({
  cursor,
  loading,
  onClick,
  empty,
}: {
  cursor: string | null;
  loading: boolean;
  onClick: () => void;
  empty: boolean;
}) {
  if (empty && !loading) {
    return <p className="py-6 text-center text-sm text-muted-foreground">موردی یافت نشد.</p>;
  }
  if (!cursor) return null;
  return (
    <div className="flex justify-center">
      <Button type="button" variant="outline" size="sm" onClick={onClick} disabled={loading}>
        {loading ? "در حال بارگذاری…" : "موارد بیشتر"}
      </Button>
    </div>
  );
}

export { Badge };
