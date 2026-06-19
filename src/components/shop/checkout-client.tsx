"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";

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

export function CheckoutClient({ cart, hasPhysical }: { cart: CartView; hasPhysical: boolean }) {
  const router = useRouter();
  const [method, setMethod] = useState<PaymentMethod>("MANUAL");
  const [shipping, setShipping] = useState<ShippingFields>(EMPTY_SHIPPING);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
      } else {
        router.push(`/account/orders/${orderId}`);
      }
    } catch {
      setError("خطا در ارتباط با سرور. لطفاً مجدداً تلاش کنید.");
    } finally {
      setPending(false);
    }
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
