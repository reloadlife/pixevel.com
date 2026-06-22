"use client";

import { Fragment, useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { SettingsManagement } from "@/components/admin/settings-management";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

// ─── Types (server Dates arrive as ISO strings) ────────────────────────────────

type LogRow = {
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

type CallbackRow = {
  id: string;
  provider: string;
  channel: string;
  type: string;
  rawPayload: unknown;
  matchedLogId: string | null;
  signatureValid: boolean;
  receivedAt: string;
};

type Page<T> = { items: T[]; nextCursor: string | null };

type SettingRow = {
  key: string;
  label: string;
  group: string;
  secret: boolean;
  hint?: string;
  value: string;
  isSet: boolean;
  source: "db" | "env" | "default" | "unset";
};

type Stats = {
  windowHours: number;
  outbound: number;
  delivered: number;
  failed: number;
  inbound: number;
};

type Tab = "logs" | "calls" | "callbacks" | "settings";

// ─── Labels & styling ──────────────────────────────────────────────────────────

const CHANNEL_FA: Record<string, string> = {
  SMS: "پیامک",
  VOICE: "تماس",
  EMAIL: "ایمیل",
  TELEGRAM: "تلگرام",
};

const STATUS_FA: Record<string, string> = {
  QUEUED: "در صف",
  SENT: "ارسال شد",
  PENDING: "در انتظار",
  DELIVERED: "تحویل شد",
  FAILED: "ناموفق",
  SKIPPED: "رد شد",
  RECEIVED: "دریافت شد",
  UNDELIVERED: "تحویل نشد",
};

const KIND_FA: Record<string, string> = {
  OTP: "کد ورود",
  ORDER_CODES: "کد سفارش",
  NOTIFICATION: "اعلان",
  INBOUND: "دریافتی",
  TEST: "تست",
  OTHER: "سایر",
};

function statusVariant(status: string): "default" | "secondary" | "destructive" | "outline" {
  if (status === "DELIVERED" || status === "SENT" || status === "RECEIVED") return "default";
  if (status === "FAILED" || status === "UNDELIVERED") return "destructive";
  if (status === "SKIPPED") return "outline";
  return "secondary";
}

function fmt(iso: string): string {
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

// ─── Main ──────────────────────────────────────────────────────────────────────

export function CommunicationsDashboard({
  initialLogs,
  initialCallbacks,
  stats,
  settings,
}: {
  initialLogs: Page<LogRow>;
  initialCallbacks: Page<CallbackRow>;
  stats: Stats;
  settings: SettingRow[];
}) {
  const [tab, setTab] = useState<Tab>("logs");

  return (
    <div className="grid gap-5">
      <StatCards stats={stats} />

      <div className="flex flex-wrap gap-1 rounded-2xl border border-border bg-muted/30 p-1">
        {(
          [
            ["logs", "همه پیام‌ها"],
            ["calls", "تماس‌ها"],
            ["callbacks", "کال‌بک‌ها"],
            ["settings", "تنظیمات و توکن‌ها"],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            onClick={() => setTab(value)}
            className={`flex-1 rounded-xl px-3 py-2 text-sm font-bold transition ${
              tab === value
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "logs" ? <LogsTab initial={initialLogs} /> : null}
      {tab === "calls" ? (
        <LogsTab initial={{ items: [], nextCursor: null }} fixedChannel="VOICE" />
      ) : null}
      {tab === "callbacks" ? <CallbacksTab initial={initialCallbacks} /> : null}
      {tab === "settings" ? <SettingsTab settings={settings} /> : null}
    </div>
  );
}

function StatCards({ stats }: { stats: Stats }) {
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

// ─── Logs / Calls ───────────────────────────────────────────────────────────────

function LogsTab({
  initial,
  fixedChannel,
}: {
  initial: Page<LogRow>;
  fixedChannel?: LogRow["channel"];
}) {
  const [items, setItems] = useState<LogRow[]>(initial.items);
  const [cursor, setCursor] = useState<string | null>(initial.nextCursor);
  const [loading, setLoading] = useState(false);
  const [q, setQ] = useState("");
  const [channel, setChannel] = useState<string>(fixedChannel ?? "");
  const [direction, setDirection] = useState<string>("");
  const [status, setStatus] = useState<string>("");
  const [expanded, setExpanded] = useState<string | null>(null);

  const load = useCallback(
    async (reset: boolean) => {
      setLoading(true);
      try {
        const sp = new URLSearchParams();
        if (fixedChannel) sp.set("channel", fixedChannel);
        else if (channel) sp.set("channel", channel);
        if (direction) sp.set("direction", direction);
        if (status) sp.set("status", status);
        if (q.trim()) sp.set("q", q.trim());
        if (!reset && cursor) sp.set("cursor", cursor);
        const res = await fetch(`/api/admin/comms/logs?${sp.toString()}`);
        const payload = await res.json();
        if (!payload.ok) {
          toast.error(payload.error?.message ?? "خطا در دریافت گزارش‌ها.");
          return;
        }
        const page = payload.data as Page<LogRow>;
        setItems((prev) => (reset ? page.items : [...prev, ...page.items]));
        setCursor(page.nextCursor);
      } finally {
        setLoading(false);
      }
    },
    [channel, direction, status, q, cursor, fixedChannel],
  );

  // Calls tab loads on mount; Logs tab is seeded from the server.
  // biome-ignore lint/correctness/useExhaustiveDependencies: load once when the fixed channel mounts
  useEffect(() => {
    if (fixedChannel) load(true);
  }, [fixedChannel]);

  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && load(true)}
          placeholder="جستجو شماره / ایمیل"
          dir="ltr"
          className="h-9 max-w-48"
        />
        {!fixedChannel ? (
          <NativeSelect
            value={channel}
            onChange={setChannel}
            options={[
              ["", "همه کانال‌ها"],
              ["SMS", "پیامک"],
              ["VOICE", "تماس"],
              ["EMAIL", "ایمیل"],
              ["TELEGRAM", "تلگرام"],
            ]}
          />
        ) : null}
        <NativeSelect
          value={direction}
          onChange={setDirection}
          options={[
            ["", "هر دو جهت"],
            ["OUTBOUND", "ارسالی"],
            ["INBOUND", "دریافتی"],
          ]}
        />
        <NativeSelect
          value={status}
          onChange={setStatus}
          options={[["", "هر وضعیت"], ...Object.entries(STATUS_FA)]}
        />
        <Button type="button" size="sm" onClick={() => load(true)} disabled={loading}>
          اعمال
        </Button>
      </div>

      <LogTable items={items} expanded={expanded} setExpanded={setExpanded} />

      <LoadMore
        cursor={cursor}
        loading={loading}
        onClick={() => load(false)}
        empty={items.length === 0}
      />
    </div>
  );
}

function LogTable({
  items,
  expanded,
  setExpanded,
}: {
  items: LogRow[];
  expanded: string | null;
  setExpanded: (id: string | null) => void;
}) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-border">
      <table className="w-full text-right text-sm">
        <thead className="bg-muted/40 text-xs text-muted-foreground">
          <tr>
            <th className="p-2 font-medium">زمان</th>
            <th className="p-2 font-medium">جهت</th>
            <th className="p-2 font-medium">کانال</th>
            <th className="p-2 font-medium">نوع</th>
            <th className="p-2 font-medium">گیرنده/فرستنده</th>
            <th className="p-2 font-medium">وضعیت</th>
            <th className="p-2 font-medium">پیام</th>
          </tr>
        </thead>
        <tbody>
          {items.map((r) => (
            <Fragment key={r.id}>
              <tr
                className="cursor-pointer border-t border-border hover:bg-muted/20"
                onClick={() => setExpanded(expanded === r.id ? null : r.id)}
              >
                <td className="whitespace-nowrap p-2 text-xs text-muted-foreground">
                  {fmt(r.createdAt)}
                </td>
                <td className="p-2 text-xs">{r.direction === "INBOUND" ? "دریافتی" : "ارسالی"}</td>
                <td className="p-2 text-xs">{CHANNEL_FA[r.channel] ?? r.channel}</td>
                <td className="p-2 text-xs">{KIND_FA[r.kind] ?? r.kind}</td>
                <td className="p-2 font-mono text-xs" dir="ltr">
                  {r.direction === "INBOUND" ? (r.fromAddress ?? "—") : r.toAddress}
                </td>
                <td className="p-2">
                  <Badge variant={statusVariant(r.status)}>{STATUS_FA[r.status] ?? r.status}</Badge>
                </td>
                <td className="max-w-40 truncate p-2 text-xs text-muted-foreground">
                  {r.errorMessage ?? r.body ?? "—"}
                </td>
              </tr>
              {expanded === r.id ? (
                <tr key={`${r.id}-x`} className="border-t border-border bg-muted/10">
                  <td colSpan={7} className="p-3">
                    <div className="grid gap-1 text-xs" dir="ltr">
                      <div>provider: {r.provider}</div>
                      {r.providerMessageId ? <div>messageId: {r.providerMessageId}</div> : null}
                      {r.cost ? <div>cost: {r.cost}</div> : null}
                      <pre className="mt-1 max-h-60 overflow-auto rounded-lg bg-background p-2">
                        {JSON.stringify(r.payload, null, 2)}
                      </pre>
                    </div>
                  </td>
                </tr>
              ) : null}
            </Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Callbacks ──────────────────────────────────────────────────────────────────

function CallbacksTab({ initial }: { initial: Page<CallbackRow> }) {
  const [items, setItems] = useState<CallbackRow[]>(initial.items);
  const [cursor, setCursor] = useState<string | null>(initial.nextCursor);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const sp = new URLSearchParams();
      if (cursor) sp.set("cursor", cursor);
      const res = await fetch(`/api/admin/comms/callbacks?${sp.toString()}`);
      const payload = await res.json();
      if (!payload.ok) {
        toast.error(payload.error?.message ?? "خطا در دریافت کال‌بک‌ها.");
        return;
      }
      const page = payload.data as Page<CallbackRow>;
      setItems((prev) => [...prev, ...page.items]);
      setCursor(page.nextCursor);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grid gap-3">
      <div className="overflow-x-auto rounded-2xl border border-border">
        <table className="w-full text-right text-sm">
          <thead className="bg-muted/40 text-xs text-muted-foreground">
            <tr>
              <th className="p-2 font-medium">زمان</th>
              <th className="p-2 font-medium">ارائه‌دهنده</th>
              <th className="p-2 font-medium">نوع</th>
              <th className="p-2 font-medium">تطبیق</th>
              <th className="p-2 font-medium">امضا</th>
            </tr>
          </thead>
          <tbody>
            {items.map((c) => (
              <Fragment key={c.id}>
                <tr
                  className="cursor-pointer border-t border-border hover:bg-muted/20"
                  onClick={() => setExpanded(expanded === c.id ? null : c.id)}
                >
                  <td className="whitespace-nowrap p-2 text-xs text-muted-foreground">
                    {fmt(c.receivedAt)}
                  </td>
                  <td className="p-2 text-xs">{c.provider}</td>
                  <td className="p-2 text-xs">
                    {c.type === "inbound" ? "دریافتی" : "وضعیت تحویل"}
                  </td>
                  <td className="p-2 text-xs">{c.matchedLogId ? "✓" : "—"}</td>
                  <td className="p-2">
                    <Badge variant={c.signatureValid ? "default" : "destructive"}>
                      {c.signatureValid ? "معتبر" : "نامعتبر"}
                    </Badge>
                  </td>
                </tr>
                {expanded === c.id ? (
                  <tr key={`${c.id}-x`} className="border-t border-border bg-muted/10">
                    <td colSpan={5} className="p-3">
                      <pre
                        className="max-h-60 overflow-auto rounded-lg bg-background p-2 text-xs"
                        dir="ltr"
                      >
                        {JSON.stringify(c.rawPayload, null, 2)}
                      </pre>
                    </td>
                  </tr>
                ) : null}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
      <LoadMore cursor={cursor} loading={loading} onClick={load} empty={items.length === 0} />
    </div>
  );
}

// ─── Settings + test send ────────────────────────────────────────────────────────

function SettingsTab({ settings }: { settings: SettingRow[] }) {
  return (
    <div className="grid gap-6">
      <TestSmsForm />
      <SettingsManagement initialSettings={settings} />
    </div>
  );
}

function TestSmsForm() {
  const [phone, setPhone] = useState("");
  const [text, setText] = useState("پیام تست پیکسوِل");
  const [sending, setSending] = useState(false);

  async function send() {
    setSending(true);
    try {
      const res = await fetch("/api/admin/comms/test", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ phone, text }),
      });
      const payload = await res.json();
      if (payload.ok) {
        toast.success(`وضعیت: ${payload.data.status} — ${payload.data.message}`);
      } else {
        toast.error(payload.error?.message ?? "ارسال ناموفق بود.");
      }
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="rounded-2xl border border-border p-4">
      <h3 className="mb-3 text-sm font-black text-gold">ارسال پیامک تست</h3>
      <div className="flex flex-wrap items-center gap-2">
        <Input
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="09xxxxxxxxx"
          dir="ltr"
          className="h-9 max-w-44"
        />
        <Input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="متن پیام"
          className="h-9 flex-1 min-w-48"
        />
        <Button type="button" size="sm" onClick={send} disabled={sending || !phone || !text}>
          ارسال
        </Button>
      </div>
      <p className="mt-2 text-[11px] text-muted-foreground">
        از کاوه‌نگار ارسال می‌شود و در گزارش‌ها با نوع «تست» ثبت می‌شود.
      </p>
    </div>
  );
}

// ─── Shared bits ──────────────────────────────────────────────────────────────

function NativeSelect({
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

function LoadMore({
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
