"use client";

import { Fragment, useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Badge,
  CHANNEL_FA,
  fmt,
  KIND_FA,
  LoadMore,
  type LogRow,
  NativeSelect,
  type Page,
  STATUS_FA,
  statusVariant,
} from "./shared";

export function LogsView({
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

  // The Calls view (fixedChannel) loads on mount; the Logs view is server-seeded.
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
                <tr className="border-t border-border bg-muted/10">
                  <td colSpan={7} className="p-3">
                    <div className="grid gap-1 text-xs" dir="ltr">
                      <div>provider: {r.provider}</div>
                      {r.providerMessageId ? <div>messageId: {r.providerMessageId}</div> : null}
                      {r.cost ? <div>cost: {r.cost}</div> : null}
                      {r.body ? <div>body: {r.body}</div> : null}
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
