"use client";

import { Fragment, useState } from "react";
import { toast } from "sonner";

import { Badge, type CallbackRow, fmt, LoadMore, type Page } from "./shared";

export function CallbacksView({ initial }: { initial: Page<CallbackRow> }) {
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
                  <tr className="border-t border-border bg-muted/10">
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
