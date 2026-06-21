"use client";

import { MapPin, Pencil, Plus, Star, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export type AddressView = {
  id: string;
  titleFa: string | null;
  fullName: string | null;
  phone: string | null;
  province: string | null;
  city: string | null;
  addressLine: string | null;
  postalCode: string | null;
  isDefault: boolean;
};

type FormState = {
  titleFa: string;
  fullName: string;
  phone: string;
  province: string;
  city: string;
  addressLine: string;
  postalCode: string;
  isDefault: boolean;
};

const EMPTY: FormState = {
  titleFa: "",
  fullName: "",
  phone: "",
  province: "",
  city: "",
  addressLine: "",
  postalCode: "",
  isDefault: false,
};

function toForm(a: AddressView): FormState {
  return {
    titleFa: a.titleFa ?? "",
    fullName: a.fullName ?? "",
    phone: a.phone ?? "",
    province: a.province ?? "",
    city: a.city ?? "",
    addressLine: a.addressLine ?? "",
    postalCode: a.postalCode ?? "",
    isDefault: a.isDefault,
  };
}

async function readError(res: Response, fallback: string): Promise<string> {
  const json = await res.json().catch(() => null);
  return json?.error?.message ?? fallback;
}

export function AddressBook({ addresses }: { addresses: AddressView[] }) {
  const router = useRouter();
  // null = closed, "new" = creating, otherwise the id being edited.
  const [openId, setOpenId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  function openNew() {
    setForm(EMPTY);
    setError(null);
    setOpenId("new");
  }

  function openEdit(a: AddressView) {
    setForm(toForm(a));
    setError(null);
    setOpenId(a.id);
  }

  function close() {
    setOpenId(null);
    setError(null);
  }

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);

    const isNew = openId === "new";
    const res = await fetch(isNew ? "/api/account/addresses" : `/api/account/addresses/${openId}`, {
      method: isNew ? "POST" : "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });

    setPending(false);

    if (!res.ok) {
      setError(await readError(res, "ذخیره نشانی ممکن نشد."));
      return;
    }

    close();
    toast.success(isNew ? "نشانی جدید ثبت شد." : "نشانی به‌روزرسانی شد.");
    router.refresh();
  }

  async function makeDefault(id: string) {
    setBusyId(id);
    const res = await fetch(`/api/account/addresses/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ setDefault: true }),
    });
    setBusyId(null);

    if (!res.ok) {
      toast.error(await readError(res, "تغییر نشانی پیش‌فرض ممکن نشد."));
      return;
    }
    toast.success("نشانی پیش‌فرض تنظیم شد.");
    router.refresh();
  }

  async function remove(id: string) {
    if (!confirm("این نشانی حذف شود؟")) return;
    setBusyId(id);
    const res = await fetch(`/api/account/addresses/${id}`, { method: "DELETE" });
    setBusyId(null);

    if (!res.ok) {
      toast.error(await readError(res, "حذف نشانی ممکن نشد."));
      return;
    }
    toast.success("نشانی حذف شد.");
    router.refresh();
  }

  const isFormOpen = openId !== null;

  return (
    <div className="space-y-5">
      {!isFormOpen ? (
        <div className="flex justify-end">
          <Button onClick={openNew}>
            <Plus className="size-4" />
            افزودن نشانی جدید
          </Button>
        </div>
      ) : null}

      {isFormOpen ? (
        <Card className="p-5 sm:p-6">
          <h2 className="mb-5 text-lg font-black">
            {openId === "new" ? "نشانی جدید" : "ویرایش نشانی"}
          </h2>
          <form onSubmit={submit} className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="titleFa">عنوان نشانی</Label>
                <Input
                  id="titleFa"
                  value={form.titleFa}
                  onChange={(e) => set("titleFa", e.target.value)}
                  placeholder="خانه، محل کار…"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="fullName">نام گیرنده</Label>
                <Input
                  id="fullName"
                  value={form.fullName}
                  onChange={(e) => set("fullName", e.target.value)}
                  placeholder="نام و نام خانوادگی"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="phone">شماره تماس</Label>
                <Input
                  id="phone"
                  dir="ltr"
                  inputMode="numeric"
                  value={form.phone}
                  onChange={(e) => set("phone", e.target.value)}
                  placeholder="0912xxxxxxx"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="postalCode">کد پستی</Label>
                <Input
                  id="postalCode"
                  dir="ltr"
                  inputMode="numeric"
                  maxLength={10}
                  value={form.postalCode}
                  onChange={(e) => set("postalCode", e.target.value)}
                  placeholder="۱۰ رقم"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="province">استان</Label>
                <Input
                  id="province"
                  value={form.province}
                  onChange={(e) => set("province", e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="city">شهر</Label>
                <Input id="city" value={form.city} onChange={(e) => set("city", e.target.value)} />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="addressLine">نشانی کامل</Label>
                <Input
                  id="addressLine"
                  value={form.addressLine}
                  onChange={(e) => set("addressLine", e.target.value)}
                  placeholder="خیابان، کوچه، پلاک، واحد"
                />
              </div>
            </div>

            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="size-4 accent-gold"
                checked={form.isDefault}
                onChange={(e) => set("isDefault", e.target.checked)}
              />
              تنظیم به‌عنوان نشانی پیش‌فرض
            </label>

            {error ? <p className="text-sm font-bold text-red-600">{error}</p> : null}

            <div className="flex gap-3">
              <Button type="submit" disabled={pending}>
                {pending ? "در حال ذخیره…" : "ذخیره نشانی"}
              </Button>
              <Button type="button" variant="ghost" onClick={close}>
                انصراف
              </Button>
            </div>
          </form>
        </Card>
      ) : null}

      {addresses.length === 0 && !isFormOpen ? (
        <Card className="flex flex-col items-center gap-4 p-10 text-center">
          <div className="grid size-14 place-items-center rounded-full bg-gold/15 text-gold">
            <MapPin className="size-7" />
          </div>
          <div>
            <p className="text-lg font-black">هنوز نشانی‌ای ثبت نکرده‌اید</p>
            <p className="mt-1 text-sm text-muted-foreground">
              برای تحویل سریع‌تر سفارش‌های فیزیکی، نشانی خود را اضافه کنید.
            </p>
          </div>
          <Button onClick={openNew}>
            <Plus className="size-4" />
            افزودن نشانی
          </Button>
        </Card>
      ) : null}

      {addresses.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {addresses.map((a) => (
            <Card
              key={a.id}
              className={cn("flex flex-col gap-3 p-5", a.isDefault && "border-gold/40 bg-gold/5")}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="font-black">{a.titleFa || "نشانی"}</span>
                  {a.isDefault ? (
                    <Badge className="border-0 bg-gold/15 text-gold">پیش‌فرض</Badge>
                  ) : null}
                </div>
              </div>

              <div className="space-y-1 text-sm text-muted-foreground">
                {a.fullName ? <p className="font-medium text-foreground">{a.fullName}</p> : null}
                <p>{[a.province, a.city, a.addressLine].filter(Boolean).join("، ")}</p>
                {a.postalCode ? (
                  <p dir="ltr" className="font-mono text-xs">
                    کد پستی: {a.postalCode}
                  </p>
                ) : null}
                {a.phone ? (
                  <p dir="ltr" className="font-mono text-xs">
                    {a.phone}
                  </p>
                ) : null}
              </div>

              <div className="mt-auto flex flex-wrap gap-2 pt-2">
                {!a.isDefault ? (
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={busyId === a.id}
                    onClick={() => makeDefault(a.id)}
                  >
                    <Star className="size-4" />
                    پیش‌فرض
                  </Button>
                ) : null}
                <Button variant="outline" size="sm" onClick={() => openEdit(a)}>
                  <Pencil className="size-4" />
                  ویرایش
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-red-600 hover:text-red-700"
                  disabled={busyId === a.id}
                  onClick={() => remove(a.id)}
                >
                  <Trash2 className="size-4" />
                  حذف
                </Button>
              </div>
            </Card>
          ))}
        </div>
      ) : null}
    </div>
  );
}
