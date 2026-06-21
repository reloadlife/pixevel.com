import { and, count, countDistinct, desc, eq, gte, isNotNull, lt, ne, sql } from "drizzle-orm";

import type { AnalyticsEventType } from "@/db/schema";
import { analyticsEvents, categories, products } from "@/db/schema";
import { getDb } from "@/lib/db";

// ─── Config ─────────────────────────────────────────────────────────────────

const TOP_SEARCHES_LIMIT = 12;
const ZERO_RESULT_LIMIT = 12;
const TOP_PRODUCTS_LIMIT = 10;
const TOP_CATEGORIES_LIMIT = 10;

/** All aggregations accept the same closed/half-open `[from, to)` window. */
export type DateRange = { from: Date; to: Date };

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Restrict to the requested time window: createdAt in `[from, to)`. */
function inRange(range: DateRange) {
  return and(gte(analyticsEvents.createdAt, range.from), lt(analyticsEvents.createdAt, range.to));
}

// ─── Types ──────────────────────────────────────────────────────────────────

export type AnalyticsOverview = {
  totalEvents: number;
  uniqueVisitors: number;
  totalSearches: number;
  zeroResultSearches: number;
  productViews: number;
  categoryViews: number;
  addToCart: number;
  checkoutStarts: number;
  purchases: number;
  countsByType: { type: AnalyticsEventType; count: number }[];
};

export type TopSearch = { query: string; count: number; avgResultCount: number };

export type ZeroResultSearch = { query: string; count: number };

export type TopViewedProduct = {
  productId: string;
  titleFa: string;
  slug: string;
  views: number;
};

export type TopViewedCategory = {
  categoryId: string;
  titleFa: string;
  slug: string;
  views: number;
};

export type ViewsBucket = { date: string; count: number };

export type Funnel = {
  productViews: number;
  addToCart: number;
  purchases: number;
};

const EVENT_TYPE_ORDER: AnalyticsEventType[] = [
  "PAGE_VIEW",
  "SEARCH",
  "PRODUCT_VIEW",
  "CATEGORY_VIEW",
  "ADD_TO_CART",
  "CHECKOUT_START",
  "PURCHASE",
];

// ─── Aggregate queries ────────────────────────────────────────────────────────

/**
 * Headline counters for the range: total events, unique visitors (distinct
 * anonId), and per-type breakdowns. One grouped scan for the type counts plus a
 * tiny distinct-count query — no per-metric round-trips.
 */
export async function getAnalyticsOverview(range: DateRange): Promise<AnalyticsOverview> {
  const db = getDb();

  const [byTypeRows, visitorsRow] = await Promise.all([
    db
      .select({ type: analyticsEvents.type, count: count() })
      .from(analyticsEvents)
      .where(inRange(range))
      .groupBy(analyticsEvents.type),
    db
      .select({ unique: countDistinct(analyticsEvents.anonId) })
      .from(analyticsEvents)
      .where(and(inRange(range), isNotNull(analyticsEvents.anonId))),
  ]);

  const byType = new Map(byTypeRows.map((r) => [r.type, Number(r.count)]));
  const get = (type: AnalyticsEventType) => byType.get(type) ?? 0;

  // Zero-result searches need a filtered count — pull it in the same window.
  const [zeroRow] = await db
    .select({ count: count() })
    .from(analyticsEvents)
    .where(
      and(inRange(range), eq(analyticsEvents.type, "SEARCH"), eq(analyticsEvents.resultCount, 0)),
    );

  const countsByType = EVENT_TYPE_ORDER.map((type) => ({ type, count: get(type) }));
  const totalEvents = countsByType.reduce((sum, r) => sum + r.count, 0);

  return {
    totalEvents,
    uniqueVisitors: Number(visitorsRow[0]?.unique ?? 0),
    totalSearches: get("SEARCH"),
    zeroResultSearches: Number(zeroRow?.count ?? 0),
    productViews: get("PRODUCT_VIEW"),
    categoryViews: get("CATEGORY_VIEW"),
    addToCart: get("ADD_TO_CART"),
    checkoutStarts: get("CHECKOUT_START"),
    purchases: get("PURCHASE"),
    countsByType,
  };
}

/** Most-searched terms with average result count. Empty queries excluded. */
export async function getTopSearches(range: DateRange): Promise<TopSearch[]> {
  const rows = await getDb()
    .select({
      query: analyticsEvents.query,
      count: count(),
      avgResultCount: sql<string | null>`avg(${analyticsEvents.resultCount})`,
    })
    .from(analyticsEvents)
    .where(
      and(
        inRange(range),
        eq(analyticsEvents.type, "SEARCH"),
        isNotNull(analyticsEvents.query),
        ne(analyticsEvents.query, ""),
      ),
    )
    .groupBy(analyticsEvents.query)
    .orderBy(desc(count()))
    .limit(TOP_SEARCHES_LIMIT);

  return rows.map((r) => ({
    query: r.query ?? "",
    count: Number(r.count),
    avgResultCount: Math.round(Number(r.avgResultCount ?? 0)),
  }));
}

