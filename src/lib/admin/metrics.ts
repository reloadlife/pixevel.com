import { desc, eq, inArray, sql } from "drizzle-orm";

import type { OrderStatus, PaymentStatus } from "@/db/schema";
import {
  inventoryUnits,
  newsletterSubscribers,
  orderItems,
  orders,
  payments,
  products,
  productVariants,
  users,
} from "@/db/schema";
import { getDb } from "@/lib/db";

// ─── Config ─────────────────────────────────────────────────────────────────

/** Variants with fewer than this many AVAILABLE units are flagged as low-stock. */
export const LOW_STOCK_THRESHOLD = 5;

const LOW_STOCK_LIMIT = 12;
const TOP_PRODUCTS_LIMIT = 8;
const RECENT_ORDERS_LIMIT = 10;

// Revenue is consistently defined as the sum of PAID payments' `amount`.
const REVENUE_PAYMENT_STATUS: PaymentStatus = "PAID";

// ─── Helpers ────────────────────────────────────────────────────────────────

function startOfToday(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

function daysAgo(days: number): Date {
  const base = startOfToday();
  base.setDate(base.getDate() - days);
  return base;
}

/** Coerce a SQL `sum()` result (string | null) into a stable money string. */
function moneyString(value: string | null): string {
  if (value === null || value === "") {
    return "0";
  }
  return value;
}

// ─── Types ──────────────────────────────────────────────────────────────────

export type RevenueSummary = {
  /** Total revenue across all PAID payments. Money string. */
  total: string;
  /** Revenue from payments paid since 00:00 today. Money string. */
  today: string;
  /** Revenue from payments paid in the trailing 7 days (incl. today). Money string. */
  last7Days: string;
};

export type StatusCount<T extends string> = { status: T; count: number };

export type LowStockVariant = {
  variantId: string;
  productId: string;
  productTitleFa: string;
  productSlug: string;
  variantTitleFa: string;
  sku: string;
  availableCount: number;
};

export type TopProduct = {
  variantId: string | null;
  titleFa: string;
  sku: string;
  unitsSold: number;
  revenue: string;
};

export type RecentOrder = {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  totalAmount: string;
  currency: string;
  customerName: string | null;
  customerPhone: string | null;
  createdAt: string;
};

export type DashboardMetrics = {
  revenue: RevenueSummary;
  orderCountsByStatus: StatusCount<OrderStatus>[];
  orderCountsByPaymentStatus: StatusCount<PaymentStatus>[];
  totalOrders: number;
  pendingPaymentOrders: number;
  totalUsers: number;
  totalProducts: number;
  activeNewsletterSubscribers: number;
  lowStock: LowStockVariant[];
  topProducts: TopProduct[];
  recentOrders: RecentOrder[];
};

// ─── Aggregate queries ────────────────────────────────────────────────────────

/**
 * Revenue figures from PAID payments: lifetime total, today, and trailing 7
 * days. A single grouped scan avoids three separate round-trips — the window
 * sums use FILTER on `paidAt`.
 */
export async function getRevenueSummary(): Promise<RevenueSummary> {
  const db = getDb();
  const todayStart = startOfToday();
  const weekStart = daysAgo(6); // today + previous 6 days = 7-day window

  const [row] = await db
    .select({
      total: sql<string | null>`sum(${payments.amount})`,
      today: sql<
        string | null
      >`sum(${payments.amount}) filter (where ${payments.paidAt} >= ${todayStart.toISOString()})`,
      last7Days: sql<
        string | null
      >`sum(${payments.amount}) filter (where ${payments.paidAt} >= ${weekStart.toISOString()})`,
    })
    .from(payments)
    .where(eq(payments.status, REVENUE_PAYMENT_STATUS));

  return {
    total: moneyString(row?.total ?? null),
    today: moneyString(row?.today ?? null),
    last7Days: moneyString(row?.last7Days ?? null),
  };
}

/** Count of orders grouped by `status`, covering every enum value (0-filled). */
export async function getOrderCountsByStatus(): Promise<StatusCount<OrderStatus>[]> {
  const rows = await getDb()
    .select({ status: orders.status, count: sql<number>`count(*)::int` })
    .from(orders)
    .groupBy(orders.status);

  const ORDER_STATUS_ORDER: OrderStatus[] = [
    "PENDING",
    "PAID",
    "PROCESSING",
    "SHIPPED",
    "DELIVERED",
    "CANCELLED",
    "REFUNDED",
  ];
  const byStatus = new Map(rows.map((r) => [r.status, r.count]));
  return ORDER_STATUS_ORDER.map((status) => ({ status, count: byStatus.get(status) ?? 0 }));
}

/** Count of orders grouped by `paymentStatus`, covering every enum value. */
export async function getOrderCountsByPaymentStatus(): Promise<StatusCount<PaymentStatus>[]> {
  const rows = await getDb()
    .select({ status: orders.paymentStatus, count: sql<number>`count(*)::int` })
    .from(orders)
    .groupBy(orders.paymentStatus);

  const PAYMENT_STATUS_ORDER: PaymentStatus[] = [
    "UNPAID",
    "AUTHORIZED",
    "PAID",
    "FAILED",
    "REFUNDED",
  ];
  const byStatus = new Map(rows.map((r) => [r.status, r.count]));
  return PAYMENT_STATUS_ORDER.map((status) => ({ status, count: byStatus.get(status) ?? 0 }));
}

/**
 * Variants whose AVAILABLE inventory-unit count is below the threshold, joined
 * to product/variant labels. Counts only AVAILABLE units (RESERVED/SOLD/DAMAGED
 * are excluded), grouped per variant so it is a single scan, not N+1.
 */
export async function getLowStockVariants(
  threshold = LOW_STOCK_THRESHOLD,
): Promise<LowStockVariant[]> {
  const rows = await getDb()
    .select({
      variantId: productVariants.id,
      productId: products.id,
      productTitleFa: products.titleFa,
      productSlug: products.slug,
      variantTitleFa: productVariants.titleFa,
      sku: productVariants.sku,
      availableCount: sql<number>`count(${inventoryUnits.id}) filter (where ${inventoryUnits.status} = 'AVAILABLE')::int`,
    })
    .from(productVariants)
    .innerJoin(products, eq(productVariants.productId, products.id))
    .leftJoin(inventoryUnits, eq(inventoryUnits.variantId, productVariants.id))
    .groupBy(
      productVariants.id,
      products.id,
      products.titleFa,
      products.slug,
      productVariants.titleFa,
      productVariants.sku,
    )
    .having(
      sql`count(${inventoryUnits.id}) filter (where ${inventoryUnits.status} = 'AVAILABLE') < ${threshold}`,
    )
    .orderBy(
      sql`count(${inventoryUnits.id}) filter (where ${inventoryUnits.status} = 'AVAILABLE') asc`,
    )
    .limit(LOW_STOCK_LIMIT);

  return rows.map((r) => ({ ...r, availableCount: Number(r.availableCount) }));
}

const PAID_ORDER_STATUSES: OrderStatus[] = ["PAID", "PROCESSING", "SHIPPED", "DELIVERED"];

/**
 * Best-selling products by units sold, drawn from order items on orders that
 * have been paid (PAID and the post-paid lifecycle statuses). Grouped per
 * variant — one aggregate scan.
 */
export async function getTopProducts(): Promise<TopProduct[]> {
  const rows = await getDb()
    .select({
      variantId: orderItems.variantId,
      titleFa: sql<string>`max(${orderItems.titleFa})`,
      sku: sql<string>`max(${orderItems.sku})`,
      unitsSold: sql<number>`sum(${orderItems.quantity})::int`,
      revenue: sql<string | null>`sum(${orderItems.totalPrice})`,
    })
    .from(orderItems)
    .innerJoin(orders, eq(orderItems.orderId, orders.id))
    .where(inArray(orders.status, PAID_ORDER_STATUSES))
    .groupBy(orderItems.variantId)
    .orderBy(desc(sql`sum(${orderItems.quantity})`))
    .limit(TOP_PRODUCTS_LIMIT);

  return rows.map((r) => ({
    variantId: r.variantId,
    titleFa: r.titleFa,
    sku: r.sku,
    unitsSold: Number(r.unitsSold),
    revenue: moneyString(r.revenue ?? null),
  }));
}

/** The latest N orders for the recent-orders table. */
export async function getRecentOrders(limit = RECENT_ORDERS_LIMIT): Promise<RecentOrder[]> {
  const rows = await getDb()
    .select({
      id: orders.id,
      orderNumber: orders.orderNumber,
      status: orders.status,
      paymentStatus: orders.paymentStatus,
      totalAmount: orders.totalAmount,
      currency: orders.currency,
      customerName: orders.customerName,
      customerPhone: orders.customerPhone,
      createdAt: orders.createdAt,
    })
    .from(orders)
    .orderBy(desc(orders.createdAt))
    .limit(limit);

  return rows.map((r) => ({
    ...r,
    createdAt: r.createdAt.toISOString(),
  }));
}

// ─── Composite ──────────────────────────────────────────────────────────────

/**
 * Fan out every dashboard aggregate in parallel so the page renders from a
 * single awaited batch instead of a serial chain.
 */
export async function getDashboardMetrics(): Promise<DashboardMetrics> {
  const db = getDb();

  const [
    revenue,
    orderCountsByStatus,
    orderCountsByPaymentStatus,
    totalsRow,
    pendingRow,
    usersRow,
    productsRow,
    newsletterRow,
    lowStock,
    topProducts,
    recentOrders,
  ] = await Promise.all([
    getRevenueSummary(),
    getOrderCountsByStatus(),
    getOrderCountsByPaymentStatus(),
    db.select({ count: sql<number>`count(*)::int` }).from(orders),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(orders)
      .where(inArray(orders.paymentStatus, ["UNPAID", "AUTHORIZED"])),
    db.select({ count: sql<number>`count(*)::int` }).from(users),
    db.select({ count: sql<number>`count(*)::int` }).from(products),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(newsletterSubscribers)
      .where(eq(newsletterSubscribers.isActive, true)),
    getLowStockVariants(),
    getTopProducts(),
    getRecentOrders(),
  ]);

  return {
    revenue,
    orderCountsByStatus,
    orderCountsByPaymentStatus,
    totalOrders: totalsRow[0]?.count ?? 0,
    pendingPaymentOrders: pendingRow[0]?.count ?? 0,
    totalUsers: usersRow[0]?.count ?? 0,
    totalProducts: productsRow[0]?.count ?? 0,
    activeNewsletterSubscribers: newsletterRow[0]?.count ?? 0,
    lowStock,
    topProducts,
    recentOrders,
  };
}
