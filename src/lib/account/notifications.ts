import "server-only";

import { and, desc, eq, isNull } from "drizzle-orm";

import { type NotificationType, notifications } from "@/db/schema";
import { getDb } from "@/lib/db";

// ─── Types ─────────────────────────────────────────────────────────────────────

export type NotificationRow = typeof notifications.$inferSelect;

/**
 * Accepts either the base Drizzle client or a transaction handle so a
 * notification can be written inside a caller-owned transaction (e.g. when an
 * order is marked PAID, fire an ORDER notification within the same tx).
 */
type DbLike = ReturnType<typeof getDb>;
type Tx = Parameters<Parameters<DbLike["transaction"]>[0]>[0];
export type DbOrTx = DbLike | Tx;

// ─── Persian labels ─────────────────────────────────────────────────────────────

/** Persian label for a notification type, used as a small badge/category. */
export function notificationTypeLabel(type: string): string {
  const map: Record<string, string> = {
    ORDER: "سفارش",
    PAYMENT: "پرداخت",
    PROMO: "پیشنهاد ویژه",
    SYSTEM: "سیستمی",
    SECURITY: "امنیتی",
  };
  return map[type] ?? type;
}

// ─── Read model ─────────────────────────────────────────────────────────────────

export type NotificationsOverview = {
  notifications: NotificationRow[];
  unreadCount: number;
};

/**
 * Loads the user's notifications newest-first plus the count of unread ones.
 */
export async function getNotificationsOverview(
  userId: string,
  limit = 50,
): Promise<NotificationsOverview> {
  const db = getDb();

  const rows = await db.query.notifications.findMany({
    where: eq(notifications.userId, userId),
    orderBy: [desc(notifications.createdAt)],
    limit,
  });

  const unreadCount = rows.reduce((count, row) => count + (row.readAt ? 0 : 1), 0);

  return { notifications: rows, unreadCount };
}

/** Count of unread notifications for a user (cheap, for badges). */
export async function getUnreadCount(userId: string): Promise<number> {
  const db = getDb();
  const rows = await db.query.notifications.findMany({
    where: and(eq(notifications.userId, userId), isNull(notifications.readAt)),
    columns: { id: true },
  });
  return rows.length;
}

// ─── Mutations ─────────────────────────────────────────────────────────────────

/**
 * Creates a notification for a user. Designed to be called by other features
 * (orders, payments, security, …) — pass a transaction handle to keep the write
 * inside an outer transaction.
 */
export async function createNotification(
  input: {
    userId: string;
    type: NotificationType;
    titleFa: string;
    bodyFa?: string | null;
    href?: string | null;
  },
  db: DbOrTx = getDb(),
): Promise<NotificationRow> {
  const [created] = await db
    .insert(notifications)
    .values({
      userId: input.userId,
      type: input.type,
      titleFa: input.titleFa,
      bodyFa: input.bodyFa ?? null,
      href: input.href ?? null,
    })
    .returning();

  return created;
}

/**
 * Marks a single notification read for the owning user. Returns true when a row
 * was updated (i.e. the notification exists and belongs to the user).
 */
export async function markNotificationRead(
  userId: string,
  notificationId: string,
): Promise<boolean> {
  const db = getDb();
  const updated = await db
    .update(notifications)
    .set({ readAt: new Date() })
    .where(
      and(
        eq(notifications.id, notificationId),
        eq(notifications.userId, userId),
        isNull(notifications.readAt),
      ),
    )
    .returning({ id: notifications.id });

  return updated.length > 0;
}

/** Marks every unread notification read for the user. Returns the count marked. */
export async function markAllNotificationsRead(userId: string): Promise<number> {
  const db = getDb();
  const updated = await db
    .update(notifications)
    .set({ readAt: new Date() })
    .where(and(eq(notifications.userId, userId), isNull(notifications.readAt)))
    .returning({ id: notifications.id });

  return updated.length;
}
