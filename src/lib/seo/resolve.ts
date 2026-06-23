import "server-only";

import type { Metadata } from "next";
import { cache as reactCache } from "react";

import { pageSeo } from "@/db/schema";
import { getDb } from "@/lib/db";
import { getGlobalDefaults, type SeoGlobalDefaults } from "@/lib/seo/defaults";
import { getStaticPage, type SitemapChangefreq } from "@/lib/seo/static-pages";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://pixevel.com";
/** Brand name — ultimate title fallback when a page has no title set anywhere. */
const SITE_NAME = "پیسکول";

// ─── Entity SEO field shapes (read-through from the owning tables) ──────────────

export type EntitySeoFields = {
  titleFa: string;
  seoTitle?: string | null;
  seoDescription?: string | null;
  /** Fallback description source when seoDescription is empty (summary/excerpt). */
  fallbackDescription?: string | null;
  ogImageUrl?: string | null;
  noindex?: boolean | null;
};

export type SeoSource =
  | { kind: "static"; pathKey: string }
  | { kind: "product"; entity: EntitySeoFields; slug: string }
  | { kind: "category"; entity: EntitySeoFields; slug: string }
  | { kind: "blog"; entity: EntitySeoFields; slug: string };

/** The resolved pieces every consumer (generateMetadata / sitemap) needs. */
export type ResolvedSeo = {
  /**
   * Final, ready-to-render absolute `<title>` — the page title with the global
   * title template already applied (except the home page, which renders the
   * site title verbatim, matching the previous root-layout default).
   */
  title: string;
  /**
   * The page's own title WITHOUT the template suffix — used for og:title /
   * twitter:title, matching the previous behavior where the template was applied
   * only to the document `<title>`.
   */
  pageTitle: string;
  description: string | undefined;
  /** Relative canonical path, e.g. "/about" or "/products/foo". */
  canonical: string;
  ogImageUrl: string | undefined;
  noindex: boolean;
  /** OpenGraph `type` appropriate for the source kind. */
  ogType: "website" | "article";
  /** Sitemap controls (resolved against the global default). */
  sitemapPriority: number;
  sitemapChangefreq: SitemapChangefreq;
};

// ─── Pure merge (first non-empty wins: entity/page → global → hardcoded) ─────────

function firstNonEmpty(...values: (string | null | undefined)[]): string | undefined {
  for (const value of values) {
    if (value != null && value.trim() !== "") return value.trim();
  }
  return undefined;
}

/**
 * Applies the global title template (e.g. "%s | پیسکول") to a page title.
 * When the template has no `%s`, the page title is returned unchanged. Mirrors
 * the previous root-layout `title.template` behavior for non-home pages.
 */
export function applyTitleTemplate(template: string, pageTitle: string): string {
  if (!template.includes("%s")) return pageTitle;
  return template.replace("%s", pageTitle);
}

/** Coerces a Drizzle `numeric` (string|null) priority to a 0–1 number, or null. */
export function coercePriority(raw: string | number | null | undefined): number | null {
  if (raw == null || raw === "") return null;
  const n = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(n) || n < 0 || n > 1) return null;
  return n;
}

type PageSeoOverride = {
  seoTitle?: string | null;
  seoDescription?: string | null;
  ogImageUrl?: string | null;
  noindex?: boolean | null;
  canonicalOverride?: string | null;
  sitemapPriority?: string | number | null;
  sitemapChangefreq?: string | null;
};

type StaticDefaults = {
  title: string;
  description: string;
  sitemapPriority: number;
  sitemapChangefreq: SitemapChangefreq;
} | null;

/**
 * Pure resolution of a static page's SEO from its `PageSeo` override row, the
 * static-pages catalog defaults, and the global defaults. Exported for unit
 * testing the merge precedence without a DB.
 */
export function mergeStaticSeo(args: {
  pathKey: string;
  row: PageSeoOverride | null;
  staticDefaults: StaticDefaults;
  global: SeoGlobalDefaults;
}): ResolvedSeo {
  const { pathKey, row, staticDefaults, global } = args;

  const pageTitle = firstNonEmpty(row?.seoTitle, staticDefaults?.title) ?? SITE_NAME;
  // The home page renders the site title verbatim (it was the root-layout
  // `title.default`); every other route applies the global title template.
  const title = pathKey === "/" ? pageTitle : applyTitleTemplate(global.titleTemplate, pageTitle);
  const description = firstNonEmpty(
    row?.seoDescription,
    staticDefaults?.description,
    global.defaultDescription,
  );
  const ogImageUrl = firstNonEmpty(row?.ogImageUrl, global.defaultOgImageUrl);
  const noindex = row?.noindex === true || !global.robotsDefault.index;
  const canonical = firstNonEmpty(row?.canonicalOverride, pathKey) ?? pathKey;

  const priority =
    coercePriority(row?.sitemapPriority) ??
    staticDefaults?.sitemapPriority ??
    global.sitemap.defaultPriority;
  const changefreq =
    (firstNonEmpty(row?.sitemapChangefreq) as SitemapChangefreq | undefined) ??
    staticDefaults?.sitemapChangefreq ??
    global.sitemap.defaultChangefreq;

  return {
    title,
    pageTitle,
    description,
    canonical,
    ogImageUrl,
    noindex,
    ogType: "website",
    sitemapPriority: priority,
    sitemapChangefreq: changefreq,
  };
}

