"use client";

import { Loader2, Plus, RotateCcw, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Row = { id: number; value: string };

let rowSeq = 0;
function makeRow(value = ""): Row {
  rowSeq += 1;
  return { id: rowSeq, value };
}

/** Ensures the editable list always has at least two rows to fill in. */
function withMinimumRows(values: string[]): Row[] {
  const rows = values.map((v) => makeRow(v));
  while (rows.length < 2) {
    rows.push(makeRow());
  }
  return rows;
}

export function NameserversForm({
  domainId,
  initial,
}: {
  domainId: string;
  initial: string[] | null;
}) {
  const router = useRouter();
  const [rows, setRows] = useState<Row[]>(() => withMinimumRows(initial ?? []));
  const [pending, setPending] = useState<"save" | "default" | null>(null);

  const usingDefaults = !initial || initial.length === 0;

  function setRow(id: number, value: string) {
    setRows((prev) => prev.map((row) => (row.id === id ? { ...row, value } : row)));
  }

  function addRow() {
    setRows((prev) => [...prev, makeRow()]);
  }

  function removeRow(id: number) {
    setRows((prev) => (prev.length <= 1 ? prev : prev.filter((row) => row.id !== id)));
  }

  function onSaved(registrarPushed: boolean, message: string) {
    if (registrarPushed === false) {
      toast.success(message, { description: "ثبت محلی انجام شد (اتصال به ثبت‌کننده برقرار نیست)." });
    } else {
      toast.success(message);
    }
    router.refresh();
  }

  async function submit(nameservers: string[], kind: "save" | "default") {
    setPending(kind);
    const res = await fetch(`/api/account/domains/${domainId}/nameservers`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nameservers }),
    });
    const json = await res.json().catch(() => null);
    setPending(null);
    if (!res.ok || !json?.ok) {
      toast.error(json?.error?.message ?? "ذخیره نِیم‌سرورها ممکن نشد.");
      return;
    }
    onSaved(
      json.data?.registrarPushed,
      kind === "default" ? "نِیم‌سرورهای پیش‌فرض ثبت‌کننده اعمال شد." : "نِیم‌سرورها ذخیره شد.",
    );
  }

  function save(event: React.FormEvent) {
    event.preventDefault();
    const clean = rows.map((r) => r.value.trim()).filter(Boolean);
    if (clean.length < 2) {
      toast.error("حداقل دو نِیم‌سرور لازم است (یا از پیش‌فرض ثبت‌کننده استفاده کنید).");
      return;
    }
    submit(clean, "save");
  }

  return (
    <section className="space-y-4">
      <div>
        <h2 className="font-black">نِیم‌سرورها</h2>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {usingDefaults
            ? "در حال استفاده از نِیم‌سرورهای پیش‌فرض ثبت‌کننده."
            : "نِیم‌سرورهای سفارشی این دامنه."}
        </p>
      </div>

      <form onSubmit={save} className="space-y-3 rounded-2xl border border-border bg-card p-4">
        <div className="space-y-2">
          {rows.map((row, index) => (
            <div key={row.id} className="flex items-center gap-2">
              <Input
                value={row.value}
                onChange={(e) => setRow(row.id, e.target.value)}
                placeholder={`ns${index + 1}.example.com`}
                dir="ltr"
              />
              <Button
                type="button"
                size="icon-sm"
                variant="ghost"
                onClick={() => removeRow(row.id)}
                disabled={rows.length <= 1}
                aria-label="حذف نِیم‌سرور"
                className="shrink-0 text-destructive hover:text-destructive"
              >
                <Trash2 className="size-3.5" aria-hidden />
              </Button>
            </div>
          ))}
        </div>

        <Button type="button" size="sm" variant="ghost" onClick={addRow} className="gap-1.5">
          <Plus className="size-3.5" aria-hidden />
          افزودن نِیم‌سرور
        </Button>

        <div className="flex flex-wrap gap-2 pt-1">
          <Button type="submit" size="sm" disabled={pending != null} className="gap-1.5">
            {pending === "save" ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : null}
            {pending === "save" ? "در حال ذخیره…" : "ذخیره نِیم‌سرورها"}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={pending != null || usingDefaults}
            onClick={() => submit([], "default")}
            className="gap-1.5"
          >
            {pending === "default" ? (
              <Loader2 className="size-3.5 animate-spin" aria-hidden />
            ) : (
              <RotateCcw className="size-3.5" aria-hidden />
            )}
            استفاده از پیش‌فرض ثبت‌کننده
          </Button>
        </div>
      </form>
    </section>
  );
}
