import { eq } from "drizzle-orm";

import { users } from "@/db/schema";
import { getAdminUser, toAdminUserDetail } from "@/lib/admin/users";
import { apiError, apiOk, readJson } from "@/lib/api";
import { requireAdmin } from "@/lib/auth";
import { getDb } from "@/lib/db";

type UserPatchPayload = {
  role?: "CUSTOMER" | "ADMIN";
  isPremium?: boolean;
  fullName?: string | null;
};

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();

  if (!admin) {
    return apiError("UNAUTHORIZED", "دسترسی مجاز نیست.", 401);
  }

  const { id } = await context.params;
  const detail = await getAdminUser(id);

  if (!detail) {
    return apiError("USER_NOT_FOUND", "کاربر پیدا نشد.", 404);
  }

  return apiOk(toAdminUserDetail(detail));
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();

  if (!admin) {
    return apiError("UNAUTHORIZED", "دسترسی مجاز نیست.", 401);
  }

  const { id } = await context.params;
  const body = await readJson<UserPatchPayload>(request);

  if (!body) {
    return apiError("INVALID_BODY", "درخواست معتبر نیست.");
  }

  const updateData = {
    ...(body.role ? { role: body.role } : {}),
    ...(typeof body.isPremium === "boolean"
      ? {
          isPremium: body.isPremium,
          premiumAt: body.isPremium ? new Date() : null,
        }
      : {}),
    ...(body.fullName !== undefined ? { fullName: body.fullName } : {}),
  };
  const returnColumns = {
    id: users.id,
    email: users.email,
    phone: users.phone,
    fullName: users.fullName,
    role: users.role,
    isPremium: users.isPremium,
    premiumAt: users.premiumAt,
    lastLoginAt: users.lastLoginAt,
    createdAt: users.createdAt,
  };

  const [user] =
    Object.keys(updateData).length > 0
      ? await getDb().update(users).set(updateData).where(eq(users.id, id)).returning(returnColumns)
      : await getDb().select(returnColumns).from(users).where(eq(users.id, id));

  if (!user) {
    return apiError("USER_NOT_FOUND", "کاربر پیدا نشد.", 404);
  }

  return apiOk({ user });
}
