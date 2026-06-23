import "server-only";

import { and, asc, count, eq, ilike, or, type SQL } from "drizzle-orm";

import { blogPosts, categories, pageSeo, products } from "@/db/schema";
import type { AdminListResponse } from "@/lib/admin/list-response";
import { getDb } from "@/lib/db";
import { STATIC_PAGES } from "@/lib/seo/static-pages";

/** Where a hub row's SEO is stored. */
export type SeoSourceKind = "static" | "product" | "category" | "blog";

export const SEO_SOURCE_KINDS: readonly SeoSourceKind[] = ["static", "product", "category", "blog"];

/** One row in the aggregated SEO hub list. */
export type SeoHubRow = {
  source: SeoSourceKind;
  /** Routing reference: pathKey for static, entity id for product/category/blog. */
  ref: string;
  /** Display label (page label or entity title). */
  label: string;
  /** Canonical-ish path shown in the list, e.g. "/about" or "/products/foo". */
  path: string;
  /** Deep link to the entity's own edit page (entity rows only). */
  editHref: string | null;
  hasTitle: boolean;
  hasDescription: boolean;
  noindex: boolean;
  /** Whether the page is eligible for the sitemap (i.e. not noindexed). */
  inSitemap: boolean;
};

export class SeoHubError extends Error {
  constructor(public code: string) {
    super(code);
    this.name = "SeoHubError";
  }
}

const DEFAULT_PAGE_SIZE = 20;

function hasText(value: string | null | undefined): boolean {
  return value != null && value.trim() !== "";
}

// ─── Static rows (read PageSeo, fall back to catalog) ───────────────────────────

async function listStaticRows(search: string | undefined): Promise<SeoHubRow[]> {
  const rows = await getDb().select().from(pageSeo).orderBy(asc(pageSeo.pathKey));
  const byPath = new Map(rows.map((r) => [r.pathKey, r]));

  // Union of seeded catalog routes and any extra PageSeo rows in the DB.
  const pathKeys = new Set<string>([
    ...STATIC_PAGES.map((p) => p.pathKey),
    ...rows.map((r) => r.pathKey),
  ]);

  const result: SeoHubRow[] = [];
  for (const pathKey of pathKeys) {
    const row = byPath.get(pathKey);
    const catalog = STATIC_PAGES.find((p) => p.pathKey === pathKey);
    const label = row?.labelFa ?? catalog?.labelFa ?? pathKey;
    const noindex = row?.noindex ?? false;
    result.push({
      source: "static",
      ref: pathKey,
      label,
      path: pathKey,
      editHref: null,
      hasTitle: hasText(row?.seoTitle) || hasText(catalog?.title),
      hasDescription: hasText(row?.seoDescription) || hasText(catalog?.description),
      noindex,
      inSitemap: !noindex,
    });
  }

  if (search) {
    const needle = search.toLowerCase();
    return result.filter(
      (r) => r.label.toLowerCase().includes(needle) || r.path.toLowerCase().includes(needle),
    );
  }
  return result.sort((a, b) => a.path.localeCompare(b.path));
}

// ─── Aggregated list ────────────────────────────────────────────────────────────

/**
 * Aggregated, paginated SEO hub list across static pages, products, categories
 * and blog posts. `source` narrows to one kind; `search` is a free-text label/
 * path filter.
 */
