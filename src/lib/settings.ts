import "server-only";

import { appSettings } from "@/db/schema";
import { decryptSecret, encryptSecret, isVaultConfigured } from "@/lib/crypto/secrets";
import { getDb } from "@/lib/db";

/**
 * Admin-editable runtime configuration. Replaces most env vars: a value lives in
 * the `AppSetting` table (secrets AES-256-GCM-encrypted) and overrides the env.
 *
 * Resolution order for {@link getSetting}: DB value → `process.env[key]` →
 * registry default. Setting keys ARE the env-var names, so anything not yet set
 * in the DB keeps reading its old env var — migration is transparent.
 *
 * Bootstrap/security vars (DATABASE_URL, SESSION_SECRET, APP_VAULT_KEY, NODE_ENV,
 * NEXT_PUBLIC_*, PIXEVEL_ADMIN_PHONES) are intentionally NOT in the registry —
 * they're needed to read/decrypt settings or to bootstrap the first admin.
 */

export type SettingGroup = "sms" | "email" | "payments" | "domains" | "servers" | "general";

export type SettingDef = {
  key: string;
  label: string;
  group: SettingGroup;
  secret?: boolean;
  default?: string;
  /** Optional hint shown under the field. */
  hint?: string;
  /** Allowed values — rendered as a dropdown in the admin UI (Task 5). */
  choices?: string[];
};

