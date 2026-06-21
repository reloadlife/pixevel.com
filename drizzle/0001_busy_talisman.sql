CREATE TYPE "public"."coupon_kind" AS ENUM('PERCENT', 'FIXED');--> statement-breakpoint
CREATE TYPE "public"."domain_status" AS ENUM('PENDING', 'REGISTERED', 'FAILED', 'EXPIRED');--> statement-breakpoint
CREATE TYPE "public"."fulfillment_type" AS ENUM('DIGITAL', 'PHYSICAL', 'DOMAIN', 'SERVER');--> statement-breakpoint
CREATE TYPE "public"."gift_card_status" AS ENUM('ACTIVE', 'REDEEMED', 'DISABLED', 'EXPIRED');--> statement-breakpoint
CREATE TYPE "public"."loyalty_txn_reason" AS ENUM('EARN', 'REDEEM', 'EXPIRE', 'ADJUST', 'REFERRAL');--> statement-breakpoint
CREATE TYPE "public"."notification_type" AS ENUM('ORDER', 'PAYMENT', 'PROMO', 'SYSTEM', 'SECURITY');--> statement-breakpoint
CREATE TYPE "public"."referral_status" AS ENUM('PENDING', 'QUALIFIED', 'REWARDED');--> statement-breakpoint
CREATE TYPE "public"."review_status" AS ENUM('PENDING', 'APPROVED', 'REJECTED');--> statement-breakpoint
CREATE TYPE "public"."server_status" AS ENUM('PENDING', 'ACTIVE', 'FAILED', 'SUSPENDED', 'TERMINATED');--> statement-breakpoint
CREATE TYPE "public"."support_ticket_status" AS ENUM('OPEN', 'PENDING', 'RESOLVED', 'CLOSED');--> statement-breakpoint
CREATE TYPE "public"."wallet_txn_direction" AS ENUM('CREDIT', 'DEBIT');--> statement-breakpoint
CREATE TYPE "public"."wallet_txn_reason" AS ENUM('TOPUP', 'PURCHASE', 'REFUND', 'GIFT_CARD', 'REFERRAL_REWARD', 'LOYALTY_REDEEM', 'ADJUSTMENT');--> statement-breakpoint
CREATE TABLE "Coupon" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"kind" "coupon_kind" NOT NULL,
	"value" numeric(12, 2) NOT NULL,
	"isActive" boolean DEFAULT true NOT NULL,
	"minSubtotalAmount" numeric(12, 2),
	"maxDiscountAmount" numeric(12, 2),
	"usageLimit" integer,
	"usedCount" integer DEFAULT 0 NOT NULL,
	"startsAt" timestamp,
	"expiresAt" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "Coupon_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "DomainRegistration" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"orderItemId" uuid,
	"userId" uuid,
	"domainName" text NOT NULL,
	"tld" text NOT NULL,
	"years" integer DEFAULT 1 NOT NULL,
	"status" "domain_status" DEFAULT 'PENDING' NOT NULL,
	"registrarRef" text,
	"registrarPayload" jsonb,
	"expiresAt" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "GiftCard" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"initialAmount" numeric(12, 2) NOT NULL,
	"balanceAmount" numeric(12, 2) NOT NULL,
	"currency" text DEFAULT 'IRR' NOT NULL,
	"status" "gift_card_status" DEFAULT 'ACTIVE' NOT NULL,
	"issuedToUserId" uuid,
	"redeemedByUserId" uuid,
	"redeemedAt" timestamp,
	"expiresAt" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "GiftCard_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "LoyaltyAccount" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"userId" uuid NOT NULL,
	"pointsBalance" integer DEFAULT 0 NOT NULL,
	"lifetimePoints" integer DEFAULT 0 NOT NULL,
	"tier" text DEFAULT 'BRONZE' NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "LoyaltyAccount_userId_unique" UNIQUE("userId")
);
--> statement-breakpoint
CREATE TABLE "LoyaltyTransaction" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"userId" uuid NOT NULL,
	"points" integer NOT NULL,
	"reason" "loyalty_txn_reason" NOT NULL,
	"orderId" uuid,
	"note" text,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "NewsletterSubscriber" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"isActive" boolean DEFAULT true NOT NULL,
	"unsubscribedAt" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "NewsletterSubscriber_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "NotificationPreference" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"userId" uuid NOT NULL,
	"orderEmail" boolean DEFAULT true NOT NULL,
	"orderSms" boolean DEFAULT true NOT NULL,
	"promoEmail" boolean DEFAULT false NOT NULL,
	"promoSms" boolean DEFAULT false NOT NULL,
	"newsletterEmail" boolean DEFAULT false NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "NotificationPreference_userId_unique" UNIQUE("userId")
);
--> statement-breakpoint
CREATE TABLE "Notification" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"userId" uuid NOT NULL,
	"type" "notification_type" NOT NULL,
	"titleFa" text NOT NULL,
	"bodyFa" text,
	"href" text,
	"readAt" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ProductReview" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"productId" uuid NOT NULL,
	"userId" uuid,
	"authorName" text,
	"rating" integer NOT NULL,
	"titleFa" text,
	"bodyFa" text NOT NULL,
	"status" "review_status" DEFAULT 'APPROVED' NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "Referral" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"referrerUserId" uuid NOT NULL,
	"refereeUserId" uuid,
	"refereePhone" text,
	"status" "referral_status" DEFAULT 'PENDING' NOT NULL,
	"rewardPoints" integer DEFAULT 0 NOT NULL,
	"rewardedAt" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ServerInstance" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"orderItemId" uuid,
	"userId" uuid,
	"planCode" text NOT NULL,
	"specs" jsonb,
	"status" "server_status" DEFAULT 'PENDING' NOT NULL,
	"providerRef" text,
	"providerPayload" jsonb,
	"ipAddress" text,
	"periodMonths" integer DEFAULT 1 NOT NULL,
	"expiresAt" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "SupportMessage" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ticketId" uuid NOT NULL,
	"authorUserId" uuid,
	"isStaff" boolean DEFAULT false NOT NULL,
	"bodyFa" text NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "SupportTicket" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"userId" uuid NOT NULL,
	"orderId" uuid,
	"subjectFa" text NOT NULL,
	"status" "support_ticket_status" DEFAULT 'OPEN' NOT NULL,
	"lastMessageAt" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "UserAddress" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"userId" uuid NOT NULL,
	"titleFa" text,
	"fullName" text,
	"phone" text,
	"province" text,
	"city" text,
	"addressLine" text,
	"postalCode" text,
	"isDefault" boolean DEFAULT false NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "WalletTransaction" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"walletId" uuid NOT NULL,
	"direction" "wallet_txn_direction" NOT NULL,
	"reason" "wallet_txn_reason" NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"balanceAfter" numeric(12, 2) NOT NULL,
	"orderId" uuid,
	"giftCardId" uuid,
	"note" text,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "Wallet" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"userId" uuid NOT NULL,
	"balanceAmount" numeric(12, 2) DEFAULT '0' NOT NULL,
	"currency" text DEFAULT 'IRR' NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "Wallet_userId_unique" UNIQUE("userId")
);
--> statement-breakpoint
CREATE TABLE "WishlistItem" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"userId" uuid NOT NULL,
	"productId" uuid NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "OrderItem" ADD COLUMN "fulfillmentType" "fulfillment_type" DEFAULT 'DIGITAL' NOT NULL;--> statement-breakpoint
