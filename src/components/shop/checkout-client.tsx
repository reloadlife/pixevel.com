"use client";

import {
  Banknote,
  Building2,
  CreditCard,
  Gift,
  Loader2,
  Mail,
  Phone,
  Smartphone,
  Tag,
  Upload,
  Wallet,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { type ChangeEvent, type ComponentType, type FormEvent, useRef, useState } from "react";
import { toast } from "sonner";
import type { CartView } from "@/lib/cart";
import { formatToman, toFaNumber } from "@/lib/format";
import {
  PAYMENT_METHOD_GROUPS,
  PAYMENT_METHODS,
  type PaymentMethodGroup,
  type PaymentMethodMeta,
} from "@/lib/payments/methods";
import type { PaymentMethod } from "@/lib/payments/provider";
import { cn } from "@/lib/utils";

interface AppliedCoupon {
  code: string;
  discountAmount: number;
}

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

const METHOD_ICONS: Record<PaymentMethod, ComponentType<{ className?: string }>> = {
  ZARINPAL: CreditCard,
  BEHPARDAKHT: Building2,
  SAMAN: Building2,
  SNAPPPAY: Wallet,
  DIGIPAY: Wallet,
  CARD_TO_CARD: Banknote,
};

const GROUP_ICONS: Record<PaymentMethodGroup, ComponentType<{ className?: string }>> = {
  ONLINE: CreditCard,
  INSTALLMENT: Wallet,
  TRANSFER: Banknote,
};

const inputClass =
  "h-11 w-full rounded-md border border-border bg-background px-4 text-sm text-foreground outline-none transition placeholder:text-muted-foreground focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/40";

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
    <div className="mx-auto max-w-xl space-y-6" dir="rtl">
      {/* Instructions card */}
      <div className="rounded-xl border border-primary/30 bg-primary/5 p-6">
        <div className="mb-4 flex items-center gap-2">
          <Banknote className="size-5 text-primary" aria-hidden="true" />
          <h2 className="text-lg font-black text-foreground">اطلاعات پرداخت کارت به کارت</h2>
        </div>
        <div className="mb-4 space-y-3">
          <div className="flex items-center gap-3">
            <span className="w-24 text-sm font-bold text-muted-foreground">شماره کارت</span>
            <span className="text-base font-black tracking-widest text-foreground" dir="ltr">
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
        <h3 className="text-base font-black text-foreground">آپلود رسید واریزی</h3>

        <button
          type="button"
          className="flex w-full cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-card p-8 text-card-foreground transition hover:border-primary/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
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
            <span className="text-sm font-bold text-primary">{file.name}</span>
          ) : (
            <>
              <Upload className="size-7 text-muted-foreground" aria-hidden="true" />
              <span className="text-sm font-bold text-muted-foreground">
                کلیک کنید و تصویر رسید را انتخاب کنید
              </span>
            </>
          )}
        </button>

        {error ? (
          <p className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm font-bold text-destructive">
            {error}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={uploading || !file}
          className="flex h-14 w-full items-center justify-center gap-2 rounded-full bg-primary text-base font-black text-primary-foreground transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 disabled:opacity-50"
        >
          {uploading ? (
            <Loader2 className="size-5 animate-spin" aria-hidden="true" />
          ) : (
            <Upload className="size-5" aria-hidden="true" />
          )}
          {uploading ? "در حال آپلود…" : "ارسال رسید و تأیید سفارش"}
        </button>
      </form>
    </div>
  );
}

// ─── Order Summary ────────────────────────────────────────────────────────────

