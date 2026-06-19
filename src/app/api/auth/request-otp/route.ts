import { loginOtps } from "@/db/schema";
import { apiError, apiOk, readJson } from "@/lib/api";
import { getDb } from "@/lib/db";
import { generateOtpCode, hashOtp } from "@/lib/otp";
import { isValidIranPhone, normalizeIranPhone } from "@/lib/phone";
import type { OtpDeliveryStatus } from "@/lib/sms/delivery";
import { sendKavenegarOtp } from "@/lib/sms/kavenegar";
import { sendTelegramLoginOtp } from "@/lib/sms/telegram";

type RequestOtpPayload = {
  phone?: string;
};

export async function POST(request: Request) {
  const body = await readJson<RequestOtpPayload>(request);
  const phone = normalizeIranPhone(body?.phone ?? "");

  if (!isValidIranPhone(phone)) {
    return apiError("INVALID_PHONE", "شماره موبایل معتبر نیست.");
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
  const [sms, telegram] = await Promise.all([
    sendKavenegarOtp(phone, code),
    sendTelegramLoginOtp({ phone, code, host }),
  ]);
  const providerStatus = resolveProviderStatus([sms.status, telegram.status]);
  const sent = hasDeliveredOtp([sms.status, telegram.status]);
  const providerMessage = [`kavenegar: ${sms.message}`, `telegram: ${telegram.message}`].join(
    " | ",
  );

  await getDb()
    .insert(loginOtps)
    .values({
      phone,
      codeHash: hashOtp(phone, code),
      expiresAt: new Date(Date.now() + 5 * 60_000),
      provider: "kavenegar+telegram",
      providerStatus,
      providerMessage,
      providerPayload: {
        kavenegar: {
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
