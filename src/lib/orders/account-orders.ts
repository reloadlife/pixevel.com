import { and, count, desc, eq, ilike } from "drizzle-orm";

import { type OrderStatus, orders } from "@/db/schema";
import { getDb } from "@/lib/db";

/** Order statuses a customer may filter their history by. */
export const ORDER_STATUS_FILTERS = [
  "PENDING",
  "PAID",
  "PROCESSING",
  "SHIPPED",
  "DELIVERED",
  "CANCELLED",
  "REFUNDED",
] as const satisfies readonly OrderStatus[];

export type OrderStatusFilter = (typeof ORDER_STATUS_FILTERS)[number];

export const ACCOUNT_ORDERS_PAGE_SIZE = 20;

export function isOrderStatusFilter(value: unknown): value is OrderStatusFilter {
  return typeof value === "string" && (ORDER_STATUS_FILTERS as readonly string[]).includes(value);
}

export type AccountOrderListItem = {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  paymentStatus: string;
  totalAmount: string;
  itemCount: number;
  createdAt: Date;
};

export type AccountOrdersPage = {
  items: AccountOrderListItem[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

export type ListAccountOrdersParams = {
  userId: string;
  page?: number;
  status?: OrderStatusFilter | null;
  search?: string | null;
};

/**
 * Paginated order history for one user. Optionally filters by status and by a
 * (case-insensitive) order-number substring. Newest first.
 */
export async function listAccountOrders(
  params: ListAccountOrdersParams,
): Promise<AccountOrdersPage> {
  const db = getDb();
  const pageSize = ACCOUNT_ORDERS_PAGE_SIZE;
  const page = Math.max(1, Math.trunc(params.page ?? 1) || 1);
  const search = params.search?.trim();

  const conditions = [eq(orders.userId, params.userId)];
  if (params.status) {
    conditions.push(eq(orders.status, params.status));
  }
  if (search) {
    conditions.push(ilike(orders.orderNumber, `%${search}%`));
  }
  const where = and(...conditions);

  const [{ total }] = await db.select({ total: count() }).from(orders).where(where);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(page, totalPages);

  const rows = await db.query.orders.findMany({
    where,
    orderBy: [desc(orders.createdAt)],
    limit: pageSize,
    offset: (safePage - 1) * pageSize,
    columns: {
      id: true,
      orderNumber: true,
      status: true,
      paymentStatus: true,
      totalAmount: true,
      createdAt: true,
    },
    with: {
      items: { columns: { quantity: true } },
    },
  });

  const items: AccountOrderListItem[] = rows.map((row) => ({
    id: row.id,
    orderNumber: row.orderNumber,
    status: row.status,
    paymentStatus: row.paymentStatus,
    totalAmount: row.totalAmount,
    itemCount: row.items.reduce((sum, item) => sum + item.quantity, 0),
    createdAt: row.createdAt,
  }));

  return { items, page: safePage, pageSize, total, totalPages };
}

/**
 * Only an unpaid (PENDING) order may be self-cancelled by its owner. A PAID
 * order must go through the refund flow (admin/support) so money and inventory
 * are reconciled — a bare status flip would keep the money and leak stock.
 */
export function isOrderCancellable(status: OrderStatus): boolean {
  return status === "PENDING";
}

/** Loads an order with the data the reorder flow needs, scoped to its owner. */
export async function getOrderForReorder(orderId: string, userId: string) {
  const db = getDb();
  return db.query.orders.findFirst({
    where: (o, { and: andOp, eq: eqOp }) => andOp(eqOp(o.id, orderId), eqOp(o.userId, userId)),
    with: {
      items: { columns: { variantId: true, quantity: true } },
    },
  });
}
