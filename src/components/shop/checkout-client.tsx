"use client";

import { useRouter } from "next/navigation";
import { type ChangeEvent, type FormEvent, useRef, useState } from "react";
import { toast } from "sonner";

import type { CartView } from "@/lib/cart";
import { formatToman } from "@/lib/format";

type PaymentMethod = "ZARINPAL" | "CARD_TO_CARD" | "MANUAL";

interface AppliedCoupon {
  code: string;
  discountAmount: number;
}

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

export function CheckoutClient({
  cart,
  hasPhysical,
  hasDigital = false,
  defaultShipping,
  defaultEmail = "",
}: {
  cart: CartView;
  hasPhysical: boolean;
  hasDigital?: boolean;
  defaultShipping?: ShippingFields;
  defaultEmail?: string;
}) {
  const router = useRouter();
  const [method, setMethod] = useState<PaymentMethod>("MANUAL");
  const [shipping, setShipping] = useState<ShippingFields>(defaultShipping ?? EMPTY_SHIPPING);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Capture fields
  const [customerEmail, setCustomerEmail] = useState(defaultEmail);
  const [isGift, setIsGift] = useState(false);
  const [recipientEmail, setRecipientEmail] = useState("");
  const [giftMessage, setGiftMessage] = useState("");

  // Coupon state
  const [couponInput, setCouponInput] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState<AppliedCoupon | null>(null);
  const [couponPending, setCouponPending] = useState(false);

  // Card-to-card receipt step state
  const [receiptStep, setReceiptStep] = useState<{
    orderId: string;
    instructions: CardInstructions;
  } | null>(null);

  // Live totals — server stays authoritative; this is a convenience preview.
  const subtotal = cart.subtotal;
  const discount = appliedCoupon?.discountAmount ?? 0;
  const total = Math.max(0, subtotal - discount);

  function updateShipping(field: keyof ShippingFields, value: string) {
    setShipping((prev) => ({ ...prev, [field]: value }));
  }

  async function applyCoupon() {
    const code = couponInput.trim();
    if (!code) {
      toast.error("کد تخفیف را وارد کنید.");
      return;
    }

    setCouponPending(true);
    try {
      const res = await fetch("/api/coupons/validate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ code, subtotal }),
      });
      const payload = await res.json();

      if (!res.ok) {
        setAppliedCoupon(null);
        toast.error(payload?.error?.message ?? "کد تخفیف معتبر نیست.");
        return;
      }

      const { code: canonicalCode, discountAmount } = payload.data;
      setAppliedCoupon({ code: canonicalCode, discountAmount });
      setCouponInput(canonicalCode);
      toast.success(`کد تخفیف اعمال شد: ${formatToman(discountAmount)} تخفیف`);
    } catch {
      toast.error("خطا در بررسی کد تخفیف. لطفاً مجدداً تلاش کنید.");
    } finally {
      setCouponPending(false);
    }
  }

  function removeCoupon() {
    setAppliedCoupon(null);
    setCouponInput("");
    toast("کد تخفیف حذف شد.");
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

      const trimmedEmail = customerEmail.trim();
      if (trimmedEmail) {
        body.customerEmail = trimmedEmail;
      }

      if (isGift) {
        body.gift = {
          isGift: true,
          recipientEmail: recipientEmail.trim() || undefined,
          giftMessage: giftMessage.trim() || undefined,
        };
      }

      if (appliedCoupon) {
        body.couponCode = appliedCoupon.code;
      }

      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });

      const payload = await res.json();

      if (!res.ok) {
        const message = payload?.error?.message ?? "خطا در ثبت سفارش.";
        setError(message);
        toast.error(message);
        // A coupon may have been exhausted/expired between preview and submit.
        if (payload?.error?.code === "INVALID_COUPON") {
          setAppliedCoupon(null);
        }
        return;
      }

      toast.success("سفارش با موفقیت ثبت شد.");

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
      const message = "خطا در ارتباط با سرور. لطفاً مجدداً تلاش کنید.";
      setError(message);
      toast.error(message);
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
      {/* Buyer email */}
      <section>
        <h2 className="mb-4 text-lg font-black">ایمیل خریدار</h2>
        <div>
          <label
            htmlFor="buyer-email"
            className="mb-1 block text-sm font-bold text-muted-foreground"
          >
            ایمیل
          </label>
          <input
            id="buyer-email"
            type="email"
            required={hasDigital}
            value={customerEmail}
            onChange={(e) => setCustomerEmail(e.target.value)}
            className="h-11 w-full border border-border bg-card px-4 text-sm outline-none focus:border-gold"
            placeholder="name@example.com"
            dir="ltr"
            inputMode="email"
            autoComplete="email"
          />
          <p className="mt-2 text-xs leading-6 text-muted-foreground">
            کد خرید به این ایمیل ارسال می‌شود.
          </p>
        </div>
      </section>

      {/* Gift */}
      <section>
        <label className="flex cursor-pointer items-center gap-3">
          <input
            type="checkbox"
            checked={isGift}
            onChange={(e) => setIsGift(e.target.checked)}
            className="size-4 accent-gold"
          />
          <span className="text-lg font-black">این خرید هدیه است</span>
        </label>

        {isGift ? (
          <div className="mt-4 space-y-4 border-r-2 border-gold/40 pr-4">
            <p className="text-xs leading-6 text-muted-foreground">
              کد خرید به جای شما، به ایمیل گیرنده ارسال می‌شود.
            </p>
            <div>
              <label
                htmlFor="recipient-email"
                className="mb-1 block text-sm font-bold text-muted-foreground"
              >
                ایمیل گیرنده
              </label>
              <input
                id="recipient-email"
                type="email"
                required={isGift}
                value={recipientEmail}
                onChange={(e) => setRecipientEmail(e.target.value)}
                className="h-11 w-full border border-border bg-card px-4 text-sm outline-none focus:border-gold"
                placeholder="recipient@example.com"
                dir="ltr"
                inputMode="email"
              />
            </div>
            <div>
              <label
                htmlFor="gift-message"
                className="mb-1 block text-sm font-bold text-muted-foreground"
              >
                پیام هدیه (اختیاری)
              </label>
              <textarea
                id="gift-message"
                value={giftMessage}
                onChange={(e) => setGiftMessage(e.target.value)}
                rows={3}
                maxLength={500}
                className="w-full resize-none border border-border bg-card px-4 py-3 text-sm outline-none focus:border-gold"
                placeholder="پیام شما برای گیرنده هدیه…"
              />
            </div>
          </div>
        ) : null}
      </section>

      {/* Coupon */}
      <section>
        <h2 className="mb-4 text-lg font-black">کد تخفیف</h2>
        {appliedCoupon ? (
          <div className="flex items-center justify-between border border-gold/40 bg-gold/5 px-4 py-3">
            <div className="flex flex-col gap-1">
              <span className="font-mono text-sm font-black text-gold" dir="ltr">
                {appliedCoupon.code}
              </span>
              <span className="text-xs text-muted-foreground">
                {formatToman(appliedCoupon.discountAmount)} تخفیف اعمال شد
              </span>
            </div>
            <button
              type="button"
              onClick={removeCoupon}
              className="text-sm font-bold text-destructive hover:underline"
            >
              حذف
            </button>
          </div>
        ) : (
          <div className="flex gap-2">
            <input
              type="text"
              value={couponInput}
              onChange={(e) => setCouponInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  applyCoupon();
                }
              }}
              className="h-11 flex-1 border border-border bg-card px-4 text-sm outline-none focus:border-gold"
              placeholder="کد تخفیف را وارد کنید"
              dir="ltr"
            />
            <button
              type="button"
              onClick={applyCoupon}
              disabled={couponPending || !couponInput.trim()}
              className="h-11 shrink-0 rounded-full bg-foreground px-6 text-sm font-black text-background transition hover:brightness-110 disabled:opacity-50"
            >
              {couponPending ? "…" : "اعمال"}
            </button>
          </div>
        )}
      </section>

      {/* Order totals — server stays authoritative; this preview reflects coupon. */}
      <section className="border-t border-border pt-6">
        <div className="space-y-2 text-sm">
          <div className="flex items-center justify-between text-muted-foreground">
            <span>جمع جزء</span>
            <span>{formatToman(subtotal)}</span>
          </div>
          {discount > 0 ? (
            <div className="flex items-center justify-between text-gold">
              <span>تخفیف</span>
              <span dir="ltr">−{formatToman(discount)}</span>
            </div>
          ) : null}
          <div className="flex items-center justify-between border-t border-border pt-3 text-lg font-black">
            <span>جمع کل</span>
            <span className="text-gold">{formatToman(total)}</span>
          </div>
        </div>
      </section>

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
