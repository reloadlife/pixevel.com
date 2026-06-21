CREATE TYPE "public"."base_currency" AS ENUM('IRT', 'USD', 'EUR');--> statement-breakpoint
CREATE TABLE "ExchangeRate" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"currency" text NOT NULL,
	"rateToman" numeric(12, 2) NOT NULL,
	"updatedByUserId" uuid,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "ExchangeRate_currency_unique" UNIQUE("currency")
);
--> statement-breakpoint
ALTER TABLE "Product" ADD COLUMN "baseCurrency" "base_currency" DEFAULT 'IRT' NOT NULL;--> statement-breakpoint
ALTER TABLE "ExchangeRate" ADD CONSTRAINT "ExchangeRate_updatedByUserId_User_id_fk" FOREIGN KEY ("updatedByUserId") REFERENCES "public"."User"("id") ON DELETE set null ON UPDATE no action;