import "server-only";

import { z } from "zod";

import { appSettings } from "@/db/schema";
import { getDb } from "@/lib/db";
import { SITEMAP_CHANGEFREQS, type SitemapChangefreq } from "@/lib/seo/static-pages";

/**
 * Global SEO defaults, stored as a single JSON `AppSetting` under {@link SEO_GLOBAL_KEY}.
 *
 * A typed reader parses + validates the JSON with Zod and falls back to the
 * hardcoded {@link HARDCODED_GLOBAL_DEFAULTS} when the key is absent or
 * malformed — so a bad write never breaks the site `<head>`. Reads are cached
 * in-process with a short TTL (mirrors the settings / exchange-rate pattern) to
 * avoid a settings query per page render.
 */

export const SEO_GLOBAL_KEY = "seo.global";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://pixevel.com";

/** Hardcoded fallbacks — these mirror the values previously hardcoded in the root layout. */
export const HARDCODED_GLOBAL_DEFAULTS: SeoGlobalDefaults = {
  titleTemplate: "%s | پیسکول",
  defaultDescription:
    "پیسکول؛ فروشگاه آنلاین برای خرید کالای فیزیکی، محصولات دیجیتال، سرویس‌ها و اشتراک‌ها با تجربه‌ای سریع، امن و مدرن.",
  defaultOgImageUrl: `${siteUrl}/icon.png`,
  robotsDefault: { index: true, follow: true },
  sitemap: { defaultPriority: 0.5, defaultChangefreq: "weekly" },
};

const changefreqSchema = z.enum(
  SITEMAP_CHANGEFREQS as unknown as [SitemapChangefreq, ...SitemapChangefreq[]],
);

export const seoGlobalSchema = z.object({
  titleTemplate: z.string().min(1),
  defaultDescription: z.string(),
  defaultOgImageUrl: z.string(),
  robotsDefault: z.object({
    index: z.boolean(),
    follow: z.boolean(),
  }),
  sitemap: z.object({
    defaultPriority: z.number().min(0).max(1),
    defaultChangefreq: changefreqSchema,
  }),
});

export type SeoGlobalDefaults = z.infer<typeof seoGlobalSchema>;

// ─── Module cache (mirrors src/lib/settings.ts) ─────────────────────────────────

const TTL_MS = 60_000;
let cache: SeoGlobalDefaults | null = null;
let loadedAt = 0;
let inflight: Promise<SeoGlobalDefaults> | null = null;
let warnedMalformed = false;

/**
 * Parses a raw JSON string into validated global defaults, falling back to the
 * hardcoded values (and logging once) when the value is absent or malformed.
 */
export function parseGlobalDefaults(raw: string | null | undefined): SeoGlobalDefaults {
  if (raw == null || raw === "") return HARDCODED_GLOBAL_DEFAULTS;
  try {
    const json = JSON.parse(raw);
    const parsed = seoGlobalSchema.safeParse(json);
    if (parsed.success) return parsed.data;
    if (!warnedMalformed) {
      warnedMalformed = true;
      console.warn("[seo] malformed seo.global setting — using hardcoded defaults");
    }
    return HARDCODED_GLOBAL_DEFAULTS;
  } catch {
    if (!warnedMalformed) {
      warnedMalformed = true;
      console.warn("[seo] unparseable seo.global setting — using hardcoded defaults");
    }
    return HARDCODED_GLOBAL_DEFAULTS;
  }
}

async function load(): Promise<SeoGlobalDefaults> {
  try {
    const row = await getDb().query.appSettings.findFirst({
      where: (item, { eq }) => eq(item.key, SEO_GLOBAL_KEY),
    });
    return parseGlobalDefaults(row?.value ?? null);
  } catch {
    // DB unavailable / table missing — keep the site head working.
    return HARDCODED_GLOBAL_DEFAULTS;
  }
}

/** Returns the global SEO defaults, cached in-process for {@link TTL_MS}. */
export async function getGlobalDefaults(force = false): Promise<SeoGlobalDefaults> {
  if (!force && cache && Date.now() - loadedAt < TTL_MS) return cache;
  if (inflight) return inflight;
  inflight = (async () => {
    try {
      const value = await load();
      cache = value;
      loadedAt = Date.now();
      return value;
    } finally {
      inflight = null;
    }
  })();
  return inflight;
}

/** Reads the raw stored defaults for the admin editor (no cache, no fallback masking). */
export async function getGlobalDefaultsForAdmin(): Promise<SeoGlobalDefaults> {
  const row = await getDb().query.appSettings.findFirst({
    where: (item, { eq }) => eq(item.key, SEO_GLOBAL_KEY),
  });
  return parseGlobalDefaults(row?.value ?? null);
}

/** Validates and persists the global defaults JSON, then refreshes the cache. */
export async function setGlobalDefaults(
  input: unknown,
  userId?: string,
): Promise<SeoGlobalDefaults> {
  const parsed = seoGlobalSchema.parse(input);
  const value = JSON.stringify(parsed);
  await getDb()
    .insert(appSettings)
    .values({
      key: SEO_GLOBAL_KEY,
      value,
      isSecret: false,
      updatedByUserId: userId ?? null,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: appSettings.key,
      set: { value, updatedByUserId: userId ?? null, updatedAt: new Date() },
    });
  cache = parsed;
  loadedAt = Date.now();
  warnedMalformed = false;
  return parsed;
}