/** Searches that returned no results — the actionable catalog gaps. */
export async function getZeroResultSearches(range: DateRange): Promise<ZeroResultSearch[]> {
  const rows = await getDb()
    .select({ query: analyticsEvents.query, count: count() })
    .from(analyticsEvents)
    .where(
      and(
        inRange(range),
        eq(analyticsEvents.type, "SEARCH"),
        eq(analyticsEvents.resultCount, 0),
        isNotNull(analyticsEvents.query),
        ne(analyticsEvents.query, ""),
      ),
    )
    .groupBy(analyticsEvents.query)
    .orderBy(desc(count()))
    .limit(ZERO_RESULT_LIMIT);

  return rows.map((r) => ({ query: r.query ?? "", count: Number(r.count) }));
}

/** Most-viewed products in range, joined to product title/slug. */
export async function getTopViewedProducts(range: DateRange): Promise<TopViewedProduct[]> {
  const rows = await getDb()
    .select({
      productId: products.id,
      titleFa: products.titleFa,
      slug: products.slug,
      views: count(),
    })
    .from(analyticsEvents)
    .innerJoin(products, eq(analyticsEvents.productId, products.id))
    .where(and(inRange(range), eq(analyticsEvents.type, "PRODUCT_VIEW")))
    .groupBy(products.id, products.titleFa, products.slug)
    .orderBy(desc(count()))
    .limit(TOP_PRODUCTS_LIMIT);

  return rows.map((r) => ({ ...r, views: Number(r.views) }));
}

/** Most-viewed categories in range, joined to category title/slug. */
export async function getTopViewedCategories(range: DateRange): Promise<TopViewedCategory[]> {
  const rows = await getDb()
    .select({
      categoryId: categories.id,
      titleFa: categories.titleFa,
      slug: categories.slug,
      views: count(),
    })
    .from(analyticsEvents)
    .innerJoin(categories, eq(analyticsEvents.categoryId, categories.id))
    .where(and(inRange(range), eq(analyticsEvents.type, "CATEGORY_VIEW")))
    .groupBy(categories.id, categories.titleFa, categories.slug)
    .orderBy(desc(count()))
    .limit(TOP_CATEGORIES_LIMIT);

  return rows.map((r) => ({ ...r, views: Number(r.views) }));
}

/**
 * Daily buckets of view events (PRODUCT_VIEW + CATEGORY_VIEW) for the range,
 * one row per UTC day. Days with no views are absent (the page fills the gaps).
 */
export async function getViewsOverTime(range: DateRange): Promise<ViewsBucket[]> {
  const rows = await getDb()
    .select({
      day: sql<string>`date_trunc('day', ${analyticsEvents.createdAt})`,
      count: count(),
    })
    .from(analyticsEvents)
    .where(and(inRange(range), sql`${analyticsEvents.type} in ('PRODUCT_VIEW', 'CATEGORY_VIEW')`))
    .groupBy(sql`date_trunc('day', ${analyticsEvents.createdAt})`)
    .orderBy(sql`date_trunc('day', ${analyticsEvents.createdAt})`);

  return rows.map((r) => ({
    date: new Date(r.day).toISOString().slice(0, 10),
    count: Number(r.count),
  }));
}

/** Coarse conversion funnel: product views → add-to-cart → purchase. */
export async function getFunnel(range: DateRange): Promise<Funnel> {
  const rows = await getDb()
    .select({ type: analyticsEvents.type, count: count() })
    .from(analyticsEvents)
    .where(
      and(
        inRange(range),
        sql`${analyticsEvents.type} in ('PRODUCT_VIEW', 'ADD_TO_CART', 'PURCHASE')`,
      ),
    )
    .groupBy(analyticsEvents.type);

  const byType = new Map(rows.map((r) => [r.type, Number(r.count)]));

  return {
    productViews: byType.get("PRODUCT_VIEW") ?? 0,
    addToCart: byType.get("ADD_TO_CART") ?? 0,
    purchases: byType.get("PURCHASE") ?? 0,
  };
}

// ─── Composite ──────────────────────────────────────────────────────────────

export type AdminAnalytics = {
  overview: AnalyticsOverview;
  topSearches: TopSearch[];
  zeroResultSearches: ZeroResultSearch[];
  topProducts: TopViewedProduct[];
  topCategories: TopViewedCategory[];
  viewsOverTime: ViewsBucket[];
  funnel: Funnel;
};

/** Fan out every analytics aggregate for the range in one awaited batch. */
export async function getAdminAnalytics(range: DateRange): Promise<AdminAnalytics> {
  const [
    overview,
    topSearches,
    zeroResultSearches,
    topProducts,
    topCategories,
    viewsOverTime,
    funnel,
  ] = await Promise.all([
    getAnalyticsOverview(range),
    getTopSearches(range),
    getZeroResultSearches(range),
    getTopViewedProducts(range),
    getTopViewedCategories(range),
    getViewsOverTime(range),
    getFunnel(range),
  ]);

  return {
    overview,
    topSearches,
    zeroResultSearches,
    topProducts,
    topCategories,
    viewsOverTime,
    funnel,
  };
}
