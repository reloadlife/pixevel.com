import { and, desc, eq } from "drizzle-orm";
import type { OrderStatus, PaymentStatus } from "@/db/schema";
import { inventoryUnits, orders, payments } from "@/db/schema";
import { getDb } from "@/lib/db";
import { releaseExpiredReservations, releaseUnits } from "@/lib/orders/inventory";
import { confirmPayment } from "@/lib/orders/payments";

// ─── Types ────────────────────────────────────────────────────────────────────

export type AdminOrderFilter = {
  status?: OrderStatus;
  paymentStatus?: PaymentStatus;
};

// ─── List ─────────────────────────────────────────────────────────────────────

export async function listAdminOrders(filter: AdminOrderFilter = {}) {
  const db = getDb();

  // Release expired reservations before listing so counts are accurate.
  await db.transaction(async (tx) => {
    await releaseExpiredReservations(tx);
  });

  const conditions = [];

  if (filter.status) {
    conditions.push(eq(orders.status, filter.status));
  }

  if (filter.paymentStatus) {
    conditions.push(eq(orders.paymentStatus, filter.paymentStatus));
  }

  return db.query.orders.findMany({
    where: conditions.length > 0 ? and(...conditions) : undefined,
    with: {
      user: {
        columns: { id: true, phone: true, fullName: true, isPremium: true },
      },
      payments: {
        columns: { id: true, status: true, amount: true, receiptUrl: true, paidAt: true },
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
  });
}

export type AdminOrderListItem = Awaited<ReturnType<typeof listAdminOrders>>[number];

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

/** Refund an order: release units + mark order + payment REFUNDED. */
export async function refundOrder(id: string): Promise<void> {
  await getDb().transaction(async (tx) => {
    await releaseUnits(tx, id);
    await tx
      .update(orders)
      .set({ status: "REFUNDED", paymentStatus: "REFUNDED" })
      .where(eq(orders.id, id));
    await tx.update(payments).set({ status: "REFUNDED" }).where(eq(payments.orderId, id));
  });
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
  return {
    id: order.id,
    orderNumber: order.orderNumber,
    status: order.status,
    paymentStatus: order.paymentStatus,
    totalAmount: order.totalAmount,
    currency: order.currency,
    customerName: order.customerName ?? order.user?.fullName ?? null,
    customerPhone: order.customerPhone ?? order.user?.phone ?? null,
    itemCount: order.items.length,
    createdAt: order.createdAt.toISOString(),
    updatedAt: order.updatedAt.toISOString(),
    latestPayment: order.payments[0]
      ? {
          status: order.payments[0].status,
          amount: order.payments[0].amount,
          receiptUrl: order.payments[0].receiptUrl,
          paidAt: order.payments[0].paidAt?.toISOString() ?? null,
        }
      : null,
  };
}