export const SETTINGS_REGISTRY: SettingDef[] = [
  // ── SMS / OTP ──
  { key: "KAVENEGAR_TOKEN", label: "کاوه‌نگار: توکن", group: "sms", secret: true },
  { key: "KAVENEGAR_OTP_TEMPLATE", label: "کاوه‌نگار: قالب کد یکبارمصرف", group: "sms" },
  { key: "KAVENEGAR_SENDER", label: "کاوه‌نگار: شماره فرستنده", group: "sms" },
  { key: "KAVENEGAR_TIMEOUT_MS", label: "کاوه‌نگار: تایم‌اوت (ms)", group: "sms", default: "10000" },
  {
    key: "TELEGRAM_LOGIN_OTP_BOT_TOKEN",
    label: "تلگرام OTP: توکن بات",
    group: "sms",
    secret: true,
  },
  { key: "TELEGRAM_LOGIN_OTP_CHAT_ID", label: "تلگرام OTP: چت آیدی", group: "sms" },
  { key: "TELEGRAM_BOT_TOKEN", label: "تلگرام: توکن بات", group: "sms", secret: true },
  { key: "TELEGRAM_CHAT_ID", label: "تلگرام: چت آیدی", group: "sms" },
  {
    key: "SMS_PROVIDER",
    label: "ارائه‌دهنده پیامک",
    group: "sms",
    default: "kavenegar",
    choices: ["kavenegar", "ippanel", "selfhosted"],
  },
  {
    key: "VOICE_PROVIDER",
    label: "ارائه‌دهنده تماس صوتی",
    group: "sms",
    default: "kavenegar",
    choices: ["kavenegar", "selfhosted"],
  },
  {
    key: "SMS_OTP_PROVIDER",
    label: "ارائه‌دهنده پیامک OTP",
    group: "sms",
    default: "kavenegar",
    hint: "منسوخ — به‌جای آن از SMS_PROVIDER استفاده کنید.",
  },
  { key: "IPPANEL_API_KEY", label: "آی‌پی‌پنل: کلید API", group: "sms", secret: true },
  { key: "IPPANEL_PATTERN_CODE", label: "آی‌پی‌پنل: کد پترن", group: "sms" },
  { key: "IPPANEL_SENDER", label: "آی‌پی‌پنل: شماره فرستنده (+98…)", group: "sms" },
  {
    key: "IPPANEL_PATTERN_VAR",
    label: "آی‌پی‌پنل: نام متغیر کد در پترن",
    group: "sms",
    default: "code",
  },
  { key: "IPPANEL_TIMEOUT_MS", label: "آی‌پی‌پنل: تایم‌اوت (ms)", group: "sms", default: "10000" },
  {
    key: "KAVENEGAR_WEBHOOK_SECRET",
    label: "کاوه‌نگار: کلید وب‌هوک (کال‌بک)",
    group: "sms",
    secret: true,
    hint: "در پنل کاوه‌نگار آدرس کال‌بک را با ?secret=<این مقدار> تنظیم کنید.",
  },
  {
    key: "IPPANEL_WEBHOOK_SECRET",
    label: "آی‌پی‌پنل: کلید وب‌هوک (کال‌بک)",
    group: "sms",
    secret: true,
    hint: "در پنل آی‌پی‌پنل آدرس کال‌بک را با ?secret=<این مقدار> تنظیم کنید.",
  },
  { key: "SELFHOSTED_SMS_BASE_URL", label: "گیت‌وی اختصاصی: آدرس پایه", group: "sms" },
  { key: "SELFHOSTED_SMS_TOKEN", label: "گیت‌وی اختصاصی: توکن", group: "sms", secret: true },
  {
    key: "SELFHOSTED_SMS_SEND_PATH",
    label: "گیت‌وی اختصاصی: مسیر ارسال",
    group: "sms",
    default: "/messages",
  },
  { key: "SELFHOSTED_SENDER", label: "گیت‌وی اختصاصی: شماره فرستنده", group: "sms" },
  {
    key: "SELFHOSTED_SMS_TIMEOUT_MS",
    label: "گیت‌وی اختصاصی: تایم‌اوت (ms)",
    group: "sms",
    default: "10000",
  },
  {
    key: "SELFHOSTED_WEBHOOK_SECRET",
    label: "گیت‌وی اختصاصی: کلید وب‌هوک",
    group: "sms",
    secret: true,
    hint: "آدرس کال‌بک را با ?secret=<این مقدار> در گیت‌وی تنظیم کنید.",
  },

  // ── Email ──
  { key: "RESEND_API_KEY", label: "Resend: کلید API", group: "email", secret: true },
  { key: "EMAIL_FROM", label: "ایمیل فرستنده", group: "email" },
  { key: "EMAIL_TIMEOUT_MS", label: "ایمیل: تایم‌اوت (ms)", group: "email", default: "10000" },

  // ── Payments ──
  { key: "ZARINPAL_MERCHANT_ID", label: "زرین‌پال: مرچنت", group: "payments", secret: true },
  { key: "ZARINPAL_ACCESS_TOKEN", label: "زرین‌پال: اکسس توکن", group: "payments", secret: true },
  { key: "ZARINPAL_SANDBOX", label: "زرین‌پال: حالت تست", group: "payments", default: "false" },
  { key: "SAMAN_TERMINAL_ID", label: "سامان: ترمینال", group: "payments", secret: true },
  { key: "BEHPARDAKHT_TERMINAL_ID", label: "به‌پرداخت: ترمینال", group: "payments" },
  { key: "BEHPARDAKHT_USERNAME", label: "به‌پرداخت: نام کاربری", group: "payments" },
  { key: "BEHPARDAKHT_PASSWORD", label: "به‌پرداخت: رمز", group: "payments", secret: true },
  { key: "DIGIPAY_CLIENT_ID", label: "دیجی‌پی: کلاینت آیدی", group: "payments" },
  { key: "DIGIPAY_CLIENT_SECRET", label: "دیجی‌پی: کلاینت سکرت", group: "payments", secret: true },
  { key: "DIGIPAY_USERNAME", label: "دیجی‌پی: نام کاربری", group: "payments" },
  { key: "DIGIPAY_PASSWORD", label: "دیجی‌پی: رمز", group: "payments", secret: true },
  { key: "DIGIPAY_BASE_URL", label: "دیجی‌پی: آدرس پایه", group: "payments" },
  { key: "DIGIPAY_PAYMENT_TYPE", label: "دیجی‌پی: نوع پرداخت", group: "payments" },
  { key: "SNAPPPAY_CLIENT_ID", label: "اسنپ‌پی: کلاینت آیدی", group: "payments" },
  { key: "SNAPPPAY_CLIENT_SECRET", label: "اسنپ‌پی: کلاینت سکرت", group: "payments", secret: true },
  { key: "SNAPPPAY_USERNAME", label: "اسنپ‌پی: نام کاربری", group: "payments" },
  { key: "SNAPPPAY_PASSWORD", label: "اسنپ‌پی: رمز", group: "payments", secret: true },
  { key: "SNAPPPAY_BASE_URL", label: "اسنپ‌پی: آدرس پایه", group: "payments" },
  { key: "CARD_TO_CARD_NUMBER", label: "کارت به کارت: شماره کارت", group: "payments" },
  { key: "CARD_TO_CARD_HOLDER", label: "کارت به کارت: نام صاحب کارت", group: "payments" },

  // NOTE: domain-registrar (SPACESHIP_*) and server-provider (SERVER_PROVIDER_*)
  // credentials are admin-managed too, but through the encrypted registrar /
  // server-node vaults at /admin/integrations (see the registrar/server specs),
  // not here — so they stay on env until that refactor lands.

  // ── General ──
  {
    key: "APP_BASE_URL",
    label: "آدرس پایه سایت",
    group: "general",
    default: "https://pixevel.com",
  },
  {
    key: "OTP_DEBUG_LOG",
    label: "ثبت کد OTP در لاگ (فقط تست)",
    group: "general",
    default: "0",
    hint: "تا زمانی که پیامک فعال نیست برای دریافت کد از journalctl. بعد خاموش شود.",
  },
];

const BY_KEY = new Map(SETTINGS_REGISTRY.map((d) => [d.key, d]));

// ─── Module cache (mirrors the exchange-rate pattern) ───────────────────────────

const TTL_MS = 60_000;
let cache = new Map<string, string>(); // decrypted plaintext, DB values only
let loadedAt = 0;
let inflight: Promise<void> | null = null;

