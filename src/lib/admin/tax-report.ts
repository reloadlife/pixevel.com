import { and, eq, gte, lte, sql } from "drizzle-orm";

import { orders } from "@/db/schema";
import { getDb } from "@/lib/db";
import { getSettingNumber } from "@/lib/settings";

// ─── Types ───────────────────────────────────────────────────────────────────

export type TaxReportRow = {
  /** Year-month label in "YYYY-MM" format (used as row key). */
  month: string;
  /** Count of PAID orders that carry a non-zero taxAmount. */
  taxedOrderCount: number;
  /** Total count of PAID orders in this month. */
  paidOrderCount: number;
  /** Sum of taxAmount on PAID orders. Money string. */
  taxCollected: string;
};

export type TaxReportSummary = {
  /** Current VAT rate from settings (TAX_VAT_PERCENT). */
  vatRatePercent: number;
  /** Total VAT collected across PAID orders in the requested period. Money string. */
  totalTaxCollected: string;
  /** Count of PAID orders that have any taxAmount > 0. */
  taxedOrderCount: number;
  /** Total count of PAID orders in the period. */
  paidOrderCount: number;
};

export type TaxReportResult = {
  summary: TaxReportSummary;
  rows: TaxReportRow[];
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Coerce a SQL `sum()` result (string | null) to a stable money string. */
function moneyString(value: string | null | undefined): string {
  if (!value || value === "") return "0";
  return value;
}

// ─── Main query ───────────────────────────────────────────────────────────────

/**
 * Aggregate VAT figures for PAID orders, grouped by calendar month.
 *
 * - Only `paymentStatus = 'PAID'` orders are counted as "collected" VAT.
 * - `from` / `to` are ISO date strings (inclusive) that filter by `createdAt`.
 * - When both are omitted the full history is returned.
 */
export async function getTaxReport(opts: { from?: string; to?: string }): Promise<TaxReportResult> {
  const db = getDb();

  // Build date-range conditions
  const conditions = [eq(orders.paymentStatus, "PAID")];

  if (opts.from) {
    const fromDate = new Date(opts.from);
    if (!Number.isNaN(fromDate.getTime())) {
      conditions.push(gte(orders.createdAt, fromDate));
    }
  }

  if (opts.to) {
    // Include the entire "to" day by advancing to the start of the next day
    const toDate = new Date(opts.to);
    if (!Number.isNaN(toDate.getTime())) {
      toDate.setDate(toDate.getDate() + 1);
      conditions.push(lte(orders.createdAt, toDate));
    }
  }

  const whereClause = and(...conditions);

  // Monthly breakdown — one aggregate scan
  const monthRows = await db
    .select({
      month: sql<string>`to_char(${orders.createdAt}, 'YYYY-MM')`,
      paidOrderCount: sql<number>`count(*)::int`,
      taxedOrderCount: sql<number>`count(*) filter (where ${orders.taxAmount} > 0)::int`,
      taxCollected: sql<string | null>`sum(${orders.taxAmount})`,
    })
    .from(orders)
    .where(whereClause)
    .groupBy(sql`to_char(${orders.createdAt}, 'YYYY-MM')`)
    .orderBy(sql`to_char(${orders.createdAt}, 'YYYY-MM') asc`);

  // Summary totals — derive from month rows to avoid a second DB round-trip
  let totalTax = 0;
  let totalTaxedOrders = 0;
  let totalPaidOrders = 0;

  const rows: TaxReportRow[] = monthRows.map((r) => {
    const taxCollected = moneyString(r.taxCollected);
    const taxNum = Number(taxCollected);
    totalTax += Number.isFinite(taxNum) ? taxNum : 0;
    totalTaxedOrders += Number(r.taxedOrderCount);
    totalPaidOrders += Number(r.paidOrderCount);

    return {
      month: r.month,
      taxedOrderCount: Number(r.taxedOrderCount),
      paidOrderCount: Number(r.paidOrderCount),
      taxCollected,
    };
  });

  const vatRatePercent = await getSettingNumber("TAX_VAT_PERCENT", 0);

  const summary: TaxReportSummary = {
    vatRatePercent,
    totalTaxCollected: String(totalTax),
    taxedOrderCount: totalTaxedOrders,
    paidOrderCount: totalPaidOrders,
  };

  return { summary, rows };
}
