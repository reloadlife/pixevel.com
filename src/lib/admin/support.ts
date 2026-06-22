import { and, asc, count, desc, eq, ilike, or, type SQL } from "drizzle-orm";

import type { SupportTicketStatus } from "@/db/schema";
import { supportMessages, supportTickets, users } from "@/db/schema";
import { notify } from "@/lib/comms/dispatch";
import { getDb } from "@/lib/db";

// ─── Types ──────────────────────────────────────────────────────────────────

export type ListAdminTicketsParams = {
  status?: SupportTicketStatus;
  q?: string;
  page?: number;
  pageSize?: number;
};

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

// ─── List ─────────────────────────────────────────────────────────────────────

/**
 * List support tickets newest-activity-first, joined to the requesting user's
 * phone/name, with pagination metadata and per-status counts for the operator
 * queue. The optional `q` filter matches the subject, user phone, or user name.
 */
export async function listAdminTickets(params: ListAdminTicketsParams = {}) {
  const db = getDb();

  const page = clampPage(params.page);
  const pageSize = clampPageSize(params.pageSize);
  const offset = (page - 1) * pageSize;

  const filters: SQL[] = [];
  if (params.status) {
    filters.push(eq(supportTickets.status, params.status));
  }
  const q = params.q?.trim();
  if (q) {
    const term = `%${q}%`;
    const search = or(
      ilike(supportTickets.subjectFa, term),
      ilike(users.phone, term),
      ilike(users.fullName, term),
    );
    if (search) {
      filters.push(search);
    }
  }
  const where = filters.length > 0 ? and(...filters) : undefined;

  const rows = await db
    .select({
      id: supportTickets.id,
      userId: supportTickets.userId,
      userPhone: users.phone,
      userName: users.fullName,
      orderId: supportTickets.orderId,
      subjectFa: supportTickets.subjectFa,
      status: supportTickets.status,
      lastMessageAt: supportTickets.lastMessageAt,
      createdAt: supportTickets.createdAt,
      updatedAt: supportTickets.updatedAt,
    })
    .from(supportTickets)
    .innerJoin(users, eq(supportTickets.userId, users.id))
    .where(where)
    .orderBy(desc(supportTickets.lastMessageAt), desc(supportTickets.createdAt))
    .limit(pageSize)
    .offset(offset);

  const [{ value: total }] = await db
    .select({ value: count() })
    .from(supportTickets)
    .innerJoin(users, eq(supportTickets.userId, users.id))
    .where(where);

  const counts = await getStatusCounts();

  const tickets = rows.map((row) => ({
    ...row,
    customer: row.userName?.trim() || row.userPhone || "کاربر",
    lastMessageAt: (row.lastMessageAt ?? row.createdAt).toISOString(),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }));

  return {
    tickets,
    counts,
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    },
  };
}

export type AdminTicketRow = Awaited<ReturnType<typeof listAdminTickets>>["tickets"][number];
export type TicketStatusCounts = Awaited<ReturnType<typeof getStatusCounts>>;

/** Count tickets grouped by status for the queue badges. */
export async function getStatusCounts() {
  const db = getDb();

  const rows = await db
    .select({ status: supportTickets.status, value: count() })
    .from(supportTickets)
    .groupBy(supportTickets.status);

  const counts = { OPEN: 0, PENDING: 0, RESOLVED: 0, CLOSED: 0, total: 0 };
  for (const row of rows) {
    counts[row.status] = row.value;
    counts.total += row.value;
  }
  return counts;
}

// ─── Detail ─────────────────────────────────────────────────────────────────────

export type AdminTicketMessage = {
  id: string;
  isStaff: boolean;
  bodyFa: string;
  createdAt: string;
};

export type AdminTicketDetail = {
  id: string;
  subjectFa: string;
  status: SupportTicketStatus;
  customer: string;
  userPhone: string | null;
  userName: string | null;
  orderNumber: string | null;
  lastMessageAt: string;
  createdAt: string;
  messages: AdminTicketMessage[];
};

/**
 * Load a single ticket thread for the operator: the ticket, the requesting
 * user, the linked order number, and every message in chronological order.
 * Returns null when the ticket does not exist.
 */
export async function getAdminTicket(id: string): Promise<AdminTicketDetail | null> {
  const db = getDb();

  const ticket = await db.query.supportTickets.findFirst({
    where: eq(supportTickets.id, id),
    with: {
      user: { columns: { phone: true, fullName: true } },
      order: { columns: { orderNumber: true } },
      messages: {
        orderBy: [asc(supportMessages.createdAt)],
      },
    },
  });

  if (!ticket) {
    return null;
  }

  const { user, order, messages, ...rest } = ticket;
  return {
    id: rest.id,
    subjectFa: rest.subjectFa,
    status: rest.status,
    customer: user?.fullName?.trim() || user?.phone || "کاربر",
    userPhone: user?.phone ?? null,
    userName: user?.fullName ?? null,
    orderNumber: order?.orderNumber ?? null,
    lastMessageAt: (rest.lastMessageAt ?? rest.createdAt).toISOString(),
    createdAt: rest.createdAt.toISOString(),
    messages: messages.map((message) => ({
      id: message.id,
      isStaff: message.isStaff,
      bodyFa: message.bodyFa,
      createdAt: message.createdAt.toISOString(),
    })),
  };
}

// ─── Mutations ─────────────────────────────────────────────────────────────────

/**
 * Append a staff reply (isStaff=true) to a ticket, attribute it to the acting
 * admin, bump `lastMessageAt`, and move the ticket to PENDING (awaiting the
 * customer). Returns null when the ticket does not exist.
 */
export async function adminReplyToTicket(
  adminUserId: string,
  ticketId: string,
  bodyFa: string,
): Promise<AdminTicketDetail | null> {
  const db = getDb();

  const exists = await db.query.supportTickets.findFirst({
    where: eq(supportTickets.id, ticketId),
    columns: { id: true },
  });
  if (!exists) {
    return null;
  }

  await db.transaction(async (tx) => {
    const now = new Date();
    await tx.insert(supportMessages).values({
      ticketId,
      authorUserId: adminUserId,
      isStaff: true,
      bodyFa,
    });

    await tx
      .update(supportTickets)
      .set({ lastMessageAt: now, status: "PENDING", updatedAt: now })
      .where(eq(supportTickets.id, ticketId));
  });

  // Notify the ticket owner that support replied (best-effort, never throws).
  const ticket = await db.query.supportTickets.findFirst({
    where: eq(supportTickets.id, ticketId),
    columns: { userId: true, subjectFa: true, orderId: true },
    with: { user: { columns: { email: true } } },
  });
  if (ticket) {
    await notify(
      "TICKET_REPLIED_TO_USER",
      { userId: ticket.userId, email: ticket.user?.email ?? null, orderId: ticket.orderId },
      {
        ticket_id: ticketId,
        ticket_subject: ticket.subjectFa,
        href: `/account/support/${ticketId}`,
      },
    );
  }

  return getAdminTicket(ticketId);
}

/** Set a ticket's status. Returns the refreshed detail or null when missing. */
export async function setTicketStatus(
  ticketId: string,
  status: SupportTicketStatus,
): Promise<AdminTicketDetail | null> {
  const db = getDb();

  const [updated] = await db
    .update(supportTickets)
    .set({ status, updatedAt: new Date() })
    .where(eq(supportTickets.id, ticketId))
    .returning({ id: supportTickets.id });

  if (!updated) {
    return null;
  }

  return getAdminTicket(ticketId);
}
