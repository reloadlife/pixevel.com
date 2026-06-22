"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { CommsProviderCard } from "@/lib/comms/provider-settings";
import { Badge } from "./shared";

export type SettingRow = {
  key: string;
  label: string;
  group: string;
  secret: boolean;
  hint?: string;
  value: string;
  isSet: boolean;
  source: "db" | "env" | "default" | "unset";
  choices?: string[];
  updatedAt?: string;
};

export type ProviderCard = {
  meta: CommsProviderCard;
  rows: SettingRow[];
  configured: boolean;
};

type Props = {
  cards: ProviderCard[];
  routingRows: SettingRow[];
  activeSms: string;
  activeVoice: string;
  appBaseUrl: string;
};

// ─── helpers ──────────────────────────────────────────────────────────────────

/** Inline format validation. Empty is always allowed (means clear/unset). */
function validate(key: string, value: string): string | null {
  if (!value) return null;
  if (key.endsWith("_TIMEOUT_MS")) {
    const n = Number(value);
    if (!Number.isInteger(n) || n <= 0) return "باید عدد صحیح مثبت (میلی‌ثانیه) باشد.";
  }
  if (key.endsWith("_BASE_URL")) {
    try {
      const u = new URL(value);
      if (u.protocol !== "http:" && u.protocol !== "https:") return "آدرس باید http یا https باشد.";
    } catch {
      return "آدرس نامعتبر است.";
    }
  }
  return null;
}

function genSecret(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

function fmtDate(iso?: string): string | null {
  if (!iso) return null;
  try {
    return new Date(iso).toLocaleString("fa-IR", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return null;
  }
}

// ─── main ─────────────────────────────────────────────────────────────────────

export function CommsSettings({ cards, routingRows, activeSms, activeVoice, appBaseUrl }: Props) {
  const initialRows = useMemo(() => {
    const m: Record<string, SettingRow> = {};
    for (const r of routingRows) m[r.key] = r;
    for (const c of cards) for (const r of c.rows) m[r.key] = r;
    return m;
  }, [cards, routingRows]);

  const [rows, setRows] = useState<Record<string, SettingRow>>(initialRows);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});
  const [genSecrets, setGenSecrets] = useState<Record<string, string>>({});

  const liveSms = rows.SMS_PROVIDER?.value || activeSms;
  const liveVoice = rows.VOICE_PROVIDER?.value || activeVoice;

  async function save(key: string, value: string | null) {
    setSavingKey(key);
    try {
      const res = await fetch("/api/admin/settings", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ key, value }),
      });
      const payload = await res.json();
      if (!payload.ok) {
        toast.error(payload.error?.message ?? "ذخیره ناموفق بود.");
        return false;
      }
      const next: Record<string, SettingRow> = {};
      for (const r of payload.data.settings as SettingRow[]) {
        if (rows[r.key]) next[r.key] = r;
      }
      setRows((prev) => ({ ...prev, ...next }));
      setDrafts((d) => {
        const n = { ...d };
        delete n[key];
        return n;
      });
      toast.success("ذخیره شد.");
      return true;
    } finally {
      setSavingKey(null);
    }
  }

  const setDraft = (key: string, v: string) => setDrafts((d) => ({ ...d, [key]: v }));

  const fieldCtx = { rows, drafts, savingKey, revealed, setDraft, save, setRevealed };

  return (
    <div className="grid gap-5">
      <ActiveBanner sms={liveSms} voice={liveVoice} />

      <section className="rounded-2xl border border-border p-4">
        <h3 className="mb-3 text-sm font-black text-gold">مسیر‌دهی ارائه‌دهنده</h3>
        <p className="mb-3 text-xs text-muted-foreground">
          کدام ارائه‌دهنده برای پیامک و کدام برای تماس صوتی استفاده شود.
        </p>
        <div className="grid gap-2">
          {routingRows.map((r) => (
            <Field key={r.key} row={rows[r.key] ?? r} {...fieldCtx} />
          ))}
        </div>
      </section>

      {cards.map((card) => (
        <ProviderCardView
          key={card.meta.id}
          card={card}
          liveSms={liveSms}
          liveVoice={liveVoice}
          appBaseUrl={appBaseUrl}
          genSecrets={genSecrets}
          setGenSecrets={setGenSecrets}
          save={save}
          rows={rows}
          fieldCtx={fieldCtx}
        />
      ))}
    </div>
  );
}

