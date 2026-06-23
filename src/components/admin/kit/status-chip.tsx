import { Badge } from "@/components/ui/badge";

type Variant = "default" | "secondary" | "destructive" | "outline";
type Meta = { label: string; variant: Variant };

export const STATUS_MAPS = {
  order: {
    PENDING: { label: "در انتظار", variant: "outline" },
    PAID: { label: "پرداخت‌شده", variant: "default" },
    PROCESSING: { label: "در حال پردازش", variant: "secondary" },
    SHIPPED: { label: "ارسال‌شده", variant: "secondary" },
    DELIVERED: { label: "تحویل‌شده", variant: "default" },
    CANCELLED: { label: "لغوشده", variant: "destructive" },
    REFUNDED: { label: "بازپرداخت‌شده", variant: "destructive" },
  },
  payment: {
    UNPAID: { label: "پرداخت‌نشده", variant: "outline" },
    AUTHORIZED: { label: "تأییدشده", variant: "secondary" },
    PAID: { label: "پرداخت‌شده", variant: "default" },
    FAILED: { label: "ناموفق", variant: "destructive" },
    REFUNDED: { label: "بازپرداخت‌شده", variant: "destructive" },
  },
  shipment: {
    PENDING: { label: "در انتظار", variant: "outline" },
    SHIPPED: { label: "ارسال‌شده", variant: "secondary" },
    IN_TRANSIT: { label: "در مسیر", variant: "secondary" },
    DELIVERED: { label: "تحویل‌شده", variant: "default" },
    RETURNED: { label: "مرجوعی", variant: "destructive" },
    CANCELLED: { label: "لغوشده", variant: "destructive" },
  },
  refund: {
    PENDING: { label: "در انتظار", variant: "outline" },
    PROCESSING: { label: "در حال انجام", variant: "secondary" },
    COMPLETED: { label: "انجام‌شده", variant: "default" },
    FAILED: { label: "ناموفق", variant: "destructive" },
    REJECTED: { label: "ردشده", variant: "destructive" },
  },
  subscription: {
    TRIALING: { label: "آزمایشی", variant: "secondary" },
    ACTIVE: { label: "فعال", variant: "default" },
    PAST_DUE: { label: "معوق", variant: "destructive" },
    CANCELED: { label: "لغوشده", variant: "destructive" },
    EXPIRED: { label: "منقضی", variant: "outline" },
    PAUSED: { label: "متوقف", variant: "outline" },
  },
  giftCard: {
    ACTIVE: { label: "فعال", variant: "default" },
    REDEEMED: { label: "استفاده‌شده", variant: "secondary" },
    DISABLED: { label: "غیرفعال", variant: "outline" },
    EXPIRED: { label: "منقضی", variant: "outline" },
  },
  review: {
    PENDING: { label: "در انتظار", variant: "outline" },
    APPROVED: { label: "تأییدشده", variant: "default" },
    REJECTED: { label: "ردشده", variant: "destructive" },
  },
  product: {
    DRAFT: { label: "پیش‌نویس", variant: "outline" },
    ACTIVE: { label: "فعال", variant: "default" },
    DISABLED: { label: "غیرفعال", variant: "secondary" },
    ARCHIVED: { label: "بایگانی", variant: "outline" },
  },
} as const satisfies Record<string, Record<string, Meta>>;

export type StatusKind = keyof typeof STATUS_MAPS;

export function statusMeta(kind: StatusKind, value: string): Meta {
  const map = STATUS_MAPS[kind] as Record<string, Meta>;
  return map[value] ?? { label: value, variant: "outline" };
}

export function StatusChip({ kind, value }: { kind: StatusKind; value: string }) {
  const meta = statusMeta(kind, value);
  return <Badge variant={meta.variant}>{meta.label}</Badge>;
}
