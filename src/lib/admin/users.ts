import { and, desc, eq, ilike, or, sql } from "drizzle-orm";

import type { UserRole } from "@/db/schema";
import { orders, payments, users } from "@/db/schema";
import { getDb } from "@/lib/db";

// ─── Types ────────────────────────────────────────────────────────────────────

export type AdminUserFilter = {
  q?: string;
  role?: UserRole;
  premium?: boolean;
  page?: number;
  pageSize?: number;
};

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

function clampPageSize(value: number | undefined) {
  if (!value || Number.isNaN(value)) return DEFAULT_PAGE_SIZE;
  return Math.min(Math.max(1, Math.trunc(value)), MAX_PAGE_SIZE);
}

function clampPage(value: number | undefined) {
  if (!value || Number.isNaN(value)) return 1;
  return Math.max(1, Math.trunc(value));
}

// ─── List ─────────────────────────────────────────────────────────────────────

/**
 * Paginated, filterable admin user list.
 *
 * Order count + lifetime spend (from PAID orders) are resolved through grouped
 * subqueries joined on the page of users — no N+1.
 */
export async function listAdminUsers(filter: AdminUserFilter = {}) {
  const db = getDb();

  const page = clampPage(filter.page);
  const pageSize = clampPageSize(filter.pageSize);
  const offset = (page - 1) * pageSize;

  const conditions = [];

  if (filter.q) {
    const term = `%${filter.q}%`;
    conditions.push(
      or(ilike(users.phone, term), ilike(users.fullName, term), ilike(users.email, term)),
    );
  }

  if (filter.role) {
    conditions.push(eq(users.role, filter.role));
  }

  if (typeof filter.premium === "boolean") {
    conditions.push(eq(users.isPremium, filter.premium));
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  // Lifetime PAID-order aggregates, grouped per user.
  const paidOrderStats = db
    .select({
      userId: orders.userId,
      orderCount: sql<number>`count(*)::int`.as("order_count"),
      totalSpent: sql<string>`coalesce(sum(${orders.totalAmount}), 0)::text`.as("total_spent"),
    })
    .from(orders)
    .where(eq(orders.paymentStatus, "PAID"))
    .groupBy(orders.userId)
    .as("paid_order_stats");

  const [rows, totalResult] = await Promise.all([
    db
      .select({
        id: users.id,
        email: users.email,
        phone: users.phone,
        fullName: users.fullName,
        role: users.role,
        isPremium: users.isPremium,
        premiumAt: users.premiumAt,
        lastLoginAt: users.lastLoginAt,
        createdAt: users.createdAt,
        orderCount: sql<number>`coalesce(${paidOrderStats.orderCount}, 0)`,
        totalSpent: sql<string>`coalesce(${paidOrderStats.totalSpent}, '0')`,
      })
      .from(users)
      .leftJoin(paidOrderStats, eq(paidOrderStats.userId, users.id))
      .where(where)
      .orderBy(desc(users.createdAt))
      .limit(pageSize)
      .offset(offset),
    db.select({ count: sql<number>`count(*)::int` }).from(users).where(where),
  ]);

  const total = totalResult[0]?.count ?? 0;

  return {
    rows,
    page,
    pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}

export type AdminUserListResult = Awaited<ReturnType<typeof listAdminUsers>>;
export type AdminUserListRow = AdminUserListResult["rows"][number];

// ─── Detail ───────────────────────────────────────────────────────────────────

/** Single user + recent orders + payment-history summary, for the detail panel. */
export async function getAdminUser(id: string) {
  const db = getDb();

  const user = await db.query.users.findFirst({
    where: eq(users.id, id),
    columns: {
      id: true,
      email: true,
      phone: true,
      fullName: true,
      role: true,
      isPremium: true,
      premiumAt: true,
      lastLoginAt: true,
      defaultAddressLine: true,
      defaultCity: true,
      defaultProvince: true,
      defaultPostalCode: true,
      createdAt: true,
    },
  });

  if (!user) {
    return null;
  }

  const [recentOrders, paymentRows, lifetime] = await Promise.all([
    db
      .select({
        id: orders.id,
        orderNumber: orders.orderNumber,
        status: orders.status,
        paymentStatus: orders.paymentStatus,
        totalAmount: orders.totalAmount,
        currency: orders.currency,
        createdAt: orders.createdAt,
      })
      .from(orders)
      .where(eq(orders.userId, id))
      .orderBy(desc(orders.createdAt))
      .limit(10),
    db
      .select({
        id: payments.id,
        status: payments.status,
        provider: payments.provider,
        reference: payments.reference,
        amount: payments.amount,
        currency: payments.currency,
        orderId: payments.orderId,
        paidAt: payments.paidAt,
        createdAt: payments.createdAt,
      })
      .from(payments)
      .where(eq(payments.userId, id))
      .orderBy(desc(payments.createdAt))
      .limit(10),
    // Lifetime PAID totals for the header stats.
    db
      .select({
        orderCount: sql<number>`count(*)::int`,
        totalSpent: sql<string>`coalesce(sum(${orders.totalAmount}), 0)::text`,
      })
      .from(orders)
      .where(and(eq(orders.userId, id), eq(orders.paymentStatus, "PAID"))),
  ]);

  const paidTotalResult = await db
    .select({
      paidCount: sql<number>`count(*)::int`,
      paidAmount: sql<string>`coalesce(sum(${payments.amount}), 0)::text`,
    })
    .from(payments)
    .where(and(eq(payments.userId, id), eq(payments.status, "PAID")));

  return {
    user,
    recentOrders,
    payments: paymentRows,
    stats: {
      paidOrderCount: lifetime[0]?.orderCount ?? 0,
      lifetimeSpent: lifetime[0]?.totalSpent ?? "0",
      paidPaymentCount: paidTotalResult[0]?.paidCount ?? 0,
      paidPaymentAmount: paidTotalResult[0]?.paidAmount ?? "0",
    },
  };
}

export type AdminUserDetail = NonNullable<Awaited<ReturnType<typeof getAdminUser>>>;

// ─── Serialisers ────────────────────────────────────────────────────────────────

export function toAdminUserRow(row: AdminUserListRow) {
  return {
    id: row.id,
    email: row.email,
    phone: row.phone,
    fullName: row.fullName,
    role: row.role,
    isPremium: row.isPremium,
    premiumAt: row.premiumAt ? row.premiumAt.toISOString() : null,
    lastLoginAt: row.lastLoginAt ? row.lastLoginAt.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
    orderCount: Number(row.orderCount ?? 0),
    totalSpent: String(row.totalSpent ?? "0"),
  };
}

export function toAdminUserDetail(detail: AdminUserDetail) {
  return {
    user: {
      id: detail.user.id,
      email: detail.user.email,
      phone: detail.user.phone,
      fullName: detail.user.fullName,
      role: detail.user.role,
      isPremium: detail.user.isPremium,
      premiumAt: detail.user.premiumAt ? detail.user.premiumAt.toISOString() : null,
      lastLoginAt: detail.user.lastLoginAt ? detail.user.lastLoginAt.toISOString() : null,
      defaultAddressLine: detail.user.defaultAddressLine,
      defaultCity: detail.user.defaultCity,
      defaultProvince: detail.user.defaultProvince,
      defaultPostalCode: detail.user.defaultPostalCode,
      createdAt: detail.user.createdAt.toISOString(),
    },
    stats: detail.stats,
    recentOrders: detail.recentOrders.map((order) => ({
      id: order.id,
      orderNumber: order.orderNumber,
      status: order.status,
      paymentStatus: order.paymentStatus,
      totalAmount: order.totalAmount,
      currency: order.currency,
      createdAt: order.createdAt.toISOString(),
    })),
    payments: detail.payments.map((payment) => ({
      id: payment.id,
      status: payment.status,
      provider: payment.provider,
      reference: payment.reference,
      amount: payment.amount,
      currency: payment.currency,
      orderId: payment.orderId,
      paidAt: payment.paidAt ? payment.paidAt.toISOString() : null,
      createdAt: payment.createdAt.toISOString(),
    })),
  };
}
