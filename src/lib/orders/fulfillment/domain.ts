import { eq } from "drizzle-orm";

import { domainRegistrations, orders } from "@/db/schema";
import { getDb } from "@/lib/db";
import { registerDomain } from "@/lib/domains/spaceship";
import type { FulfillmentOrderItem } from "../fulfillment";

type DomainMetadata = {
  domainName?: string;
  tld?: string;
  years?: number;
};

function readDomainMetadata(metadata: unknown): Required<DomainMetadata> | null {
  if (!metadata || typeof metadata !== "object") {
    return null;
  }

  const meta = metadata as DomainMetadata;
  const domainName = typeof meta.domainName === "string" ? meta.domainName.trim() : "";

  if (!domainName) {
    return null;
  }

  const tld =
    typeof meta.tld === "string" && meta.tld ? meta.tld : domainName.split(".").slice(1).join(".");
  const years = Math.min(10, Math.max(1, Math.trunc(Number(meta.years)) || 1));

  return { domainName, tld, years };
}

/**
 * Registers each DOMAIN order item via the registrar (spaceship).
 *
 * For every item: read `metadata = { domainName, tld, years }`, call
 * `registerDomain`, then upsert a DomainRegistration row keyed by orderItemId —
 * REGISTERED on success (with registrarRef/expiresAt), FAILED otherwise.
 *
 * Best-effort: a failure on one item is recorded and does not stop the others;
 * the function never throws (the dispatcher also guards with .catch).
 */
export async function fulfillDomainItems(
  orderId: string,
  items: FulfillmentOrderItem[],
): Promise<void> {
  const db = getDb();

  const order = await db.query.orders.findFirst({
    where: eq(orders.id, orderId),
    columns: { userId: true },
  });

  const userId = order?.userId ?? null;

  for (const item of items) {
    const meta = readDomainMetadata(item.metadata);

    if (!meta) {
      console.error(`[fulfillment/domain] order ${orderId} item ${item.id}: missing metadata`);
      continue;
    }

    try {
      const result = await registerDomain({
        domainName: meta.domainName,
        years: meta.years,
      });

      await upsertRegistration(item.id, {
        userId,
        domainName: meta.domainName,
        tld: meta.tld,
        years: meta.years,
        status: "REGISTERED",
        registrarRef: result.registrarRef,
        registrarPayload: result.payload,
        expiresAt: result.expiresAt,
      });
    } catch (error) {
      console.error(
        `[fulfillment/domain] register failed for ${meta.domainName} (order ${orderId})`,
        error,
      );

      await upsertRegistration(item.id, {
        userId,
        domainName: meta.domainName,
        tld: meta.tld,
        years: meta.years,
        status: "FAILED",
        registrarRef: null,
        registrarPayload: { error: error instanceof Error ? error.message : "unknown" },
        expiresAt: null,
      }).catch((writeError: unknown) => {
        console.error("[fulfillment/domain] could not record FAILED row", writeError);
      });
    }
  }
}

type RegistrationValues = {
  userId: string | null;
  domainName: string;
  tld: string;
  years: number;
  status: "REGISTERED" | "FAILED";
  registrarRef: string | null;
  registrarPayload: unknown;
  expiresAt: Date | null;
};

/**
 * Idempotent per order item: updates an existing registration row for the item
 * if present (e.g. an operator retry), otherwise inserts a new one.
 */
async function upsertRegistration(orderItemId: string, values: RegistrationValues): Promise<void> {
  const db = getDb();

  const existing = await db.query.domainRegistrations.findFirst({
    where: eq(domainRegistrations.orderItemId, orderItemId),
    columns: { id: true },
  });

  if (existing) {
    await db
      .update(domainRegistrations)
      .set({
        userId: values.userId,
        domainName: values.domainName,
        tld: values.tld,
        years: values.years,
        status: values.status,
        registrarRef: values.registrarRef,
        registrarPayload: values.registrarPayload,
        expiresAt: values.expiresAt,
      })
      .where(eq(domainRegistrations.id, existing.id));
    return;
  }

  await db.insert(domainRegistrations).values({
    orderItemId,
    userId: values.userId,
    domainName: values.domainName,
    tld: values.tld,
    years: values.years,
    status: values.status,
    registrarRef: values.registrarRef,
    registrarPayload: values.registrarPayload,
    expiresAt: values.expiresAt,
  });
}