ALTER TABLE "OrderItem" ADD COLUMN "metadata" jsonb;--> statement-breakpoint
ALTER TABLE "Order" ADD COLUMN "customerEmail" text;--> statement-breakpoint
ALTER TABLE "Order" ADD COLUMN "recipientEmail" text;--> statement-breakpoint
ALTER TABLE "Order" ADD COLUMN "recipientPhone" text;--> statement-breakpoint
ALTER TABLE "Order" ADD COLUMN "giftMessage" text;--> statement-breakpoint
ALTER TABLE "Order" ADD COLUMN "couponCode" text;--> statement-breakpoint
ALTER TABLE "Payment" ADD COLUMN "receiptUrl" text;--> statement-breakpoint
ALTER TABLE "ProductVariant" ADD COLUMN "metadata" jsonb;--> statement-breakpoint
ALTER TABLE "Product" ADD COLUMN "fulfillmentType" "fulfillment_type" DEFAULT 'DIGITAL' NOT NULL;--> statement-breakpoint
ALTER TABLE "User" ADD COLUMN "defaultAddressLine" text;--> statement-breakpoint
ALTER TABLE "User" ADD COLUMN "defaultCity" text;--> statement-breakpoint
ALTER TABLE "User" ADD COLUMN "defaultProvince" text;--> statement-breakpoint
ALTER TABLE "User" ADD COLUMN "defaultPostalCode" text;--> statement-breakpoint
ALTER TABLE "User" ADD COLUMN "avatarUrl" text;--> statement-breakpoint
ALTER TABLE "User" ADD COLUMN "emailVerifiedAt" timestamp;--> statement-breakpoint
ALTER TABLE "User" ADD COLUMN "referralCode" text;--> statement-breakpoint
ALTER TABLE "User" ADD COLUMN "referredByUserId" uuid;--> statement-breakpoint
ALTER TABLE "DomainRegistration" ADD CONSTRAINT "DomainRegistration_orderItemId_OrderItem_id_fk" FOREIGN KEY ("orderItemId") REFERENCES "public"."OrderItem"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "DomainRegistration" ADD CONSTRAINT "DomainRegistration_userId_User_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "GiftCard" ADD CONSTRAINT "GiftCard_issuedToUserId_User_id_fk" FOREIGN KEY ("issuedToUserId") REFERENCES "public"."User"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "GiftCard" ADD CONSTRAINT "GiftCard_redeemedByUserId_User_id_fk" FOREIGN KEY ("redeemedByUserId") REFERENCES "public"."User"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "LoyaltyAccount" ADD CONSTRAINT "LoyaltyAccount_userId_User_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "LoyaltyTransaction" ADD CONSTRAINT "LoyaltyTransaction_userId_User_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "LoyaltyTransaction" ADD CONSTRAINT "LoyaltyTransaction_orderId_Order_id_fk" FOREIGN KEY ("orderId") REFERENCES "public"."Order"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "NotificationPreference" ADD CONSTRAINT "NotificationPreference_userId_User_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_User_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ProductReview" ADD CONSTRAINT "ProductReview_productId_Product_id_fk" FOREIGN KEY ("productId") REFERENCES "public"."Product"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ProductReview" ADD CONSTRAINT "ProductReview_userId_User_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "Referral" ADD CONSTRAINT "Referral_referrerUserId_User_id_fk" FOREIGN KEY ("referrerUserId") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "Referral" ADD CONSTRAINT "Referral_refereeUserId_User_id_fk" FOREIGN KEY ("refereeUserId") REFERENCES "public"."User"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ServerInstance" ADD CONSTRAINT "ServerInstance_orderItemId_OrderItem_id_fk" FOREIGN KEY ("orderItemId") REFERENCES "public"."OrderItem"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ServerInstance" ADD CONSTRAINT "ServerInstance_userId_User_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "SupportMessage" ADD CONSTRAINT "SupportMessage_ticketId_SupportTicket_id_fk" FOREIGN KEY ("ticketId") REFERENCES "public"."SupportTicket"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "SupportMessage" ADD CONSTRAINT "SupportMessage_authorUserId_User_id_fk" FOREIGN KEY ("authorUserId") REFERENCES "public"."User"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "SupportTicket" ADD CONSTRAINT "SupportTicket_userId_User_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "SupportTicket" ADD CONSTRAINT "SupportTicket_orderId_Order_id_fk" FOREIGN KEY ("orderId") REFERENCES "public"."Order"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "UserAddress" ADD CONSTRAINT "UserAddress_userId_User_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "WalletTransaction" ADD CONSTRAINT "WalletTransaction_walletId_Wallet_id_fk" FOREIGN KEY ("walletId") REFERENCES "public"."Wallet"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "WalletTransaction" ADD CONSTRAINT "WalletTransaction_orderId_Order_id_fk" FOREIGN KEY ("orderId") REFERENCES "public"."Order"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "WalletTransaction" ADD CONSTRAINT "WalletTransaction_giftCardId_GiftCard_id_fk" FOREIGN KEY ("giftCardId") REFERENCES "public"."GiftCard"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "Wallet" ADD CONSTRAINT "Wallet_userId_User_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "WishlistItem" ADD CONSTRAINT "WishlistItem_userId_User_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "WishlistItem" ADD CONSTRAINT "WishlistItem_productId_Product_id_fk" FOREIGN KEY ("productId") REFERENCES "public"."Product"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "Coupon_code_idx" ON "Coupon" USING btree ("code");--> statement-breakpoint
CREATE INDEX "Coupon_isActive_idx" ON "Coupon" USING btree ("isActive");--> statement-breakpoint
CREATE INDEX "DomainRegistration_userId_idx" ON "DomainRegistration" USING btree ("userId");--> statement-breakpoint
CREATE INDEX "DomainRegistration_status_idx" ON "DomainRegistration" USING btree ("status");--> statement-breakpoint
CREATE INDEX "DomainRegistration_domainName_idx" ON "DomainRegistration" USING btree ("domainName");--> statement-breakpoint
CREATE INDEX "GiftCard_code_idx" ON "GiftCard" USING btree ("code");--> statement-breakpoint
CREATE INDEX "GiftCard_status_idx" ON "GiftCard" USING btree ("status");--> statement-breakpoint
CREATE INDEX "LoyaltyAccount_userId_idx" ON "LoyaltyAccount" USING btree ("userId");--> statement-breakpoint
CREATE INDEX "LoyaltyTransaction_userId_idx" ON "LoyaltyTransaction" USING btree ("userId");--> statement-breakpoint
CREATE INDEX "NewsletterSubscriber_createdAt_idx" ON "NewsletterSubscriber" USING btree ("createdAt");--> statement-breakpoint
CREATE INDEX "NotificationPreference_userId_idx" ON "NotificationPreference" USING btree ("userId");--> statement-breakpoint
CREATE INDEX "Notification_userId_createdAt_idx" ON "Notification" USING btree ("userId","createdAt");--> statement-breakpoint
CREATE INDEX "Notification_userId_readAt_idx" ON "Notification" USING btree ("userId","readAt");--> statement-breakpoint
CREATE INDEX "ProductReview_productId_status_idx" ON "ProductReview" USING btree ("productId","status");--> statement-breakpoint
CREATE INDEX "ProductReview_userId_idx" ON "ProductReview" USING btree ("userId");--> statement-breakpoint
CREATE UNIQUE INDEX "ProductReview_productId_userId_key" ON "ProductReview" USING btree ("productId","userId");--> statement-breakpoint
CREATE INDEX "Referral_referrerUserId_idx" ON "Referral" USING btree ("referrerUserId");--> statement-breakpoint
CREATE INDEX "ServerInstance_userId_idx" ON "ServerInstance" USING btree ("userId");--> statement-breakpoint
CREATE INDEX "ServerInstance_status_idx" ON "ServerInstance" USING btree ("status");--> statement-breakpoint
CREATE INDEX "SupportMessage_ticketId_idx" ON "SupportMessage" USING btree ("ticketId");--> statement-breakpoint
CREATE INDEX "SupportTicket_userId_idx" ON "SupportTicket" USING btree ("userId");--> statement-breakpoint
CREATE INDEX "SupportTicket_status_idx" ON "SupportTicket" USING btree ("status");--> statement-breakpoint
CREATE INDEX "UserAddress_userId_idx" ON "UserAddress" USING btree ("userId");--> statement-breakpoint
CREATE INDEX "WalletTransaction_walletId_idx" ON "WalletTransaction" USING btree ("walletId");--> statement-breakpoint
CREATE INDEX "Wallet_userId_idx" ON "Wallet" USING btree ("userId");--> statement-breakpoint
CREATE UNIQUE INDEX "WishlistItem_userId_productId_key" ON "WishlistItem" USING btree ("userId","productId");--> statement-breakpoint
CREATE INDEX "WishlistItem_userId_idx" ON "WishlistItem" USING btree ("userId");--> statement-breakpoint
ALTER TABLE "User" ADD CONSTRAINT "User_referredByUserId_User_id_fk" FOREIGN KEY ("referredByUserId") REFERENCES "public"."User"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "User_referredByUserId_idx" ON "User" USING btree ("referredByUserId");--> statement-breakpoint
ALTER TABLE "User" ADD CONSTRAINT "User_referralCode_unique" UNIQUE("referralCode");