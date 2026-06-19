export type StatusTone = "success" | "warning" | "danger" | "info" | "muted";

const TONE_CLASS: Record<StatusTone, string> = {
  success: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  warning: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  danger: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
  info: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
  muted: "bg-muted text-muted-foreground",
};

export function toneClass(tone: StatusTone): string {
  return TONE_CLASS[tone];
}

type StatusMeta = { label: string; tone: StatusTone };

export const ORDER_STATUS: Record<string, StatusMeta> = {
  PENDING: { label: "در انتظار", tone: "warning" },
  PAID: { label: "پرداخت شده", tone: "info" },
  PROCESSING: { label: "در حال پردازش", tone: "info" },
  SHIPPED: { label: "ارسال شده", tone: "info" },
  DELIVERED: { label: "تحویل شده", tone: "success" },
  CANCELLED: { label: "لغو شده", tone: "muted" },
  REFUNDED: { label: "مسترد شده", tone: "danger" },
};

export const PAYMENT_STATUS: Record<string, StatusMeta> = {
  UNPAID: { label: "پرداخت نشده", tone: "warning" },
  AUTHORIZED: { label: "تأیید اولیه", tone: "info" },
  PAID: { label: "پرداخت شده", tone: "success" },
  FAILED: { label: "ناموفق", tone: "danger" },
  REFUNDED: { label: "مسترد شده", tone: "muted" },
};

export function orderStatusMeta(status: string): StatusMeta {
  return ORDER_STATUS[status] ?? { label: status, tone: "muted" };
}

export function paymentStatusMeta(status: string): StatusMeta {
  return PAYMENT_STATUS[status] ?? { label: status, tone: "muted" };
}
