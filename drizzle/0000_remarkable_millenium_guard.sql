CREATE TYPE "public"."cart_status" AS ENUM('ACTIVE', 'ORDERED', 'ABANDONED');--> statement-breakpoint
CREATE TYPE "public"."home_block_source" AS ENUM('MANUAL', 'DYNAMIC');--> statement-breakpoint
CREATE TYPE "public"."home_block_type" AS ENUM('SHOWCASE', 'SHOWCASE_RANDOM', 'SHOWCASE_HERO', 'SHOWCASE_HERO_NO_PRODUCT_INFO', 'LEFT_TO_RIGHT_GALLERY', 'FULLSCREEN_HORIZONTAL_GALLERY');--> statement-breakpoint
CREATE TYPE "public"."inventory_status" AS ENUM('AVAILABLE', 'RESERVED', 'SOLD', 'DAMAGED');--> statement-breakpoint
CREATE TYPE "public"."order_status" AS ENUM('PENDING', 'PAID', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED', 'REFUNDED');--> statement-breakpoint
CREATE TYPE "public"."payment_status" AS ENUM('UNPAID', 'AUTHORIZED', 'PAID', 'FAILED', 'REFUNDED');--> statement-breakpoint
CREATE TYPE "public"."product_status" AS ENUM('DRAFT', 'ACTIVE', 'DISABLED', 'ARCHIVED');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('CUSTOMER', 'ADMIN');--> statement-breakpoint
CREATE TABLE "CartItem" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cartId" uuid NOT NULL,
	"variantId" uuid NOT NULL,
	"quantity" integer DEFAULT 1 NOT NULL,
	"unitPrice" numeric(12, 2) NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "Cart" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"userId" uuid,
	"anonymousId" text,
	"status" "cart_status" DEFAULT 'ACTIVE' NOT NULL,
	"currency" text DEFAULT 'IRR' NOT NULL,
	"subtotalAmount" numeric(12, 2) DEFAULT '0' NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "Category" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"titleFa" text NOT NULL,
	"descriptionFa" text,
	"parentId" uuid,
	"isVisible" boolean DEFAULT true NOT NULL,
	"sortOrder" integer DEFAULT 0 NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "Category_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "HomeBlockItem" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"blockId" uuid NOT NULL,
	"productId" uuid NOT NULL,
	"sortOrder" integer DEFAULT 0 NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "HomeBlock" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"titleFa" text NOT NULL,
	"subtitleFa" text,
	"type" "home_block_type" NOT NULL,
	"source" "home_block_source" DEFAULT 'MANUAL' NOT NULL,
	"isActive" boolean DEFAULT true NOT NULL,
	"sortOrder" integer DEFAULT 0 NOT NULL,
	"categoryId" uuid,
	"tagId" uuid,
	"sortKey" text DEFAULT 'newest' NOT NULL,
	"maxItems" integer DEFAULT 12 NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "InventoryUnit" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"variantId" uuid NOT NULL,
	"code" text NOT NULL,
	"status" "inventory_status" DEFAULT 'AVAILABLE' NOT NULL,
	"reservedAt" timestamp,
	"soldAt" timestamp,
	"userId" uuid,
	"orderId" uuid,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "InventoryUnit_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "LoginOtp" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"phone" text NOT NULL,
	"codeHash" text NOT NULL,
	"expiresAt" timestamp NOT NULL,
	"consumedAt" timestamp,
	"attempts" integer DEFAULT 0 NOT NULL,
	"provider" text DEFAULT 'kavenegar' NOT NULL,
	"providerStatus" text,
	"providerMessage" text,
	"providerPayload" jsonb,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"userId" uuid
);
--> statement-breakpoint
CREATE TABLE "OrderItem" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"orderId" uuid NOT NULL,
	"variantId" uuid,
	"titleFa" text NOT NULL,
	"sku" text NOT NULL,
	"colorNameFa" text NOT NULL,
	"materialNameFa" text NOT NULL,
	"size" text NOT NULL,
	"quantity" integer NOT NULL,
	"unitPrice" numeric(12, 2) NOT NULL,
	"totalPrice" numeric(12, 2) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "Order" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"orderNumber" text NOT NULL,
	"userId" uuid,
	"status" "order_status" DEFAULT 'PENDING' NOT NULL,
	"paymentStatus" "payment_status" DEFAULT 'UNPAID' NOT NULL,
	"currency" text DEFAULT 'IRR' NOT NULL,
	"subtotalAmount" numeric(12, 2) NOT NULL,
	"shippingAmount" numeric(12, 2) DEFAULT '0' NOT NULL,
	"discountAmount" numeric(12, 2) DEFAULT '0' NOT NULL,
	"totalAmount" numeric(12, 2) NOT NULL,
	"customerName" text,
	"customerPhone" text,
	"addressLine" text,
	"city" text,
	"province" text,
	"postalCode" text,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "Order_orderNumber_unique" UNIQUE("orderNumber")
);
--> statement-breakpoint
CREATE TABLE "Payment" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"userId" uuid,
	"orderId" uuid,
	"status" "payment_status" DEFAULT 'UNPAID' NOT NULL,
	"provider" text,
	"reference" text,
	"amount" numeric(12, 2) NOT NULL,
	"currency" text DEFAULT 'IRR' NOT NULL,
	"paidAt" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ProductImage" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"productId" uuid NOT NULL,
	"variantId" uuid,
	"url" text NOT NULL,
	"originalUrl" text,
	"altFa" text,
	"vipImage" boolean DEFAULT false NOT NULL,
	"isPrimary" boolean DEFAULT false NOT NULL,
	"showcasePublic" boolean DEFAULT false NOT NULL,
	"showcasePremium" boolean DEFAULT false NOT NULL,
	"sortOrder" integer DEFAULT 0 NOT NULL,
	"watermarkEnabled" boolean DEFAULT false NOT NULL,
	"watermarkImageId" uuid,
	"watermarkX" integer DEFAULT 0 NOT NULL,
	"watermarkY" integer DEFAULT 0 NOT NULL,
	"watermarkSize" integer DEFAULT 120 NOT NULL,
	"watermarkOpacity" integer DEFAULT 100 NOT NULL,
	"watermarkAppliedUrl" text,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ProductTag" (
	"productId" uuid NOT NULL,
	"tagId" uuid NOT NULL,
	"assignedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "ProductTag_productId_tagId_pk" PRIMARY KEY("productId","tagId")
);
--> statement-breakpoint
CREATE TABLE "ProductVariant" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"productId" uuid NOT NULL,
	"sku" text NOT NULL,
	"titleFa" text NOT NULL,
	"colorNameFa" text NOT NULL,
	"colorSlug" text NOT NULL,
	"colorHex" text,
	"materialNameFa" text NOT NULL,
	"materialSlug" text NOT NULL,
	"size" text NOT NULL,
	"publicPriceAmount" numeric(12, 2) NOT NULL,
	"registeredPriceAmount" numeric(12, 2),
	"premiumPriceAmount" numeric(12, 2),
	"compareAtAmount" numeric(12, 2),
	"isDefault" boolean DEFAULT false NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "ProductVariant_sku_unique" UNIQUE("sku")
);
--> statement-breakpoint
CREATE TABLE "Product" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"titleFa" text NOT NULL,
	"summaryFa" text,
	"descriptionFa" text,
	"fitFa" text,
	"careFa" text,
	"status" "product_status" DEFAULT 'DRAFT' NOT NULL,
	"categoryId" uuid,
	"primaryImageUrl" text,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "Product_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "Session" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"userId" uuid NOT NULL,
	"tokenHash" text NOT NULL,
	"expiresAt" timestamp NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "Session_tokenHash_unique" UNIQUE("tokenHash")
);
--> statement-breakpoint
CREATE TABLE "Tag" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"titleFa" text NOT NULL,
	"isVisible" boolean DEFAULT true NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "Tag_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "User" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text,
	"phone" text,
	"fullName" text,
	"role" "user_role" DEFAULT 'CUSTOMER' NOT NULL,
	"isPremium" boolean DEFAULT false NOT NULL,
	"premiumAt" timestamp,
	"lastLoginAt" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "User_email_unique" UNIQUE("email"),
	CONSTRAINT "User_phone_unique" UNIQUE("phone")
);
--> statement-breakpoint
CREATE TABLE "WatermarkImage" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"titleFa" text,
	"originalName" text NOT NULL,
	"url" text NOT NULL,
	"width" integer,
	"height" integer,
	"mimeType" text DEFAULT 'image/png' NOT NULL,
	"sizeBytes" integer DEFAULT 0 NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "CartItem" ADD CONSTRAINT "CartItem_cartId_Cart_id_fk" FOREIGN KEY ("cartId") REFERENCES "public"."Cart"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "CartItem" ADD CONSTRAINT "CartItem_variantId_ProductVariant_id_fk" FOREIGN KEY ("variantId") REFERENCES "public"."ProductVariant"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "Cart" ADD CONSTRAINT "Cart_userId_User_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "Category" ADD CONSTRAINT "Category_parentId_Category_id_fk" FOREIGN KEY ("parentId") REFERENCES "public"."Category"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "HomeBlockItem" ADD CONSTRAINT "HomeBlockItem_blockId_HomeBlock_id_fk" FOREIGN KEY ("blockId") REFERENCES "public"."HomeBlock"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "HomeBlockItem" ADD CONSTRAINT "HomeBlockItem_productId_Product_id_fk" FOREIGN KEY ("productId") REFERENCES "public"."Product"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "HomeBlock" ADD CONSTRAINT "HomeBlock_categoryId_Category_id_fk" FOREIGN KEY ("categoryId") REFERENCES "public"."Category"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "HomeBlock" ADD CONSTRAINT "HomeBlock_tagId_Tag_id_fk" FOREIGN KEY ("tagId") REFERENCES "public"."Tag"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "InventoryUnit" ADD CONSTRAINT "InventoryUnit_variantId_ProductVariant_id_fk" FOREIGN KEY ("variantId") REFERENCES "public"."ProductVariant"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "InventoryUnit" ADD CONSTRAINT "InventoryUnit_userId_User_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "InventoryUnit" ADD CONSTRAINT "InventoryUnit_orderId_Order_id_fk" FOREIGN KEY ("orderId") REFERENCES "public"."Order"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "LoginOtp" ADD CONSTRAINT "LoginOtp_userId_User_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_orderId_Order_id_fk" FOREIGN KEY ("orderId") REFERENCES "public"."Order"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_variantId_ProductVariant_id_fk" FOREIGN KEY ("variantId") REFERENCES "public"."ProductVariant"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "Order" ADD CONSTRAINT "Order_userId_User_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_userId_User_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_orderId_Order_id_fk" FOREIGN KEY ("orderId") REFERENCES "public"."Order"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ProductImage" ADD CONSTRAINT "ProductImage_productId_Product_id_fk" FOREIGN KEY ("productId") REFERENCES "public"."Product"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ProductImage" ADD CONSTRAINT "ProductImage_variantId_ProductVariant_id_fk" FOREIGN KEY ("variantId") REFERENCES "public"."ProductVariant"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ProductImage" ADD CONSTRAINT "ProductImage_watermarkImageId_WatermarkImage_id_fk" FOREIGN KEY ("watermarkImageId") REFERENCES "public"."WatermarkImage"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ProductTag" ADD CONSTRAINT "ProductTag_productId_Product_id_fk" FOREIGN KEY ("productId") REFERENCES "public"."Product"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ProductTag" ADD CONSTRAINT "ProductTag_tagId_Tag_id_fk" FOREIGN KEY ("tagId") REFERENCES "public"."Tag"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ProductVariant" ADD CONSTRAINT "ProductVariant_productId_Product_id_fk" FOREIGN KEY ("productId") REFERENCES "public"."Product"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "Product" ADD CONSTRAINT "Product_categoryId_Category_id_fk" FOREIGN KEY ("categoryId") REFERENCES "public"."Category"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_User_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "CartItem_cartId_variantId_key" ON "CartItem" USING btree ("cartId","variantId");--> statement-breakpoint