/**
 * Pure resolution of an entity (product/category/blog) page's SEO from its own
 * SEO columns and the global defaults. Exported for unit testing.
 */
export function mergeEntitySeo(args: {
  kind: "product" | "category" | "blog";
  entity: EntitySeoFields;
  canonical: string;
  global: SeoGlobalDefaults;
}): ResolvedSeo {
  const { kind, entity, canonical, global } = args;

  const pageTitle = firstNonEmpty(entity.seoTitle, entity.titleFa) ?? entity.titleFa;
  const title = applyTitleTemplate(global.titleTemplate, pageTitle);
  const description = firstNonEmpty(entity.seoDescription, entity.fallbackDescription);
  const ogImageUrl = firstNonEmpty(entity.ogImageUrl, global.defaultOgImageUrl);
  const noindex = entity.noindex === true || !global.robotsDefault.index;

  return {
    title,
    pageTitle,
    description,
    canonical,
    ogImageUrl,
    noindex,
    ogType: kind === "blog" ? "article" : "website",
    sitemapPriority: global.sitemap.defaultPriority,
    sitemapChangefreq: global.sitemap.defaultChangefreq,
  };
}

// ─── DB-backed resolution (cached per request) ──────────────────────────────────

/** Reads a single `PageSeo` row by pathKey. Cached per request via React cache. */
const getPageSeoRow = reactCache(async (pathKey: string): Promise<PageSeoOverride | null> => {
  try {
    const row = await getDb().query.pageSeo.findFirst({
      where: (item, { eq }) => eq(item.pathKey, pathKey),
    });
    return row ?? null;
  } catch {
    return null;
  }
});

/**
 * The single resolution layer used by every `generateMetadata`, plus `robots.ts`
 * and `sitemap.ts`. Merge order: page/entity-specific → global defaults →
 * hardcoded fallback.
 */
export async function resolvePageSeo(source: SeoSource): Promise<ResolvedSeo> {
  const global = await getGlobalDefaults();

  if (source.kind === "static") {
    const [row, staticDefaults] = await Promise.all([
      getPageSeoRow(source.pathKey),
      Promise.resolve(getStaticPage(source.pathKey) ?? null),
    ]);
    return mergeStaticSeo({ pathKey: source.pathKey, row, staticDefaults, global });
  }

  const canonical =
    source.kind === "product"
      ? `/products/${source.slug}`
      : source.kind === "category"
        ? `/category/${source.slug}`
        : `/blog/${source.slug}`;

  return mergeEntitySeo({ kind: source.kind, entity: source.entity, canonical, global });
}

// ─── Metadata builder (shared by all generateMetadata consumers) ────────────────

/**
 * Builds a Next.js `Metadata` object from a {@link ResolvedSeo}. The page title
 * is returned as `{ absolute }` so the root layout's title template is NOT
 * doubly applied — entity/static pages already carry their full intended title.
 */
export function toMetadata(
  resolved: ResolvedSeo,
  opts: { ogPublishedTime?: string | null } = {},
): Metadata {
  const { title, pageTitle, description, canonical, ogImageUrl, noindex, ogType } = resolved;
  // og:/twitter: titles use the un-templated page title (previous behavior set
  // openGraph.title to the page's own title, not the document <title>).
  const images = ogImageUrl ? [{ url: ogImageUrl, alt: pageTitle }] : undefined;

  return {
    title: { absolute: title },
    description,
    alternates: { canonical },
    robots: { index: !noindex, follow: !noindex },
    openGraph: {
      type: ogType,
      title: pageTitle,
      description,
      url: canonical.startsWith("http") ? canonical : `${siteUrl}${canonical}`,
      images,
      ...(ogType === "article" && opts.ogPublishedTime
        ? { publishedTime: opts.ogPublishedTime }
        : {}),
    },
    twitter: {
      card: ogImageUrl ? "summary_large_image" : "summary",
      title: pageTitle,
      description,
      images: ogImageUrl ? [ogImageUrl] : undefined,
    },
  };
}

/** Convenience: resolve a source and return ready-to-use Metadata. */
export async function resolveMetadata(
  source: SeoSource,
  opts: { ogPublishedTime?: string | null } = {},
): Promise<Metadata> {
  const resolved = await resolvePageSeo(source);
  return toMetadata(resolved, opts);
}

export { pageSeo };
