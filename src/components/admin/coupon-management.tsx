"use client";

import { Loader2, Pencil, Plus, Power, Save, Trash2, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatToman, toFaNumber } from "@/lib/format";
import { cn } from "@/lib/utils";

type CouponKind = "PERCENT" | "FIXED";

type Coupon = {
  id: string;
  code: string;
  kind: CouponKind;
  value: string;
  isActive: boolean;
  minSubtotalAmount: string | null;
  maxDiscountAmount: string | null;
  usageLimit: number | null;
  usedCount: number;
  startsAt: string | null;
  expiresAt: string | null;
  createdAt: string | null;
  updatedAt: string | null;
};

type CouponForm = {
  code: string;
  kind: CouponKind;
  value: string;
  minSubtotalAmount: string;
  maxDiscountAmount: string;
  usageLimit: string;
  startsAt: string;
  expiresAt: string;
  isActive: boolean;
};

const EMPTY_FORM: CouponForm = {
  code: "",
  kind: "PERCENT",
  value: "",
  minSubtotalAmount: "",
  maxDiscountAmount: "",
  usageLimit: "",
  startsAt: "",
  expiresAt: "",
  isActive: true,
};

/** ISO timestamp → value for a `datetime-local` input (local time, no seconds). */
function toLocalInput(iso: string | null): string {
  if (!iso) {
    return "";
  }
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours(),
  )}:${pad(date.getMinutes())}`;
}

/** `datetime-local` value → ISO string (or null when empty). */
function fromLocalInput(value: string): string | null {
  if (!value) {
    return null;
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function formFromCoupon(coupon: Coupon): CouponForm {
  return {
    code: coupon.code,
    kind: coupon.kind,
    value: coupon.value,
    minSubtotalAmount: coupon.minSubtotalAmount ?? "",
    maxDiscountAmount: coupon.maxDiscountAmount ?? "",
    usageLimit: coupon.usageLimit != null ? String(coupon.usageLimit) : "",
    startsAt: toLocalInput(coupon.startsAt),
    expiresAt: toLocalInput(coupon.expiresAt),
    isActive: coupon.isActive,
  };
}

function formToPayload(form: CouponForm) {
  return {
    code: form.code,
    kind: form.kind,
    value: form.value,
    minSubtotalAmount: form.minSubtotalAmount.trim() || null,
    maxDiscountAmount: form.maxDiscountAmount.trim() || null,
    usageLimit: form.usageLimit.trim() || null,
    startsAt: fromLocalInput(form.startsAt),
    expiresAt: fromLocalInput(form.expiresAt),
    isActive: form.isActive,
  };
}

const FA_DATE = new Intl.DateTimeFormat("fa-IR", {
  dateStyle: "short",
  timeStyle: "short",
});

function formatDate(iso: string | null): string {
  if (!iso) {
    return "—";
  }
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? "—" : FA_DATE.format(date);
}

type CouponStatus = { label: string; variant: "default" | "secondary" | "destructive" | "outline" };

function couponStatus(coupon: Coupon): CouponStatus {
  if (!coupon.isActive) {
    return { label: "غیرفعال", variant: "outline" };
  }
  const now = Date.now();
  if (coupon.expiresAt && new Date(coupon.expiresAt).getTime() <= now) {
    return { label: "منقضی", variant: "destructive" };
  }
  if (coupon.startsAt && new Date(coupon.startsAt).getTime() > now) {
    return { label: "زمان‌بندی‌شده", variant: "secondary" };
  }
  if (coupon.usageLimit != null && coupon.usedCount >= coupon.usageLimit) {
    return { label: "تمام‌شده", variant: "destructive" };
  }
  return { label: "فعال", variant: "default" };
}

function formatValue(coupon: Coupon): string {
  if (coupon.kind === "PERCENT") {
    return `${toFaNumber(coupon.value)}٪`;
  }
  return formatToman(coupon.value);
}

export function CouponManagement({ initialCoupons }: { initialCoupons: Coupon[] }) {
  const [coupons, setCoupons] = useState(initialCoupons);
  const [createForm, setCreateForm] = useState<CouponForm>(EMPTY_FORM);
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<CouponForm>(EMPTY_FORM);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function refresh() {
    const response = await fetch("/api/admin/coupons");
    const result = await response.json();
    if (result.ok) {
      setCoupons(result.data.coupons);
    }
  }

  async function createCoupon() {
    if (!createForm.code.trim()) {
      toast.error("کد تخفیف الزامی است.");
      return;
    }
    setCreating(true);
    const response = await fetch("/api/admin/coupons", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(formToPayload(createForm)),
    });
    const result = await response.json();
    setCreating(false);

    if (!result.ok) {
      toast.error(result.error?.message ?? "کد تخفیف ذخیره نشد.");
      return;
    }

    toast.success("کد تخفیف ساخته شد.");
    setCreateForm(EMPTY_FORM);
    await refresh();
  }

  async function saveEdit(id: string) {
    setBusyId(id);
    const response = await fetch(`/api/admin/coupons/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(formToPayload(editForm)),
    });
    const result = await response.json();
    setBusyId(null);

    if (!result.ok) {
      toast.error(result.error?.message ?? "کد تخفیف ذخیره نشد.");
      return;
    }

    toast.success("کد تخفیف به‌روزرسانی شد.");
    setEditingId(null);
    await refresh();
  }

  async function toggleActive(coupon: Coupon) {
    setBusyId(coupon.id);
    const response = await fetch(`/api/admin/coupons/${coupon.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !coupon.isActive }),
    });
    const result = await response.json();
    setBusyId(null);

    if (!result.ok) {
      toast.error(result.error?.message ?? "تغییر وضعیت انجام نشد.");
      return;
    }

    toast.success(coupon.isActive ? "کد تخفیف غیرفعال شد." : "کد تخفیف فعال شد.");
    await refresh();
  }

  async function removeCoupon(coupon: Coupon) {
    if (!window.confirm(`حذف کد «${coupon.code}»؟ این عمل قابل بازگشت نیست.`)) {
      return;
    }
    setBusyId(coupon.id);
    const response = await fetch(`/api/admin/coupons/${coupon.id}`, { method: "DELETE" });
    const result = await response.json();
    setBusyId(null);

    if (!result.ok) {
      toast.error(result.error?.message ?? "کد تخفیف حذف نشد.");
      return;
    }

    toast.success("کد تخفیف حذف شد.");
    if (editingId === coupon.id) {
      setEditingId(null);
    }
    await refresh();
  }

  function startEdit(coupon: Coupon) {
    setEditingId(coupon.id);
    setEditForm(formFromCoupon(coupon));
  }

  return (
    <div className="grid gap-6" dir="rtl">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-black">کدهای تخفیف</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {toFaNumber(coupons.length)} کد ثبت‌شده
          </p>
        </div>
      </div>

      {/* ── Create form ─────────────────────────────────────────── */}
      <section className="rounded-2xl border border-border bg-card p-4">
        <h2 className="text-base font-black">کد تخفیف جدید</h2>
        <CouponFields form={createForm} onChange={setCreateForm} />
        <Button className="mt-4 font-black" onClick={createCoupon} disabled={creating}>
          {creating ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
          ساخت کد تخفیف
        </Button>
      </section>

      {/* ── Table ───────────────────────────────────────────────── */}
      <section className="overflow-hidden rounded-2xl border border-border bg-card">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[840px] text-sm">
            <thead className="bg-muted/50 text-xs text-muted-foreground">
              <tr className="[&>th]:p-3 [&>th]:text-start [&>th]:font-bold">
                <th>کد</th>
                <th>نوع</th>
                <th>مقدار</th>
                <th>استفاده</th>
                <th>بازه اعتبار</th>
                <th>وضعیت</th>
                <th className="text-end">عملیات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {coupons.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-muted-foreground">
                    هنوز کد تخفیفی ثبت نشده است.
                  </td>
                </tr>
              ) : (
                coupons.map((coupon) => {
                  const status = couponStatus(coupon);
                  const usageText =
                    coupon.usageLimit != null
                      ? `${toFaNumber(coupon.usedCount)} از ${toFaNumber(coupon.usageLimit)} استفاده شده`
                      : `${toFaNumber(coupon.usedCount)} بار استفاده شده`;
                  const isBusy = busyId === coupon.id;

                  return (
                    <tr key={coupon.id} className="[&>td]:p-3 [&>td]:align-top">
                      <td>
                        <span className="font-mono font-bold" dir="ltr">
                          {coupon.code}
                        </span>
                      </td>
                      <td className="text-muted-foreground">
                        {coupon.kind === "PERCENT" ? "درصدی" : "مبلغ ثابت"}
                      </td>
                      <td className="font-bold">{formatValue(coupon)}</td>
                      <td>
                        <div className="text-xs">{usageText}</div>
                        {coupon.usageLimit != null && (
                          <div className="mt-1 h-1.5 w-24 overflow-hidden rounded-full bg-muted">
                            <div
                              className={cn(
                                "h-full rounded-full",
                                coupon.usedCount >= coupon.usageLimit
                                  ? "bg-destructive"
                                  : "bg-primary",
                              )}
                              style={{
                                width: `${Math.min(
                                  100,
                                  (coupon.usedCount / Math.max(1, coupon.usageLimit)) * 100,
                                )}%`,
                              }}
                            />
                          </div>
                        )}
                      </td>
                      <td className="text-xs text-muted-foreground">
                        <div>از: {formatDate(coupon.startsAt)}</div>
                        <div>تا: {formatDate(coupon.expiresAt)}</div>
                      </td>
                      <td>
                        <Badge variant={status.variant}>{status.label}</Badge>
                      </td>
                      <td>
                        <div className="flex flex-wrap items-center justify-end gap-1.5">
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            disabled={isBusy}
                            onClick={() => toggleActive(coupon)}
                          >
                            <Power className="size-3.5" />
                            {coupon.isActive ? "غیرفعال" : "فعال"}
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            disabled={isBusy}
                            onClick={() => startEdit(coupon)}
                          >
                            <Pencil className="size-3.5" />
                            ویرایش
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="destructive"
                            disabled={isBusy}
                            onClick={() => removeCoupon(coupon)}
                          >
                            <Trash2 className="size-3.5" />
                            حذف
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* ── Edit panel ──────────────────────────────────────────── */}
      {editingId && (
        <section className="rounded-2xl border border-primary/40 bg-card p-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-black">ویرایش کد تخفیف</h2>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => setEditingId(null)}
              aria-label="بستن"
            >
              <X className="size-4" />
            </Button>
          </div>
          <CouponFields form={editForm} onChange={setEditForm} />
          <div className="mt-4 flex gap-2">
            <Button
              className="font-black"
              onClick={() => saveEdit(editingId)}
              disabled={busyId === editingId}
            >
              {busyId === editingId ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Save className="size-4" />
              )}
              ذخیره تغییرات
            </Button>
            <Button variant="outline" onClick={() => setEditingId(null)}>
              انصراف
            </Button>
          </div>
        </section>
      )}
    </div>
  );
}

function CouponFields({
  form,
  onChange,
}: {
  form: CouponForm;
  onChange: (next: CouponForm) => void;
}) {
  function set<K extends keyof CouponForm>(key: K, value: CouponForm[K]) {
    onChange({ ...form, [key]: value });
  }

  return (
    <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      <Field label="کد تخفیف">
        <input
          value={form.code}
          onChange={(event) => set("code", event.target.value.toUpperCase())}
          placeholder="WELCOME20"
          dir="ltr"
          className={fieldClass}
        />
      </Field>

      <Field label="نوع تخفیف">
        <select
          value={form.kind}
          onChange={(event) => set("kind", event.target.value as CouponKind)}
          className={fieldClass}
        >
          <option value="PERCENT">درصدی</option>
          <option value="FIXED">مبلغ ثابت (تومان)</option>
        </select>
      </Field>

      <Field label={form.kind === "PERCENT" ? "درصد تخفیف" : "مبلغ تخفیف (تومان)"}>
        <input
          value={form.value}
          onChange={(event) => set("value", event.target.value)}
          inputMode="numeric"
          dir="ltr"
          placeholder={form.kind === "PERCENT" ? "20" : "50000"}
          className={fieldClass}
        />
      </Field>

      <Field label="حداقل مبلغ سبد (تومان)" hint="اختیاری">
        <input
          value={form.minSubtotalAmount}
          onChange={(event) => set("minSubtotalAmount", event.target.value)}
          inputMode="numeric"
          dir="ltr"
          placeholder="بدون محدودیت"
          className={fieldClass}
        />
      </Field>

      <Field label="سقف تخفیف (تومان)" hint="برای درصدی">
        <input
          value={form.maxDiscountAmount}
          onChange={(event) => set("maxDiscountAmount", event.target.value)}
          inputMode="numeric"
          dir="ltr"
          placeholder="بدون سقف"
          className={fieldClass}
        />
      </Field>

      <Field label="سقف تعداد استفاده" hint="اختیاری">
        <input
          value={form.usageLimit}
          onChange={(event) => set("usageLimit", event.target.value)}
          inputMode="numeric"
          dir="ltr"
          placeholder="نامحدود"
          className={fieldClass}
        />
      </Field>

      <Field label="شروع اعتبار" hint="اختیاری">
        <input
          type="datetime-local"
          value={form.startsAt}
          onChange={(event) => set("startsAt", event.target.value)}
          dir="ltr"
          className={fieldClass}
        />
      </Field>

      <Field label="پایان اعتبار" hint="اختیاری">
        <input
          type="datetime-local"
          value={form.expiresAt}
          onChange={(event) => set("expiresAt", event.target.value)}
          dir="ltr"
          className={fieldClass}
        />
      </Field>

      <label className="flex items-center gap-2 self-end pb-2 text-sm font-bold">
        <input
          type="checkbox"
          checked={form.isActive}
          onChange={(event) => set("isActive", event.target.checked)}
          className="size-4 accent-primary"
        />
        فعال باشد
      </label>
    </div>
  );
}

const fieldClass =
  "h-10 w-full rounded-2xl border border-border bg-input/50 px-3 text-sm outline-none transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30";

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="block">
      <span className="mb-1.5 flex items-center gap-1.5 text-sm font-bold">
        {label}
        {hint && <span className="text-xs font-normal text-muted-foreground">({hint})</span>}
      </span>
      {children}
    </div>
  );
}
