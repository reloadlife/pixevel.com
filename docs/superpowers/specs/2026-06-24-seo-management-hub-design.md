# SEO Management Hub + Global Defaults — Design

**Date:** 2026-06-24
**Status:** Approved (design), pending spec review
**Sub-project:** A of 2 (companion: `2026-06-24-traffic-user-flow-analytics-design.md`)

## Problem

Pixevel can already manage SEO for products, categories, and blog posts — each has
DB-backed `seoTitle`, `seoDescription`, `ogImageUrl`, `noindex` columns wired into
`generateMetadata`, and inline editing already exists in `product-management.tsx`,
`taxonomy-management.tsx`, and `blog-management.tsx`.

What is missing, relative to WooCommerce/Yoast-style SEO control:

1. **Static/marketing pages have no DB-backed SEO.** The indexable routes that export a
   hardcoded `export const metadata` (homepage, `/about`, `/faq`, `/terms`,
   `/products` listing, `/domains`, `/servers`, etc.) cannot be edited by operators.
   (19 page files export static metadata, but `/account/*` and `/checkout` are
   disallowed in `robots.ts`; only the indexable subset is managed here.)
2. **No global SEO defaults.** Title template, default OG image, default description,
   robots default, and sitemap priority/changefreq live in code, not in admin.
3. **No central place** to see and manage SEO across every indexable page.

## Goals

- A central admin "SEO" screen, under the Content section, listing **every indexable
  page** (static + products + categories + blog) with its SEO state, editable in place.
- DB-backed SEO for static/standalone pages.
- A global-defaults editor (title template, default description, default OG image,
  robots default, sitemap defaults).
- A single resolution layer that all `generateMetadata` functions, `robots.ts`, and
  `sitemap.ts` use, so behavior is consistent and testable.

## Non-Goals (YAGNI)

- No keyword analysis, readability scoring, or content suggestions (Yoast-style).
- No redirect manager (separate concern).
- No per-page social-preview image generation.
- No multi-locale SEO (project is Persian-first single-locale today).

## Data Model

### New table: `PageSeo`

For standalone routes that are **not** backed by a catalog/blog entity. Keyed by the
route path so a page maps to exactly one row.

```ts
export const pageSeo = pgTable("PageSeo", {
  id: uuid("id").primaryKey().defaultRandom(),
  // Stable route identifier, e.g. "/", "/about", "/products". Unique.
  pathKey: text("pathKey").notNull().unique(),
  // Human label for the admin list, e.g. "صفحه اصلی", "درباره ما".
  labelFa: text("labelFa").notNull(),
  seoTitle: text("seoTitle"),
  seoDescription: text("seoDescription"),
  ogImageUrl: text("ogImageUrl"),
  noindex: boolean("noindex").default(false).notNull(),
  // Optional absolute/relative canonical override; null = derive from pathKey.
  canonicalOverride: text("canonicalOverride"),
  // Sitemap controls (null = use global default).
  sitemapPriority: numeric("sitemapPriority"), // 0.0–1.0
  sitemapChangefreq: text("sitemapChangefreq"), // daily/weekly/monthly/…
  updatedByUserId: uuid("updatedByUserId").references(() => users.id, {
    onDelete: "set null",
  }),
  updatedAt,
});
```

Indexes: `pathKey` unique already covers lookups.

### Global defaults: `appSettings` JSON key

Reuse the existing `AppSetting` key/value store. One row under key `seo.global` whose
`value` is JSON:

```jsonc
{
  "titleTemplate": "%s | پیسکول",
  "defaultDescription": "…",
  "defaultOgImageUrl": "https://…/og-default.png",
  "robotsDefault": { "index": true, "follow": true },
  "sitemap": { "defaultPriority": 0.5, "defaultChangefreq": "weekly" }
}
```

A typed reader parses + validates this with a Zod schema and falls back to the current
hardcoded values when the key is absent or malformed (so a bad write never breaks the
site head).

### Entities (unchanged)

`products`, `categories`, `blogPosts` keep their existing SEO columns. The hub reads
them read-through and writes edits back to the owning table. No migration on entities.

## Resolution Layer

New module `src/lib/seo/resolve.ts` — the single source of truth for page metadata.

