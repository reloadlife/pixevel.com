import { and, asc, desc, eq } from "drizzle-orm";

import { orders, type SupportTicketStatus, supportMessages, supportTickets } from "@/db/schema";
import { getDb } from "@/lib/db";
import type { StatusTone } from "@/lib/status-labels";

// ─── Types ─────────────────────────────────────────────────────────────────────

export type SupportTicketRow = typeof supportTickets.$inferSelect;
export type SupportMessageRow = typeof supportMessages.$inferSelect;

/** A ticket in the list view plus its message count for a quick preview. */
export type SupportTicketListItem = SupportTicketRow & {
  messageCount: number;
};

/** A full ticket thread: the ticket, its linked order number, and messages. */
export type SupportTicketThread = SupportTicketRow & {
  orderNumber: string | null;
  messages: SupportMessageRow[];
};

// ─── Persian labels ─────────────────────────────────────────────────────────────

type StatusMeta = { label: string; tone: StatusTone };

const TICKET_STATUS: Record<string, StatusMeta> = {
  OPEN: { label: "باز", tone: "info" },
  PENDING: { label: "در انتظار پاسخ", tone: "warning" },
  RESOLVED: { label: "حل شده", tone: "success" },
  CLOSED: { label: "بسته شده", tone: "muted" },
};

/** Persian label + tone for a support-ticket status. */
export function ticketStatusMeta(status: string): StatusMeta {
  return TICKET_STATUS[status] ?? { label: status, tone: "muted" };
}

/** Statuses in which the user may still post a reply. */
export function isTicketReplyable(status: SupportTicketStatus): boolean {
  return status === "OPEN" || status === "PENDING" || status === "RESOLVED";
}

// ─── Validation ──────────────────────────────────────────────────────────────────

export const SUBJECT_MAX = 120;
export const BODY_MAX = 4000;

type Validated<T> = { ok: true; value: T } | { ok: false; code: string; message: string };

/** Validates new-ticket input: subject + first message body, optional orderId. */
export function validateNewTicket(input: {
  subjectFa?: unknown;
  bodyFa?: unknown;
  orderId?: unknown;
}): Validated<{ subjectFa: string; bodyFa: string; orderId: string | null }> {
  const subjectFa = typeof input.subjectFa === "string" ? input.subjectFa.trim() : "";
  const bodyFa = typeof input.bodyFa === "string" ? input.bodyFa.trim() : "";

  if (subjectFa.length < 3) {
    return { ok: false, code: "INVALID_SUBJECT", message: "موضوع را وارد کنید." };
  }
  if (subjectFa.length > SUBJECT_MAX) {
    return { ok: false, code: "INVALID_SUBJECT", message: "موضوع بیش از حد طولانی است." };
  }
  if (bodyFa.length < 5) {
    return { ok: false, code: "INVALID_BODY", message: "متن پیام را وارد کنید." };
  }
  if (bodyFa.length > BODY_MAX) {
    return { ok: false, code: "INVALID_BODY", message: "متن پیام بیش از حد طولانی است." };
  }

  const orderId =
    typeof input.orderId === "string" && input.orderId.trim().length > 0
      ? input.orderId.trim()
      : null;

  return { ok: true, value: { subjectFa, bodyFa, orderId } };
}

/** Validates a reply body. */
export function validateReply(input: { bodyFa?: unknown }): Validated<{ bodyFa: string }> {
  const bodyFa = typeof input.bodyFa === "string" ? input.bodyFa.trim() : "";
  if (bodyFa.length < 1) {
    return { ok: false, code: "INVALID_BODY", message: "متن پیام را وارد کنید." };
  }
  if (bodyFa.length > BODY_MAX) {
    return { ok: false, code: "INVALID_BODY", message: "متن پیام بیش از حد طولانی است." };
  }
  return { ok: true, value: { bodyFa } };
}

// ─── Read model ─────────────────────────────────────────────────────────────────