function ActiveBanner({ sms, voice }: { sms: string; voice: string }) {
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-gold/40 bg-gold/5 p-4">
      <span className="text-sm font-bold">ارائه‌دهنده‌های فعال:</span>
      <span className="flex items-center gap-1.5 text-sm">
        پیامک <Badge>{sms}</Badge>
      </span>
      <span className="flex items-center gap-1.5 text-sm">
        تماس <Badge>{voice}</Badge>
      </span>
    </div>
  );
}

// ─── provider card ──────────────────────────────────────────────────────────

type FieldCtx = {
  rows: Record<string, SettingRow>;
  drafts: Record<string, string>;
  savingKey: string | null;
  revealed: Record<string, boolean>;
  setDraft: (key: string, v: string) => void;
  save: (key: string, value: string | null) => Promise<boolean>;
  setRevealed: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
};

function ProviderCardView({
  card,
  liveSms,
  liveVoice,
  appBaseUrl,
  genSecrets,
  setGenSecrets,
  save,
  rows,
  fieldCtx,
}: {
  card: ProviderCard;
  liveSms: string;
  liveVoice: string;
  appBaseUrl: string;
  genSecrets: Record<string, string>;
  setGenSecrets: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  save: (key: string, value: string | null) => Promise<boolean>;
  rows: Record<string, SettingRow>;
  fieldCtx: FieldCtx;
}) {
  const { meta } = card;
  const isActiveSms = meta.channel === "sms" && meta.id === liveSms;
  const isActiveVoice =
    (meta.id === "kavenegar" || meta.id === "selfhosted") && meta.id === liveVoice;
  const [testPhone, setTestPhone] = useState("");
  const [testing, setTesting] = useState(false);

  async function sendTest() {
    setTesting(true);
    try {
      const res = await fetch("/api/admin/comms/test", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          phone: testPhone,
          text: `تست ${meta.label}`,
          provider: meta.testProvider,
        }),
      });
      const payload = await res.json();
      if (payload.ok)
        toast.success(`${meta.label}: ${payload.data.status} — ${payload.data.message}`);
      else toast.error(payload.error?.message ?? "ارسال ناموفق بود.");
    } finally {
      setTesting(false);
    }
  }

  return (
    <section className="rounded-2xl border border-border p-4">
      <header className="mb-3 flex flex-wrap items-center gap-2">
        <h3 className="text-sm font-black">{meta.label}</h3>
        <Badge variant={card.configured ? "default" : "outline"}>
          {card.configured ? "پیکربندی‌شده" : "ناقص"}
        </Badge>
        {isActiveSms ? <Badge variant="secondary">فعال: پیامک</Badge> : null}
        {isActiveVoice ? <Badge variant="secondary">فعال: تماس</Badge> : null}
      </header>

      <div className="grid gap-2">
        {card.rows.map((r) => (
          <Field key={r.key} row={rows[r.key] ?? r} {...fieldCtx} />
        ))}
      </div>

      {meta.testProvider ? (
        <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border pt-3">
          <Input
            value={testPhone}
            onChange={(e) => setTestPhone(e.target.value)}
            placeholder="09xxxxxxxxx"
            dir="ltr"
            className="h-9 max-w-44"
          />
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={sendTest}
            disabled={testing || !testPhone}
          >
            ارسال تست از این ارائه‌دهنده
          </Button>
        </div>
      ) : null}

      {meta.webhookSecretKey && meta.webhookPaths ? (
        <WebhookBlock
          paths={meta.webhookPaths}
          appBaseUrl={appBaseUrl}
          secretSet={Boolean(rows[meta.webhookSecretKey]?.isSet)}
          generated={genSecrets[meta.webhookSecretKey]}
          onGenerate={async () => {
            const secret = genSecret();
            const ok = await save(meta.webhookSecretKey as string, secret);
            if (ok) setGenSecrets((g) => ({ ...g, [meta.webhookSecretKey as string]: secret }));
          }}
        />
      ) : null}
    </section>
  );
}

