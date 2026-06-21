"use client";

import { Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatToman } from "@/lib/format";

type Rate = { currency: "USD" | "EUR"; rateToman: number; updatedAt: string | null };

const LABEL: Record<string, string> = { USD: "دلار آمریکا", EUR: "یورو" };

function faDate(iso: string | null): string {
  if (!iso) return "هنوز تنظیم نشده";
  return new Date(iso).toLocaleString("fa-IR", { dateStyle: "medium", timeStyle: "short" });
}

export function ExchangeRateManagement({ initialRates }: { initialRates: Rate[] }) {
  const [rates, setRates] = useState(initialRates);
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(initialRates.map((r) => [r.currency, String(r.rateToman)])),
  );
  const [saving, setSaving] = useState<string | null>(null);

  async function save(currency: "USD" | "EUR") {
    const rateToman = Number(values[currency]);
    if (!Number.isFinite(rateToman) || rateToman <= 0) {
      toast.error("نرخ باید عددی مثبت باشد.");
      return;
    }
    setSaving(currency);
    try {
      const res = await fetch("/api/admin/exchange-rates", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currency, rateToman }),
      });
      const json = await res.json();
      if (!json.ok) {
        toast.error(json.error?.message ?? "ذخیره نرخ ممکن نشد.");
        return;
      }
      setRates(json.data.rates);
      toast.success(`نرخ ${LABEL[currency]} به‌روزرسانی شد.`);
    } catch {
      toast.error("اتصال برقرار نشد.");
    } finally {
      setSaving(null);
    }
  }

  return (
    <div className="grid max-w-2xl gap-4 sm:grid-cols-2" dir="rtl">
      {rates.map((rate) => {
        const numeric = Number(values[rate.currency]) || 0;
        return (
          <div key={rate.currency} className="rounded-2xl border border-border bg-card p-5">
            <div className="flex items-center justify-between">
              <h3 className="font-black">{LABEL[rate.currency]}</h3>
              <span className="font-mono text-xs font-bold text-muted-foreground" dir="ltr">
                {rate.currency} → IRT
              </span>
            </div>

            <Label htmlFor={`rate-${rate.currency}`} className="mt-4 block text-sm">
              قیمت هر ۱ {rate.currency} (تومان)
            </Label>
            <div className="mt-1.5 flex gap-2">
              <Input
                id={`rate-${rate.currency}`}
                dir="ltr"
                inputMode="numeric"
                value={values[rate.currency] ?? ""}
                onChange={(e) =>
                  setValues((v) => ({
                    ...v,
                    [rate.currency]: e.target.value.replace(/[^\d]/g, ""),
                  }))
                }
              />
              <Button
                type="button"
                onClick={() => save(rate.currency)}
                disabled={saving === rate.currency}
              >
                {saving === rate.currency ? <Loader2 className="size-4 animate-spin" /> : "ذخیره"}
              </Button>
            </div>

            <p className="mt-3 text-xs text-muted-foreground">
              نمونه: ۱۰ {rate.currency} ={" "}
              <b className="text-foreground">{formatToman(numeric * 10)}</b>
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              آخرین به‌روزرسانی: {faDate(rate.updatedAt)}
            </p>
          </div>
        );
      })}
    </div>
  );
}