function OrderSummary({
  cart,
  subtotal,
  discount,
  total,
  couponInput,
  setCouponInput,
  appliedCoupon,
  couponPending,
  applyCoupon,
  removeCoupon,
}: {
  cart: CartView;
  subtotal: number;
  discount: number;
  total: number;
  couponInput: string;
  setCouponInput: (value: string) => void;
  appliedCoupon: AppliedCoupon | null;
  couponPending: boolean;
  applyCoupon: () => void;
  removeCoupon: () => void;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-5 text-card-foreground sm:p-6">
      <h2 className="mb-4 text-lg font-black">خلاصه سفارش</h2>

      {/* Line items */}
      <ul className="space-y-3">
        {cart.items.map((item) => (
          <li key={item.variantId} className="flex items-center gap-3">
            <div className="relative size-14 shrink-0 overflow-hidden rounded-md bg-muted">
              {item.imageUrl ? (
                <img
                  src={item.imageUrl}
                  alt={item.titleFa}
                  className="h-full w-full object-cover"
                />
              ) : null}
              <span className="absolute -left-1 -top-1 flex size-5 items-center justify-center rounded-full bg-foreground text-[10px] font-black text-background">
                {toFaNumber(item.quantity)}
              </span>
            </div>
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="truncate text-sm font-bold">{item.titleFa}</span>
              <span className="truncate text-xs text-muted-foreground">{item.variantTitleFa}</span>
            </div>
            <span className="shrink-0 text-sm font-black">{formatToman(item.lineTotal)}</span>
          </li>
        ))}
      </ul>

      {/* Coupon */}
      <div className="mt-5 border-t border-border pt-5">
        {appliedCoupon ? (
          <div className="flex items-center justify-between rounded-md border border-primary/40 bg-primary/5 px-4 py-3">
            <div className="flex items-center gap-2">
              <Tag className="size-4 text-primary" aria-hidden="true" />
              <div className="flex flex-col gap-0.5">
                <span className="text-sm font-black text-primary" dir="ltr">
                  {appliedCoupon.code}
                </span>
                <span className="text-xs text-muted-foreground">
                  {formatToman(appliedCoupon.discountAmount)} تخفیف اعمال شد
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={removeCoupon}
              className="flex items-center gap-1 text-sm font-bold text-destructive hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-destructive/40"
            >
              <X className="size-4" aria-hidden="true" />
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
              className={inputClass}
              placeholder="کد تخفیف"
              dir="ltr"
              aria-label="کد تخفیف"
            />
            <button
              type="button"
              onClick={applyCoupon}
              disabled={couponPending || !couponInput.trim()}
              className="flex h-11 shrink-0 items-center justify-center rounded-full bg-foreground px-6 text-sm font-black text-background transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/40 disabled:opacity-50"
            >
              {couponPending ? (
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              ) : (
                "اعمال"
              )}
            </button>
          </div>
        )}
      </div>

      {/* Totals */}
      <div className="mt-5 space-y-2 border-t border-border pt-5 text-sm">
        <div className="flex items-center justify-between text-muted-foreground">
          <span>جمع جزء</span>
          <span>{formatToman(subtotal)}</span>
        </div>
        {discount > 0 ? (
          <div className="flex items-center justify-between text-primary">
            <span>تخفیف</span>
            <span dir="ltr">−{formatToman(discount)}</span>
          </div>
        ) : null}
        <div className="flex items-center justify-between border-t border-border pt-3 text-lg font-black">
          <span>جمع کل</span>
          <span className="text-primary">{formatToman(total)}</span>
        </div>
      </div>
    </div>
  );
}

// ─── Payment Method Card ──────────────────────────────────────────────────────

function MethodCard({
  meta,
  enabled,
  selected,
  onSelect,
}: {
  meta: PaymentMethodMeta;
  enabled: boolean;
  selected: boolean;
  onSelect: () => void;
}) {
  const Icon = METHOD_ICONS[meta.method];

  return (
    <label
      className={cn(
        "flex items-center gap-3 rounded-lg border p-4 transition",
        enabled
          ? "cursor-pointer focus-within:ring-2 focus-within:ring-primary/40"
          : "cursor-not-allowed opacity-60",
        selected ? "border-primary bg-primary/5" : "border-border bg-card",
        enabled && !selected ? "hover:border-primary/50" : "",
      )}
    >
      <input
        type="radio"
        name="paymentMethod"
        value={meta.method}
        checked={selected}
        disabled={!enabled}
        onChange={onSelect}
        className="size-4 shrink-0 accent-primary"
      />
      <Icon
        className={cn("size-5 shrink-0", selected ? "text-primary" : "text-muted-foreground")}
        aria-hidden="true"
      />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="flex items-center gap-2">
          <span className="font-bold text-foreground">{meta.label}</span>
          {!enabled ? (
            <span className="rounded-full border border-border bg-muted px-2 py-0.5 text-[10px] font-black text-muted-foreground">
              به‌زودی
            </span>
          ) : null}
        </span>
        <span className="truncate text-xs text-muted-foreground">{meta.description}</span>
      </span>
    </label>
  );
}

// ─── Checkout Form ────────────────────────────────────────────────────────────

