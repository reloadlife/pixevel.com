import { loginOtps } from "@/db/schema";
import { apiError, apiOk, readJson } from "@/lib/api";
import { sendOtpLogged, sendTelegramLoginOtpLogged } from "@/lib/comms/send";
import { getDb } from "@/lib/db";
import { generateOtpCode, hashOtp } from "@/lib/otp";
import { isValidIranPhone, normalizeIranPhone } from "@/lib/phone";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { getSettingBool } from "@/lib/settings";
import type { OtpDeliveryStatus } from "@/lib/sms/delivery";

type RequestOtpPayload = {
  phone?: string;
  /** "sms" (default) or "call" — a voice call that reads the code aloud. */
  method?: "sms" | "call";
};

export async function POST(request: Request) {
  const body = await readJson<RequestOtpPayload>(request);
  const phone = normalizeIranPhone(body?.phone ?? "");
  const method = body?.method === "call" ? "call" : "sms";

  if (!isValidIranPhone(phone)) {
    return apiError("INVALID_PHONE", "شماره موبایل معتبر نیست.");
  }

  // Per-IP cap stops one source from spraying OTPs across many numbers (SMS bomb)
  // beyond the per-phone 60s cooldown below.
  if (!rateLimit(`request-otp:${clientIp(request)}`, 5, 60_000).ok) {
    return apiError("OTP_RATE_LIMITED", "تلاش بیش از حد. کمی بعد دوباره تلاش کنید.", 429);
  }

  const recentOtp = await getDb().query.loginOtps.findFirst({
    where: (item, { and, eq, gt }) =>
      and(eq(item.phone, phone), gt(item.createdAt, new Date(Date.now() - 60_000))),
    orderBy: (item, { desc }) => [desc(item.createdAt)],
  });

  if (recentOtp) {
    return apiError("OTP_RATE_LIMITED", "لطفا یک دقیقه دیگر دوباره تلاش کنید.", 429);
  }

  const code = generateOtpCode();
  const host = getRequestHost(request);
  // SMS via the configured provider (Kavenegar/IPPanel) or voice via Kavenegar.
  // Telegram is only a dev/staging relay for the SMS channel — skipped for calls.
  const [sms, telegram] = await Promise.all([
    sendOtpLogged(phone, code, method),
    method === "sms"
      ? sendTelegramLoginOtpLogged({ phone, code, host })
      : Promise.resolve({ status: "skipped" as const, message: "voice channel", payload: null }),
  ]);
  const providerStatus = resolveProviderStatus([sms.status, telegram.status]);
  const sent = hasDeliveredOtp([sms.status, telegram.status]);

  // Staging affordance: until SMS delivery is wired up, write the code to the
  // service journal so an operator can read it (`journalctl -u pixevel | grep otp`).
  // Gated by an explicit env flag (default OFF), server-side only — turn it OFF the
  // moment real SMS works (plaintext OTP in logs is a security risk otherwise).
  if (await getSettingBool("OTP_DEBUG_LOG", false)) {
    console.warn(`[otp] phone=${phone} code=${code} method=${method} sent=${sent}`);
  }

  const providerMessage = [`sms: ${sms.message}`, `telegram: ${telegram.message}`].join(" | ");

  await getDb()
    .insert(loginOtps)
    .values({
      phone,
      codeHash: hashOtp(phone, code),
      expiresAt: new Date(Date.now() + 5 * 60_000),
      provider: `sms:${method}`,
      providerStatus,
      providerMessage,
      providerPayload: {
        sms: {
          status: sms.status,
          message: sms.message,
          payload: sms.payload,
        },
        telegram: {
          status: telegram.status,
          message: telegram.message,
          payload: telegram.payload,
        },
      },
    });

  return apiOk({
    phone,
    sent,
    expiresInSeconds: 300,
    ...(process.env.NODE_ENV !== "production" && !sent ? { debugCode: code } : {}),
  });
}

function getRequestHost(request: Request) {
  const forwardedHost = request.headers.get("x-forwarded-host");
  const host = forwardedHost?.split(",")[0]?.trim() || request.headers.get("host");

  if (host) {
    return host;
  }

  try {
    return new URL(request.url).host;
  } catch {
    return "unknown";
  }
}

function resolveProviderStatus(statuses: OtpDeliveryStatus[]): OtpDeliveryStatus {
  if (statuses.includes("sent")) {
    return "sent";
  }

  if (statuses.includes("pending")) {
    return "pending";
  }

  if (statuses.includes("skipped") && statuses.every((status) => status === "skipped")) {
    return "skipped";
  }

  return "failed";
}

function hasDeliveredOtp(statuses: OtpDeliveryStatus[]) {
  return statuses.some((status) => status === "sent" || status === "pending");
}