export async function listSeoHub(opts: {
  source?: SeoSourceKind;
  search?: string;
  page?: number;
  pageSize?: number;
}): Promise<AdminListResponse<SeoHubRow>> {
  const db = getDb();
  const search = opts.search?.trim() || undefined;
  const page = Math.max(1, opts.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, opts.pageSize ?? DEFAULT_PAGE_SIZE));

  let all: SeoHubRow[] = [];

  const wantStatic = !opts.source || opts.source === "static";
  const wantProduct = !opts.source || opts.source === "product";
  const wantCategory = !opts.source || opts.source === "category";
  const wantBlog = !opts.source || opts.source === "blog";

  if (wantStatic) {
    all = all.concat(await listStaticRows(search));
  }

  if (wantProduct) {
    const where: SQL[] = [];
    if (search) {
      const like = `%${search}%`;
      const cond = or(ilike(products.titleFa, like), ilike(products.slug, like));
      if (cond) where.push(cond);
    }
    const rows = await db
      .select({
        id: products.id,
        slug: products.slug,
        titleFa: products.titleFa,
        seoTitle: products.seoTitle,
        seoDescription: products.seoDescription,
        summaryFa: products.summaryFa,
        noindex: products.noindex,
        status: products.status,
      })
      .from(products)
      .where(where.length ? and(...where) : undefined)
      .orderBy(asc(products.titleFa));
    for (const row of rows) {
      const noindex = row.noindex;
      all.push({
        source: "product",
        ref: row.id,
        label: row.titleFa,
        path: `/products/${row.slug}`,
        editHref: `/admin/products/${row.id}`,
        hasTitle: hasText(row.seoTitle) || hasText(row.titleFa),
        hasDescription: hasText(row.seoDescription) || hasText(row.summaryFa),
        noindex,
        inSitemap: !noindex && row.status === "ACTIVE",
      });
    }
  }

  if (wantCategory) {
    const where: SQL[] = [];
    if (search) {
      const like = `%${search}%`;
      const cond = or(ilike(categories.titleFa, like), ilike(categories.slug, like));
      if (cond) where.push(cond);
    }
    const rows = await db
      .select({
        id: categories.id,
        slug: categories.slug,
        titleFa: categories.titleFa,
        seoTitle: categories.seoTitle,
        seoDescription: categories.seoDescription,
        descriptionFa: categories.descriptionFa,
        noindex: categories.noindex,
        isVisible: categories.isVisible,
      })
      .from(categories)
      .where(where.length ? and(...where) : undefined)
      .orderBy(asc(categories.titleFa));
    for (const row of rows) {
      const noindex = row.noindex;
      all.push({
        source: "category",
        ref: row.id,
        label: row.titleFa,
        path: `/category/${row.slug}`,
        editHref: `/admin/categories`,
        hasTitle: hasText(row.seoTitle) || hasText(row.titleFa),
        hasDescription: hasText(row.seoDescription) || hasText(row.descriptionFa),
        noindex,
        inSitemap: !noindex && row.isVisible,
      });
    }
  }

  if (wantBlog) {
    const where: SQL[] = [];
    if (search) {
      const like = `%${search}%`;
      const cond = or(ilike(blogPosts.titleFa, like), ilike(blogPosts.slug, like));
      if (cond) where.push(cond);
    }
    const rows = await db
      .select({
        id: blogPosts.id,
        slug: blogPosts.slug,
        titleFa: blogPosts.titleFa,
        seoTitle: blogPosts.seoTitle,
        seoDescription: blogPosts.seoDescription,
        excerptFa: blogPosts.excerptFa,
        noindex: blogPosts.noindex,
        status: blogPosts.status,
      })
      .from(blogPosts)
      .where(where.length ? and(...where) : undefined)
      .orderBy(asc(blogPosts.titleFa));
    for (const row of rows) {
      const noindex = row.noindex;
      all.push({
        source: "blog",
        ref: row.id,
        label: row.titleFa,
        path: `/blog/${row.slug}`,
        editHref: `/admin/blog`,
        hasTitle: hasText(row.seoTitle) || hasText(row.titleFa),
        hasDescription: hasText(row.seoDescription) || hasText(row.excerptFa),
        noindex,
        inSitemap: !noindex && row.status === "PUBLISHED",
      });
    }
  }

  const total = all.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const start = (page - 1) * pageSize;
  const rows = all.slice(start, start + pageSize);

  return {
    rows,
    pagination: { page, pageSize, total, totalPages },
    counts: {
      static: wantStatic ? all.filter((r) => r.source === "static").length : 0,
      product: wantProduct ? all.filter((r) => r.source === "product").length : 0,
      category: wantCategory ? all.filter((r) => r.source === "category").length : 0,
      blog: wantBlog ? all.filter((r) => r.source === "blog").length : 0,
    },
  };
}

// ─── Single-row read (for the edit sheet) ───────────────────────────────────────

export type SeoEditValues = {
  source: SeoSourceKind;
  ref: string;
  label: string;
  path: string;
  seoTitle: string;
  seoDescription: string;
  ogImageUrl: string;
  noindex: boolean;
  /** Static-only fields. */
  canonicalOverride: string;
  sitemapPriority: string;
  sitemapChangefreq: string;
};

// ─── Patch (route the write to the owning table) ────────────────────────────────

export type SeoPatchFields = {
  seoTitle?: string | null;
  seoDescription?: string | null;
  ogImageUrl?: string | null;
  noindex?: boolean;
  // Static-only:
  labelFa?: string | null;
  canonicalOverride?: string | null;
  sitemapPriority?: string | null;
  sitemapChangefreq?: string | null;
};

