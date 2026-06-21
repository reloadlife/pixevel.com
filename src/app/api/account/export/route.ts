import { eq } from "drizzle-orm";

import { users } from "@/db/schema";
import { apiError } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth";
import { getDb } from "@/lib/db";

export const runtime = "nodejs";

/**
 * Returns the authenticated user's personal data as a downloadable JSON file
 * (lightweight GDPR-style export). Only the user's own rows are included; no
 * internal/staff fields are exposed.
 */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return apiError("AUTH_REQUIRED", "ابتدا وارد شوید.", 401);
  }

  const db = getDb();

  const profile = await db.query.users.findFirst({
    where: eq(users.id, user.id),
    columns: {
      id: true,
      fullName: true,
      email: true,
      phone: true,
      isPremium: true,
      premiumAt: true,
      avatarUrl: true,
      emailVerifiedAt: true,
      referralCode: true,
      defaultAddressLine: true,
      defaultCity: true,
      defaultProvince: true,
      defaultPostalCode: true,
      createdAt: true,
      lastLoginAt: true,
    },
    with: {
      addresses: true,
      wishlistItems: true,
      reviews: true,
      notifications: true,
      payments: true,
      notificationPreferences: true,
      wallet: true,
      loyaltyAccount: true,
      orders: {
        with: { items: true },
        orderBy: (o, { desc }) => [desc(o.createdAt)],
      },
    },
  });

  if (!profile) {
    return apiError("NOT_FOUND", "کاربر یافت نشد.", 404);
  }

  const { addresses, wishlistItems, reviews, notifications, payments, orders, ...account } =
    profile;

  const payload = {
    exportedAt: new Date().toISOString(),
    account,
    orders,
    payments,
    addresses,
    wishlist: wishlistItems,
    reviews,
    notifications,
  };

  const body = JSON.stringify(payload, null, 2);
  const fileName = `pixevel-data-${new Date().toISOString().slice(0, 10)}.json`;

  return new Response(body, {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="${fileName}"`,
      "Cache-Control": "no-store",
    },
  });
}
