import { and, eq, ne } from "drizzle-orm";
import type { MetadataRoute } from "next";

import { blogPosts, categories, pageSeo, products } from "@/db/schema";
import { getDb } from "@/lib/db";
import { categoryHref } from "@/lib/nav-items";
import { getGlobalDefaults } from "@/lib/seo/defaults";
import { coercePriority } from "@/lib/seo/resolve";
import { STATIC_PAGES } from "@/lib/seo/static-pages";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://pixevel.com";

type ChangeFreq = NonNullable<MetadataRoute.Sitemap[number]["changeFrequency"]>;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const global = await getGlobalDefaults();

  // ── Static pages: merge the catalog with PageSeo overrides; exclude noindex ──
  let pageOverrides = new Map<
    string,
    { noindex: boolean; priority: number | null; changefreq: string | null }
  >();
  try {
    const rows = await getDb()
      .select({
        pathKey: pageSeo.pathKey,
        noindex: pageSeo.noindex,
        sitemapPriority: pageSeo.sitemapPriority,
        sitemapChangefreq: pageSeo.sitemapChangefreq,
      })
      .from(pageSeo);
    pageOverrides = new Map(
      rows.map((r) => [
        r.pathKey,
        {
          noindex: r.noindex,
          priority: coercePriority(r.sitemapPriority),
          changefreq: r.sitemapChangefreq,
        },
      ]),
    );
  } catch {
    // No DB — fall back to the hardcoded catalog defaults below.
  }

  const staticEntries: MetadataRoute.Sitemap = [];
  for (const page of STATIC_PAGES) {
    const override = pageOverrides.get(page.pathKey);
    if (override?.noindex) continue; // excluded from sitemap
    staticEntries.push({
      url: `${siteUrl}${page.pathKey}`,
      lastModified: now,
      changeFrequency:
        ((override?.changefreq ?? page.sitemapChangefreq) as ChangeFreq) ??
        (global.sitemap.defaultChangefreq as ChangeFreq),
      priority: override?.priority ?? page.sitemapPriority ?? global.sitemap.defaultPriority,
    });
  }

  let dynamicEntries: MetadataRoute.Sitemap = [];

  try {
    const db = getDb();

    const [activeProducts, visibleCategories, publishedPosts] = await Promise.all([
      db
        .select({
          slug: products.slug,
          updatedAt: products.updatedAt,
          noindex: products.noindex,
        })
        .from(products)
        .where(
          and(
            eq(products.status, "ACTIVE"),
            // Exclude per-order domain/server products minted at checkout —
            // they aren't real catalog pages.
            ne(products.fulfillmentType, "DOMAIN"),
            ne(products.fulfillmentType, "SERVER"),
          ),
        ),
      db
        .select({ slug: categories.slug, noindex: categories.noindex })
        .from(categories)
        .where(eq(categories.isVisible, true)),
      db
        .select({
          slug: blogPosts.slug,
          updatedAt: blogPosts.updatedAt,
          noindex: blogPosts.noindex,
        })
        .from(blogPosts)
        .where(eq(blogPosts.status, "PUBLISHED")),
    ]);

    const productEntries: MetadataRoute.Sitemap = activeProducts
      .filter((product) => !product.noindex)
      .map((product) => ({
        url: `${siteUrl}/products/${product.slug}`,
        lastModified: product.updatedAt ?? now,
        changeFrequency: "weekly",
        priority: 0.7,
      }));

    const categoryEntries: MetadataRoute.Sitemap = visibleCategories
      .filter((category) => !category.noindex)
      .map((category) => ({
        url: `${siteUrl}${categoryHref(category.slug)}`,
        lastModified: now,
        changeFrequency: "weekly",
        priority: 0.6,
      }));

    const blogEntries: MetadataRoute.Sitemap = publishedPosts
      .filter((post) => !post.noindex)
      .map((post) => ({
        url: `${siteUrl}/blog/${post.slug}`,
        lastModified: post.updatedAt ?? now,
        changeFrequency: "monthly",
        priority: 0.5,
      }));

    dynamicEntries = [...categoryEntries, ...productEntries, ...blogEntries];
  } catch {
    // No DB available (e.g. build without DATABASE_URL) — ship the static map.
  }

  return [...staticEntries, ...dynamicEntries];
}
