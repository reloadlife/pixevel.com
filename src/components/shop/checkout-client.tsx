"use client";

import { useRouter } from "next/navigation";
import { type ChangeEvent, type FormEvent, useRef, useState } from "react";

import type { CartView } from "@/lib/cart";

type PaymentMethod = "ZARINPAL" | "CARD_TO_CARD" | "MANUAL";

const PAYMENT_METHODS: { value: PaymentMethod; label: string }[] = [
  { value: "ZARINPAL", label: "زرین‌پال" },
  { value: "CARD_TO_CARD", label: "کارت به کارت" },
  { value: "MANUAL", label: "پرداخت دستی" },
];

interface ShippingFields {
  customerName: string;
  addressLine: string;
  city: string;
  province: string;
  postalCode: string;
}

const EMPTY_SHIPPING: ShippingFields = {
  customerName: "",
  addressLine: "",
  city: "",
  province: "",
  postalCode: "",
};

interface CardInstructions {
  cardNumber: string;
  holder: string;
  fa: string;
}

// ─── Receipt Step ─────────────────────────────────────────────────────────────

function ReceiptStep({
  orderId,
  instructions,
}: {
  orderId: string;
  instructions: CardInstructions;
}) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    const picked = e.target.files?.[0] ?? null;
    setFile(picked);
    setError(null);
  }

  async function handleUpload(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!file) {
      setError("لطفاً تصویر رسید را انتخاب کنید.");
      return;
    }

    setError(null);
    setUploading(true);

    try {
      const fd = new FormData();
      fd.append("orderId", orderId);
      fd.append("file", file);

      const res = await fetch("/api/payments/receipt", { method: "POST", body: fd });
      const payload = await res.json();

      if (!res.ok) {
        setError(payload?.error?.message ?? "خطا در آپلود رسید.");
        return;
      }

      router.push(`/account/orders/${orderId}`);
    } catch {
      setError("خطا در ارتباط با سرور. لطفاً مجدداً تلاش کنید.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="space-y-6" dir="rtl">
      {/* Instructions card */}
      <div className="border border-gold/40 bg-gold/5 p-6">
        <h2 className="mb-4 text-lg font-black text-gold">اطلاعات پرداخت کارت به کارت</h2>
        <div className="mb-4 space-y-3">
          <div className="flex items-center gap-3">
            <span className="w-24 text-sm font-bold text-muted-foreground">شماره کارت</span>
            <span
              className="font-mono text-base font-black tracking-widest text-foreground"
              dir="ltr"
            >
              {instructions.cardNumber}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span className="w-24 text-sm font-bold text-muted-foreground">به نام</span>
            <span className="font-bold text-foreground">{instructions.holder}</span>
          </div>
        </div>
        <p className="text-sm leading-7 text-muted-foreground">{instructions.fa}</p>
      </div>

      {/* Receipt upload */}
      <form onSubmit={handleUpload} className="space-y-4">
        <h3 className="text-base font-black">آپلود رسید واریزی</h3>

        <button
          type="button"
          className="flex w-full cursor-pointer flex-col items-center justify-center gap-2 border border-dashed border-border bg-card p-8 transition hover:border-gold/60"
          onClick={() => fileRef.current?.click()}
          aria-label="انتخاب تصویر رسید"
        >
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileChange}
          />
          {file ? (
            <span className="text-sm font-bold text-gold">{file.name}</span>
          ) : (
            <>
              <span className="text-2xl">📎</span>
              <span className="text-sm font-bold text-muted-foreground">
                کلیک کنید و تصویر رسید را انتخاب کنید
              </span>
            </>
          )}
        </button>

        {error ? (
          <p className="rounded border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm font-bold text-destructive">
            {error}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={uploading || !file}
          className="h-14 w-full rounded-full bg-gold text-base font-black text-luxe transition hover:brightness-110 disabled:opacity-50"
        >
          {uploading ? "در حال آپلود…" : "ارسال رسید و تأیید سفارش"}
        </button>
      </form>
    </div>
  );
}

// ─── Checkout Form ────────────────────────────────────────────────────────────

export function CheckoutClient({ cart, hasPhysical }: { cart: CartView; hasPhysical: boolean }) {
  const router = useRouter();
  const [method, setMethod] = useState<PaymentMethod>("MANUAL");
  const [shipping, setShipping] = useState<ShippingFields>(EMPTY_SHIPPING);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Card-to-card receipt step state
  const [receiptStep, setReceiptStep] = useState<{
    orderId: string;
    instructions: CardInstructions;
  } | null>(null);

  function updateShipping(field: keyof ShippingFields, value: string) {
    setShipping((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setPending(true);

    try {
      const body: Record<string, unknown> = { paymentMethod: method };

      if (hasPhysical) {
        body.shipping = shipping;
      }

      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });

      const payload = await res.json();

      if (!res.ok) {
        setError(payload?.error?.message ?? "خطا در ثبت سفارش.");
        return;
      }

      const { orderId, payment } = payload.data;

      if (payment?.redirectUrl) {
        window.location.assign(payment.redirectUrl);
      } else if (payment?.instructions?.cardNumber) {
        // Card-to-card: show receipt upload step
        setReceiptStep({ orderId, instructions: payment.instructions as CardInstructions });
      } else {
        router.push(`/account/orders/${orderId}`);
      }
    } catch {
      setError("خطا در ارتباط با سرور. لطفاً مجدداً تلاش کنید.");
    } finally {
      setPending(false);
    }
  }

  // Show receipt upload step for card-to-card orders
  if (receiptStep) {
    return <ReceiptStep orderId={receiptStep.orderId} instructions={receiptStep.instructions} />;
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-8" dir="rtl">
      {/* Payment method */}
      <section>
        <h2 className="mb-4 text-lg font-black">روش پرداخت</h2>
        <div className="space-y-3">
          {PAYMENT_METHODS.map(({ value, label }) => (
            <label
              key={value}
              className={`flex cursor-pointer items-center gap-3 border p-4 transition ${
                method === value
                  ? "border-gold bg-gold/5 text-foreground"
                  : "border-border bg-card text-foreground hover:border-gold/50"
              }`}
            >
              <input
                type="radio"
                name="paymentMethod"
                value={value}
                checked={method === value}
                onChange={() => setMethod(value)}
                className="accent-gold"
              />
              <span className="font-bold">{label}</span>
            </label>
          ))}
        </div>
      </section>

      {/* Address form — only for physical items */}
      {hasPhysical ? (
        <section>
          <h2 className="mb-4 text-lg font-black">آدرس ارسال</h2>
          <div className="space-y-4">
            <div>
              <label
                htmlFor="sh-name"
                className="mb-1 block text-sm font-bold text-muted-foreground"
              >
                نام گیرنده
              </label>
              <input
                id="sh-name"
                type="text"
                required
                value={shipping.customerName}
                onChange={(e) => updateShipping("customerName", e.target.value)}
                className="h-11 w-full border border-border bg-card px-4 text-sm outline-none focus:border-gold"
                placeholder="نام و نام خانوادگی"
              />
            </div>
            <div>
              <label
                htmlFor="sh-address"
                className="mb-1 block text-sm font-bold text-muted-foreground"
              >
                نشانی
              </label>
              <input
                id="sh-address"
                type="text"
                required
                value={shipping.addressLine}
                onChange={(e) => updateShipping("addressLine", e.target.value)}
                className="h-11 w-full border border-border bg-card px-4 text-sm outline-none focus:border-gold"
                placeholder="خیابان، کوچه، پلاک"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label
                  htmlFor="sh-city"
                  className="mb-1 block text-sm font-bold text-muted-foreground"
                >
                  شهر
                </label>
                <input
                  id="sh-city"
                  type="text"
                  required
                  value={shipping.city}
                  onChange={(e) => updateShipping("city", e.target.value)}
                  className="h-11 w-full border border-border bg-card px-4 text-sm outline-none focus:border-gold"
                  placeholder="تهران"
                />
              </div>
              <div>
                <label
                  htmlFor="sh-province"
                  className="mb-1 block text-sm font-bold text-muted-foreground"
                >
                  استان
                </label>
                <input
                  id="sh-province"
                  type="text"
                  required
                  value={shipping.province}
                  onChange={(e) => updateShipping("province", e.target.value)}
                  className="h-11 w-full border border-border bg-card px-4 text-sm outline-none focus:border-gold"
                  placeholder="تهران"
                />
              </div>
            </div>
            <div>
              <label
                htmlFor="sh-postal"
                className="mb-1 block text-sm font-bold text-muted-foreground"
              >
                کد پستی
              </label>
              <input
                id="sh-postal"
                type="text"
                required
                value={shipping.postalCode}
                onChange={(e) => updateShipping("postalCode", e.target.value)}
                className="h-11 w-full border border-border bg-card px-4 text-sm outline-none focus:border-gold"
                placeholder="۱۲۳۴۵۶۷۸۹۰"
                maxLength={10}
              />
            </div>
          </div>
        </section>
      ) : null}

      {/* Error */}
      {error ? (
        <p className="rounded border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm font-bold text-destructive">
          {error}
        </p>
      ) : null}

      {/* Submit */}
      <button
        type="submit"
        disabled={pending || cart.items.length === 0}
        className="h-14 w-full rounded-full bg-gold text-base font-black text-luxe transition hover:brightness-110 disabled:opacity-50"
      >
        {pending ? "در حال پردازش…" : "نهایی کردن سفارش"}
      </button>
    </form>
  );
}
