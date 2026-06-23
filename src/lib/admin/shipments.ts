import { and, eq } from "drizzle-orm";
import type { CurrencyCode, ShipmentStatus } from "@/db/schema";
import { shipments } from "@/db/schema";
import { getDb } from "@/lib/db";
import { emitOrderEvent } from "@/lib/orders/events";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CreateShipmentInput {
  orderId: string;
  methodId?: string | null;
  carrier?: string | null;
  trackingNumber?: string | null;
  trackingUrl?: string | null;
  status?: ShipmentStatus;
  costAmount?: string | null;
  noteFa?: string | null;
  actorUserId?: string | null;
}

export interface UpdateShipmentInput {
  methodId?: string | null;
  carrier?: string | null;
  trackingNumber?: string | null;
  trackingUrl?: string | null;
  status?: ShipmentStatus;
  costAmount?: string | null;
  noteFa?: string | null;
  actorUserId?: string | null;
}

// ─── List ─────────────────────────────────────────────────────────────────────

export async function listOrderShipments(orderId: string) {
  const db = getDb();
  return db.query.shipments.findMany({
    where: (s, { eq: e }) => e(s.orderId, orderId),
    with: {
      method: {
        columns: { id: true, titleFa: true, code: true },
      },
    },
    orderBy: (s, { desc }) => [desc(s.createdAt)],
  });
}

export type AdminShipmentListItem = Awaited<ReturnType<typeof listOrderShipments>>[number];

// ─── Create ───────────────────────────────────────────────────────────────────

export async function createShipment(input: CreateShipmentInput) {
  const db = getDb();

  const status: ShipmentStatus = input.status ?? "PENDING";

  const now = new Date();
  const shippedAt =
    status === "SHIPPED" || status === "IN_TRANSIT" || status === "DELIVERED" ? now : null;
  const deliveredAt = status === "DELIVERED" ? now : null;

  const [shipment] = await db
    .insert(shipments)
    .values({
      orderId: input.orderId,
      methodId: input.methodId ?? null,
      carrier: input.carrier ?? null,
      trackingNumber: input.trackingNumber ?? null,
      trackingUrl: input.trackingUrl ?? null,
      status,
      costAmount: input.costAmount ?? "0",
      currency: "IRT" as CurrencyCode,
      noteFa: input.noteFa ?? null,
      shippedAt,
      deliveredAt,
    })
    .returning({ id: shipments.id });

  // Emit audit event.
  await emitOrderEvent(db, {
    orderId: input.orderId,
    type: "SHIPMENT",
    toStatus: status,
    noteFa: buildShipmentNote(input),
    isCustomerVisible: status === "SHIPPED" || status === "DELIVERED",
    authorUserId: input.actorUserId ?? null,
  });

  return shipment.id;
}

// ─── Update ───────────────────────────────────────────────────────────────────

export async function updateShipment(id: string, patch: UpdateShipmentInput) {
  const db = getDb();

  // Fetch current state to determine timestamp changes.
  const current = await db.query.shipments.findFirst({
    where: (s, { eq: e }) => e(s.id, id),
    columns: { id: true, orderId: true, status: true, shippedAt: true, deliveredAt: true },
  });

  if (!current) throw new Error("SHIPMENT_NOT_FOUND");

  const newStatus = patch.status ?? current.status;
  const now = new Date();

  const shippedAt =
    (newStatus === "SHIPPED" || newStatus === "IN_TRANSIT" || newStatus === "DELIVERED") &&
    !current.shippedAt
      ? now
      : current.shippedAt;

  const deliveredAt = newStatus === "DELIVERED" && !current.deliveredAt ? now : current.deliveredAt;

  await db
    .update(shipments)
    .set({
      ...(patch.methodId !== undefined ? { methodId: patch.methodId } : {}),
      ...(patch.carrier !== undefined ? { carrier: patch.carrier } : {}),
      ...(patch.trackingNumber !== undefined ? { trackingNumber: patch.trackingNumber } : {}),
      ...(patch.trackingUrl !== undefined ? { trackingUrl: patch.trackingUrl } : {}),
      ...(patch.costAmount !== undefined ? { costAmount: patch.costAmount ?? "0" } : {}),
      ...(patch.noteFa !== undefined ? { noteFa: patch.noteFa } : {}),
      status: newStatus,
      shippedAt,
      deliveredAt,
    })
    .where(and(eq(shipments.id, id)));

  if (patch.status && patch.status !== current.status) {
    await emitOrderEvent(db, {
      orderId: current.orderId,
      type: "SHIPMENT",
      fromStatus: current.status,
      toStatus: newStatus,
      noteFa: `وضعیت مرسوله به «${shipmentStatusLabel(newStatus)}» تغییر کرد`,
      isCustomerVisible: newStatus === "SHIPPED" || newStatus === "DELIVERED",
      authorUserId: patch.actorUserId ?? null,
    });
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function buildShipmentNote(input: CreateShipmentInput): string {
  const parts: string[] = ["مرسوله ثبت شد"];
  if (input.carrier) parts.push(`پیک: ${input.carrier}`);
  if (input.trackingNumber) parts.push(`کد پیگیری: ${input.trackingNumber}`);
  return parts.join(" · ");
}

function shipmentStatusLabel(status: ShipmentStatus): string {
  const labels: Record<ShipmentStatus, string> = {
    PENDING: "در انتظار",
    SHIPPED: "ارسال‌شده",
    IN_TRANSIT: "در مسیر",
    DELIVERED: "تحویل‌شده",
    RETURNED: "مرجوعی",
    CANCELLED: "لغوشده",
  };
  return labels[status] ?? status;
}
