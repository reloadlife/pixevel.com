import { eq } from "drizzle-orm";

import { orderItems } from "@/db/schema";
import { getDb } from "@/lib/db";
import { fulfillDomainItems } from "./fulfillment/domain";
import { fulfillServerItems } from "./fulfillment/server";

export type FulfillmentOrderItem = typeof orderItems.$inferSelect;

/**
 * Post-payment fulfillment dispatcher. Called best-effort from confirmPayment
 * once an order is PAID, AFTER digital codes have been emailed/SMSed.
 *
 * By fulfillment type:
 * - DIGITAL  → codes already delivered by confirmPayment; nothing here.
 * - PHYSICAL → no auto-delivery; the order enters the shipping lifecycle.
 * - DOMAIN   → register each domain via the registrar (spaceship).
 * - SERVER   → provision each VPS via the upstream.
 *
 * Never throws — provisioning failures are logged; the order stays PAID and an
 * operator can retry from the admin.
 */
export async function dispatchFulfillment(orderId: string): Promise<void> {
  const items = await getDb().query.orderItems.findMany({
    where: eq(orderItems.orderId, orderId),
  });

  const domainItems = items.filter((item) => item.fulfillmentType === "DOMAIN");
  const serverItems = items.filter((item) => item.fulfillmentType === "SERVER");

  if (domainItems.length > 0) {
    await fulfillDomainItems(orderId, domainItems).catch((error: unknown) => {
      console.error(`[fulfillment] domain registration failed for order ${orderId}`, error);
    });
  }

  if (serverItems.length > 0) {
    await fulfillServerItems(orderId, serverItems).catch((error: unknown) => {
      console.error(`[fulfillment] server provisioning failed for order ${orderId}`, error);
    });
  }
}