export function CheckoutClient({
  cart,
  hasPhysical,
  hasDigital = false,
  defaultShipping,
  defaultEmail = "",
  enabledMethods,
}: {
  cart: CartView;
  hasPhysical: boolean;
  hasDigital?: boolean;
  defaultShipping?: ShippingFields;
  defaultEmail?: string;
  enabledMethods: PaymentMethod[];
}) {
  const router = useRouter();

  const enabledSet = new Set(enabledMethods);
  const firstEnabled =
    PAYMENT_METHODS.find((m) => enabledSet.has(m.method))?.method ?? PAYMENT_METHODS[0].method;

  const [method, setMethod] = useState<PaymentMethod>(firstEnabled);
  const [shipping, setShipping] = useState<ShippingFields>(defaultShipping ?? EMPTY_SHIPPING);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Capture fields
  const [customerEmail, setCustomerEmail] = useState(defaultEmail);
  const [isGift, setIsGift] = useState(false);
  const [recipientEmail, setRecipientEmail] = useState("");
  const [recipientPhone, setRecipientPhone] = useState("");
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

    // Gift requires at least one of email/phone.
    if (isGift && !recipientEmail.trim() && !recipientPhone.trim()) {
      toast.error("ایمیل یا موبایل گیرنده هدیه را وارد کنید.");
      return;
    }

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
          recipientPhone: recipientPhone.trim() || undefined,
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

  const summary = (
    <OrderSummary
      cart={cart}
      subtotal={subtotal}
      discount={discount}
      total={total}
      couponInput={couponInput}
      setCouponInput={setCouponInput}
      appliedCoupon={appliedCoupon}
      couponPending={couponPending}
      applyCoupon={applyCoupon}
      removeCoupon={removeCoupon}
    />
  );

  return (
    <div dir="rtl" className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start">
      {/* Summary first on mobile, sidebar on desktop */}
      <aside className="order-first lg:order-last lg:sticky lg:top-6">{summary}</aside>

      <form onSubmit={handleSubmit} className="order-last space-y-8 lg:order-first">
        {/* Buyer email */}
        <section>
          <h2 className="mb-4 flex items-center gap-2 text-lg font-black text-foreground">
            <Mail className="size-5 text-muted-foreground" aria-hidden="true" />
            ایمیل خریدار
          </h2>
          <div>
            <label
              htmlFor="buyer-email"
              className="mb-1.5 block text-sm font-bold text-muted-foreground"
            >
              ایمیل
            </label>
            <input
              id="buyer-email"
              type="email"
              required={hasDigital}
              value={customerEmail}
              onChange={(e) => setCustomerEmail(e.target.value)}
              className={inputClass}
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
              className="size-4 accent-primary"
            />
            <Gift className="size-5 text-muted-foreground" aria-hidden="true" />
            <span className="text-lg font-black text-foreground">این خرید هدیه است</span>
          </label>

          {isGift ? (
            <div className="mt-4 space-y-4 border-r-2 border-primary/40 pr-4">
              <p className="text-xs leading-6 text-muted-foreground">
                حداقل یکی را وارد کنید؛ کد به همان ارسال می‌شود.
              </p>
              <div>
                <label
                  htmlFor="recipient-email"
                  className="mb-1.5 flex items-center gap-1.5 text-sm font-bold text-muted-foreground"
                >
                  <Mail className="size-4" aria-hidden="true" />
                  ایمیل گیرنده
                </label>
                <input
                  id="recipient-email"
                  type="email"
                  value={recipientEmail}
                  onChange={(e) => setRecipientEmail(e.target.value)}
                  className={inputClass}
                  placeholder="recipient@example.com"
                  dir="ltr"
                  inputMode="email"
                />
              </div>
              <div>
                <label
                  htmlFor="recipient-phone"
                  className="mb-1.5 flex items-center gap-1.5 text-sm font-bold text-muted-foreground"
                >
                  <Phone className="size-4" aria-hidden="true" />
                  موبایل گیرنده
                </label>
                <input
                  id="recipient-phone"
                  type="tel"
                  value={recipientPhone}
                  onChange={(e) => setRecipientPhone(e.target.value)}
                  className={inputClass}
                  placeholder="0912xxxxxxx"
                  dir="ltr"
                  inputMode="tel"
                />
              </div>
              <div>
                <label
                  htmlFor="gift-message"
                  className="mb-1.5 block text-sm font-bold text-muted-foreground"
                >
                  پیام هدیه (اختیاری)
                </label>
                <textarea
                  id="gift-message"
                  value={giftMessage}
                  onChange={(e) => setGiftMessage(e.target.value)}
                  rows={3}
                  maxLength={500}
                  className="w-full resize-none rounded-md border border-border bg-background px-4 py-3 text-sm text-foreground outline-none transition placeholder:text-muted-foreground focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/40"
                  placeholder="پیام شما برای گیرنده هدیه…"
                />
              </div>
            </div>
          ) : null}
        </section>

        {/* Payment method */}
        <section>
          <h2 className="mb-4 flex items-center gap-2 text-lg font-black text-foreground">
            <Wallet className="size-5 text-muted-foreground" aria-hidden="true" />
            روش پرداخت
          </h2>
          <div className="space-y-6">
            {PAYMENT_METHOD_GROUPS.map((group) => {
              const methods = PAYMENT_METHODS.filter((m) => m.group === group.group);
              if (methods.length === 0) {
                return null;
              }
              const GroupIcon = GROUP_ICONS[group.group];
              return (
                <div key={group.group}>
                  <div className="mb-3 flex items-center gap-2">
                    <GroupIcon className="size-4 text-muted-foreground" aria-hidden="true" />
                    <h3 className="text-sm font-black text-muted-foreground">{group.label}</h3>
                  </div>
                  <div className="space-y-3">
                    {methods.map((meta) => (
                      <MethodCard
                        key={meta.method}
                        meta={meta}
                        enabled={enabledSet.has(meta.method)}
                        selected={method === meta.method}
                        onSelect={() => setMethod(meta.method)}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Address form — only for physical items */}
        {hasPhysical ? (
          <section>
            <h2 className="mb-4 flex items-center gap-2 text-lg font-black text-foreground">
              <Smartphone className="size-5 text-muted-foreground" aria-hidden="true" />
              آدرس ارسال
            </h2>
            <div className="space-y-4">
              <div>
                <label
                  htmlFor="sh-name"
                  className="mb-1.5 block text-sm font-bold text-muted-foreground"
                >
                  نام گیرنده
                </label>
                <input
                  id="sh-name"
                  type="text"
                  required
                  value={shipping.customerName}
                  onChange={(e) => updateShipping("customerName", e.target.value)}
                  className={inputClass}
                  placeholder="نام و نام خانوادگی"
                />
              </div>
              <div>
                <label
                  htmlFor="sh-address"
                  className="mb-1.5 block text-sm font-bold text-muted-foreground"
                >
                  نشانی
                </label>
                <input
                  id="sh-address"
                  type="text"
                  required
                  value={shipping.addressLine}
                  onChange={(e) => updateShipping("addressLine", e.target.value)}
                  className={inputClass}
                  placeholder="خیابان، کوچه، پلاک"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label
                    htmlFor="sh-city"
                    className="mb-1.5 block text-sm font-bold text-muted-foreground"
                  >
                    شهر
                  </label>
                  <input
                    id="sh-city"
                    type="text"
                    required
                    value={shipping.city}
                    onChange={(e) => updateShipping("city", e.target.value)}
                    className={inputClass}
                    placeholder="تهران"
                  />
                </div>
                <div>
                  <label
                    htmlFor="sh-province"
                    className="mb-1.5 block text-sm font-bold text-muted-foreground"
                  >
                    استان
                  </label>
                  <input
                    id="sh-province"
                    type="text"
                    required
                    value={shipping.province}
                    onChange={(e) => updateShipping("province", e.target.value)}
                    className={inputClass}
                    placeholder="تهران"
                  />
                </div>
              </div>
              <div>
                <label
                  htmlFor="sh-postal"
                  className="mb-1.5 block text-sm font-bold text-muted-foreground"
                >
                  کد پستی
                </label>
                <input
                  id="sh-postal"
                  type="text"
                  required
                  value={shipping.postalCode}
                  onChange={(e) => updateShipping("postalCode", e.target.value)}
                  className={inputClass}
                  placeholder="۱۲۳۴۵۶۷۸۹۰"
                  maxLength={10}
                  dir="ltr"
                  inputMode="numeric"
                />
              </div>
            </div>
          </section>
        ) : null}

        {/* Error */}
        {error ? (
          <p className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm font-bold text-destructive">
            {error}
          </p>
        ) : null}

        {/* Submit */}
        <button
          type="submit"
          disabled={pending || cart.items.length === 0}
          className="flex h-14 w-full items-center justify-center gap-2 rounded-full bg-primary text-base font-black text-primary-foreground transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 disabled:opacity-50"
        >
          {pending ? <Loader2 className="size-5 animate-spin" aria-hidden="true" /> : null}
          {pending ? "در حال پردازش…" : "نهایی کردن سفارش"}
        </button>
      </form>
    </div>
  );
}
