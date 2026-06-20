import { and, asc, count, desc, eq, ilike, sql } from "drizzle-orm";

import {
  type InventoryStatus,
  inventoryStatus as inventoryStatusEnum,
  inventoryUnits,
  products,
  productVariants,
} from "@/db/schema";
import { addInventoryUnitsForVariant, type StockInsertResult } from "@/lib/admin/products";
import { getDb } from "@/lib/db";

const INVENTORY_STATUSES = new Set<InventoryStatus>(inventoryStatusEnum.enumValues);

// Statuses an operator is allowed to set manually from the inventory browser.
// RESERVED / SOLD are owned by the checkout flow and must not be set by hand.
const MANUAL_STATUSES = new Set<InventoryStatus>(["AVAILABLE", "DAMAGED"]);

const DEFAULT_PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 200;

export type InventoryListFilters = {
  productId?: string;
  variantId?: string;
  status?: string;
  code?: string;
  page?: number;
  pageSize?: number;
};

function isInventoryStatus(value: string | undefined): value is InventoryStatus {
  return Boolean(value) && INVENTORY_STATUSES.has(value as InventoryStatus);
}

/**
 * Mask a secret code for list display: keep the last 4 visible.
 * The full code is still returned (clients reveal it on demand) but a masked
 * variant is provided so the UI can avoid showing secrets by default.
 */
function maskCode(code: string): string {
  const trimmed = code.trim();

  if (trimmed.length <= 4) {
    return "•".repeat(trimmed.length);
  }

  return `${"•".repeat(Math.min(trimmed.length - 4, 8))}${trimmed.slice(-4)}`;
}

function sanitizePage(value: number | undefined): number {
  if (!Number.isFinite(value) || !value || value < 1) {
    return 1;
  }

  return Math.floor(value);
}

function sanitizePageSize(value: number | undefined): number {
  if (!Number.isFinite(value) || !value || value < 1) {
    return DEFAULT_PAGE_SIZE;
  }

  return Math.min(Math.floor(value), MAX_PAGE_SIZE);
}

export async function listInventoryUnits(filters: InventoryListFilters) {
  const db = getDb();
  const page = sanitizePage(filters.page);
  const pageSize = sanitizePageSize(filters.pageSize);
  const offset = (page - 1) * pageSize;

  const conditions = [];

  if (filters.variantId) {
    conditions.push(eq(inventoryUnits.variantId, filters.variantId));
  }

  if (filters.productId) {
    conditions.push(eq(productVariants.productId, filters.productId));
  }

  if (isInventoryStatus(filters.status)) {
    conditions.push(eq(inventoryUnits.status, filters.status));
  }

  const codeQuery = filters.code?.trim();

  if (codeQuery) {
    conditions.push(ilike(inventoryUnits.code, `%${codeQuery}%`));
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const [rows, totalRows] = await Promise.all([
    db
      .select({
        id: inventoryUnits.id,
        code: inventoryUnits.code,
        status: inventoryUnits.status,
        reservedAt: inventoryUnits.reservedAt,
        soldAt: inventoryUnits.soldAt,
        createdAt: inventoryUnits.createdAt,
        orderId: inventoryUnits.orderId,
        variantId: inventoryUnits.variantId,
        variantSku: productVariants.sku,
        variantTitleFa: productVariants.titleFa,
        productId: productVariants.productId,
        productTitleFa: products.titleFa,
        fulfillmentType: products.fulfillmentType,
      })
      .from(inventoryUnits)
      .innerJoin(productVariants, eq(inventoryUnits.variantId, productVariants.id))
      .innerJoin(products, eq(productVariants.productId, products.id))
      .where(where)
      .orderBy(desc(inventoryUnits.createdAt))
      .limit(pageSize)
      .offset(offset),
    db
      .select({ value: count() })
      .from(inventoryUnits)
      .innerJoin(productVariants, eq(inventoryUnits.variantId, productVariants.id))
      .innerJoin(products, eq(productVariants.productId, products.id))
      .where(where),
  ]);

  const total = totalRows[0]?.value ?? 0;

  return {
    units: rows.map((row) => {
      // Only DIGITAL units hold a real sellable secret (gift-card code / CD key)
      // that must be masked by default. PHYSICAL (and other non-digital) units
      // carry a meaningless internal serial — show it plainly, never mask it as
      // if it were a secret.
      const isSecret = row.fulfillmentType === "DIGITAL";

      return {
        id: row.id,
        code: row.code,
        // For secrets this is the masked form; for serials it is the serial as-is.
        maskedCode: isSecret ? maskCode(row.code) : row.code,
        isSecret,
        fulfillmentType: row.fulfillmentType,
        status: row.status,
        reservedAt: row.reservedAt ? row.reservedAt.toISOString() : null,
        soldAt: row.soldAt ? row.soldAt.toISOString() : null,
        createdAt: row.createdAt ? row.createdAt.toISOString() : null,
        orderId: row.orderId ?? null,
        variantId: row.variantId,
        variantSku: row.variantSku,
        variantTitleFa: row.variantTitleFa,
        productId: row.productId,
        productTitleFa: row.productTitleFa,
      };
    }),
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    },
  };
}

export type InventoryUnitRow = Awaited<ReturnType<typeof listInventoryUnits>>["units"][number];

