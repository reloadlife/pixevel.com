import { desc, eq, sql } from "drizzle-orm";

import { newsletterSubscribers } from "@/db/schema";
import { apiError, apiOk, readJson } from "@/lib/api";
import { requireAdmin } from "@/lib/auth";
import { getDb } from "@/lib/db";

const MAX_LIMIT = 1000;

function serialize(row: {
  id: string;
  email: string;
  isActive: boolean;
  unsubscribedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: row.id,
    email: row.email,
    isActive: row.isActive,
    unsubscribedAt: row.unsubscribedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/** List subscribers (newest first) plus active/total counts. */
export async function GET() {
  const admin = await requireAdmin();

  if (!admin) {
    return apiError("UNAUTHORIZED", "دسترسی مجاز نیست.", 401);
  }

  const db = getDb();

  const [rows, [counts]] = await Promise.all([
    db
      .select()
      .from(newsletterSubscribers)
      .orderBy(desc(newsletterSubscribers.createdAt))
      .limit(MAX_LIMIT),
    db
      .select({
        total: sql<number>`count(*)::int`,
        active: sql<number>`count(*) filter (where ${newsletterSubscribers.isActive})::int`,
      })
      .from(newsletterSubscribers),
  ]);

  return apiOk({
    subscribers: rows.map(serialize),
    counts: {
      total: counts?.total ?? 0,
      active: counts?.active ?? 0,
      inactive: (counts?.total ?? 0) - (counts?.active ?? 0),
    },
  });
}

type PatchBody = { id?: unknown; isActive?: unknown };

/** Toggle a subscriber's active state (unsubscribe / reactivate). */
export async function PATCH(request: Request) {
  const admin = await requireAdmin();

  if (!admin) {
    return apiError("UNAUTHORIZED", "دسترسی مجاز نیست.", 401);
  }

  const body = await readJson<PatchBody>(request);

  if (!body || typeof body.id !== "string" || typeof body.isActive !== "boolean") {
    return apiError("INVALID_BODY", "درخواست معتبر نیست.", 400);
  }

  const { id, isActive } = body;

  const [updated] = await getDb()
    .update(newsletterSubscribers)
    .set({
      isActive,
      unsubscribedAt: isActive ? null : new Date(),
      updatedAt: new Date(),
    })
    .where(eq(newsletterSubscribers.id, id))
    .returning();

  if (!updated) {
    return apiError("NOT_FOUND", "مشترک پیدا نشد.", 404);
  }

  return apiOk({ subscriber: serialize(updated) });
}

type DeleteBody = { id?: unknown };

/** Permanently remove a subscriber. */
export async function DELETE(request: Request) {
  const admin = await requireAdmin();

  if (!admin) {
    return apiError("UNAUTHORIZED", "دسترسی مجاز نیست.", 401);
  }

  const body = await readJson<DeleteBody>(request);

  if (!body || typeof body.id !== "string") {
    return apiError("INVALID_BODY", "درخواست معتبر نیست.", 400);
  }

  const deleted = await getDb()
    .delete(newsletterSubscribers)
    .where(eq(newsletterSubscribers.id, body.id))
    .returning({ id: newsletterSubscribers.id });

  if (deleted.length === 0) {
    return apiError("NOT_FOUND", "مشترک پیدا نشد.", 404);
  }

  return apiOk({ id: body.id });
}
