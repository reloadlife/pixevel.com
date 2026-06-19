import type { PaymentMethod } from "./provider";

/**
 * Single source of truth for payment-method presentation + availability.
 *
 * A method is "enabled" when its required env vars are set. ZARINPAL and
 * CARD_TO_CARD ship with working defaults (sandbox / placeholder card), so they
 * are always enabled. The bank gateways and installment providers stay disabled
 * (shown as «به‌زودی» in the UI) until their merchant credentials are supplied —
 * the provider implementations read these exact env vars.
 */

export type PaymentMethodGroup = "ONLINE" | "INSTALLMENT" | "TRANSFER";

export type PaymentMethodMeta = {
  method: PaymentMethod;
  label: string;
  description: string;
  group: PaymentMethodGroup;
  /** Env vars that must all be present for the method to be enabled. */
  requiredEnv: string[];
  /** Always enabled regardless of env (sandbox / non-credential flows). */
  alwaysEnabled?: boolean;
};

export const PAYMENT_METHOD_GROUPS: { group: PaymentMethodGroup; label: string }[] = [
  { group: "ONLINE", label: "پرداخت آنلاین" },
  { group: "INSTALLMENT", label: "پرداخت قسطی" },
  { group: "TRANSFER", label: "کارت به کارت" },
];

export const PAYMENT_METHODS: PaymentMethodMeta[] = [
  {
    method: "ZARINPAL",
    label: "زرین‌پال",
    description: "پرداخت آنلاین با تمام کارت‌های بانکی",
    group: "ONLINE",
    requiredEnv: [],
    alwaysEnabled: true,
  },
  {
    method: "BEHPARDAKHT",
    label: "به‌پرداخت ملت",
    description: "درگاه مستقیم بانک ملت",
    group: "ONLINE",
    requiredEnv: ["BEHPARDAKHT_TERMINAL_ID", "BEHPARDAKHT_USERNAME", "BEHPARDAKHT_PASSWORD"],
  },
  {
    method: "SAMAN",
    label: "درگاه سامان",
    description: "درگاه مستقیم بانک سامان",
    group: "ONLINE",
    requiredEnv: ["SAMAN_TERMINAL_ID"],
  },
  {
    method: "SNAPPPAY",
    label: "اسنپ‌پی",
    description: "خرید اقساطی بدون کارمزد",
    group: "INSTALLMENT",
    requiredEnv: [
      "SNAPPPAY_CLIENT_ID",
      "SNAPPPAY_CLIENT_SECRET",
      "SNAPPPAY_USERNAME",
      "SNAPPPAY_PASSWORD",
    ],
  },
  {
    method: "DIGIPAY",
    label: "دیجی‌پی",
    description: "خرید اقساطی دیجی‌پی",
    group: "INSTALLMENT",
    requiredEnv: [
      "DIGIPAY_CLIENT_ID",
      "DIGIPAY_CLIENT_SECRET",
      "DIGIPAY_USERNAME",
      "DIGIPAY_PASSWORD",
    ],
  },
  {
    method: "CARD_TO_CARD",
    label: "کارت به کارت",
    description: "واریز کارت‌به‌کارت و ارسال رسید",
    group: "TRANSFER",
    requiredEnv: [],
    alwaysEnabled: true,
  },
];

export function isMethodEnabled(meta: PaymentMethodMeta): boolean {
  if (meta.alwaysEnabled) return true;
  if (meta.requiredEnv.length === 0) return true;
  return meta.requiredEnv.every((key) => Boolean(process.env[key]));
}

/** The set of methods currently usable (server-side env check). */
export function getEnabledMethods(): PaymentMethod[] {
  return PAYMENT_METHODS.filter(isMethodEnabled).map((m) => m.method);
}

const VALID = new Set<PaymentMethod>(PAYMENT_METHODS.map((m) => m.method));

export function isPaymentMethod(value: unknown): value is PaymentMethod {
  return typeof value === "string" && VALID.has(value as PaymentMethod);
}
