"use client";

import { Check, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import type { DomainSettingsInput, ManagedDomain, RegistrantContact } from "@/lib/domains/manage";
import { cn } from "@/lib/utils";

type ToggleKey = keyof DomainSettingsInput;

const TOGGLES: { key: ToggleKey; label: string; hint: string }[] = [
  { key: "autoRenew", label: "تمدید خودکار", hint: "دامنه پیش از انقضا به‌صورت خودکار تمدید شود." },
  { key: "transferLock", label: "قفل انتقال", hint: "از انتقال ناخواسته دامنه جلوگیری می‌کند." },
  {
    key: "privacyProtection",
    label: "حریم خصوصی WHOIS",
    hint: "اطلاعات تماس شما در WHOIS مخفی می‌ماند.",
  },
];

const CONTACT_FIELDS: { key: keyof RegistrantContact; label: string; dir?: "ltr" }[] = [
  { key: "firstName", label: "نام" },
  { key: "lastName", label: "نام خانوادگی" },
  { key: "email", label: "ایمیل", dir: "ltr" },
  { key: "phone", label: "تلفن", dir: "ltr" },
  { key: "organization", label: "سازمان" },
  { key: "address", label: "نشانی" },
  { key: "city", label: "شهر" },
  { key: "country", label: "کشور" },
];

function onSaved(router: ReturnType<typeof useRouter>, registrarPushed: boolean, message: string) {
  if (registrarPushed === false) {
    toast.success(message, { description: "ثبت محلی انجام شد (اتصال به ثبت‌کننده برقرار نیست)." });
  } else {
    toast.success(message);
  }
  router.refresh();
}

export function DomainSettings({ domainId, domain }: { domainId: string; domain: ManagedDomain }) {
  return (
    <section className="space-y-5">
      <div>
        <h2 className="font-black">تنظیمات دامنه</h2>
        <p className="mt-0.5 text-xs text-muted-foreground">گزینه‌های مدیریتی و اطلاعات تماس.</p>
      </div>

      <div className="space-y-3 rounded-2xl border border-border bg-card p-4">
        {TOGGLES.map((toggle, index) => (
          <div key={toggle.key}>
            {index > 0 ? <Separator className="my-3" /> : null}
            <SettingToggle
              domainId={domainId}
              settingKey={toggle.key}
              label={toggle.label}
              hint={toggle.hint}
              initial={domain[toggle.key]}
            />
          </div>
        ))}
      </div>

      <ContactForm
        domainId={domainId}
        initial={(domain.registrantContact as RegistrantContact | null) ?? null}
      />
    </section>
  );
}

function SettingToggle({
  domainId,
  settingKey,
  label,
  hint,
  initial,
}: {
  domainId: string;
  settingKey: ToggleKey;
  label: string;
  hint: string;
  initial: boolean;
}) {
  const router = useRouter();
  const [enabled, setEnabled] = useState(initial);
  const [pending, setPending] = useState(false);

  async function toggle() {
    const next = !enabled;
    setPending(true);
    setEnabled(next); // optimistic
    const res = await fetch(`/api/account/domains/${domainId}/settings`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [settingKey]: next }),
    });
    const json = await res.json().catch(() => null);
    setPending(false);
    if (!res.ok || !json?.ok) {
      setEnabled(!next); // revert
      toast.error(json?.error?.message ?? "ذخیره تنظیمات ممکن نشد.");
      return;
    }
    onSaved(router, json.data?.registrarPushed, `${label} ${next ? "فعال" : "غیرفعال"} شد.`);
  }

  return (
    <div className="flex items-center justify-between gap-4">
      <div className="min-w-0">
        <p className="text-sm font-bold">{label}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={enabled}
        aria-label={label}
        disabled={pending}
        onClick={toggle}
        className={cn(
          "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/30 disabled:opacity-60",
          enabled ? "bg-primary" : "bg-muted",
        )}
      >
        <span
          className={cn(
            "inline-flex size-5 items-center justify-center rounded-full bg-background shadow-sm transition-transform",
            // RTL: the "on" position moves the knob toward the start (right).
            enabled ? "-translate-x-0.5" : "-translate-x-[22px]",
          )}
        >
          {pending ? (
            <Loader2 className="size-3 animate-spin text-muted-foreground" aria-hidden />
          ) : null}
        </span>
      </button>
    </div>
  );
}

function ContactForm({
  domainId,
  initial,
}: {
  domainId: string;
  initial: RegistrantContact | null;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [form, setForm] = useState<Record<keyof RegistrantContact, string>>(
    () =>
      Object.fromEntries(
        CONTACT_FIELDS.map((f) => [f.key, (initial?.[f.key] as string | undefined) ?? ""]),
      ) as Record<keyof RegistrantContact, string>,
  );

  function set(key: keyof RegistrantContact, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    const res = await fetch(`/api/account/domains/${domainId}/contact`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const json = await res.json().catch(() => null);
    setPending(false);
    if (!res.ok || !json?.ok) {
      toast.error(json?.error?.message ?? "ذخیره اطلاعات تماس ممکن نشد.");
      return;
    }
    onSaved(router, json.data?.registrarPushed, "اطلاعات تماس ذخیره شد.");
  }

  return (
    <form onSubmit={save} className="space-y-4 rounded-2xl border border-border bg-card p-4">
      <div>
        <h3 className="text-sm font-black">اطلاعات تماس مالک (Registrant)</h3>
        <p className="mt-0.5 text-xs text-muted-foreground">
          این اطلاعات برای ثبت دامنه نزد ثبت‌کننده استفاده می‌شود.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {CONTACT_FIELDS.map((field) => (
          <div key={field.key} className="space-y-1.5">
            <Label htmlFor={`contact-${field.key}`}>{field.label}</Label>
            <Input
              id={`contact-${field.key}`}
              dir={field.dir}
              type={field.key === "email" ? "email" : "text"}
              value={form[field.key]}
              onChange={(e) => set(field.key, e.target.value)}
            />
          </div>
        ))}
      </div>

      <Button type="submit" size="sm" disabled={pending} className="gap-1.5">
        {pending ? (
          <Loader2 className="size-3.5 animate-spin" aria-hidden />
        ) : (
          <Check className="size-3.5" aria-hidden />
        )}
        {pending ? "در حال ذخیره…" : "ذخیره اطلاعات تماس"}
      </Button>
    </form>
  );
}
