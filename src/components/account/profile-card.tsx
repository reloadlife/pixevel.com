"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export type AccountProfile = {
  fullName: string | null;
  email: string | null;
  phone: string | null;
  isPremium: boolean;
  createdAt: Date | string;
  defaultAddressLine: string | null;
  defaultCity: string | null;
  defaultProvince: string | null;
  defaultPostalCode: string | null;
};

const FIELDS = [
  "fullName",
  "email",
  "defaultAddressLine",
  "defaultCity",
  "defaultProvince",
  "defaultPostalCode",
] as const;

function faDate(value: Date | string): string {
  return new Date(value).toLocaleDateString("fa-IR", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export function ProfileCard({ profile }: { profile: AccountProfile }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState(
    () =>
      Object.fromEntries(FIELDS.map((f) => [f, profile[f] ?? ""])) as Record<
        (typeof FIELDS)[number],
        string
      >,
  );

  const name = profile.fullName?.trim() || "کاربر پیسکول";
  const initial = profile.fullName?.trim()?.[0] || profile.phone?.slice(-1) || "؟";
  const addressParts = [
    profile.defaultProvince,
    profile.defaultCity,
    profile.defaultAddressLine,
  ].filter(Boolean);

  function set(field: (typeof FIELDS)[number], value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    const res = await fetch("/api/account/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const json = await res.json().catch(() => null);
    setPending(false);
    if (!res.ok) {
      setError(json?.error?.message ?? "ذخیره پروفایل ممکن نشد.");
      return;
    }
    setEditing(false);
    router.refresh();
  }

  if (editing) {
    return (
      <Card className="p-5 sm:p-6">
        <form onSubmit={save} className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="fullName">نام و نام خانوادگی</Label>
              <Input
                id="fullName"
                value={form.fullName}
                onChange={(e) => set("fullName", e.target.value)}
                placeholder="نام شما"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="email">ایمیل</Label>
              <Input
                id="email"
                type="email"
                dir="ltr"
                value={form.email}
                onChange={(e) => set("email", e.target.value)}
                placeholder="you@example.com"
              />
            </div>
          </div>

          <div>
            <p className="mb-3 text-xs font-black uppercase tracking-[0.18em] text-muted-foreground">
              نشانی پیش‌فرض
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="addr">نشانی</Label>
                <Input
                  id="addr"
                  value={form.defaultAddressLine}
                  onChange={(e) => set("defaultAddressLine", e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="province">استان</Label>
                <Input
                  id="province"
                  value={form.defaultProvince}
                  onChange={(e) => set("defaultProvince", e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="city">شهر</Label>
                <Input
                  id="city"
                  value={form.defaultCity}
                  onChange={(e) => set("defaultCity", e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="postal">کد پستی</Label>
                <Input
                  id="postal"
                  dir="ltr"
                  inputMode="numeric"
                  maxLength={10}
                  value={form.defaultPostalCode}
                  onChange={(e) => set("defaultPostalCode", e.target.value)}
                />
              </div>
            </div>
          </div>

          {error ? <p className="text-sm font-bold text-red-600">{error}</p> : null}

          <div className="flex gap-3">
            <Button type="submit" disabled={pending}>
              {pending ? "در حال ذخیره…" : "ذخیره تغییرات"}
            </Button>
            <Button type="button" variant="ghost" onClick={() => setEditing(false)}>
              انصراف
            </Button>
          </div>
        </form>
      </Card>
    );
  }

  return (
    <Card className="p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="grid size-14 shrink-0 place-items-center rounded-full bg-gold/15 text-xl font-black text-gold">
            {initial}
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-black">{name}</h1>
              {profile.isPremium ? (
                <Badge className="border-0 bg-gold/15 text-gold">طلایی</Badge>
              ) : null}
            </div>
            <p className="mt-1 text-sm text-muted-foreground" dir="ltr">
              {profile.phone}
            </p>
            {profile.email ? (
              <p className="text-sm text-muted-foreground" dir="ltr">
                {profile.email}
              </p>
            ) : null}
            {addressParts.length > 0 ? (
              <p className="mt-1 text-sm text-muted-foreground">{addressParts.join("، ")}</p>
            ) : null}
            <p className="mt-1 text-xs text-muted-foreground">عضو از {faDate(profile.createdAt)}</p>
          </div>
        </div>
        <Button variant="outline" onClick={() => setEditing(true)}>
          ویرایش پروفایل
        </Button>
      </div>
    </Card>
  );
}