async function ensureLoaded(force = false): Promise<void> {
  if (!force && loadedAt > 0 && Date.now() - loadedAt < TTL_MS) return;
  if (inflight) return inflight;
  inflight = (async () => {
    try {
      const rows = await getDb().select().from(appSettings);
      const next = new Map<string, string>();
      for (const row of rows) {
        if (row.value == null || row.value === "") continue;
        try {
          next.set(row.key, row.isSecret ? decryptSecret(row.value) : row.value);
        } catch {
          // Undecryptable (missing/rotated key) — skip so getSetting falls back to env.
        }
      }
      cache = next;
      loadedAt = Date.now();
    } catch {
      // DB unavailable / table missing — keep env + defaults working (and don't
      // hammer the DB by retrying every call until the TTL elapses).
      loadedAt = Date.now();
    } finally {
      inflight = null;
    }
  })();
  return inflight;
}

// ─── Reads ──────────────────────────────────────────────────────────────────────

/** DB value → process.env[key] → registry default. */
export async function getSetting(key: string): Promise<string | undefined> {
  await ensureLoaded();
  const fromDb = cache.get(key);
  if (fromDb !== undefined && fromDb !== "") return fromDb;
  const env = process.env[key];
  if (env !== undefined && env !== "") return env;
  return BY_KEY.get(key)?.default;
}

export async function getSettingBool(key: string, fallback = false): Promise<boolean> {
  const value = (await getSetting(key))?.toLowerCase();
  if (value === undefined) return fallback;
  return value === "1" || value === "true" || value === "yes" || value === "on";
}

export async function getSettingNumber(key: string, fallback: number): Promise<number> {
  const n = Number(await getSetting(key));
  return Number.isFinite(n) ? n : fallback;
}

// ─── Writes (admin) ──────────────────────────────────────────────────────────────

export async function setSetting(key: string, value: string, userId?: string): Promise<void> {
  const def = BY_KEY.get(key);
  if (!def) throw new Error(`Unknown setting: ${key}`);
  if (def.secret && !isVaultConfigured()) {
    throw new Error("APP_VAULT_KEY is not configured — cannot store secrets.");
  }
  const stored = def.secret ? encryptSecret(value) : value;
  await getDb()
    .insert(appSettings)
    .values({
      key,
      value: stored,
      isSecret: Boolean(def.secret),
      updatedByUserId: userId ?? null,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: appSettings.key,
      set: {
        value: stored,
        isSecret: Boolean(def.secret),
        updatedByUserId: userId ?? null,
        updatedAt: new Date(),
      },
    });
  await ensureLoaded(true);
}

/** Clears a DB override (reverts to env/default). */
export async function clearSetting(key: string, userId?: string): Promise<void> {
  const def = BY_KEY.get(key);
  if (!def) throw new Error(`Unknown setting: ${key}`);
  await getDb()
    .insert(appSettings)
    .values({
      key,
      value: null,
      isSecret: Boolean(def.secret),
      updatedByUserId: userId ?? null,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: appSettings.key,
      set: { value: null, updatedByUserId: userId ?? null, updatedAt: new Date() },
    });
  await ensureLoaded(true);
}

// ─── Admin view (secrets masked) ─────────────────────────────────────────────────

export type AdminSettingRow = {
  key: string;
  label: string;
  group: SettingGroup;
  secret: boolean;
  hint?: string;
  /** Editable value for non-secret keys (the DB override; empty if using fallback). */
  value: string;
  /** Whether an effective value exists (DB or env). */
  isSet: boolean;
  /** Where the effective value comes from. */
  source: "db" | "env" | "default" | "unset";
  /** Allowed values — when present, the admin UI renders a dropdown instead of a text input. */
  choices?: string[];
};

export async function getSettingsForAdmin(): Promise<AdminSettingRow[]> {
  await ensureLoaded(true);
  const rows = await getDb().select().from(appSettings);
  const dbHas = new Map(rows.map((r) => [r.key, r.value != null && r.value !== ""]));

  return SETTINGS_REGISTRY.map((def) => {
    const hasDb = dbHas.get(def.key) === true;
    const env = process.env[def.key];
    const hasEnv = env !== undefined && env !== "";
    const source: AdminSettingRow["source"] = hasDb
      ? "db"
      : hasEnv
        ? "env"
        : def.default !== undefined
          ? "default"
          : "unset";
    return {
      key: def.key,
      label: def.label,
      group: def.group,
      secret: Boolean(def.secret),
      hint: def.hint,
      // Never reveal secret values; for non-secret show the DB override so it's editable.
      value: def.secret ? "" : hasDb ? (cache.get(def.key) ?? "") : "",
      isSet: hasDb || hasEnv,
      source,
      // Choices are only surfaced for non-secret fields (secrets never have choices).
      choices: def.secret ? undefined : def.choices,
    };
  });
}

export const SETTING_KEYS = new Set(SETTINGS_REGISTRY.map((d) => d.key));
