"use client";

import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

type Row = {
  key: string;
  label: string;
  group: string;
  secret: boolean;
  hint?: string;
  value: string;
  isSet: boolean;
  source: "db" | "env" | "default" | "unset";
  choices?: string[];
};

const GROUP_LABELS: Record<string, string> = {
  sms: "پیامک و کد یکبارمصرف",
  email: "ایمیل",
  payments: "درگاه‌های پرداخت",
  domains: "دامنه",
  servers: "سرور",
  general: "عمومی",
};

const SOURCE_LABELS: Record<Row["source"], string> = {
  db: "تنظیم‌شده",
  env: "از env",
  default: "پیش‌فرض",
  unset: "خالی",
};

export function SettingsManagement({ initialSettings }: { initialSettings: Row[] }) {
  const [rows, setRows] = useState<Row[]>(initialSettings);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [savingKey, setSavingKey] = useState<string | null>(null);

  const groups = [...new Set(rows.map((r) => r.group))];

  async function save(key: string, value: string | null) {
    setSavingKey(key);
    try {
      const res = await fetch("/api/admin/settings", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ key, value }),
      });
      const payload = await res.json();
      if (payload.ok) {
        setRows(payload.data.settings);
        setDrafts((d) => {
          const next = { ...d };
          delete next[key];
          return next;
        });
        toast.success("ذخیره شد.");
      } else {
        toast.error(payload.error?.message ?? "ذخیره ناموفق بود.");
      }
    } finally {
      setSavingKey(null);
    }
  }

  return (
    <div className="space-y-8" dir="rtl">
      {groups.map((group) => (
        <section key={group}>
          <h3 className="mb-3 text-sm font-black text-gold">{GROUP_LABELS[group] ?? group}</h3>
          <div className="overflow-hidden rounded-2xl border border-border">
            {rows
              .filter((r) => r.group === group)
              .map((row) => {
                const draft = drafts[row.key];
                const dirty =
                  draft !== undefined &&
                  (draft !== row.value || (!!row.choices && row.value === ""));
                return (
                  <div
                    key={row.key}
                    className="flex flex-col gap-2 border-b border-border p-3 last:border-b-0 sm:flex-row sm:items-center"
                  >
                    <div className="min-w-0 sm:w-64">
                      <p className="truncate text-sm font-bold">{row.label}</p>
                      <p className="font-mono text-[11px] text-muted-foreground" dir="ltr">
                        {row.key}
                      </p>
                      {row.hint ? (
                        <p className="mt-0.5 text-[11px] text-muted-foreground">{row.hint}</p>
                      ) : null}
                    </div>
                    <div className="flex flex-1 items-center gap-2">
                      {row.choices ? (
                        <select
                          value={draft ?? row.value}
                          onChange={(e) => setDrafts((d) => ({ ...d, [row.key]: e.target.value }))}
                          dir="ltr"
                          className="h-10 flex-1 rounded-xl border border-border bg-muted/30 px-3 text-sm focus:border-gold/50 focus:outline-none"
                        >
                          {row.choices.map((c) => (
                            <option key={c} value={c}>
                              {c}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <input
                          type={row.secret ? "password" : "text"}
                          defaultValue={row.value}
                          value={draft ?? row.value}
                          onChange={(e) => setDrafts((d) => ({ ...d, [row.key]: e.target.value }))}
                          placeholder={
                            row.secret
                              ? row.isSet
                                ? "•••••••• (تنظیم‌شده — برای تغییر وارد کنید)"
                                : "تنظیم نشده"
                              : `پیش‌فرض/${SOURCE_LABELS[row.source]}`
                          }
                          dir="ltr"
                          className="h-10 flex-1 rounded-xl border border-border bg-muted/30 px-3 text-sm focus:border-gold/50 focus:outline-none"
                        />
                      )}
                      <span className="hidden shrink-0 rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold text-muted-foreground sm:inline">
                        {SOURCE_LABELS[row.source]}
                      </span>
                      <Button
                        type="button"
                        size="sm"
                        disabled={savingKey === row.key || (!dirty && !(row.secret && draft))}
                        onClick={() => save(row.key, draft ?? row.value)}
                      >
                        ذخیره
                      </Button>
                      {row.source === "db" ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={savingKey === row.key}
                          onClick={() => save(row.key, null)}
                        >
                          حذف
                        </Button>
                      ) : null}
                    </div>
                  </div>
                );
              })}
          </div>
        </section>
      ))}
    </div>
  );
}
