import type { CommChannel, NotificationType } from "@/db/schema";

/**
 * The catalog of dispatchable events. Single source of truth for the dispatcher
 * (`dispatch.ts`), the seeded templates (`templates.ts`), and the admin Templates
 * editor (which reads `variables` to show the available {placeholders}).
 */

export type CommEventKey =
  | "ORDER_CREATED"
  | "ORDER_PAID"
  | "DIGITAL_CODES_DELIVERED"
  | "PAYMENT_FAILED"
  | "ORDER_SHIPPED"
  | "ORDER_DELIVERED"
  | "ORDER_CANCELLED"
  | "ORDER_REFUNDED"
  | "TICKET_CREATED"
  | "TICKET_REPLIED_TO_USER"
  | "TICKET_REPLIED_TO_STAFF";

/** Channels an event may dispatch over (subset of the ledger's channels). */
export type CommEventChannel = Extract<CommChannel, "EMAIL" | "SMS" | "INAPP" | "PUSH">;

export type CommEventDef = {
  key: CommEventKey;
  labelFa: string;
  channels: CommEventChannel[];
  /** Preference toggle that gates delivery: "order"→orderEmail/orderSms, "promo"→promo*, null→always. */
  prefGate: "order" | "promo" | null;
  /** In-app notification row type. */
  notificationType: NotificationType;
  /** Transactional events ignore promo opt-out (still respect order* toggles). */
  transactional: boolean;
  /** Who receives it: the customer (order/ticket owner) or staff (ops + admins). */
  audience: "customer" | "staff";
  /** Template {variables} available to this event (for the admin editor chips). */
  variables: string[];
};

const ORDER_VARS = ["order_number", "customer_name", "total", "status", "href"];

export const EVENTS: Record<CommEventKey, CommEventDef> = {
  ORDER_CREATED: {
    key: "ORDER_CREATED",
    labelFa: "ثبت سفارش",
    channels: ["EMAIL", "INAPP"],
    prefGate: "order",
    notificationType: "ORDER",
    transactional: true,
    audience: "customer",
    variables: ORDER_VARS,
  },
  ORDER_PAID: {
    key: "ORDER_PAID",
    // EMAIL omitted: the rich itemized receipt email is sent inline by
    // sendOrderEmails (structured data, not a flat template). notify() adds the
    // confirmation SMS + in-app only, so customers never get two paid emails.
    labelFa: "پرداخت سفارش",
    channels: ["SMS", "INAPP"],
    prefGate: "order",
    notificationType: "PAYMENT",
    transactional: true,
    audience: "customer",
    variables: ORDER_VARS,
  },
  DIGITAL_CODES_DELIVERED: {
    key: "DIGITAL_CODES_DELIVERED",
    // EMAIL omitted: the grouped-by-product codes email is sent inline by
    // sendOrderEmails. notify() owns the (admin-editable) codes SMS.
    labelFa: "تحویل کد دیجیتال",
    channels: ["SMS"],
    prefGate: "order",
    notificationType: "ORDER",
    transactional: true,
    audience: "customer",
    variables: ["order_number", "codes", "codes_count", "href"],
  },
  PAYMENT_FAILED: {
    key: "PAYMENT_FAILED",
    labelFa: "ناموفق‌بودن پرداخت",
    channels: ["EMAIL", "INAPP"],
    prefGate: "order",
    notificationType: "PAYMENT",
    transactional: true,
    audience: "customer",
    variables: ["order_number", "href"],
  },
  ORDER_SHIPPED: {
    key: "ORDER_SHIPPED",
    labelFa: "ارسال سفارش",
    channels: ["SMS", "INAPP", "EMAIL"],
    prefGate: "order",
    notificationType: "ORDER",
    transactional: true,
    audience: "customer",
    variables: ["order_number", "customer_name", "tracking", "href"],
  },
  ORDER_DELIVERED: {
    key: "ORDER_DELIVERED",
    labelFa: "تحویل سفارش",
    channels: ["SMS", "INAPP"],
    prefGate: "order",
    notificationType: "ORDER",
    transactional: true,
    audience: "customer",
    variables: ["order_number", "href"],
  },
  ORDER_CANCELLED: {
    key: "ORDER_CANCELLED",
    labelFa: "لغو سفارش",
    channels: ["EMAIL", "INAPP"],
    prefGate: "order",
    notificationType: "ORDER",
    transactional: true,
    audience: "customer",
    variables: ["order_number", "href"],
  },
  ORDER_REFUNDED: {
    key: "ORDER_REFUNDED",
    labelFa: "بازگشت وجه",
    channels: ["EMAIL", "INAPP"],
    prefGate: "order",
    notificationType: "PAYMENT",
    transactional: true,
    audience: "customer",
    variables: ["order_number", "amount", "href"],
  },
  TICKET_CREATED: {
    key: "TICKET_CREATED",
    labelFa: "تیکت جدید (اطلاع به پشتیبانی)",
    channels: ["EMAIL", "INAPP"],
    prefGate: null,
    notificationType: "SYSTEM",
    transactional: true,
    audience: "staff",
    variables: ["ticket_id", "ticket_subject", "href"],
  },
  TICKET_REPLIED_TO_USER: {
    key: "TICKET_REPLIED_TO_USER",
    labelFa: "پاسخ پشتیبانی به کاربر",
    channels: ["EMAIL", "INAPP"],
    prefGate: null,
    notificationType: "SYSTEM",
    transactional: true,
    audience: "customer",
    variables: ["ticket_id", "ticket_subject", "href"],
  },
  TICKET_REPLIED_TO_STAFF: {
    key: "TICKET_REPLIED_TO_STAFF",
    labelFa: "پاسخ کاربر (اطلاع به پشتیبانی)",
    channels: ["EMAIL", "INAPP"],
    prefGate: null,
    notificationType: "SYSTEM",
    transactional: true,
    audience: "staff",
    variables: ["ticket_id", "ticket_subject", "href"],
  },
};

export const EVENT_LIST: CommEventDef[] = Object.values(EVENTS);

export function isCommEventKey(value: string): value is CommEventKey {
  return value in EVENTS;
}
