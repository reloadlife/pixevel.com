import { eq } from "drizzle-orm";

import { notificationPreferences } from "@/db/schema";
import { apiError, apiOk, readJson } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth";
import { getDb } from "@/lib/db";

type PrefRow = typeof notificationPreferences.$inferSelect;

const PREF_KEYS = ["orderEmail", "orderSms", "promoEmail", "promoSms", "newsletterEmail"] as const;

type PrefKey = (typeof PREF_KEYS)[number];

function publicShape(row: PrefRow) {
  return {
    orderEmail: row.orderEmail,
    orderSms: row.orderSms,
    promoEmail: row.promoEmail,
    promoSms: row.promoSms,
    newsletterEmail: row.newsletterEmail,
    updatedAt: row.updatedAt,
  };
}

/** Get-or-create the user's preference row using schema defaults. */
async function getOrCreate(userId: string): Promise<PrefRow> {
  const db = getDb();
  const existing = await db.query.notificationPreferences.findFirst({
    where: eq(notificationPreferences.userId, userId),
  });
  if (existing) {
    return existing;
  }
  const [created] = await db
    .insert(notificationPreferences)
    .values({ userId })
    .onConflictDoNothing({ target: notificationPreferences.userId })
    .returning();
  if (created) {
    return created;
  }
  // Lost the race — another request created it first.
  const row = await db.query.notificationPreferences.findFirst({
    where: eq(notificationPreferences.userId, userId),
  });
  if (!row) {
    throw new Error("preference row missing after upsert");
  }
  return row;
}

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return apiError("AUTH_REQUIRED", "ابتدا وارد شوید.", 401);
  }

  try {
    const row = await getOrCreate(user.id);
    return apiOk({ preferences: publicShape(row) });
  } catch {
    return apiError("INTERNAL", "دریافت تنظیمات اعلان‌ها ممکن نشد.", 500);
  }
}

export async function PUT(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return apiError("AUTH_REQUIRED", "ابتدا وارد شوید.", 401);
  }

  const body = (await readJson<Partial<Record<PrefKey, unknown>>>(request)) ?? {};

  const patch: Partial<Record<PrefKey, boolean>> = {};
  for (const key of PREF_KEYS) {
    if (typeof body[key] === "boolean") {
      patch[key] = body[key] as boolean;
    }
  }

  if (Object.keys(patch).length === 0) {
    return apiError("NO_FIELDS", "هیچ تنظیمی برای ذخیره ارسال نشده است.");
  }

  try {
    await getOrCreate(user.id);
    const [updated] = await getDb()
      .update(notificationPreferences)
      .set(patch)
      .where(eq(notificationPreferences.userId, user.id))
      .returning();
    return apiOk({ preferences: publicShape(updated) });
  } catch {
    return apiError("INTERNAL", "ذخیره تنظیمات اعلان‌ها ممکن نشد.", 500);
  }
}