/**
 * Per-variant stock summary (available / reserved / sold / damaged / total),
 * optionally scoped to a single product or variant.
 */
export async function getVariantStockSummary(scope: { productId?: string; variantId?: string }) {
  const db = getDb();
  const conditions = [];

  if (scope.variantId) {
    conditions.push(eq(productVariants.id, scope.variantId));
  }

  if (scope.productId) {
    conditions.push(eq(productVariants.productId, scope.productId));
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const rows = await db
    .select({
      variantId: productVariants.id,
      variantSku: productVariants.sku,
      variantTitleFa: productVariants.titleFa,
      productId: productVariants.productId,
      productTitleFa: products.titleFa,
      available: sql<number>`count(*) filter (where ${inventoryUnits.status} = 'AVAILABLE')`,
      reserved: sql<number>`count(*) filter (where ${inventoryUnits.status} = 'RESERVED')`,
      sold: sql<number>`count(*) filter (where ${inventoryUnits.status} = 'SOLD')`,
      damaged: sql<number>`count(*) filter (where ${inventoryUnits.status} = 'DAMAGED')`,
      total: count(inventoryUnits.id),
    })
    .from(productVariants)
    .innerJoin(products, eq(productVariants.productId, products.id))
    .leftJoin(inventoryUnits, eq(inventoryUnits.variantId, productVariants.id))
    .where(where)
    .groupBy(
      productVariants.id,
      productVariants.sku,
      productVariants.titleFa,
      productVariants.productId,
      products.titleFa,
    )
    .orderBy(asc(products.titleFa), asc(productVariants.titleFa));

  return rows.map((row) => ({
    variantId: row.variantId,
    variantSku: row.variantSku,
    variantTitleFa: row.variantTitleFa,
    productId: row.productId,
    productTitleFa: row.productTitleFa,
    available: Number(row.available),
    reserved: Number(row.reserved),
    sold: Number(row.sold),
    damaged: Number(row.damaged),
    total: Number(row.total),
  }));
}

export type VariantStockSummary = Awaited<ReturnType<typeof getVariantStockSummary>>[number];

/**
 * Compact variant list for the inventory browser filter / import target picker.
 */
export async function listInventoryVariantOptions() {
  const db = getDb();

  const rows = await db
    .select({
      variantId: productVariants.id,
      variantSku: productVariants.sku,
      variantTitleFa: productVariants.titleFa,
      productId: productVariants.productId,
      productTitleFa: products.titleFa,
    })
    .from(productVariants)
    .innerJoin(products, eq(productVariants.productId, products.id))
    .orderBy(asc(products.titleFa), asc(productVariants.titleFa));

  return rows.map((row) => ({
    variantId: row.variantId,
    variantSku: row.variantSku,
    variantTitleFa: row.variantTitleFa,
    productId: row.productId,
    productTitleFa: row.productTitleFa,
    label: `${row.productTitleFa} — ${row.variantTitleFa}`,
  }));
}

export type InventoryVariantOption = Awaited<
  ReturnType<typeof listInventoryVariantOptions>
>[number];

export class InventoryError extends Error {}

/**
 * Manually set a unit's status. Only AVAILABLE <-> DAMAGED transitions are
 * allowed here; RESERVED / SOLD belong to the checkout flow. A unit that is
 * currently RESERVED or SOLD cannot be hand-edited (it is tied to an order).
 */
export async function setInventoryUnitStatus(unitId: string, nextStatus: string) {
  if (!isInventoryStatus(nextStatus) || !MANUAL_STATUSES.has(nextStatus)) {
    throw new InventoryError("INVALID_STATUS");
  }

  const db = getDb();

  const unit = await db.query.inventoryUnits.findFirst({
    where: (item, { eq }) => eq(item.id, unitId),
    columns: { id: true, status: true },
  });

  if (!unit) {
    throw new InventoryError("UNIT_NOT_FOUND");
  }

  if (unit.status === "RESERVED" || unit.status === "SOLD") {
    throw new InventoryError("UNIT_LOCKED");
  }

  const [updated] = await db
    .update(inventoryUnits)
    .set({
      status: nextStatus,
      // Clear any stale reservation/order links when returning to AVAILABLE.
      ...(nextStatus === "AVAILABLE"
        ? { reservedAt: null, soldAt: null, orderId: null, userId: null }
        : {}),
    })
    .where(eq(inventoryUnits.id, unitId))
    .returning({ id: inventoryUnits.id, status: inventoryUnits.status });

  return updated;
}

/**
 * Bulk-import real sellable codes for a variant. Reuses the shared insert helper
 * so dedupe + UNIQUE(code) handling behaves exactly like the product form path.
 */
export async function importInventoryCodes(
  variantId: string,
  codes: string[],
): Promise<StockInsertResult> {
  const db = getDb();

  const variant = await db.query.productVariants.findFirst({
    where: (item, { eq }) => eq(item.id, variantId),
    columns: { id: true, sku: true },
  });

  if (!variant) {
    throw new InventoryError("VARIANT_NOT_FOUND");
  }

  return db.transaction((tx) =>
    addInventoryUnitsForVariant(tx, {
      variantId: variant.id,
      sku: variant.sku,
      codes,
    }),
  );
}
