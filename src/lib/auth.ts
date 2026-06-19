import { cookies } from "next/headers";

import { getDb } from "@/lib/db";
import { isValidIranPhone, normalizeIranPhone } from "@/lib/phone";
import { hashToken, SESSION_COOKIE } from "@/lib/session";

export type CurrentUser = {
  id: string;
  phone: string | null;
  fullName: string | null;
  role: "CUSTOMER" | "ADMIN";
  isPremium: boolean;
};

export async function getCurrentUser(): Promise<CurrentUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;

  if (!token) {
    return null;
  }

  const session = await getDb().query.sessions.findFirst({
    where: (s, { and, eq, gt }) =>
      and(eq(s.tokenHash, hashToken(token)), gt(s.expiresAt, new Date())),
    with: {
      user: {
        columns: {
          id: true,
          phone: true,
          fullName: true,
          role: true,
          isPremium: true,
        },
      },
    },
  });

  return session?.user ?? null;
}

export async function requireAdmin() {
  const user = await getCurrentUser();

  if (!user || user.role !== "ADMIN") {
    return null;
  }

  return user;
}

export function getAdminPhones() {
  return (process.env.PIXEVEL_ADMIN_PHONES ?? "")
    .split(",")
    .map((phone) => normalizeIranPhone(phone.trim()))
    .filter(isValidIranPhone);
}
