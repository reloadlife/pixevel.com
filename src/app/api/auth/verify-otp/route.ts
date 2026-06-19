import { eq, sql } from "drizzle-orm";
import { cookies } from "next/headers";

import { loginOtps, users } from "@/db/schema";
import { apiError, apiOk, readJson } from "@/lib/api";
import { getAdminPhones } from "@/lib/auth";
import { CART_COOKIE, mergeAnonymousCart } from "@/lib/cart";
import { getDb } from "@/lib/db";
import { hashOtp } from "@/lib/otp";
import { isValidIranPhone, normalizeIranPhone } from "@/lib/phone";
import { createSession, SESSION_COOKIE, sessionCookieOptions } from "@/lib/session";

type VerifyOtpPayload = {
  phone?: string;
  code?: string;
};

export async function POST(request: Request) {
  const body = await readJson<VerifyOtpPayload>(request);
  const phone = normalizeIranPhone(body?.phone ?? "");
  const code = (body?.code ?? "").trim();

  if (!isValidIranPhone(phone) || !/^\d{4}$/.test(code)) {
    return apiError("INVALID_OTP", "کد تایید یا شماره موبایل معتبر نیست.");
  }

  const otp = await getDb().query.loginOtps.findFirst({
    where: (item, { and, eq, gt, isNull }) =>
      and(eq(item.phone, phone), isNull(item.consumedAt), gt(item.expiresAt, new Date())),
    orderBy: (item, { desc }) => [desc(item.createdAt)],
  });

  if (!otp || otp.codeHash !== hashOtp(phone, code)) {
    if (otp) {
      await getDb()
        .update(loginOtps)
        .set({ attempts: sql`${loginOtps.attempts} + 1` })
        .where(eq(loginOtps.id, otp.id));
    }

    return apiError("INVALID_OTP", "کد وارد شده صحیح نیست.");
  }

  const adminPhones = getAdminPhones();
  const shouldBeAdmin = adminPhones.includes(phone);

  const user = await getDb().transaction(async (tx) => {
    const [savedUser] = await tx
      .insert(users)
      .values({
        phone,
        role: shouldBeAdmin ? "ADMIN" : "CUSTOMER",
        lastLoginAt: new Date(),
      })
      .onConflictDoUpdate({
        target: users.phone,
        set: {
          lastLoginAt: new Date(),
          ...(shouldBeAdmin ? { role: "ADMIN" as const } : {}),
        },
      })
      .returning({
        id: users.id,
        phone: users.phone,
        fullName: users.fullName,
        role: users.role,
        isPremium: users.isPremium,
      });

    await tx
      .update(loginOtps)
      .set({
        consumedAt: new Date(),
        userId: savedUser.id,
      })
      .where(eq(loginOtps.id, otp.id));

    return savedUser;
  });

  const token = await createSession(user.id);
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, sessionCookieOptions());

  // Fold any anonymous basket into the now-authenticated user, then drop the
  // anonymous cart cookie so future requests use the user cart.
  const anonymousCartId = cookieStore.get(CART_COOKIE)?.value;

  if (anonymousCartId) {
    await mergeAnonymousCart(user.id, anonymousCartId);
    cookieStore.delete(CART_COOKIE);
  }

  return apiOk({ user });
}