/** Lists the user's tickets newest-active-first with a message count. */
export async function listMyTickets(userId: string): Promise<SupportTicketListItem[]> {
  const db = getDb();

  const rows = await db.query.supportTickets.findMany({
    where: eq(supportTickets.userId, userId),
    with: {
      messages: { columns: { id: true } },
    },
    orderBy: [desc(supportTickets.lastMessageAt), desc(supportTickets.createdAt)],
  });

  return rows.map(({ messages, ...ticket }) => ({
    ...ticket,
    messageCount: messages.length,
  }));
}

/**
 * Loads a single ticket thread for the owning user. Returns null when the ticket
 * does not exist or belongs to someone else (ownership-guarded).
 */
export async function getMyTicketThread(
  userId: string,
  ticketId: string,
): Promise<SupportTicketThread | null> {
  const db = getDb();

  const ticket = await db.query.supportTickets.findFirst({
    where: and(eq(supportTickets.id, ticketId), eq(supportTickets.userId, userId)),
    with: {
      order: { columns: { orderNumber: true } },
      messages: {
        orderBy: [asc(supportMessages.createdAt)],
      },
    },
  });

  if (!ticket) {
    return null;
  }

  const { order, messages, ...rest } = ticket;
  return {
    ...rest,
    orderNumber: order?.orderNumber ?? null,
    messages,
  };
}

/** Returns the user's order ids+numbers for the new-ticket "link an order" picker. */
export async function listLinkableOrders(
  userId: string,
): Promise<{ id: string; orderNumber: string }[]> {
  const db = getDb();
  const rows = await db.query.orders.findMany({
    where: eq(orders.userId, userId),
    columns: { id: true, orderNumber: true },
    orderBy: [desc(orders.createdAt)],
    limit: 50,
  });
  return rows;
}

// ─── Mutations ─────────────────────────────────────────────────────────────────

/**
 * Creates a ticket plus its first message inside a transaction, stamping
 * `lastMessageAt`. The order link is verified to belong to the user; an unknown
 * or foreign orderId is silently dropped (not fatal) to keep the contract clean.
 */
export async function createTicket(input: {
  userId: string;
  subjectFa: string;
  bodyFa: string;
  orderId: string | null;
}): Promise<SupportTicketRow> {
  const db = getDb();

  // Only link an order the user actually owns.
  let orderId: string | null = null;
  if (input.orderId) {
    const owned = await db.query.orders.findFirst({
      where: and(eq(orders.id, input.orderId), eq(orders.userId, input.userId)),
      columns: { id: true },
    });
    orderId = owned ? owned.id : null;
  }

  return db.transaction(async (tx) => {
    const now = new Date();
    const [ticket] = await tx
      .insert(supportTickets)
      .values({
        userId: input.userId,
        orderId,
        subjectFa: input.subjectFa,
        status: "OPEN",
        lastMessageAt: now,
      })
      .returning();

    await tx.insert(supportMessages).values({
      ticketId: ticket.id,
      authorUserId: input.userId,
      isStaff: false,
      bodyFa: input.bodyFa,
    });

    return ticket;
  });
}

/**
 * Appends a user reply (isStaff=false) to a ticket and bumps `lastMessageAt`.
 * Re-opens a RESOLVED ticket to PENDING so staff revisit it. Ownership must be
 * checked by the caller before invoking this.
 */
export async function addUserReply(input: {
  ticketId: string;
  userId: string;
  bodyFa: string;
  currentStatus: SupportTicketStatus;
}): Promise<SupportMessageRow> {
  const db = getDb();

  return db.transaction(async (tx) => {
    const now = new Date();
    const [message] = await tx
      .insert(supportMessages)
      .values({
        ticketId: input.ticketId,
        authorUserId: input.userId,
        isStaff: false,
        bodyFa: input.bodyFa,
      })
      .returning();

    // A user reply on a resolved ticket re-opens it for staff.
    const nextStatus: SupportTicketStatus =
      input.currentStatus === "RESOLVED" ? "PENDING" : input.currentStatus;

    await tx
      .update(supportTickets)
      .set({ lastMessageAt: now, status: nextStatus, updatedAt: now })
      .where(eq(supportTickets.id, input.ticketId));

    return message;
  });
}