function cleanText(value: string | null | undefined): string | null {
  if (value == null) return null;
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

/**
 * Routes a SEO edit to the correct table based on `source`: `PageSeo` (by
 * pathKey) for static pages, or the owning entity table (by id) for products /
 * categories / blog posts. Validation of fields happens at the API boundary.
 */
export async function patchSeo(
  source: SeoSourceKind,
  ref: string,
  fields: SeoPatchFields,
  userId?: string,
): Promise<void> {
  const db = getDb();

  if (source === "static") {
    // Seed the row from the catalog if it doesn't exist yet, then patch.
    const catalog = STATIC_PAGES.find((p) => p.pathKey === ref);
    const set: Record<string, unknown> = { updatedByUserId: userId ?? null, updatedAt: new Date() };
    if (fields.seoTitle !== undefined) set.seoTitle = cleanText(fields.seoTitle);
    if (fields.seoDescription !== undefined) set.seoDescription = cleanText(fields.seoDescription);
    if (fields.ogImageUrl !== undefined) set.ogImageUrl = cleanText(fields.ogImageUrl);
    if (fields.noindex !== undefined) set.noindex = fields.noindex;
    if (fields.labelFa !== undefined) set.labelFa = cleanText(fields.labelFa);
    if (fields.canonicalOverride !== undefined)
      set.canonicalOverride = cleanText(fields.canonicalOverride);
    if (fields.sitemapPriority !== undefined)
      set.sitemapPriority = cleanText(fields.sitemapPriority);
    if (fields.sitemapChangefreq !== undefined)
      set.sitemapChangefreq = cleanText(fields.sitemapChangefreq);

    const existing = await db.query.pageSeo.findFirst({
      where: (item, { eq }) => eq(item.pathKey, ref),
    });
    if (existing) {
      await db.update(pageSeo).set(set).where(eq(pageSeo.pathKey, ref));
      return;
    }
    await db.insert(pageSeo).values({
      pathKey: ref,
      labelFa: cleanText(fields.labelFa) ?? catalog?.labelFa ?? ref,
      seoTitle:
        fields.seoTitle !== undefined ? cleanText(fields.seoTitle) : (catalog?.title ?? null),
      seoDescription:
        fields.seoDescription !== undefined
          ? cleanText(fields.seoDescription)
          : (catalog?.description ?? null),
      ogImageUrl: cleanText(fields.ogImageUrl),
      noindex: fields.noindex ?? false,
      canonicalOverride: cleanText(fields.canonicalOverride),
      sitemapPriority:
        fields.sitemapPriority !== undefined
          ? cleanText(fields.sitemapPriority)
          : catalog
            ? String(catalog.sitemapPriority)
            : null,
      sitemapChangefreq:
        fields.sitemapChangefreq !== undefined
          ? cleanText(fields.sitemapChangefreq)
          : (catalog?.sitemapChangefreq ?? null),
      updatedByUserId: userId ?? null,
    });
    return;
  }

  // Entity tables share the same SEO column shape.
  const table = source === "product" ? products : source === "category" ? categories : blogPosts;
  const set: Record<string, unknown> = {};
  if (fields.seoTitle !== undefined) set.seoTitle = cleanText(fields.seoTitle);
  if (fields.seoDescription !== undefined) set.seoDescription = cleanText(fields.seoDescription);
  if (fields.ogImageUrl !== undefined) set.ogImageUrl = cleanText(fields.ogImageUrl);
  if (fields.noindex !== undefined) set.noindex = fields.noindex;

  if (Object.keys(set).length === 0) return;

  const result = await db
    .update(table)
    .set(set)
    .where(eq(table.id, ref))
    .returning({ id: table.id });
  if (result.length === 0) throw new SeoHubError("NOT_FOUND");
}

/** Count of indexable pages across sources (for the admin subtitle). */
export async function countSeoPages(): Promise<number> {
  const db = getDb();
  const [p, c, b] = await Promise.all([
    db.select({ n: count() }).from(products),
    db.select({ n: count() }).from(categories),
    db.select({ n: count() }).from(blogPosts),
  ]);
  return STATIC_PAGES.length + (p[0]?.n ?? 0) + (c[0]?.n ?? 0) + (b[0]?.n ?? 0);
}
