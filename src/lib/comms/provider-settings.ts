/**
 * Declarative grouping of comms settings into per-provider cards for the
 * /admin/communications/settings UI. Keys reference {@link SETTINGS_REGISTRY};
 * webhook paths mirror the routes under `src/app/api/webhooks/sms/*`.
 */
export type CommsProviderCard = {
  id: "kavenegar" | "ippanel" | "selfhosted" | "telegram" | "resend";
  label: string;
  channel: "sms" | "email" | "telegram";
  /** Setting keys shown in this card, in display order. */
  keys: string[];
  /** Keys that must all be set for the provider to count as "configured". */
  requiredKeys: string[];
  /** When set, the test-send button posts `provider` to /api/admin/comms/test. */
  testProvider?: "kavenegar" | "ippanel" | "selfhosted";
  /** Webhook shared-secret key + the callback paths to surface for copy/paste. */
  webhookSecretKey?: string;
  webhookPaths?: { delivery?: string; receive?: string };
};

export const COMMS_PROVIDER_CARDS: CommsProviderCard[] = [
  {
    id: "kavenegar",
    label: "کاوه‌نگار",
    channel: "sms",
    keys: [
      "KAVENEGAR_TOKEN",
      "KAVENEGAR_OTP_TEMPLATE",
      "KAVENEGAR_SENDER",
      "KAVENEGAR_TIMEOUT_MS",
      "KAVENEGAR_WEBHOOK_SECRET",
    ],
    requiredKeys: ["KAVENEGAR_TOKEN"],
    testProvider: "kavenegar",
    webhookSecretKey: "KAVENEGAR_WEBHOOK_SECRET",
    webhookPaths: {
      delivery: "/api/webhooks/sms/kavenegar/delivery",
      receive: "/api/webhooks/sms/kavenegar/receive",
    },
  },
  {
    id: "ippanel",
    label: "آی‌پی‌پنل",
    channel: "sms",
    keys: [
      "IPPANEL_API_KEY",
      "IPPANEL_PATTERN_CODE",
      "IPPANEL_SENDER",
      "IPPANEL_PATTERN_VAR",
      "IPPANEL_TIMEOUT_MS",
      "IPPANEL_WEBHOOK_SECRET",
    ],
    requiredKeys: ["IPPANEL_API_KEY", "IPPANEL_PATTERN_CODE", "IPPANEL_SENDER"],
    testProvider: "ippanel",
    webhookSecretKey: "IPPANEL_WEBHOOK_SECRET",
    webhookPaths: {
      delivery: "/api/webhooks/sms/ippanel/delivery",
      receive: "/api/webhooks/sms/ippanel/receive",
    },
  },
  {
    id: "selfhosted",
    label: "گیت‌وی اختصاصی",
    channel: "sms",
    keys: [
      "SELFHOSTED_SMS_BASE_URL",
      "SELFHOSTED_SMS_TOKEN",
      "SELFHOSTED_SMS_SEND_PATH",
      "SELFHOSTED_SENDER",
      "SELFHOSTED_SMS_TIMEOUT_MS",
      "SELFHOSTED_WEBHOOK_SECRET",
    ],
    requiredKeys: ["SELFHOSTED_SMS_BASE_URL", "SELFHOSTED_SMS_TOKEN"],
    testProvider: "selfhosted",
    webhookSecretKey: "SELFHOSTED_WEBHOOK_SECRET",
    webhookPaths: {
      delivery: "/api/webhooks/sms/selfhosted/delivery",
      receive: "/api/webhooks/sms/selfhosted/receive",
    },
  },
  {
    id: "telegram",
    label: "تلگرام (رله توسعه)",
    channel: "telegram",
    keys: [
      "TELEGRAM_LOGIN_OTP_BOT_TOKEN",
      "TELEGRAM_LOGIN_OTP_CHAT_ID",
      "TELEGRAM_BOT_TOKEN",
      "TELEGRAM_CHAT_ID",
    ],
    requiredKeys: ["TELEGRAM_LOGIN_OTP_CHAT_ID"],
  },
  {
    id: "resend",
    label: "ایمیل (Resend)",
    channel: "email",
    keys: ["RESEND_API_KEY", "EMAIL_FROM", "EMAIL_TIMEOUT_MS"],
    requiredKeys: ["RESEND_API_KEY", "EMAIL_FROM"],
  },
];
