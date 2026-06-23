import "server-only";

import { pageSeo } from "@/db/schema";
import { getDb } from "@/lib/db";
import { STATIC_PAGES } from "@/lib/seo/static-pages";

/**
 * Idempotent upsert of one `PageSeo` row per indexable static route, seeded from
 * the static-pages catalog so a fresh install renders the same `<title>` and
 * description as the previously hardcoded metadata.
 *
 * Only inserts missing rows (`onConflictDoNothing` by `pathKey`) — it never
 * overwrites an operator's edits. Safe to run on every deploy.
 */
export async function seedStaticPageSeo(): Promise<{ inserted: number }> {
  const db = getDb();
  const values = STATIC_PAGES.map((page) => ({
    pathKey: page.pathKey,
    labelFa: page.labelFa,
    seoTitle: page.title,
    seoDescription: page.description,
    sitemapPriority: String(page.sitemapPriority),
    sitemapChangefreq: page.sitemapChangefreq,
  }));

  const result = await db
    .insert(pageSeo)
    .values(values)
    .onConflictDoNothing({ target: pageSeo.pathKey })
    .returning({ id: pageSeo.id });

  return { inserted: result.length };
}
