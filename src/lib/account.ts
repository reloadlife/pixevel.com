import { eq } from "drizzle-orm";

import { users } from "@/db/schema";
import { getDb } from "@/lib/db";

type Db = ReturnType<typeof getDb>;
type DbOrTx = Db | Parameters<Parameters<Db["transaction"]>[0]>[0];

export class ProfileError extends Error {
  constructor(public code: "EMAIL_TAKEN" | "INVALID_EMAIL") {
    super(code);
    this.name = "ProfileError";
  }
}

export type ProfileInput = {
  fullName?: string | null;
  email?: string | null;
  defaultAddressLine?: string | null;
  defaultCity?: string | null;
  defaultProvince?: string | null;
  defaultPostalCode?: string | null;
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function norm(value: string | null | undefined): string | null {
  if (value == null) return null;
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

/**
 * Update the authenticated user's profile (name, email, default address).
 * Phone is the login identity and is never changed here. Email must be unique.
 */
export async function updateProfile(
  userId: string,
  input: ProfileInput,
  db: ReturnType<typeof getDb> = getDb(),
) {
  const email = norm(input.email);
  if (email && !EMAIL_RE.test(email)) {
    throw new ProfileError("INVALID_EMAIL");
  }
  if (email) {
    const taken = await db.query.users.findFirst({
      where: (u, { and, eq: eqOp, ne }) => and(eqOp(u.email, email), ne(u.id, userId)),
      columns: { id: true },
    });
    if (taken) {
      throw new ProfileError("EMAIL_TAKEN");
    }
  }

  const [updated] = await db
    .update(users)
    .set({
      fullName: norm(input.fullName),
      email,
      defaultAddressLine: norm(input.defaultAddressLine),
      defaultCity: norm(input.defaultCity),
      defaultProvince: norm(input.defaultProvince),
      defaultPostalCode: norm(input.defaultPostalCode),
    })
    .where(eq(users.id, userId))
    .returning({
      id: users.id,
      fullName: users.fullName,
      email: users.email,
      phone: users.phone,
      isPremium: users.isPremium,
      defaultAddressLine: users.defaultAddressLine,
      defaultCity: users.defaultCity,
      defaultProvince: users.defaultProvince,
      defaultPostalCode: users.defaultPostalCode,
    });

  return updated;
}

/**
 * Persist a new avatar URL on the user. Pass `null` to clear it.
 * The caller is responsible for validating/storing the underlying file.
 */
export async function updateAvatar(
  userId: string,
  avatarUrl: string | null,
  db: ReturnType<typeof getDb> = getDb(),
) {
  const [updated] = await db
    .update(users)
    .set({ avatarUrl })
    .where(eq(users.id, userId))
    .returning({ id: users.id, avatarUrl: users.avatarUrl });

  return updated;
}

export class PhoneChangeError extends Error {
  constructor(public code: "INVALID_PHONE" | "PHONE_TAKEN" | "SAME_PHONE") {
    super(code);
    this.name = "PhoneChangeError";
  }
}

/**
 * Change the authenticated user's login phone after the OTP for the new number
 * has already been verified by the caller. The new phone must be a valid Iran
 * mobile, must not equal the current phone, and must be free.
 */
export async function changePhone(userId: string, newPhone: string, db: DbOrTx = getDb()) {
  const current = await db.query.users.findFirst({
    where: eq(users.id, userId),
    columns: { id: true, phone: true },
  });

  if (current?.phone === newPhone) {
    throw new PhoneChangeError("SAME_PHONE");
  }

  const taken = await db.query.users.findFirst({
    where: (u, { and, eq: eqOp, ne }) => and(eqOp(u.phone, newPhone), ne(u.id, userId)),
    columns: { id: true },
  });
  if (taken) {
    throw new PhoneChangeError("PHONE_TAKEN");
  }

  const [updated] = await db
    .update(users)
    .set({ phone: newPhone })
    .where(eq(users.id, userId))
    .returning({ id: users.id, phone: users.phone });

  return updated;
}
