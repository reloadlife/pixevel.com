import { and, count, countDistinct, desc, eq, gte, isNotNull, lt, ne, sql } from "drizzle-orm";

import type { AnalyticsEventType } from "@/db/schema";
import { analyticsEvents, categories, products } from "@/db/schema";
import {
  deriveEntryPages,
  deriveExitPages,
  deriveSessionKpis,
  deriveTransitions,
  type FlowEvent,
  type PageCount,
  type Transition,
} from "@/lib/admin/flow";
import {
  classifyTrafficSource,
  referrerHost,
  type TrafficSource,
} from "@/lib/analytics/acquisition";
import { getDb } from "@/lib/db";

// ─── Config ─────────────────────────────────────────────────────────────────

const TOP_SEARCHES_LIMIT = 12;
const ZERO_RESULT_LIMIT = 12;
const TOP_PRODUCTS_LIMIT = 10;
const TOP_CATEGORIES_LIMIT = 10;
const TOP_PAGES_LIMIT = 20;
const TOP_REFERRERS_LIMIT = 12;
const TOP_CAMPAIGNS_LIMIT = 12;
const TRANSITIONS_LIMIT = 25;
const ENTRY_EXIT_LIMIT = 12;

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

/** Real 4-step funnel: view → cart → checkout → purchase. */
export type Funnel = {
  productViews: number;
  addToCart: number;
  checkoutStarts: number;
  purchases: number;
};

export type TopPage = { path: string; views: number; uniqueVisitors: number };

export type PathViewsBucket = { date: string; count: number };

export type TrafficSourceRow = { source: TrafficSource; sessions: number; visitors: number };

export type ReferrerRow = { host: string; sessions: number };

export type CampaignRow = { campaign: string; sessions: number };

export type SessionKpisResult = {
  sessions: number;
  pagesPerSession: number;
  /** Average session duration in seconds (last − first event per session). */
  avgDurationSec: number;
  bounceRate: number; // 0–100
};