function WebhookBlock({
  paths,
  appBaseUrl,
  secretSet,
  generated,
  onGenerate,
}: {
  paths: { delivery?: string; receive?: string };
  appBaseUrl: string;
  secretSet: boolean;
  generated?: string;
  onGenerate: () => void;
}) {
  const base = appBaseUrl.replace(/\/+$/, "");
  const secretParam = generated ?? (secretSet ? "<کلید-وب‌هوک>" : "<کلید>");
  const urlFor = (path: string) => `${base}${path}?secret=${secretParam}`;

  const copy = (text: string) => {
    navigator.clipboard?.writeText(text).then(
      () => toast.success("کپی شد."),
      () => toast.error("کپی ناموفق بود."),
    );
  };

  return (
    <div className="mt-3 grid gap-2 border-t border-border pt-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs font-bold">آدرس‌های وب‌هوک (در پنل ارائه‌دهنده ثبت کنید)</span>
        <Button type="button" size="sm" variant="outline" onClick={onGenerate}>
          تولید کلید جدید
        </Button>
      </div>
      {!generated && secretSet ? (
        <p className="text-[11px] text-muted-foreground">
          کلید وب‌هوک تنظیم شده اما به‌دلایل امنیتی نمایش داده نمی‌شود. اگر آن را ندارید، کلید جدید
          تولید کنید (آدرس کامل پس از تولید نمایش داده می‌شود).
        </p>
      ) : null}
      {(["delivery", "receive"] as const).map((kind) =>
        paths[kind] ? (
          <div key={kind} className="flex items-center gap-2">
            <span className="w-16 shrink-0 text-[11px] text-muted-foreground">
              {kind === "delivery" ? "تحویل" : "دریافت"}
            </span>
            <code
              className="flex-1 truncate rounded-lg bg-muted/40 px-2 py-1 text-[11px]"
              dir="ltr"
            >
              {urlFor(paths[kind] as string)}
            </code>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => copy(urlFor(paths[kind] as string))}
            >
              کپی
            </Button>
          </div>
        ) : null,
      )}
    </div>
  );
}

// ─── single field ──────────────────────────────────────────────────────────

function Field({
  row,
  drafts,
  savingKey,
  revealed,
  setDraft,
  save,
  setRevealed,
}: { row: SettingRow } & FieldCtx) {
  const draft = drafts[row.key];
  const current = draft ?? row.value;
  const error = validate(row.key, current);
  const dirty = draft !== undefined && (draft !== row.value || (row.secret && draft !== ""));
  const saving = savingKey === row.key;
  const lastUpdated = fmtDate(row.updatedAt);

  return (
    <div className="flex flex-col gap-1.5 rounded-xl border border-border/60 p-2.5 sm:flex-row sm:items-center">
      <div className="min-w-0 sm:w-56">
        <p className="truncate text-sm font-bold">{row.label}</p>
        <p className="font-mono text-[10px] text-muted-foreground" dir="ltr">
          {row.key}
        </p>
        {row.hint ? <p className="mt-0.5 text-[10px] text-muted-foreground">{row.hint}</p> : null}
        {lastUpdated ? (
          <p className="mt-0.5 text-[10px] text-muted-foreground">آخرین تغییر: {lastUpdated}</p>
        ) : null}
      </div>

      <div className="flex flex-1 flex-col gap-1">
        <div className="flex items-center gap-2">
          {row.choices ? (
            <select
              value={current}
              onChange={(e) => setDraft(row.key, e.target.value)}
              dir="ltr"
              className="h-9 flex-1 rounded-xl border border-border bg-muted/30 px-3 text-sm focus:border-gold/50 focus:outline-none"
            >
              {row.value === "" ? (
                <option value="" disabled>
                  — انتخاب کنید —
                </option>
              ) : null}
              {row.choices.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          ) : (
            <Input
              type={row.secret && !revealed[row.key] ? "password" : "text"}
              value={current}
              onChange={(e) => setDraft(row.key, e.target.value)}
              placeholder={
                row.secret
                  ? row.isSet
                    ? "•••••••• (تنظیم‌شده — برای تغییر وارد کنید)"
                    : "تنظیم نشده"
                  : `پیش‌فرض/${row.source}`
              }
              dir="ltr"
              className={`h-9 flex-1 ${error ? "border-destructive" : ""}`}
            />
          )}

          {row.secret ? (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => setRevealed((s) => ({ ...s, [row.key]: !s[row.key] }))}
            >
              {revealed[row.key] ? "پنهان" : "نمایش"}
            </Button>
          ) : null}

          <Button
            type="button"
            size="sm"
            disabled={saving || !!error || !(dirty || (row.secret && !!draft))}
            onClick={() => save(row.key, current)}
          >
            ذخیره
          </Button>

          {row.source === "db" ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={saving}
              onClick={() => save(row.key, null)}
            >
              حذف
            </Button>
          ) : null}
        </div>
        {error ? <p className="text-[11px] text-destructive">{error}</p> : null}
      </div>
    </div>
  );
}