CREATE INDEX "CartItem_variantId_idx" ON "CartItem" USING btree ("variantId");--> statement-breakpoint
CREATE INDEX "Cart_userId_idx" ON "Cart" USING btree ("userId");--> statement-breakpoint
CREATE INDEX "Cart_anonymousId_idx" ON "Cart" USING btree ("anonymousId");--> statement-breakpoint
CREATE INDEX "Cart_status_idx" ON "Cart" USING btree ("status");--> statement-breakpoint
CREATE INDEX "Category_parentId_idx" ON "Category" USING btree ("parentId");--> statement-breakpoint
CREATE INDEX "Category_isVisible_idx" ON "Category" USING btree ("isVisible");--> statement-breakpoint
CREATE INDEX "Category_sortOrder_idx" ON "Category" USING btree ("sortOrder");--> statement-breakpoint
CREATE UNIQUE INDEX "HomeBlockItem_blockId_productId_key" ON "HomeBlockItem" USING btree ("blockId","productId");--> statement-breakpoint
CREATE INDEX "HomeBlockItem_productId_idx" ON "HomeBlockItem" USING btree ("productId");--> statement-breakpoint
CREATE INDEX "HomeBlockItem_blockId_sortOrder_idx" ON "HomeBlockItem" USING btree ("blockId","sortOrder");--> statement-breakpoint
CREATE INDEX "HomeBlock_isActive_sortOrder_idx" ON "HomeBlock" USING btree ("isActive","sortOrder");--> statement-breakpoint
CREATE INDEX "HomeBlock_categoryId_idx" ON "HomeBlock" USING btree ("categoryId");--> statement-breakpoint
CREATE INDEX "HomeBlock_tagId_idx" ON "HomeBlock" USING btree ("tagId");--> statement-breakpoint
CREATE INDEX "InventoryUnit_variantId_status_idx" ON "InventoryUnit" USING btree ("variantId","status");--> statement-breakpoint
CREATE INDEX "InventoryUnit_userId_idx" ON "InventoryUnit" USING btree ("userId");--> statement-breakpoint
CREATE INDEX "InventoryUnit_orderId_idx" ON "InventoryUnit" USING btree ("orderId");--> statement-breakpoint
CREATE INDEX "LoginOtp_phone_createdAt_idx" ON "LoginOtp" USING btree ("phone","createdAt");--> statement-breakpoint
CREATE INDEX "LoginOtp_expiresAt_idx" ON "LoginOtp" USING btree ("expiresAt");--> statement-breakpoint
CREATE INDEX "OrderItem_orderId_idx" ON "OrderItem" USING btree ("orderId");--> statement-breakpoint
CREATE INDEX "OrderItem_variantId_idx" ON "OrderItem" USING btree ("variantId");--> statement-breakpoint
CREATE INDEX "Order_userId_idx" ON "Order" USING btree ("userId");--> statement-breakpoint
CREATE INDEX "Order_status_idx" ON "Order" USING btree ("status");--> statement-breakpoint
CREATE INDEX "Order_createdAt_idx" ON "Order" USING btree ("createdAt");--> statement-breakpoint
CREATE INDEX "Payment_userId_idx" ON "Payment" USING btree ("userId");--> statement-breakpoint
CREATE INDEX "Payment_orderId_idx" ON "Payment" USING btree ("orderId");--> statement-breakpoint
CREATE INDEX "Payment_status_idx" ON "Payment" USING btree ("status");--> statement-breakpoint
CREATE INDEX "ProductImage_productId_sortOrder_idx" ON "ProductImage" USING btree ("productId","sortOrder");--> statement-breakpoint
CREATE INDEX "ProductImage_variantId_idx" ON "ProductImage" USING btree ("variantId");--> statement-breakpoint
CREATE INDEX "ProductImage_watermarkImageId_idx" ON "ProductImage" USING btree ("watermarkImageId");--> statement-breakpoint
CREATE INDEX "ProductImage_vipImage_idx" ON "ProductImage" USING btree ("vipImage");--> statement-breakpoint
CREATE INDEX "ProductImage_isPrimary_idx" ON "ProductImage" USING btree ("isPrimary");--> statement-breakpoint
CREATE INDEX "ProductImage_showcasePublic_idx" ON "ProductImage" USING btree ("showcasePublic");--> statement-breakpoint
CREATE INDEX "ProductImage_showcasePremium_idx" ON "ProductImage" USING btree ("showcasePremium");--> statement-breakpoint
CREATE INDEX "ProductTag_tagId_idx" ON "ProductTag" USING btree ("tagId");--> statement-breakpoint
CREATE INDEX "ProductVariant_productId_idx" ON "ProductVariant" USING btree ("productId");--> statement-breakpoint
CREATE INDEX "ProductVariant_color_material_size_idx" ON "ProductVariant" USING btree ("colorSlug","materialSlug","size");--> statement-breakpoint
CREATE INDEX "Product_categoryId_idx" ON "Product" USING btree ("categoryId");--> statement-breakpoint
CREATE INDEX "Product_status_idx" ON "Product" USING btree ("status");--> statement-breakpoint
CREATE INDEX "Product_createdAt_idx" ON "Product" USING btree ("createdAt");--> statement-breakpoint
CREATE INDEX "Session_userId_idx" ON "Session" USING btree ("userId");--> statement-breakpoint
CREATE INDEX "Session_expiresAt_idx" ON "Session" USING btree ("expiresAt");--> statement-breakpoint
CREATE INDEX "Tag_isVisible_idx" ON "Tag" USING btree ("isVisible");--> statement-breakpoint
CREATE INDEX "User_createdAt_idx" ON "User" USING btree ("createdAt");--> statement-breakpoint
CREATE INDEX "User_role_idx" ON "User" USING btree ("role");--> statement-breakpoint
CREATE INDEX "User_isPremium_idx" ON "User" USING btree ("isPremium");--> statement-breakpoint
CREATE INDEX "WatermarkImage_createdAt_idx" ON "WatermarkImage" USING btree ("createdAt");