export type SearchConversion = {
  searchSessions: number;
  convertedSessions: number;
  conversionRate: number; // 0–100
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

/**
 * Real 4-step conversion funnel:
 * product view → add-to-cart → checkout start → purchase. All steps now fire
 * (CHECKOUT_START from place-order, PURCHASE from confirmPayment).
 */
export async function getFunnel(range: DateRange): Promise<Funnel> {
  const rows = await getDb()
    .select({ type: analyticsEvents.type, count: count() })
    .from(analyticsEvents)
    .where(
      and(
        inRange(range),
        sql`${analyticsEvents.type} in ('PRODUCT_VIEW', 'ADD_TO_CART', 'CHECKOUT_START', 'PURCHASE')`,
      ),
    )
    .groupBy(analyticsEvents.type);

  const byType = new Map(rows.map((r) => [r.type, Number(r.count)]));

  return {
    productViews: byType.get("PRODUCT_VIEW") ?? 0,
    addToCart: byType.get("ADD_TO_CART") ?? 0,
    checkoutStarts: byType.get("CHECKOUT_START") ?? 0,
    purchases: byType.get("PURCHASE") ?? 0,
  };
}

// ─── Traffic / behavior queries ─────────────────────────────────────────────

/** Restrict to PAGE_VIEW events with a non-null path, in range. */
function pageViewsInRange(range: DateRange) {
  return and(
    inRange(range),
    eq(analyticsEvents.type, "PAGE_VIEW"),
    isNotNull(analyticsEvents.path),
  );
}

/**
 * Most-viewed paths (PAGE_VIEW) with total views and unique visitors (distinct
 * anonId). One grouped scan, ordered by views.
 */
export async function getTopPages(range: DateRange): Promise<TopPage[]> {
  const rows = await getDb()
    .select({
      path: analyticsEvents.path,
      views: count(),
      uniqueVisitors: countDistinct(analyticsEvents.anonId),
    })
    .from(analyticsEvents)
    .where(pageViewsInRange(range))
    .groupBy(analyticsEvents.path)
    .orderBy(desc(count()))
    .limit(TOP_PAGES_LIMIT);

  return rows.map((r) => ({
    path: r.path ?? "",
    views: Number(r.views),
    uniqueVisitors: Number(r.uniqueVisitors),
  }));
}

/**
 * Daily page-view buckets, optionally filtered to a single path. Days with no
 * views are absent (the page fills the gaps).
 */
export async function getPageViewsOverTime(
  range: DateRange,
  path?: string,
): Promise<PathViewsBucket[]> {
  const rows = await getDb()
    .select({
      day: sql<string>`date_trunc('day', ${analyticsEvents.createdAt})`,
      count: count(),
    })
    .from(analyticsEvents)
    .where(
      path ? and(pageViewsInRange(range), eq(analyticsEvents.path, path)) : pageViewsInRange(range),
    )
    .groupBy(sql`date_trunc('day', ${analyticsEvents.createdAt})`)
    .orderBy(sql`date_trunc('day', ${analyticsEvents.createdAt})`);

  return rows.map((r) => ({
    date: new Date(r.day).toISOString().slice(0, 10),
    count: Number(r.count),
  }));
}

/**
 * Traffic sources over session-landing events. A landing is the FIRST event of
 * each session (min createdAt). We bucket each landing by referrer host + UTM
 * source into Direct/Search/Social/Referral/Campaign and count sessions +
 * unique visitors per bucket. Classification reuses the shared pure helper, so
 * the read side matches the write side exactly.
 */
export async function getTrafficSources(range: DateRange): Promise<TrafficSourceRow[]> {
  // One landing row per session: the earliest event carries referrer/UTM.
  const landings = await getDb()
    .selectDistinctOn([analyticsEvents.sessionId], {
      sessionId: analyticsEvents.sessionId,
      anonId: analyticsEvents.anonId,
      referrer: analyticsEvents.referrer,
      utmSource: sql<string | null>`${analyticsEvents.metadata}->'utm'->>'source'`,
    })
    .from(analyticsEvents)
    .where(and(inRange(range), isNotNull(analyticsEvents.sessionId)))
    .orderBy(analyticsEvents.sessionId, analyticsEvents.createdAt);

  const agg = new Map<TrafficSource, { sessions: number; visitors: Set<string> }>();
  for (const row of landings) {
    const source = classifyTrafficSource(referrerHost(row.referrer), row.utmSource);
    const entry = agg.get(source) ?? { sessions: 0, visitors: new Set<string>() };
    entry.sessions += 1;
    if (row.anonId) entry.visitors.add(row.anonId);
    agg.set(source, entry);
  }

  return [...agg.entries()]
    .map(([source, v]) => ({ source, sessions: v.sessions, visitors: v.visitors.size }))
    .sort((a, b) => b.sessions - a.sessions);
}

/** Top referring hosts over session-landing events (non-empty referrers only). */
export async function getTopReferrers(range: DateRange): Promise<ReferrerRow[]> {
  const landings = await getDb()
    .selectDistinctOn([analyticsEvents.sessionId], {
      sessionId: analyticsEvents.sessionId,
      referrer: analyticsEvents.referrer,
    })
    .from(analyticsEvents)
    .where(and(inRange(range), isNotNull(analyticsEvents.sessionId)))
    .orderBy(analyticsEvents.sessionId, analyticsEvents.createdAt);

  const counts = new Map<string, number>();
  for (const row of landings) {
    const host = referrerHost(row.referrer);
    if (!host) continue;
    counts.set(host, (counts.get(host) ?? 0) + 1);
  }

  return [...counts.entries()]
    .map(([host, sessions]) => ({ host, sessions }))
    .sort((a, b) => b.sessions - a.sessions)
    .slice(0, TOP_REFERRERS_LIMIT);
}

/** Top UTM campaigns over session-landing events. */
export async function getTopCampaigns(range: DateRange): Promise<CampaignRow[]> {
  const landings = await getDb()
    .selectDistinctOn([analyticsEvents.sessionId], {
      sessionId: analyticsEvents.sessionId,
      campaign: sql<string | null>`${analyticsEvents.metadata}->'utm'->>'campaign'`,
    })
    .from(analyticsEvents)
    .where(and(inRange(range), isNotNull(analyticsEvents.sessionId)))
    .orderBy(analyticsEvents.sessionId, analyticsEvents.createdAt);

  const counts = new Map<string, number>();
  for (const row of landings) {
    const campaign = row.campaign?.trim();
    if (!campaign) continue;
    counts.set(campaign, (counts.get(campaign) ?? 0) + 1);
  }

  return [...counts.entries()]
    .map(([campaign, sessions]) => ({ campaign, sessions }))
    .sort((a, b) => b.sessions - a.sessions)
    .slice(0, TOP_CAMPAIGNS_LIMIT);
}

/**
 * Pulls every page-view row for the range, ordered by session then time, and
 * derives behavior flow (transitions) + entry/exit pages + page-derived session
 * KPIs in one pass via the pure helpers. The composite (sessionId, createdAt)
 * index keeps this ordered scan cheap within a bounded window.
 */
async function loadOrderedPageViews(range: DateRange): Promise<FlowEvent[]> {
  const rows = await getDb()
    .select({
      sessionId: analyticsEvents.sessionId,
      path: analyticsEvents.path,
      createdAt: analyticsEvents.createdAt,
    })
    .from(analyticsEvents)
    .where(and(pageViewsInRange(range), isNotNull(analyticsEvents.sessionId)))
    .orderBy(analyticsEvents.sessionId, analyticsEvents.createdAt);

  return rows.map((r) => ({
    sessionId: r.sessionId ?? "",
    path: r.path ?? "",
    createdAt: r.createdAt,
  }));
}

export type BehaviorFlow = {
  transitions: Transition[];
  entryPages: PageCount[];
  exitPages: PageCount[];
};

/** Behavior flow: top page→page transitions + entry/exit pages. */
export async function getBehaviorFlow(range: DateRange): Promise<BehaviorFlow> {
  const events = await loadOrderedPageViews(range);
  return {
    transitions: deriveTransitions(events, TRANSITIONS_LIMIT),
    entryPages: deriveEntryPages(events, ENTRY_EXIT_LIMIT),
    exitPages: deriveExitPages(events, ENTRY_EXIT_LIMIT),
  };
}

/**
 * Session KPIs: count, avg pages/session, avg duration, bounce rate. Pages and
 * bounce come from the page-view derivation; duration needs the first/last
 * timestamp of ALL events in a session, computed in SQL.
 */
export async function getSessionKpis(range: DateRange): Promise<SessionKpisResult> {
  const [pageEvents, durationRow] = await Promise.all([
    loadOrderedPageViews(range),
    getDb()
      .select({
        avgDuration: sql<string | null>`
          avg(extract(epoch from (span.max_at - span.min_at)))
        `,
      })
      .from(
        sql`(
          select ${analyticsEvents.sessionId} as session_id,
                 min(${analyticsEvents.createdAt}) as min_at,
                 max(${analyticsEvents.createdAt}) as max_at
          from ${analyticsEvents}
          where ${and(inRange(range), isNotNull(analyticsEvents.sessionId))}
          group by ${analyticsEvents.sessionId}
        ) as span`,
      ),
  ]);

  const kpis = deriveSessionKpis(pageEvents);
  return {
    sessions: kpis.sessions,
    pagesPerSession: kpis.pagesPerSession,
    bounceRate: kpis.bounceRate,
    avgDurationSec: Math.round(Number(durationRow[0]?.avgDuration ?? 0)),
  };
}

/**
 * Search → purchase conversion: how many sessions fired a SEARCH and later a
 * PURCHASE (in the same session, within range). Set intersection over the two
 * event types' session ids.
 */
export async function getSearchConversion(range: DateRange): Promise<SearchConversion> {
  const db = getDb();
  const [searchRows, purchaseRows] = await Promise.all([
    db
      .selectDistinct({ sessionId: analyticsEvents.sessionId })
      .from(analyticsEvents)
      .where(
        and(
          inRange(range),
          eq(analyticsEvents.type, "SEARCH"),
          isNotNull(analyticsEvents.sessionId),
        ),
      ),
    db
      .selectDistinct({ sessionId: analyticsEvents.sessionId })
      .from(analyticsEvents)
      .where(
        and(
          inRange(range),
          eq(analyticsEvents.type, "PURCHASE"),
          isNotNull(analyticsEvents.sessionId),
        ),
      ),
  ]);

  const purchased = new Set(purchaseRows.map((r) => r.sessionId));
  const searchSessions = searchRows.length;
  let converted = 0;
  for (const row of searchRows) {
    if (row.sessionId && purchased.has(row.sessionId)) converted += 1;
  }

  return {
    searchSessions,
    convertedSessions: converted,
    conversionRate: searchSessions > 0 ? Math.round((converted / searchSessions) * 100) : 0,
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
  // Traffic & user-flow surface.
  topPages: TopPage[];
  pageViewsOverTime: PathViewsBucket[];
  trafficSources: TrafficSourceRow[];
  topReferrers: ReferrerRow[];
  topCampaigns: CampaignRow[];
  behaviorFlow: BehaviorFlow;
  sessionKpis: SessionKpisResult;
  searchConversion: SearchConversion;
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
    topPages,
    pageViewsOverTime,
    trafficSources,
    topReferrers,
    topCampaigns,
    behaviorFlow,
    sessionKpis,
    searchConversion,
  ] = await Promise.all([
    getAnalyticsOverview(range),
    getTopSearches(range),
    getZeroResultSearches(range),
    getTopViewedProducts(range),
    getTopViewedCategories(range),
    getViewsOverTime(range),
    getFunnel(range),
    getTopPages(range),
    getPageViewsOverTime(range),
    getTrafficSources(range),
    getTopReferrers(range),
    getTopCampaigns(range),
    getBehaviorFlow(range),
    getSessionKpis(range),
    getSearchConversion(range),
  ]);

  return {
    overview,
    topSearches,
    zeroResultSearches,
    topProducts,
    topCategories,
    viewsOverTime,
    funnel,
    topPages,
    pageViewsOverTime,
    trafficSources,
    topReferrers,
    topCampaigns,
    behaviorFlow,
    sessionKpis,
    searchConversion,
  };
}
