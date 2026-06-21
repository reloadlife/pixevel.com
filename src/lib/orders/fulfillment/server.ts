import { eq } from "drizzle-orm";

import { orders, serverInstances } from "@/db/schema";
import { getDb } from "@/lib/db";
import { provisionServer, type ServerSpecs } from "@/lib/servers/provider";
import type { FulfillmentOrderItem } from "../fulfillment";

/**
 * Provisions each SERVER (VPS) order item via the upstream provider once an
 * order is PAID.
 *
 * For every item: reads its plan/specs from `item.metadata` (carried from the
 * variant — `{ planCode, cpu, ram, diskGb, periodMonths }`), calls
 * `provisionServer`, and upserts a `ServerInstance` row keyed by `orderItemId`:
 *   - success → ACTIVE, with providerRef / ipAddress and
 *     expiresAt = now + periodMonths.
 *   - failure (incl. unconfigured upstream) → FAILED, so an operator can retry.
 *
 * Best-effort: each item is isolated; a single failure never throws and never
 * blocks the rest. Auto-recurring billing is out of scope — one period is
 * provisioned per order.
 */
export async function fulfillServerItems(
  orderId: string,
  items: FulfillmentOrderItem[],
): Promise<void> {
  const db = getDb();

  const order = await db.query.orders.findFirst({
    where: eq(orders.id, orderId),
    columns: { id: true, userId: true, orderNumber: true },
  });

  const userId = order?.userId ?? null;
  const label = order?.orderNumber ?? orderId;

  for (const item of items) {
    if (item.fulfillmentType !== "SERVER") {
      continue;
    }

    await provisionServerItem(db, item, userId, label).catch((error: unknown) => {
      console.error(`[fulfillment] server item ${item.id} provisioning failed`, error);
    });
  }
}

type Db = ReturnType<typeof getDb>;

type ServerItemMetadata = {
  planCode?: string;
  cpu?: number;
  ram?: number;
  diskGb?: number;
  periodMonths?: number;
};

function readMetadata(value: unknown): ServerItemMetadata {
  return value && typeof value === "object" ? (value as ServerItemMetadata) : {};
}

function addMonths(from: Date, months: number): Date {
  const date = new Date(from);
  date.setMonth(date.getMonth() + months);
  return date;
}

async function provisionServerItem(
  db: Db,
  item: FulfillmentOrderItem,
  userId: string | null,
  label: string,
): Promise<void> {
  const meta = readMetadata(item.metadata);
  const planCode = meta.planCode ?? item.sku;
  const periodMonths =
    typeof meta.periodMonths === "number" && meta.periodMonths > 0 ? meta.periodMonths : 1;

  const specs: ServerSpecs = {
    cpu: meta.cpu,
    ram: meta.ram,
    diskGb: meta.diskGb,
  };

  // Upsert is keyed on orderItemId so a retry reconciles the same row rather
  // than creating duplicates.
  const existing = await db.query.serverInstances.findFirst({
    where: eq(serverInstances.orderItemId, item.id),
    columns: { id: true },
  });

  try {
    const result = await provisionServer({
      planCode,
      specs,
      periodMonths,
      label: `${label} · ${item.titleFa}`,
    });

    const expiresAt = result.status === "ACTIVE" ? addMonths(new Date(), periodMonths) : null;

    const values = {
      orderItemId: item.id,
      userId,
      planCode,
      specs,
      status: result.status,
      providerRef: result.providerRef,
      providerPayload: result.raw,
      ipAddress: result.ipAddress,
      periodMonths,
      expiresAt,
    };

    if (existing) {
      await db
        .update(serverInstances)
        .set({ ...values, updatedAt: new Date() })
        .where(eq(serverInstances.id, existing.id));
    } else {
      await db.insert(serverInstances).values(values);
    }
  } catch (error) {
    // Record a FAILED instance so the failure is visible to operators + the
    // user, and an admin retry has a row to reconcile.
    if (existing) {
      await db
        .update(serverInstances)
        .set({ status: "FAILED", updatedAt: new Date() })
        .where(eq(serverInstances.id, existing.id));
    } else {
      await db.insert(serverInstances).values({
        orderItemId: item.id,
        userId,
        planCode,
        specs,
        status: "FAILED",
        periodMonths,
      });
    }

    throw error;
  }
}
