import { loginOtps } from "@/db/schema";
import { apiError, apiOk, readJson } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { generateOtpCode, hashOtp } from "@/lib/otp";
import { isValidIranPhone, normalizeIranPhone } from "@/lib/phone";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import type { OtpDeliveryStatus } from "@/lib/sms/delivery";
import { sendKavenegarOtp } from "@/lib/sms/kavenegar";

type RequestPayload = {
  phone?: string;
};

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return apiError("AUTH_REQUIRED", "ابتدا وارد شوید.", 401);
  }

  const body = await readJson<RequestPayload>(request);
  const phone = normalizeIranPhone(body?.phone ?? "");

  if (!isValidIranPhone(phone)) {
    return apiError("INVALID_PHONE", "شماره موبایل معتبر نیست.");
  }

  if (phone === user.phone) {
    return apiError("SAME_PHONE", "این شماره همان شماره فعلی شماست.");
  }

  if (!rateLimit(`phone-request-otp:${clientIp(request)}:${user.id}`, 5, 60_000).ok) {
    return apiError("OTP_RATE_LIMITED", "تلاش بیش از حد. کمی بعد دوباره تلاش کنید.", 429);
  }

  const taken = await getDb().query.users.findFirst({
    where: (u, { and, eq, ne }) => and(eq(u.phone, phone), ne(u.id, user.id)),
    columns: { id: true },
  });
  if (taken) {
    return apiError("PHONE_TAKEN", "این شماره موبایل قبلاً ثبت شده است.", 409);
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
  const sms = await sendKavenegarOtp(phone, code);
  const sent: boolean = sms.status === "sent" || sms.status === "pending";
  const providerStatus: OtpDeliveryStatus = sms.status;

  await getDb()
    .insert(loginOtps)
    .values({
      phone,
      codeHash: hashOtp(phone, code),
      expiresAt: new Date(Date.now() + 5 * 60_000),
      provider: "kavenegar",
      providerStatus,
      providerMessage: `kavenegar: ${sms.message}`,
      providerPayload: { kavenegar: { status: sms.status, message: sms.message } },
      userId: user.id,
    });

  return apiOk({
    phone,
    sent,
    expiresInSeconds: 300,
    ...(process.env.NODE_ENV !== "production" && !sent ? { debugCode: code } : {}),
  });
}
