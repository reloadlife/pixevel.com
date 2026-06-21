CREATE TYPE "public"."analytics_event_type" AS ENUM('SEARCH', 'PRODUCT_VIEW', 'CATEGORY_VIEW', 'ADD_TO_CART', 'CHECKOUT_START', 'PURCHASE', 'PAGE_VIEW');--> statement-breakpoint
CREATE TYPE "public"."blog_status" AS ENUM('DRAFT', 'PUBLISHED', 'ARCHIVED');--> statement-breakpoint
CREATE TABLE "AnalyticsEvent" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"type" "analytics_event_type" NOT NULL,
	"userId" uuid,
	"anonId" text,
	"sessionId" text,
	"productId" uuid,
	"categoryId" uuid,
	"query" text,
	"resultCount" integer,
	"path" text,
	"referrer" text,
	"metadata" jsonb,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "BlogPost" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"titleFa" text NOT NULL,
	"excerptFa" text,
	"bodyFa" text NOT NULL,
	"coverImageUrl" text,
	"status" "blog_status" DEFAULT 'DRAFT' NOT NULL,
	"authorUserId" uuid,
	"tags" jsonb,
	"publishedAt" timestamp,
	"seoTitle" text,
	"seoDescription" text,
	"ogImageUrl" text,
	"noindex" boolean DEFAULT false NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "BlogPost_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
ALTER TABLE "Category" ADD COLUMN "seoTitle" text;--> statement-breakpoint
ALTER TABLE "Category" ADD COLUMN "seoDescription" text;--> statement-breakpoint
ALTER TABLE "Category" ADD COLUMN "ogImageUrl" text;--> statement-breakpoint
ALTER TABLE "Category" ADD COLUMN "noindex" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "Product" ADD COLUMN "seoTitle" text;--> statement-breakpoint
ALTER TABLE "Product" ADD COLUMN "seoDescription" text;--> statement-breakpoint
ALTER TABLE "Product" ADD COLUMN "ogImageUrl" text;--> statement-breakpoint
ALTER TABLE "Product" ADD COLUMN "noindex" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "AnalyticsEvent" ADD CONSTRAINT "AnalyticsEvent_userId_User_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "AnalyticsEvent" ADD CONSTRAINT "AnalyticsEvent_productId_Product_id_fk" FOREIGN KEY ("productId") REFERENCES "public"."Product"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "AnalyticsEvent" ADD CONSTRAINT "AnalyticsEvent_categoryId_Category_id_fk" FOREIGN KEY ("categoryId") REFERENCES "public"."Category"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "BlogPost" ADD CONSTRAINT "BlogPost_authorUserId_User_id_fk" FOREIGN KEY ("authorUserId") REFERENCES "public"."User"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "AnalyticsEvent_type_createdAt_idx" ON "AnalyticsEvent" USING btree ("type","createdAt");--> statement-breakpoint
CREATE INDEX "AnalyticsEvent_createdAt_idx" ON "AnalyticsEvent" USING btree ("createdAt");--> statement-breakpoint
CREATE INDEX "AnalyticsEvent_productId_idx" ON "AnalyticsEvent" USING btree ("productId");--> statement-breakpoint
CREATE INDEX "AnalyticsEvent_categoryId_idx" ON "AnalyticsEvent" USING btree ("categoryId");--> statement-breakpoint
CREATE INDEX "AnalyticsEvent_query_idx" ON "AnalyticsEvent" USING btree ("query");--> statement-breakpoint
CREATE INDEX "BlogPost_status_publishedAt_idx" ON "BlogPost" USING btree ("status","publishedAt");--> statement-breakpoint
CREATE INDEX "BlogPost_slug_idx" ON "BlogPost" USING btree ("slug");