```ts
type SeoSource =
  | { kind: "static"; pathKey: string }
  | { kind: "product"; product: ProductSeoFields; slug: string }
  | { kind: "category"; category: CategorySeoFields; slug: string }
  | { kind: "blog"; post: BlogSeoFields; slug: string };

async function resolvePageSeo(source: SeoSource): Promise<ResolvedSeo>;
```

Merge order (first non-empty wins): **page/entity-specific → global defaults →
hardcoded fallback**. Returns the pieces `generateMetadata` needs (title, description,
canonical, robots, openGraph, twitter) plus `noindex` and sitemap fields.

Refactor consumers to call it:

- `products/[slug]`, `category/[slug]`, `blog/[slug]` `generateMetadata` → call
  `resolvePageSeo` with the entity (keeps their current fallback chains, now centralized).
- The indexable static pages → convert hardcoded `export const metadata` into
  `generateMetadata` that calls `resolvePageSeo({ kind: "static", pathKey })`.
- `robots.ts` → read `seo.global.robotsDefault`; keep the existing disallow list.
- `sitemap.ts` → per-URL `priority`/`changefreq` from `PageSeo` (static) or global
  default; respect `noindex` (exclude noindexed pages).

Resolution reads are cached per request; global defaults cached in-process with a short
TTL (mirrors the `loadExchangeRates` pattern) to avoid a settings query per page render.

## Admin UI

New route group `src/app/admin/seo/`, added to the **Content** sidebar section in
`admin-sidebar.tsx`.

### Tab 1 — Pages

A searchable `DataTable` (existing kit component) aggregating every indexable page:

| Source   | Rows from                                  |
|----------|--------------------------------------------|
| Static   | `PageSeo` (seeded list of standalone routes) |
| Products | `products` (slug, seo fields)              |
| Category | `categories`                               |
| Blog     | `blogPosts`                                |

Columns: page label + path, "title set?" / "description set?" indicators, `noindex`
chip, in-sitemap indicator. Filter by source + free-text search. Edit opens a
`SheetForm`; on submit the API routes the write to the correct table based on row
`source`. Entity rows deep-link to the entity's own edit page as a secondary action.

### Tab 2 — Global Defaults

A form (kit `form-fields`) for the `seo.global` JSON: title template, default
description, default OG image (URL field), robots default (switches), sitemap default
priority + changefreq. Saved via the settings API.

### APIs

Under `src/app/api/admin/seo/` (all `requireAdmin()`):

- `GET /api/admin/seo` — paginated aggregated list (source, pathKey/slug, label, seo
  state), with `source` + search filters. Follows the `AdminListResponse` shape.
- `PATCH /api/admin/seo` — body includes `{ source, ref, fields }`; routes the write to
  `PageSeo` (by `pathKey`) or the entity table (by id/slug).
- `GET/PUT /api/admin/seo/defaults` — read/update the `seo.global` setting (validated).

## Seeding

A seed step (idempotent upsert by `pathKey`) inserts a `PageSeo` row for each indexable
static route, copying its **current hardcoded** title/description as the starting value
so the rendered head is byte-identical until an operator edits it. The catalog of
indexable static routes lives in `src/lib/seo/static-pages.ts` (pathKey, labelFa,
current title, current description) — `/account/*` and `/checkout` are excluded (they
are disallowed in `robots.ts`). This module is reused both by the seed and as the source
of static rows in the hub.

## Error Handling

- Malformed `seo.global` JSON → resolver logs once and uses hardcoded fallback; site
  head never breaks.
- Missing `PageSeo` row for a static page → resolver falls back to the static-pages
  catalog defaults, then global defaults.
- Admin writes validated with Zod; invalid sitemap priority (outside 0–1) or unknown
  changefreq rejected with a structured `apiError`.

## Testing

- Unit: `resolvePageSeo` merge precedence (entity → global → fallback) for each kind;
  malformed-settings fallback; noindex propagation.
- Unit: sitemap excludes noindexed pages and applies per-page priority.
- Integration: admin PATCH routes a static edit to `PageSeo` and an entity edit to the
  entity table; defaults PUT validates and round-trips.
- Regression: seeded static pages render the same `<title>`/description as before the
  change (snapshot the resolved metadata for each indexable static route in the catalog).

## Rollout

- Migration: `PageSeo` table (additive). No entity changes. `db:push` safe (additive).
- Seed static pages on deploy (idempotent).
- No destructive schema operations.

## Open Questions

None blocking. Sitemap `priority` stored as `numeric` text via Drizzle — coerce to
number in the resolver.
