import { and, count, desc, eq, gte, ilike, isNotNull, lte, or, sql } from "drizzle-orm";
import type { OrderStatus, PaymentStatus } from "@/db/schema";
import { inventoryUnits, orders, payments } from "@/db/schema";
import { getDb } from "@/lib/db";
import { releaseExpiredReservations, releaseUnits } from "@/lib/orders/inventory";
import {
  confirmPayment,
  failPayment,
  resendOrderCodes as resendOrderCodesEmail,
} from "@/lib/orders/payments";
import { refundZarinpalPayment } from "@/lib/payments/zarinpal";

// ─── Types ────────────────────────────────────────────────────────────────────

export type AdminOrderFilter = {
  status?: OrderStatus;
  paymentStatus?: PaymentStatus;
  /** Payment provider, e.g. ZARINPAL / CARD_TO_CARD / MANUAL. */
  provider?: string;
  /** Free-text search over orderNumber / customerPhone / customerEmail. */
  search?: string;
  /** ISO date (inclusive lower bound) on createdAt. */
  dateFrom?: string;
  /** ISO date (inclusive upper bound) on createdAt. */
  dateTo?: string;
  /**
   * Quick filter for card-to-card receipts awaiting review: paymentStatus is
   * UNPAID or AUTHORIZED *and* the order has a payment with a receiptUrl.
   */
  pendingReceipts?: boolean;
  page?: number;
  pageSize?: number;
};

export type PageMeta = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  hasPrev: boolean;
  hasNext: boolean;
};

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

// ─── Filter builder ─────────────────────────────────────────────────────────

/**
 * Subquery of orderIds that have at least one payment carrying a receiptUrl.
 * Used by the "رسیدهای در انتظار بررسی" (pending receipts) quick filter.
 */
function ordersWithReceiptSubquery() {
  return getDb()
    .select({ id: payments.orderId })
    .from(payments)
    .where(isNotNull(payments.receiptUrl));
}

function buildConditions(filter: AdminOrderFilter) {
  const conditions = [];

  if (filter.status) {
    conditions.push(eq(orders.status, filter.status));
  }

  if (filter.paymentStatus) {
    conditions.push(eq(orders.paymentStatus, filter.paymentStatus));
  }

  if (filter.provider) {
    // Provider lives on the payment rows; match orders having such a payment.
    const sub = getDb()
      .select({ id: payments.orderId })
      .from(payments)
      .where(eq(payments.provider, filter.provider));
    conditions.push(sql`${orders.id} in ${sub}`);
  }

  if (filter.dateFrom) {
    const from = new Date(filter.dateFrom);
    if (!Number.isNaN(from.getTime())) {
      conditions.push(gte(orders.createdAt, from));
    }
  }

  if (filter.dateTo) {
    const to = new Date(filter.dateTo);
    if (!Number.isNaN(to.getTime())) {
      conditions.push(lte(orders.createdAt, to));
    }
  }

  const search = filter.search?.trim();
  if (search) {
    const like = `%${search}%`;
    conditions.push(
      or(
        ilike(orders.orderNumber, like),
        ilike(orders.customerPhone, like),
        ilike(orders.customerEmail, like),
      ),
    );
  }

  if (filter.pendingReceipts) {
    conditions.push(or(eq(orders.paymentStatus, "UNPAID"), eq(orders.paymentStatus, "AUTHORIZED")));
    conditions.push(sql`${orders.id} in ${ordersWithReceiptSubquery()}`);
  }

  return conditions;
}

// ─── List ─────────────────────────────────────────────────────────────────────

/**
 * Plain list (no pagination meta). Kept for server components that just need
 * the rows. Honours every filter in {@link AdminOrderFilter}.
 */
export async function listAdminOrders(filter: AdminOrderFilter = {}) {
  const { rows } = await listAdminOrdersPaged({ ...filter, pageSize: MAX_PAGE_SIZE, page: 1 });
  return rows;
}

/**
 * Paginated list with filters + page meta. Backing query for the admin orders
 * API and the list UI.
 */
