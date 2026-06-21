import { and, eq, ne } from "drizzle-orm";
import type { MetadataRoute } from "next";

import { blogPosts, categories, products } from "@/db/schema";
import { getDb } from "@/lib/db";
import { categoryHref } from "@/lib/nav-items";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://pixevel.com";

const STATIC_ROUTES: { path: string; priority: number; changeFrequency: ChangeFreq }[] = [
  { path: "/", priority: 1, changeFrequency: "daily" },
  { path: "/products", priority: 0.9, changeFrequency: "daily" },
  { path: "/domains", priority: 0.7, changeFrequency: "weekly" },
  { path: "/servers", priority: 0.7, changeFrequency: "weekly" },
  { path: "/about", priority: 0.4, changeFrequency: "yearly" },
  { path: "/contact", priority: 0.4, changeFrequency: "yearly" },
  { path: "/faq", priority: 0.5, changeFrequency: "monthly" },
  { path: "/support", priority: 0.4, changeFrequency: "monthly" },
  { path: "/terms", priority: 0.3, changeFrequency: "yearly" },
  { path: "/privacy", priority: 0.3, changeFrequency: "yearly" },
  { path: "/refund", priority: 0.4, changeFrequency: "yearly" },
  { path: "/blog", priority: 0.6, changeFrequency: "daily" },
];

type ChangeFreq = NonNullable<MetadataRoute.Sitemap[number]["changeFrequency"]>;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();

  const staticEntries: MetadataRoute.Sitemap = STATIC_ROUTES.map((route) => ({
    url: `${siteUrl}${route.path}`,
    lastModified: now,
    changeFrequency: route.changeFrequency,
    priority: route.priority,
  }));

  let dynamicEntries: MetadataRoute.Sitemap = [];

  try {
    const db = getDb();

    const [activeProducts, visibleCategories, publishedPosts] = await Promise.all([
      db
        .select({ slug: products.slug, updatedAt: products.updatedAt })
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
      db.select({ slug: categories.slug }).from(categories).where(eq(categories.isVisible, true)),
      db
        .select({ slug: blogPosts.slug, updatedAt: blogPosts.updatedAt })
        .from(blogPosts)
        .where(eq(blogPosts.status, "PUBLISHED")),
    ]);

    const productEntries: MetadataRoute.Sitemap = activeProducts.map((product) => ({
      url: `${siteUrl}/products/${product.slug}`,
      lastModified: product.updatedAt ?? now,
      changeFrequency: "weekly",
      priority: 0.7,
    }));

    const categoryEntries: MetadataRoute.Sitemap = visibleCategories.map((category) => ({
      url: `${siteUrl}${categoryHref(category.slug)}`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.6,
    }));

    const blogEntries: MetadataRoute.Sitemap = publishedPosts.map((post) => ({
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
