import { eq, sql } from "drizzle-orm";

import { loginOtps } from "@/db/schema";
import { changePhone, PhoneChangeError } from "@/lib/account";
import { apiError, apiOk, readJson } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { isOtpCodeShape, MAX_OTP_ATTEMPTS, verifyOtpHash } from "@/lib/otp";
import { isValidIranPhone, normalizeIranPhone } from "@/lib/phone";
import { clientIp, rateLimit } from "@/lib/rate-limit";

type VerifyPayload = {
  phone?: string;
  code?: string;
};

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return apiError("AUTH_REQUIRED", "ابتدا وارد شوید.", 401);
  }

  const body = await readJson<VerifyPayload>(request);
  const phone = normalizeIranPhone(body?.phone ?? "");
  const code = (body?.code ?? "").trim();

  if (!isValidIranPhone(phone) || !isOtpCodeShape(code)) {
    return apiError("INVALID_OTP", "کد تایید یا شماره موبایل معتبر نیست.");
  }

  if (!rateLimit(`phone-verify:${clientIp(request)}:${user.id}`, 10, 60_000).ok) {
    return apiError("RATE_LIMITED", "تلاش بیش از حد. کمی بعد دوباره امتحان کنید.", 429);
  }

  // Bind the OTP to THIS user — phone-change codes are minted with userId set, so
  // a login OTP (userId null) or another user's code can never be consumed here.
  const otp = await getDb().query.loginOtps.findFirst({
    where: (item, { and, eq: eqOp, gt, isNull }) =>
      and(
        eqOp(item.phone, phone),
        eqOp(item.userId, user.id),
        isNull(item.consumedAt),
        gt(item.expiresAt, new Date()),
      ),
    orderBy: (item, { desc }) => [desc(item.createdAt)],
  });

  if (!otp) {
    return apiError("INVALID_OTP", "کد وارد شده صحیح نیست.");
  }

  if (otp.attempts >= MAX_OTP_ATTEMPTS) {
    await getDb().update(loginOtps).set({ consumedAt: new Date() }).where(eq(loginOtps.id, otp.id));
    return apiError("OTP_LOCKED", "تعداد تلاش‌ها بیش از حد مجاز است. کد جدید بگیرید.", 429);
  }

  if (!verifyOtpHash(phone, code, otp.codeHash)) {
    const nextAttempts = otp.attempts + 1;
    await getDb()
      .update(loginOtps)
      .set({
        attempts: sql`${loginOtps.attempts} + 1`,
        ...(nextAttempts >= MAX_OTP_ATTEMPTS ? { consumedAt: new Date() } : {}),
      })
      .where(eq(loginOtps.id, otp.id));
    return apiError("INVALID_OTP", "کد وارد شده صحیح نیست.");
  }

  try {
    const updated = await getDb().transaction(async (tx) => {
      const result = await changePhone(user.id, phone, tx);
      await tx
        .update(loginOtps)
        .set({ consumedAt: new Date(), userId: user.id })
        .where(eq(loginOtps.id, otp.id));
      return result;
    });

    return apiOk({ phone: updated.phone });
  } catch (error) {
    if (error instanceof PhoneChangeError) {
      if (error.code === "PHONE_TAKEN") {
        return apiError("PHONE_TAKEN", "این شماره موبایل قبلاً ثبت شده است.", 409);
      }
      if (error.code === "SAME_PHONE") {
        return apiError("SAME_PHONE", "این شماره همان شماره فعلی شماست.");
      }
      return apiError("INVALID_PHONE", "شماره موبایل معتبر نیست.");
    }
    return apiError("INTERNAL", "تغییر شماره موبایل ممکن نشد.", 500);
  }
}