export async function listAdminOrdersPaged(filter: AdminOrderFilter = {}) {
  const db = getDb();

  // Release expired reservations before listing so counts are accurate.
  await db.transaction(async (tx) => {
    await releaseExpiredReservations(tx);
  });

  const page = Math.max(1, Math.floor(filter.page ?? 1));
  const pageSize = Math.min(
    MAX_PAGE_SIZE,
    Math.max(1, Math.floor(filter.pageSize ?? DEFAULT_PAGE_SIZE)),
  );

  const conditions = buildConditions(filter);
  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const [{ total }] = await db.select({ total: count() }).from(orders).where(where);

  const rows = await db.query.orders.findMany({
    where,
    with: {
      user: {
        columns: { id: true, phone: true, fullName: true, isPremium: true },
      },
      payments: {
        columns: {
          id: true,
          status: true,
          provider: true,
          amount: true,
          receiptUrl: true,
          paidAt: true,
        },
        orderBy: (p, { desc: d }) => [d(p.createdAt)],
      },
      items: {
        columns: {
          id: true,
          titleFa: true,
          sku: true,
          quantity: true,
          unitPrice: true,
          totalPrice: true,
        },
      },
    },
    orderBy: [desc(orders.createdAt)],
    limit: pageSize,
    offset: (page - 1) * pageSize,
  });

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const meta: PageMeta = {
    page,
    pageSize,
    total,
    totalPages,
    hasPrev: page > 1,
    hasNext: page < totalPages,
  };

  return { rows, meta };
}

export type AdminOrderListResult = Awaited<ReturnType<typeof listAdminOrdersPaged>>;
export type AdminOrderListItem = AdminOrderListResult["rows"][number];

/**
 * Count of orders that have a card-to-card receipt awaiting review. Surfaced as
 * a badge so operators find pending receipts fast.
 */
export async function countPendingReceipts(): Promise<number> {
  const db = getDb();
  const [{ total }] = await db
    .select({ total: count() })
    .from(orders)
    .where(
      and(
        or(eq(orders.paymentStatus, "UNPAID"), eq(orders.paymentStatus, "AUTHORIZED")),
        sql`${orders.id} in ${ordersWithReceiptSubquery()}`,
      ),
    );

  return total;
}

// ─── Detail ───────────────────────────────────────────────────────────────────

export async function getAdminOrder(id: string) {
  return getDb().query.orders.findFirst({
    where: (o, { eq: e }) => e(o.id, id),
    with: {
      user: {
        columns: { id: true, phone: true, fullName: true, isPremium: true },
      },
      payments: {
        orderBy: (p, { desc: d }) => [d(p.createdAt)],
      },
      items: {
        with: {
          variant: {
            columns: {
              id: true,
              sku: true,
              titleFa: true,
              colorNameFa: true,
              materialNameFa: true,
              size: true,
            },
          },
        },
      },
      inventoryUnits: {
        columns: { id: true, code: true, status: true, variantId: true, soldAt: true },
        with: {
          variant: {
            columns: { id: true, sku: true, titleFa: true },
          },
        },
        orderBy: (u, { asc }) => [asc(u.createdAt)],
      },
    },
  });
}

export type AdminOrderDetail = Awaited<ReturnType<typeof getAdminOrder>>;

// ─── Actions ──────────────────────────────────────────────────────────────────

/** Admin manually confirms a card-to-card payment. */
export async function confirmOrderPayment(id: string): Promise<void> {
  await confirmPayment(id);
}

/**
 * Admin rejects a payment (e.g. an uploaded receipt that doesn't check out):
 * set the payment + order to FAILED and release any RESERVED units.
 */
export async function failOrderPayment(id: string): Promise<void> {
  await failPayment(id);
}

/** Re-send the digital-codes / receipt email for a PAID order. */
export async function resendOrderCodes(id: string): Promise<void> {
  await resendOrderCodesEmail(id);
}

/** Mark order as physically shipped. */
export async function markShipped(id: string): Promise<void> {
  await getDb().update(orders).set({ status: "SHIPPED" }).where(eq(orders.id, id));
}

/** Mark order as physically delivered. */
export async function markDelivered(id: string): Promise<void> {
  await getDb().update(orders).set({ status: "DELIVERED" }).where(eq(orders.id, id));
}

