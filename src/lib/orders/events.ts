import { type OrderEventType, orderEvents } from "@/db/schema";
import type { getDb } from "@/lib/db";

type InsertCapable = { insert: ReturnType<typeof getDb>["insert"] };

export interface OrderEventInput {
  orderId: string;
  type: OrderEventType;
  /** Order status before the change (free text; mirrors the order_status labels). */
  fromStatus?: string | null;
  toStatus?: string | null;
  /** Human note — operator comment or system description. */
  noteFa?: string | null;
  /** When true the note is shown to the customer in their order timeline. */
  isCustomerVisible?: boolean;
  /** Operator who triggered the event (null for system/automatic events). */
  authorUserId?: string | null;
  metadata?: unknown;
}

/**
 * Appends one row to the order audit trail. Pass the surrounding transaction so
 * the event commits atomically with the change it records; falls back to the
 * default client when called standalone. Never throws on a missing field — the
 * audit log must never block the business operation it describes, so callers
 * should still wrap standalone calls in a try/catch if the op must not fail.
 */
export async function emitOrderEvent(tx: InsertCapable, input: OrderEventInput): Promise<void> {
  await tx.insert(orderEvents).values({
    orderId: input.orderId,
    type: input.type,
    fromStatus: input.fromStatus ?? null,
    toStatus: input.toStatus ?? null,
    noteFa: input.noteFa ?? null,
    isCustomerVisible: input.isCustomerVisible ?? false,
    authorUserId: input.authorUserId ?? null,
    metadata: input.metadata ?? null,
  });
}
