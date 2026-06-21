"use client";

import { useState } from "react";
import { toast } from "sonner";

import { cn } from "@/lib/utils";

export type NotificationPrefs = {
  orderEmail: boolean;
  orderSms: boolean;
  promoEmail: boolean;
  promoSms: boolean;
  newsletterEmail: boolean;
};

type PrefKey = keyof NotificationPrefs;

const ROWS: { key: PrefKey; label: string; hint: string }[] = [
  { key: "orderSms", label: "پیامک سفارش‌ها", hint: "وضعیت سفارش و کدهای خرید با پیامک" },
  { key: "orderEmail", label: "ایمیل سفارش‌ها", hint: "رسید و جزئیات سفارش با ایمیل" },
  { key: "promoSms", label: "پیامک تخفیف‌ها", hint: "پیشنهادها و کدهای تخفیف با پیامک" },
  { key: "promoEmail", label: "ایمیل تخفیف‌ها", hint: "پیشنهادهای ویژه با ایمیل" },
  { key: "newsletterEmail", label: "خبرنامه", hint: "تازه‌ترین محصولات و اخبار" },
];

function Toggle({
  checked,
  disabled,
  onChange,
  label,
}: {
  checked: boolean;
  disabled: boolean;
  onChange: (next: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/30 disabled:cursor-not-allowed disabled:opacity-50",
        checked ? "bg-gold" : "bg-muted",
      )}
    >
      <span
        className={cn(
          "inline-block size-5 transform rounded-full bg-background shadow-sm transition-transform",
          // RTL: "on" slides the knob to the start (right) edge.
          checked ? "-translate-x-0.5" : "-translate-x-[22px]",
        )}
      />
    </button>
  );
}

export function NotificationPrefsForm({ initial }: { initial: NotificationPrefs }) {
  const [prefs, setPrefs] = useState<NotificationPrefs>(initial);
  const [savingKey, setSavingKey] = useState<PrefKey | null>(null);

  async function update(key: PrefKey, next: boolean) {
    const previous = prefs[key];
    setPrefs((p) => ({ ...p, [key]: next }));
    setSavingKey(key);

    const res = await fetch("/api/account/notification-preferences", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [key]: next }),
    });
    setSavingKey(null);

    if (!res.ok) {
      setPrefs((p) => ({ ...p, [key]: previous }));
      toast.error("ذخیره تنظیمات ممکن نشد.");
      return;
    }
    toast.success("تنظیمات اعلان‌ها ذخیره شد.");
  }

  return (
    <ul className="divide-y">
      {ROWS.map((row) => (
        <li
          key={row.key}
          className="flex items-center justify-between gap-4 py-3.5 first:pt-0 last:pb-0"
        >
          <div className="min-w-0">
            <p className="text-sm font-bold">{row.label}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">{row.hint}</p>
          </div>
          <Toggle
            label={row.label}
            checked={prefs[row.key]}
            disabled={savingKey === row.key}
            onChange={(next) => update(row.key, next)}
          />
        </li>
      ))}
    </ul>
  );
}