/** Cancel an order and release all reserved inventory units. */
export async function cancelOrder(id: string): Promise<void> {
  await getDb().transaction(async (tx) => {
    await releaseUnits(tx, id);
    await tx.update(orders).set({ status: "CANCELLED" }).where(eq(orders.id, id));
  });
}

export type RefundOutcome = {
  /** Gateway result, when a gateway payment was found. */
  gateway: "refunded" | "manual" | "failed" | "none";
  message: string;
};

/**
 * Refund an order.
 *
 * Always (locally, in one tx): release reserved units + mark order/payments
 * REFUNDED. Additionally makes a best-effort gateway refund for ZARINPAL
 * payments. The local refund is the source of truth — a `manual` or `failed`
 * gateway result is recorded/logged but never blocks the refund.
 */
export async function refundOrder(id: string): Promise<RefundOutcome> {
  const db = getDb();

  // Look at the latest payment to decide whether a gateway refund is possible.
  const latestPayment = await db.query.payments.findFirst({
    where: (p, { eq: e }) => e(p.orderId, id),
    orderBy: (p, { desc: d }) => [d(p.createdAt)],
    columns: { id: true, provider: true, reference: true, amount: true, status: true },
  });

  // Local refund first — always authoritative.
  await db.transaction(async (tx) => {
    await releaseUnits(tx, id);
    await tx
      .update(orders)
      .set({ status: "REFUNDED", paymentStatus: "REFUNDED" })
      .where(eq(orders.id, id));
    await tx.update(payments).set({ status: "REFUNDED" }).where(eq(payments.orderId, id));
  });

  // Best-effort gateway refund (Zarinpal only for now).
  if (latestPayment?.provider === "ZARINPAL" && latestPayment.status === "PAID") {
    const result = await refundZarinpalPayment({
      reference: latestPayment.reference,
      amount: latestPayment.amount,
    });

    if (result.status !== "refunded") {
      console.warn(
        `[admin/orders] gateway refund for order ${id}: ${result.status} — ${result.message}`,
      );
    }

    return { gateway: result.status, message: result.message };
  }

  return {
    gateway: "none",
    message: "استرداد محلی انجام شد. تراکنش درگاه‌داری برای استرداد خودکار یافت نشد.",
  };
}

/** Mark a specific inventory unit as DAMAGED. */
export async function markUnitDamaged(unitId: string): Promise<void> {
  await getDb()
    .update(inventoryUnits)
    .set({ status: "DAMAGED" })
    .where(eq(inventoryUnits.id, unitId));
}

// ─── Serialisers ──────────────────────────────────────────────────────────────

export function toAdminOrderRow(order: AdminOrderListItem) {
  // A receipt is "pending review" when payment hasn't been settled yet but a
  // receipt image exists on one of the order's payments.
  const receiptPayment = order.payments.find((p) => p.receiptUrl);
  const pendingReceipt =
    (order.paymentStatus === "UNPAID" || order.paymentStatus === "AUTHORIZED") &&
    Boolean(receiptPayment);

  return {
    id: order.id,
    orderNumber: order.orderNumber,
    status: order.status,
    paymentStatus: order.paymentStatus,
    totalAmount: order.totalAmount,
    discountAmount: order.discountAmount,
    couponCode: order.couponCode,
    customerEmail: order.customerEmail,
    recipientEmail: order.recipientEmail,
    giftMessage: order.giftMessage,
    currency: order.currency,
    customerName: order.customerName ?? order.user?.fullName ?? null,
    customerPhone: order.customerPhone ?? order.user?.phone ?? null,
    itemCount: order.items.length,
    pendingReceipt,
    createdAt: order.createdAt.toISOString(),
    updatedAt: order.updatedAt.toISOString(),
    latestPayment: order.payments[0]
      ? {
          status: order.payments[0].status,
          provider: order.payments[0].provider,
          amount: order.payments[0].amount,
          receiptUrl: order.payments[0].receiptUrl,
          paidAt: order.payments[0].paidAt?.toISOString() ?? null,
        }
      : null,
  };
}
