import { count, desc, eq } from "drizzle-orm";

import type { NotificationType } from "@/db/schema";
import { notifications, users } from "@/db/schema";
import { getDb } from "@/lib/db";

// ─── Types ──────────────────────────────────────────────────────────────────

/** Notification types an operator is allowed to broadcast from the panel. */
export type BroadcastType = Extract<NotificationType, "PROMO" | "SYSTEM">;

export type BroadcastInput = {
  /** "user" sends to a single user; "all" fans out to every active user. */
  target: "user" | "all";
  /** Required when `target` is "user". */
  userId?: string;
  type: BroadcastType;
  titleFa: string;
  bodyFa?: string | null;
  href?: string | null;
};

/**
 * Domain errors thrown by this module. The API layer maps each `code` to an
 * HTTP status + Persian message, so messages never leak ORM/DB details.
 */
export class NotificationBroadcastError extends Error {
  constructor(public code: string) {
    super(code);
    this.name = "NotificationBroadcastError";
  }
}

// Insert in chunks to keep a single statement small when fanning out to a very
// large audience.
const INSERT_CHUNK_SIZE = 500;

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

function clampPageSize(value: number | undefined) {
  if (!value || !Number.isFinite(value) || value < 1) {
    return DEFAULT_PAGE_SIZE;
  }
  return Math.min(Math.floor(value), MAX_PAGE_SIZE);
}

function clampPage(value: number | undefined) {
  if (!value || !Number.isFinite(value) || value < 1) {
    return 1;
  }
  return Math.floor(value);
}

// ─── Broadcast ──────────────────────────────────────────────────────────────

/**
 * Sends a notification to a single user or to every active user. The customer
 * inbox reads notifications per `userId`, so "all" inserts one row per user
 * (batched). Returns the number of notifications written.
 */
export async function broadcastNotification(input: BroadcastInput): Promise<{ sent: number }> {
  const db = getDb();

  const titleFa = input.titleFa.trim();
  if (!titleFa) {
    throw new NotificationBroadcastError("TITLE_REQUIRED");
  }

  const bodyFa = input.bodyFa?.trim() || null;
  const href = input.href?.trim() || null;

  if (input.target === "user") {
    if (!input.userId) {
      throw new NotificationBroadcastError("USER_REQUIRED");
    }

    const target = await db.query.users.findFirst({
      where: eq(users.id, input.userId),
      columns: { id: true },
    });
    if (!target) {
      throw new NotificationBroadcastError("USER_NOT_FOUND");
    }

    await db.insert(notifications).values({
      userId: target.id,
      type: input.type,
      titleFa,
      bodyFa,
      href,
    });

    return { sent: 1 };
  }

  // target === "all": one row per active user, inserted in chunks.
  const recipients = await db.select({ id: users.id }).from(users);

  if (recipients.length === 0) {
    return { sent: 0 };
  }

  for (let i = 0; i < recipients.length; i += INSERT_CHUNK_SIZE) {
    const chunk = recipients.slice(i, i + INSERT_CHUNK_SIZE);
    await db.insert(notifications).values(
      chunk.map((recipient) => ({
        userId: recipient.id,
        type: input.type,
        titleFa,
        bodyFa,
        href,
      })),
    );
  }

  return { sent: recipients.length };
}

// ─── Read (audit list) ────────────────────────────────────────────────────────

export type ListRecentNotificationsParams = {
  page?: number;
  pageSize?: number;
};

/**
 * Lists recently sent notifications newest-first, joined to the recipient's
 * phone/name, with pagination metadata — an audit trail for the operator.
 */
export async function listRecentNotifications(params: ListRecentNotificationsParams = {}) {
  const db = getDb();

  const page = clampPage(params.page);
  const pageSize = clampPageSize(params.pageSize);
  const offset = (page - 1) * pageSize;

  const rows = await db
    .select({
      id: notifications.id,
      userId: notifications.userId,
      userPhone: users.phone,
      userName: users.fullName,
      type: notifications.type,
      titleFa: notifications.titleFa,
      bodyFa: notifications.bodyFa,
      href: notifications.href,
      readAt: notifications.readAt,
      createdAt: notifications.createdAt,
    })
    .from(notifications)
    .innerJoin(users, eq(notifications.userId, users.id))
    .orderBy(desc(notifications.createdAt))
    .limit(pageSize)
    .offset(offset);

  const [{ value: total }] = await db.select({ value: count() }).from(notifications);

  const items = rows.map((row) => ({
    id: row.id,
    userId: row.userId,
    recipient: row.userName?.trim() || row.userPhone || "کاربر",
    userPhone: row.userPhone,
    type: row.type,
    titleFa: row.titleFa,
    bodyFa: row.bodyFa,
    href: row.href,
    readAt: row.readAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
  }));

  return {
    notifications: items,
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    },
  };
}

export type AdminNotificationRow = Awaited<
  ReturnType<typeof listRecentNotifications>
>["notifications"][number];
