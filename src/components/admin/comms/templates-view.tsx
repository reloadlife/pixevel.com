"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { AdminTemplateCell, AdminTemplateEvent } from "@/lib/admin/comm-templates";
import { Badge, CHANNEL_FA } from "./shared";

const SAMPLE: Record<string, string> = {
  order_number: "PX-1024",
  customer_name: "کاربر نمونه",
  total: "۲۵۰٬۰۰۰ تومان",
  status: "پرداخت‌شده",
  href: "/account/orders/1024",
  codes: "ABCD-1234-EFGH\nIJKL-5678-MNOP",
  codes_count: "۲",
  tracking: "TRK-99887766",
  amount: "۱۰۰٬۰۰۰ تومان",
  ticket_id: "T-501",
  ticket_subject: "مشکل در پرداخت",
};

function preview(text: string): string {
  return text.replace(/\{(\w+)\}/g, (_m, k: string) => SAMPLE[k] ?? `{${k}}`);
}

const cellKey = (c: { eventKey: string; channel: string }) => `${c.eventKey}:${c.channel}`;

export function TemplatesView({ initialEvents }: { initialEvents: AdminTemplateEvent[] }) {
  const [events, setEvents] = useState(initialEvents);
  const [editing, setEditing] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function send(payload: Record<string, unknown>): Promise<boolean> {
    setBusy(true);
    try {
      const res = await fetch("/api/admin/comms/templates", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!json.ok) {
        toast.error(json.error?.message ?? "ذخیره ناموفق بود.");
        return false;
      }
      setEvents(json.data.events as AdminTemplateEvent[]);
      toast.success("ذخیره شد.");
      return true;
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-5" dir="rtl">
      <p className="text-sm text-muted-foreground">
        متن هر رویداد را برای هر کانال ویرایش کنید. متغیرها داخل{" "}
        <code className="rounded bg-muted px-1">{"{}"}</code> قرار می‌گیرند و هنگام ارسال جایگزین
        می‌شوند. «بازنشانی» متن را به حالت پیش‌فرض برمی‌گرداند.
      </p>

      {events.map((ev) => (
        <section key={ev.key} className="rounded-2xl border border-border p-4">
          <header className="mb-3 flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-black">{ev.labelFa}</h3>
            <span className="font-mono text-[10px] text-muted-foreground" dir="ltr">
              {ev.key}
            </span>
          </header>
          <div className="mb-3 flex flex-wrap gap-1">
            {ev.variables.map((v) => (
              <code
                key={v}
                className="rounded-md bg-muted/60 px-1.5 py-0.5 text-[10px] text-muted-foreground"
                dir="ltr"
              >{`{${v}}`}</code>
            ))}
          </div>

          <div className="grid gap-2">
            {ev.cells.map((cell) => (
              <CellRow
                key={cellKey(cell)}
                cell={cell}
                busy={busy}
                expanded={editing === cellKey(cell)}
                onToggleEdit={() => setEditing(editing === cellKey(cell) ? null : cellKey(cell))}
                onSave={(patch) =>
                  send({ action: "save", eventKey: cell.eventKey, channel: cell.channel, ...patch })
                }
                onToggleEnabled={(enabled) =>
                  send({
                    action: "save",
                    eventKey: cell.eventKey,
                    channel: cell.channel,
                    subject: cell.subject,
                    body: cell.body,
                    bodyText: cell.bodyText,
                    isPattern: cell.isPattern,
                    enabled,
                  })
                }
                onReset={() =>
                  send({ action: "reset", eventKey: cell.eventKey, channel: cell.channel })
                }
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function CellRow({
  cell,
  busy,
  expanded,
  onToggleEdit,
  onSave,
  onToggleEnabled,
  onReset,
}: {
  cell: AdminTemplateCell;
  busy: boolean;
  expanded: boolean;
  onToggleEdit: () => void;
  onSave: (patch: Record<string, unknown>) => Promise<boolean>;
  onToggleEnabled: (enabled: boolean) => void;
  onReset: () => void;
}) {
  return (
    <div className="rounded-xl border border-border/60">
      <div className="flex flex-wrap items-center gap-2 p-2.5">
        <span className="w-24 text-sm font-bold">{CHANNEL_FA[cell.channel] ?? cell.channel}</span>
        <Badge variant={cell.source === "custom" ? "default" : "outline"}>
          {cell.source === "custom" ? "سفارشی" : "پیش‌فرض"}
        </Badge>
        {!cell.enabled ? <Badge variant="destructive">غیرفعال</Badge> : null}
        <span className="flex-1" />
        <Button type="button" size="sm" variant="outline" onClick={onToggleEdit} disabled={busy}>
          {expanded ? "بستن" : "ویرایش"}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={() => onToggleEnabled(!cell.enabled)}
          disabled={busy}
        >
          {cell.enabled ? "غیرفعال‌سازی" : "فعال‌سازی"}
        </Button>
        {cell.source === "custom" ? (
          <Button type="button" size="sm" variant="ghost" onClick={onReset} disabled={busy}>
            بازنشانی
          </Button>
        ) : null}
      </div>
      {expanded ? <CellEditor cell={cell} busy={busy} onSave={onSave} /> : null}
    </div>
  );
}

function CellEditor({
  cell,
  busy,
  onSave,
}: {
  cell: AdminTemplateCell;
  busy: boolean;
  onSave: (patch: Record<string, unknown>) => Promise<boolean>;
}) {
  const [subject, setSubject] = useState(cell.subject ?? "");
  const [body, setBody] = useState(cell.body);
  const [bodyText, setBodyText] = useState(cell.bodyText ?? "");
  const [isPattern, setIsPattern] = useState(cell.isPattern);

  const hasSubject = cell.channel !== "SMS";
  const isEmail = cell.channel === "EMAIL";
  const isSms = cell.channel === "SMS";

  return (
    <div className="grid gap-2 border-t border-border/60 p-3">
      {hasSubject ? (
        <div className="grid gap-1 text-xs">
          <span>{isEmail ? "موضوع ایمیل" : "عنوان"}</span>
          <Input value={subject} onChange={(e) => setSubject(e.target.value)} className="h-9" />
        </div>
      ) : null}

      <label className="grid gap-1 text-xs">
        {isEmail ? "متن HTML ایمیل" : "متن"}
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          dir="rtl"
          rows={isEmail ? 6 : 3}
          className="rounded-xl border border-border bg-muted/30 p-2 font-mono text-xs focus:border-gold/50 focus:outline-none"
        />
      </label>

      {isEmail ? (
        <label className="grid gap-1 text-xs">
          متن ساده (نسخه بدون HTML)
          <textarea
            value={bodyText}
            onChange={(e) => setBodyText(e.target.value)}
            dir="rtl"
            rows={2}
            className="rounded-xl border border-border bg-muted/30 p-2 text-xs focus:border-gold/50 focus:outline-none"
          />
        </label>
      ) : null}

      {isSms ? (
        <label className="flex items-center gap-2 text-xs">
          <input
            type="checkbox"
            checked={isPattern}
            onChange={(e) => setIsPattern(e.target.checked)}
          />
          ارسال از طریق پترن ثبت‌شده ارائه‌دهنده (به‌جای متن آزاد)
        </label>
      ) : null}

      <div className="grid gap-1">
        <span className="text-xs text-muted-foreground">پیش‌نمایش (با داده نمونه):</span>
        {isEmail ? (
          <iframe
            title="preview"
            className="h-40 w-full rounded-xl border border-border bg-white"
            srcDoc={preview(body)}
          />
        ) : (
          <pre
            className="whitespace-pre-wrap rounded-xl border border-border bg-muted/20 p-2 text-xs"
            dir="rtl"
          >
            {(subject ? `${preview(subject)}\n` : "") + preview(body)}
          </pre>
        )}
      </div>

      <div>
        <Button
          type="button"
          size="sm"
          disabled={busy || body.trim() === ""}
          onClick={() =>
            onSave({
              subject: hasSubject ? subject || null : null,
              body,
              bodyText: isEmail ? bodyText || null : null,
              isPattern: isSms ? isPattern : false,
              enabled: cell.enabled,
            })
          }
        >
          ذخیره
        </Button>
      </div>
    </div>
  );
}
