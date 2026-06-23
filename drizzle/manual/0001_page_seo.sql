-- Additive migration: PageSeo (SEO Management Hub).
--
-- The drizzle migration journal (drizzle/meta) predates ~17 push-added tables,
-- so `drizzle-kit generate` cannot run non-interactively without resolving that
-- pre-existing drift. Deploys apply schema changes with `db:push` (see
-- `deploy:prepare`), which derives this table directly from `src/db/schema.ts`.
--
-- This hand-written, idempotent statement is provided for environments that
-- apply SQL by hand. It is purely additive — no existing table is altered.

CREATE TABLE IF NOT EXISTS "PageSeo" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"pathKey" text NOT NULL,
	"labelFa" text NOT NULL,
	"seoTitle" text,
	"seoDescription" text,
	"ogImageUrl" text,
	"noindex" boolean DEFAULT false NOT NULL,
	"canonicalOverride" text,
	"sitemapPriority" numeric,
	"sitemapChangefreq" text,
	"updatedByUserId" uuid,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "PageSeo_pathKey_unique" UNIQUE("pathKey")
);

DO $$ BEGIN
	ALTER TABLE "PageSeo"
		ADD CONSTRAINT "PageSeo_updatedByUserId_User_id_fk"
		FOREIGN KEY ("updatedByUserId") REFERENCES "public"."User"("id")
		ON DELETE set null ON UPDATE no action;
EXCEPTION
	WHEN duplicate_object THEN NULL;
END $$;
