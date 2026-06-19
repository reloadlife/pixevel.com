import { eq } from "drizzle-orm";
import type { MetadataRoute } from "next";

import { categories, products } from "@/db/schema";
import { getDb } from "@/lib/db";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://pixevel.com";

const STATIC_ROUTES: { path: string; priority: number; changeFrequency: ChangeFreq }[] = [
  { path: "/", priority: 1, changeFrequency: "daily" },
  { path: "/products", priority: 0.9, changeFrequency: "daily" },
  { path: "/about", priority: 0.4, changeFrequency: "yearly" },
  { path: "/contact", priority: 0.4, changeFrequency: "yearly" },
  { path: "/faq", priority: 0.5, changeFrequency: "monthly" },
  { path: "/support", priority: 0.4, changeFrequency: "monthly" },
  { path: "/terms", priority: 0.3, changeFrequency: "yearly" },
  { path: "/privacy", priority: 0.3, changeFrequency: "yearly" },
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

    const [activeProducts, visibleCategories] = await Promise.all([
      db
        .select({ slug: products.slug, updatedAt: products.updatedAt })
        .from(products)
        .where(eq(products.status, "ACTIVE")),
      db.select({ slug: categories.slug }).from(categories).where(eq(categories.isVisible, true)),
    ]);

    const productEntries: MetadataRoute.Sitemap = activeProducts.map((product) => ({
      url: `${siteUrl}/products/${product.slug}`,
      lastModified: product.updatedAt ?? now,
      changeFrequency: "weekly",
      priority: 0.7,
    }));

    const categoryEntries: MetadataRoute.Sitemap = visibleCategories.map((category) => ({
      url: `${siteUrl}/products?category=${category.slug}`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.6,
    }));

    dynamicEntries = [...categoryEntries, ...productEntries];
  } catch {
    // No DB available (e.g. build without DATABASE_URL) — ship the static map.
  }

  return [...staticEntries, ...dynamicEntries];
}
