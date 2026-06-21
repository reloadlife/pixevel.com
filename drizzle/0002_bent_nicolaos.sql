CREATE TYPE "public"."dns_record_type" AS ENUM('A', 'AAAA', 'CNAME', 'MX', 'TXT', 'NS', 'SRV', 'CAA');--> statement-breakpoint
CREATE TABLE "DomainDnsRecord" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"domainId" uuid NOT NULL,
	"type" "dns_record_type" NOT NULL,
	"name" text NOT NULL,
	"value" text NOT NULL,
	"ttl" integer DEFAULT 3600 NOT NULL,
	"priority" integer,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "DomainRegistration" ADD COLUMN "autoRenew" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "DomainRegistration" ADD COLUMN "transferLock" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "DomainRegistration" ADD COLUMN "privacyProtection" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "DomainRegistration" ADD COLUMN "nameservers" jsonb;--> statement-breakpoint
ALTER TABLE "DomainRegistration" ADD COLUMN "authCode" text;--> statement-breakpoint
ALTER TABLE "DomainRegistration" ADD COLUMN "registrantContact" jsonb;--> statement-breakpoint
ALTER TABLE "DomainRegistration" ADD COLUMN "lastSyncedAt" timestamp;--> statement-breakpoint
ALTER TABLE "DomainDnsRecord" ADD CONSTRAINT "DomainDnsRecord_domainId_DomainRegistration_id_fk" FOREIGN KEY ("domainId") REFERENCES "public"."DomainRegistration"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "DomainDnsRecord_domainId_idx" ON "DomainDnsRecord" USING btree ("domainId");