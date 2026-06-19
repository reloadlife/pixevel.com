import { apiError, apiOk } from "@/lib/api";
import { requireAdmin } from "@/lib/auth";
import { getDb } from "@/lib/db";

export async function GET() {
  const admin = await requireAdmin();

  if (!admin) {
    return apiError("UNAUTHORIZED", "دسترسی مجاز نیست.", 401);
  }

  const users = await getDb().query.users.findMany({
    columns: {
      id: true,
      phone: true,
      fullName: true,
      role: true,
      isPremium: true,
      premiumAt: true,
      lastLoginAt: true,
      createdAt: true,
    },
    orderBy: (user, { desc }) => [desc(user.createdAt)],
  });

  return apiOk({ users });
}
