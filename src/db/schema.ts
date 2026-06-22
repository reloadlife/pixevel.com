import { relations } from "drizzle-orm";
import {
  type AnyPgColumn,
  boolean,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

// --- Enums -----------------------------------------------------------------

export const userRole = pgEnum("user_role", ["CUSTOMER", "ADMIN"]);

export const productStatus = pgEnum("product_status", ["DRAFT", "ACTIVE", "DISABLED", "ARCHIVED"]);

export const inventoryStatus = pgEnum("inventory_status", [
  "AVAILABLE",
  "RESERVED",
  "SOLD",
  "DAMAGED",
]);

export const homeBlockType = pgEnum("home_block_type", [
  "SHOWCASE",
  "SHOWCASE_RANDOM",
  "SHOWCASE_HERO",
  "SHOWCASE_HERO_NO_PRODUCT_INFO",
  "LEFT_TO_RIGHT_GALLERY",
  "FULLSCREEN_HORIZONTAL_GALLERY",
]);

export const homeBlockSource = pgEnum("home_block_source", ["MANUAL", "DYNAMIC"]);

export const cartStatus = pgEnum("cart_status", ["ACTIVE", "ORDERED", "ABANDONED"]);

export const orderStatus = pgEnum("order_status", [
  "PENDING",
  "PAID",
  "PROCESSING",
  "SHIPPED",
  "DELIVERED",
  "CANCELLED",
  "REFUNDED",
]);

export const paymentStatus = pgEnum("payment_status", [
  "UNPAID",
  "AUTHORIZED",
  "PAID",
  "FAILED",
  "REFUNDED",
]);

export const fulfillmentType = pgEnum("fulfillment_type", [
  "DIGITAL",
  "PHYSICAL",
  "DOMAIN",
  "SERVER",
]);

export const domainStatus = pgEnum("domain_status", ["PENDING", "REGISTERED", "FAILED", "EXPIRED"]);

export const dnsRecordType = pgEnum("dns_record_type", [
  "A",
  "AAAA",
  "CNAME",
  "MX",
  "TXT",
  "NS",
  "SRV",
  "CAA",
]);

export const serverStatus = pgEnum("server_status", [
  "PENDING",
  "ACTIVE",
  "FAILED",
  "SUSPENDED",
  "TERMINATED",
]);

export const reviewStatus = pgEnum("review_status", ["PENDING", "APPROVED", "REJECTED"]);

export const couponKind = pgEnum("coupon_kind", ["PERCENT", "FIXED"]);

export const walletTxnDirection = pgEnum("wallet_txn_direction", ["CREDIT", "DEBIT"]);

export const walletTxnReason = pgEnum("wallet_txn_reason", [
  "TOPUP",
  "PURCHASE",
  "REFUND",
  "GIFT_CARD",
  "REFERRAL_REWARD",
  "LOYALTY_REDEEM",
  "ADJUSTMENT",
]);

export const loyaltyTxnReason = pgEnum("loyalty_txn_reason", [
  "EARN",
  "REDEEM",
  "EXPIRE",
  "ADJUST",
  "REFERRAL",
]);

export const notificationType = pgEnum("notification_type", [
  "ORDER",
  "PAYMENT",
  "PROMO",
  "SYSTEM",
  "SECURITY",
]);

export const giftCardStatus = pgEnum("gift_card_status", [
  "ACTIVE",
  "REDEEMED",
  "DISABLED",
  "EXPIRED",
]);

export const referralStatus = pgEnum("referral_status", ["PENDING", "QUALIFIED", "REWARDED"]);

export const supportTicketStatus = pgEnum("support_ticket_status", [
  "OPEN",
  "PENDING",
  "RESOLVED",
  "CLOSED",
]);

// Exported string-union types (drop-in replacements for the generated Prisma enums).
export type UserRole = (typeof userRole.enumValues)[number];
export type ProductStatus = (typeof productStatus.enumValues)[number];
export type InventoryStatus = (typeof inventoryStatus.enumValues)[number];
export type HomeBlockType = (typeof homeBlockType.enumValues)[number];
export type HomeBlockSource = (typeof homeBlockSource.enumValues)[number];
export type CartStatus = (typeof cartStatus.enumValues)[number];
export type OrderStatus = (typeof orderStatus.enumValues)[number];
export type PaymentStatus = (typeof paymentStatus.enumValues)[number];
export type FulfillmentType = (typeof fulfillmentType.enumValues)[number];
export type DomainStatus = (typeof domainStatus.enumValues)[number];
export type ServerStatus = (typeof serverStatus.enumValues)[number];
export type ReviewStatus = (typeof reviewStatus.enumValues)[number];
export type CouponKind = (typeof couponKind.enumValues)[number];
export type WalletTxnDirection = (typeof walletTxnDirection.enumValues)[number];
export type WalletTxnReason = (typeof walletTxnReason.enumValues)[number];
export type LoyaltyTxnReason = (typeof loyaltyTxnReason.enumValues)[number];
export type NotificationType = (typeof notificationType.enumValues)[number];
export type GiftCardStatus = (typeof giftCardStatus.enumValues)[number];
export type ReferralStatus = (typeof referralStatus.enumValues)[number];
export type SupportTicketStatus = (typeof supportTicketStatus.enumValues)[number];

// Shared timestamp helpers (Prisma defaults: createdAt = now(), updatedAt = @updatedAt).
const createdAt = timestamp("createdAt", { mode: "date" }).defaultNow().notNull();
const updatedAt = timestamp("updatedAt", { mode: "date" })
  .defaultNow()
  .notNull()
  .$onUpdate(() => new Date());

const price = { precision: 12, scale: 2 } as const;

// --- Tables ----------------------------------------------------------------

export const users = pgTable(
  "User",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: text("email").unique(),
    phone: text("phone").unique(),
    fullName: text("fullName"),
    role: userRole("role").default("CUSTOMER").notNull(),
    isPremium: boolean("isPremium").default(false).notNull(),
    premiumAt: timestamp("premiumAt", { mode: "date" }),
    lastLoginAt: timestamp("lastLoginAt", { mode: "date" }),
    defaultAddressLine: text("defaultAddressLine"),
    defaultCity: text("defaultCity"),
    defaultProvince: text("defaultProvince"),
    defaultPostalCode: text("defaultPostalCode"),
    avatarUrl: text("avatarUrl"),
    emailVerifiedAt: timestamp("emailVerifiedAt", { mode: "date" }),
    referralCode: text("referralCode").unique(),
    referredByUserId: uuid("referredByUserId").references((): AnyPgColumn => users.id, {
      onDelete: "set null",
    }),
    createdAt,
    updatedAt,
  },
  (t) => [
    index("User_createdAt_idx").on(t.createdAt),
    index("User_role_idx").on(t.role),
    index("User_isPremium_idx").on(t.isPremium),
    index("User_referredByUserId_idx").on(t.referredByUserId),
  ],
);

export const sessions = pgTable(
  "Session",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tokenHash: text("tokenHash").notNull().unique(),
    expiresAt: timestamp("expiresAt", { mode: "date" }).notNull(),
    createdAt,
    updatedAt,
  },
  (t) => [index("Session_userId_idx").on(t.userId), index("Session_expiresAt_idx").on(t.expiresAt)],
);

export const loginOtps = pgTable(
  "LoginOtp",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    phone: text("phone").notNull(),
    codeHash: text("codeHash").notNull(),
    expiresAt: timestamp("expiresAt", { mode: "date" }).notNull(),
    consumedAt: timestamp("consumedAt", { mode: "date" }),
    attempts: integer("attempts").default(0).notNull(),
    provider: text("provider").default("kavenegar").notNull(),
    providerStatus: text("providerStatus"),
    providerMessage: text("providerMessage"),
    providerPayload: jsonb("providerPayload"),
    createdAt,
    userId: uuid("userId").references(() => users.id, { onDelete: "set null" }),
  },
  (t) => [
    index("LoginOtp_phone_createdAt_idx").on(t.phone, t.createdAt),
    index("LoginOtp_expiresAt_idx").on(t.expiresAt),
  ],
);

export const analyticsEventType = pgEnum("analytics_event_type", [
  "SEARCH",
  "PRODUCT_VIEW",
  "CATEGORY_VIEW",
  "ADD_TO_CART",
  "CHECKOUT_START",
  "PURCHASE",
  "PAGE_VIEW",
]);

export const blogStatus = pgEnum("blog_status", ["DRAFT", "PUBLISHED", "ARCHIVED"]);

/** Currency a product's prices are authored in; IRT = Toman (no conversion). */
export const baseCurrency = pgEnum("base_currency", ["IRT", "USD", "EUR"]);

export const categories = pgTable(
  "Category",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    slug: text("slug").notNull().unique(),
    titleFa: text("titleFa").notNull(),
    descriptionFa: text("descriptionFa"),
    parentId: uuid("parentId").references((): AnyPgColumn => categories.id, {
      onDelete: "set null",
    }),
    isVisible: boolean("isVisible").default(true).notNull(),
    sortOrder: integer("sortOrder").default(0).notNull(),
    /** SEO overrides (fall back to titleFa/descriptionFa when null). */
    seoTitle: text("seoTitle"),
    seoDescription: text("seoDescription"),
    ogImageUrl: text("ogImageUrl"),
    noindex: boolean("noindex").default(false).notNull(),
    createdAt,
    updatedAt,
  },
  (t) => [
    index("Category_parentId_idx").on(t.parentId),
    index("Category_isVisible_idx").on(t.isVisible),
    index("Category_sortOrder_idx").on(t.sortOrder),
  ],
);

export const tags = pgTable(
  "Tag",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    slug: text("slug").notNull().unique(),
    titleFa: text("titleFa").notNull(),
    isVisible: boolean("isVisible").default(true).notNull(),
    createdAt,
    updatedAt,
  },
  (t) => [index("Tag_isVisible_idx").on(t.isVisible)],
);

export const products = pgTable(
  "Product",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    slug: text("slug").notNull().unique(),
    titleFa: text("titleFa").notNull(),
    summaryFa: text("summaryFa"),
    descriptionFa: text("descriptionFa"),
    fitFa: text("fitFa"),
    careFa: text("careFa"),
    status: productStatus("status").default("DRAFT").notNull(),
    fulfillmentType: fulfillmentType("fulfillmentType").default("DIGITAL").notNull(),
    categoryId: uuid("categoryId").references(() => categories.id, {
      onDelete: "set null",
    }),
    primaryImageUrl: text("primaryImageUrl"),
    /** SEO overrides (fall back to titleFa/summaryFa when null). */
    seoTitle: text("seoTitle"),
    seoDescription: text("seoDescription"),
    ogImageUrl: text("ogImageUrl"),
    noindex: boolean("noindex").default(false).notNull(),
    /** Currency the variant price amounts are authored in (IRT = no conversion). */
    baseCurrency: baseCurrency("baseCurrency").default("IRT").notNull(),
    createdAt,
    updatedAt,
  },
  (t) => [
    index("Product_categoryId_idx").on(t.categoryId),
    index("Product_status_idx").on(t.status),
    index("Product_createdAt_idx").on(t.createdAt),
  ],
);

export const productTags = pgTable(
  "ProductTag",
  {
    productId: uuid("productId")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    tagId: uuid("tagId")
      .notNull()
      .references(() => tags.id, { onDelete: "cascade" }),
    assignedAt: timestamp("assignedAt", { mode: "date" }).defaultNow().notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.productId, t.tagId] }),
    index("ProductTag_tagId_idx").on(t.tagId),
  ],
);

export const productVariants = pgTable(
  "ProductVariant",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    productId: uuid("productId")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    sku: text("sku").notNull().unique(),
    titleFa: text("titleFa").notNull(),
    colorNameFa: text("colorNameFa").notNull(),
    colorSlug: text("colorSlug").notNull(),
    colorHex: text("colorHex"),
    materialNameFa: text("materialNameFa").notNull(),
    materialSlug: text("materialSlug").notNull(),
    size: text("size").notNull(),
    publicPriceAmount: numeric("publicPriceAmount", price).notNull(),
    registeredPriceAmount: numeric("registeredPriceAmount", price),
    premiumPriceAmount: numeric("premiumPriceAmount", price),
    compareAtAmount: numeric("compareAtAmount", price),
    isDefault: boolean("isDefault").default(false).notNull(),
    /** World-specific data: domain { domainName, tld, years }, server { planCode, cpu, ram, diskGb, periodMonths }. */
    metadata: jsonb("metadata"),
    createdAt,
    updatedAt,
  },
  (t) => [
    index("ProductVariant_productId_idx").on(t.productId),
    index("ProductVariant_color_material_size_idx").on(t.colorSlug, t.materialSlug, t.size),
  ],
);

export const inventoryUnits = pgTable(
  "InventoryUnit",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    variantId: uuid("variantId")
      .notNull()
      .references(() => productVariants.id, { onDelete: "cascade" }),
    code: text("code").notNull().unique(),
    status: inventoryStatus("status").default("AVAILABLE").notNull(),
    reservedAt: timestamp("reservedAt", { mode: "date" }),
    soldAt: timestamp("soldAt", { mode: "date" }),
    userId: uuid("userId").references(() => users.id, { onDelete: "set null" }),
    orderId: uuid("orderId").references(() => orders.id, { onDelete: "set null" }),
    createdAt,
    updatedAt,
  },
  (t) => [
    index("InventoryUnit_variantId_status_idx").on(t.variantId, t.status),
    index("InventoryUnit_userId_idx").on(t.userId),
    index("InventoryUnit_orderId_idx").on(t.orderId),
  ],
);

export const productImages = pgTable(
  "ProductImage",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    productId: uuid("productId")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    variantId: uuid("variantId").references(() => productVariants.id, {
      onDelete: "set null",
    }),
    url: text("url").notNull(),
    originalUrl: text("originalUrl"),
    altFa: text("altFa"),
    vipImage: boolean("vipImage").default(false).notNull(),
    isPrimary: boolean("isPrimary").default(false).notNull(),
    showcasePublic: boolean("showcasePublic").default(false).notNull(),
    showcasePremium: boolean("showcasePremium").default(false).notNull(),
    sortOrder: integer("sortOrder").default(0).notNull(),
    watermarkEnabled: boolean("watermarkEnabled").default(false).notNull(),
    watermarkImageId: uuid("watermarkImageId").references(() => watermarkImages.id, {
      onDelete: "set null",
    }),
    watermarkX: integer("watermarkX").default(0).notNull(),
    watermarkY: integer("watermarkY").default(0).notNull(),
    watermarkSize: integer("watermarkSize").default(120).notNull(),
    watermarkOpacity: integer("watermarkOpacity").default(100).notNull(),
    watermarkAppliedUrl: text("watermarkAppliedUrl"),
    createdAt,
    updatedAt,
  },
  (t) => [
    index("ProductImage_productId_sortOrder_idx").on(t.productId, t.sortOrder),
    index("ProductImage_variantId_idx").on(t.variantId),
    index("ProductImage_watermarkImageId_idx").on(t.watermarkImageId),
    index("ProductImage_vipImage_idx").on(t.vipImage),
    index("ProductImage_isPrimary_idx").on(t.isPrimary),
    index("ProductImage_showcasePublic_idx").on(t.showcasePublic),
    index("ProductImage_showcasePremium_idx").on(t.showcasePremium),
  ],
);

export const watermarkImages = pgTable(
  "WatermarkImage",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    titleFa: text("titleFa"),
    originalName: text("originalName").notNull(),
    url: text("url").notNull(),
    width: integer("width"),
    height: integer("height"),
    mimeType: text("mimeType").default("image/png").notNull(),
    sizeBytes: integer("sizeBytes").default(0).notNull(),
    createdAt,
    updatedAt,
  },
  (t) => [index("WatermarkImage_createdAt_idx").on(t.createdAt)],
);

export const homeBlocks = pgTable(
  "HomeBlock",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    titleFa: text("titleFa").notNull(),
    subtitleFa: text("subtitleFa"),
    type: homeBlockType("type").notNull(),
    source: homeBlockSource("source").default("MANUAL").notNull(),
    isActive: boolean("isActive").default(true).notNull(),
    sortOrder: integer("sortOrder").default(0).notNull(),
    categoryId: uuid("categoryId").references(() => categories.id, {
      onDelete: "set null",
    }),
    tagId: uuid("tagId").references(() => tags.id, { onDelete: "set null" }),
    sortKey: text("sortKey").default("newest").notNull(),
    maxItems: integer("maxItems").default(12).notNull(),
    createdAt,
    updatedAt,
  },
  (t) => [
    index("HomeBlock_isActive_sortOrder_idx").on(t.isActive, t.sortOrder),
    index("HomeBlock_categoryId_idx").on(t.categoryId),
    index("HomeBlock_tagId_idx").on(t.tagId),
  ],
);

export const homeBlockItems = pgTable(
  "HomeBlockItem",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    blockId: uuid("blockId")
      .notNull()
      .references(() => homeBlocks.id, { onDelete: "cascade" }),
    productId: uuid("productId")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    sortOrder: integer("sortOrder").default(0).notNull(),
    createdAt,
  },
  (t) => [
    uniqueIndex("HomeBlockItem_blockId_productId_key").on(t.blockId, t.productId),
    index("HomeBlockItem_productId_idx").on(t.productId),
    index("HomeBlockItem_blockId_sortOrder_idx").on(t.blockId, t.sortOrder),
  ],
);

export const carts = pgTable(
  "Cart",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("userId").references(() => users.id, { onDelete: "set null" }),
    anonymousId: text("anonymousId"),
    status: cartStatus("status").default("ACTIVE").notNull(),
    currency: text("currency").default("IRR").notNull(),
    subtotalAmount: numeric("subtotalAmount", price).default("0").notNull(),
    createdAt,
    updatedAt,
  },
  (t) => [
    index("Cart_userId_idx").on(t.userId),
    index("Cart_anonymousId_idx").on(t.anonymousId),
    index("Cart_status_idx").on(t.status),
  ],
);

export const cartItems = pgTable(
  "CartItem",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    cartId: uuid("cartId")
      .notNull()
      .references(() => carts.id, { onDelete: "cascade" }),
    variantId: uuid("variantId")
      .notNull()
      .references(() => productVariants.id, { onDelete: "restrict" }),
    quantity: integer("quantity").default(1).notNull(),
    unitPrice: numeric("unitPrice", price).notNull(),
    createdAt,
    updatedAt,
  },
  (t) => [
    uniqueIndex("CartItem_cartId_variantId_key").on(t.cartId, t.variantId),
    index("CartItem_variantId_idx").on(t.variantId),
  ],
);

export const orders = pgTable(
  "Order",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orderNumber: text("orderNumber").notNull().unique(),
    userId: uuid("userId").references(() => users.id, { onDelete: "set null" }),
    status: orderStatus("status").default("PENDING").notNull(),
    paymentStatus: paymentStatus("paymentStatus").default("UNPAID").notNull(),
    currency: text("currency").default("IRR").notNull(),
    subtotalAmount: numeric("subtotalAmount", price).notNull(),
    shippingAmount: numeric("shippingAmount", price).default("0").notNull(),
    discountAmount: numeric("discountAmount", price).default("0").notNull(),
    totalAmount: numeric("totalAmount", price).notNull(),
    customerName: text("customerName"),
    customerPhone: text("customerPhone"),
    customerEmail: text("customerEmail"),
    recipientEmail: text("recipientEmail"),
    recipientPhone: text("recipientPhone"),
    giftMessage: text("giftMessage"),
    couponCode: text("couponCode"),
    addressLine: text("addressLine"),
    city: text("city"),
    province: text("province"),
    postalCode: text("postalCode"),
    createdAt,
    updatedAt,
  },
  (t) => [
    index("Order_userId_idx").on(t.userId),
    index("Order_status_idx").on(t.status),
    index("Order_createdAt_idx").on(t.createdAt),
  ],
);

export const orderItems = pgTable(
  "OrderItem",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orderId: uuid("orderId")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    variantId: uuid("variantId").references(() => productVariants.id, {
      onDelete: "set null",
    }),
    titleFa: text("titleFa").notNull(),
    sku: text("sku").notNull(),
    colorNameFa: text("colorNameFa").notNull(),
    materialNameFa: text("materialNameFa").notNull(),
    size: text("size").notNull(),
    quantity: integer("quantity").notNull(),
    unitPrice: numeric("unitPrice", price).notNull(),
    totalPrice: numeric("totalPrice", price).notNull(),
    fulfillmentType: fulfillmentType("fulfillmentType").default("DIGITAL").notNull(),
    /** World-specific data carried from the variant (domain / server). */
    metadata: jsonb("metadata"),
  },
  (t) => [
    index("OrderItem_orderId_idx").on(t.orderId),
    index("OrderItem_variantId_idx").on(t.variantId),
  ],
);

export const payments = pgTable(
  "Payment",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("userId").references(() => users.id, { onDelete: "set null" }),
    orderId: uuid("orderId").references(() => orders.id, { onDelete: "set null" }),
    status: paymentStatus("status").default("UNPAID").notNull(),
    provider: text("provider"),
    reference: text("reference"),
    receiptUrl: text("receiptUrl"),
    amount: numeric("amount", price).notNull(),
    currency: text("currency").default("IRR").notNull(),
    paidAt: timestamp("paidAt", { mode: "date" }),
    createdAt,
    updatedAt,
  },
  (t) => [
    index("Payment_userId_idx").on(t.userId),
    index("Payment_orderId_idx").on(t.orderId),
    index("Payment_status_idx").on(t.status),
  ],
);

export const productReviews = pgTable(
  "ProductReview",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    productId: uuid("productId")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    userId: uuid("userId").references(() => users.id, { onDelete: "set null" }),
    authorName: text("authorName"),
    rating: integer("rating").notNull(),
    titleFa: text("titleFa"),
    bodyFa: text("bodyFa").notNull(),
    status: reviewStatus("status").default("APPROVED").notNull(),
    createdAt,
    updatedAt,
  },
  (t) => [
    index("ProductReview_productId_status_idx").on(t.productId, t.status),
    index("ProductReview_userId_idx").on(t.userId),
    uniqueIndex("ProductReview_productId_userId_key").on(t.productId, t.userId),
  ],
);

export const coupons = pgTable(
  "Coupon",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    code: text("code").notNull().unique(),
    kind: couponKind("kind").notNull(),
    value: numeric("value", price).notNull(),
    isActive: boolean("isActive").default(true).notNull(),
    minSubtotalAmount: numeric("minSubtotalAmount", price),
    maxDiscountAmount: numeric("maxDiscountAmount", price),
    usageLimit: integer("usageLimit"),
    usedCount: integer("usedCount").default(0).notNull(),
    startsAt: timestamp("startsAt", { mode: "date" }),
    expiresAt: timestamp("expiresAt", { mode: "date" }),
    createdAt,
    updatedAt,
  },
  (t) => [index("Coupon_code_idx").on(t.code), index("Coupon_isActive_idx").on(t.isActive)],
);

export const newsletterSubscribers = pgTable(
  "NewsletterSubscriber",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: text("email").notNull().unique(),
    isActive: boolean("isActive").default(true).notNull(),
    unsubscribedAt: timestamp("unsubscribedAt", { mode: "date" }),
    createdAt,
    updatedAt,
  },
  (t) => [index("NewsletterSubscriber_createdAt_idx").on(t.createdAt)],
);

export const domainRegistrations = pgTable(
  "DomainRegistration",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orderItemId: uuid("orderItemId").references(() => orderItems.id, { onDelete: "set null" }),
    userId: uuid("userId").references(() => users.id, { onDelete: "set null" }),
    domainName: text("domainName").notNull(),
    tld: text("tld").notNull(),
    years: integer("years").default(1).notNull(),
    status: domainStatus("status").default("PENDING").notNull(),
    registrarRef: text("registrarRef"),
    registrarPayload: jsonb("registrarPayload"),
    expiresAt: timestamp("expiresAt", { mode: "date" }),
    /** Management settings (local source of truth; best-effort push to registrar). */
    autoRenew: boolean("autoRenew").default(false).notNull(),
    transferLock: boolean("transferLock").default(true).notNull(),
    privacyProtection: boolean("privacyProtection").default(true).notNull(),
    /** Custom nameservers (string[]). Empty/null → registrar defaults. */
    nameservers: jsonb("nameservers").$type<string[]>(),
    /** EPP / auth code for outbound transfers. */
    authCode: text("authCode"),
    /** Registrant contact snapshot { firstName, lastName, email, phone, org?, address? }. */
    registrantContact: jsonb("registrantContact"),
    /** Last time state was reconciled from the registrar. */
    lastSyncedAt: timestamp("lastSyncedAt", { mode: "date" }),
    createdAt,
    updatedAt,
  },
  (t) => [
    index("DomainRegistration_userId_idx").on(t.userId),
    index("DomainRegistration_status_idx").on(t.status),
    index("DomainRegistration_domainName_idx").on(t.domainName),
  ],
);

export const domainDnsRecords = pgTable(
  "DomainDnsRecord",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    domainId: uuid("domainId")
      .notNull()
      .references(() => domainRegistrations.id, { onDelete: "cascade" }),
    type: dnsRecordType("type").notNull(),
    /** Host/subdomain, e.g. "@" for the apex or "www". */
    name: text("name").notNull(),
    /** Record value (IP, hostname, text…). */
    value: text("value").notNull(),
    ttl: integer("ttl").default(3600).notNull(),
    /** Priority for MX / SRV records. */
    priority: integer("priority"),
    createdAt,
    updatedAt,
  },
  (t) => [index("DomainDnsRecord_domainId_idx").on(t.domainId)],
);

export const serverInstances = pgTable(
  "ServerInstance",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orderItemId: uuid("orderItemId").references(() => orderItems.id, { onDelete: "set null" }),
    userId: uuid("userId").references(() => users.id, { onDelete: "set null" }),
    planCode: text("planCode").notNull(),
    specs: jsonb("specs"),
    status: serverStatus("status").default("PENDING").notNull(),
    providerRef: text("providerRef"),
    providerPayload: jsonb("providerPayload"),
    ipAddress: text("ipAddress"),
    periodMonths: integer("periodMonths").default(1).notNull(),
    expiresAt: timestamp("expiresAt", { mode: "date" }),
    createdAt,
    updatedAt,
  },
  (t) => [
    index("ServerInstance_userId_idx").on(t.userId),
    index("ServerInstance_status_idx").on(t.status),
  ],
);

export const userAddresses = pgTable(
  "UserAddress",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    titleFa: text("titleFa"),
    fullName: text("fullName"),
    phone: text("phone"),
    province: text("province"),
    city: text("city"),
    addressLine: text("addressLine"),
    postalCode: text("postalCode"),
    isDefault: boolean("isDefault").default(false).notNull(),
    createdAt,
    updatedAt,
  },
  (t) => [index("UserAddress_userId_idx").on(t.userId)],
);

export const wishlistItems = pgTable(
  "WishlistItem",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    productId: uuid("productId")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    createdAt,
  },
  (t) => [
    uniqueIndex("WishlistItem_userId_productId_key").on(t.userId, t.productId),
    index("WishlistItem_userId_idx").on(t.userId),
  ],
);

export const wallets = pgTable(
  "Wallet",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("userId")
      .notNull()
      .unique()
      .references(() => users.id, { onDelete: "cascade" }),
    balanceAmount: numeric("balanceAmount", price).default("0").notNull(),
    currency: text("currency").default("IRR").notNull(),
    createdAt,
    updatedAt,
  },
  (t) => [index("Wallet_userId_idx").on(t.userId)],
);

export const giftCards = pgTable(
  "GiftCard",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    code: text("code").notNull().unique(),
    initialAmount: numeric("initialAmount", price).notNull(),
    balanceAmount: numeric("balanceAmount", price).notNull(),
    currency: text("currency").default("IRR").notNull(),
    status: giftCardStatus("status").default("ACTIVE").notNull(),
    issuedToUserId: uuid("issuedToUserId").references(() => users.id, { onDelete: "set null" }),
    redeemedByUserId: uuid("redeemedByUserId").references(() => users.id, { onDelete: "set null" }),
    redeemedAt: timestamp("redeemedAt", { mode: "date" }),
    expiresAt: timestamp("expiresAt", { mode: "date" }),
    createdAt,
    updatedAt,
  },
  (t) => [index("GiftCard_code_idx").on(t.code), index("GiftCard_status_idx").on(t.status)],
);

export const walletTransactions = pgTable(
  "WalletTransaction",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    walletId: uuid("walletId")
      .notNull()
      .references(() => wallets.id, { onDelete: "cascade" }),
    direction: walletTxnDirection("direction").notNull(),
    reason: walletTxnReason("reason").notNull(),
    amount: numeric("amount", price).notNull(),
    balanceAfter: numeric("balanceAfter", price).notNull(),
    orderId: uuid("orderId").references(() => orders.id, { onDelete: "set null" }),
    giftCardId: uuid("giftCardId").references(() => giftCards.id, { onDelete: "set null" }),
    note: text("note"),
    createdAt,
  },
  (t) => [index("WalletTransaction_walletId_idx").on(t.walletId)],
);

export const loyaltyAccounts = pgTable(
  "LoyaltyAccount",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("userId")
      .notNull()
      .unique()
      .references(() => users.id, { onDelete: "cascade" }),
    pointsBalance: integer("pointsBalance").default(0).notNull(),
    lifetimePoints: integer("lifetimePoints").default(0).notNull(),
    tier: text("tier").default("BRONZE").notNull(),
    createdAt,
    updatedAt,
  },
  (t) => [index("LoyaltyAccount_userId_idx").on(t.userId)],
);

export const loyaltyTransactions = pgTable(
  "LoyaltyTransaction",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    points: integer("points").notNull(),
    reason: loyaltyTxnReason("reason").notNull(),
    orderId: uuid("orderId").references(() => orders.id, { onDelete: "set null" }),
    note: text("note"),
    createdAt,
  },
  (t) => [index("LoyaltyTransaction_userId_idx").on(t.userId)],
);

export const referrals = pgTable(
  "Referral",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    referrerUserId: uuid("referrerUserId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    refereeUserId: uuid("refereeUserId").references(() => users.id, { onDelete: "set null" }),
    refereePhone: text("refereePhone"),
    status: referralStatus("status").default("PENDING").notNull(),
    rewardPoints: integer("rewardPoints").default(0).notNull(),
    rewardedAt: timestamp("rewardedAt", { mode: "date" }),
    createdAt,
    updatedAt,
  },
  (t) => [index("Referral_referrerUserId_idx").on(t.referrerUserId)],
);

export const notifications = pgTable(
  "Notification",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: notificationType("type").notNull(),
    titleFa: text("titleFa").notNull(),
    bodyFa: text("bodyFa"),
    href: text("href"),
    readAt: timestamp("readAt", { mode: "date" }),
    createdAt,
  },
  (t) => [
    index("Notification_userId_createdAt_idx").on(t.userId, t.createdAt),
    index("Notification_userId_readAt_idx").on(t.userId, t.readAt),
  ],
);

export const notificationPreferences = pgTable(
  "NotificationPreference",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("userId")
      .notNull()
      .unique()
      .references(() => users.id, { onDelete: "cascade" }),
    orderEmail: boolean("orderEmail").default(true).notNull(),
    orderSms: boolean("orderSms").default(true).notNull(),
    promoEmail: boolean("promoEmail").default(false).notNull(),
    promoSms: boolean("promoSms").default(false).notNull(),
    newsletterEmail: boolean("newsletterEmail").default(false).notNull(),
    createdAt,
    updatedAt,
  },
  (t) => [index("NotificationPreference_userId_idx").on(t.userId)],
);

export const supportTickets = pgTable(
  "SupportTicket",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    orderId: uuid("orderId").references(() => orders.id, { onDelete: "set null" }),
    subjectFa: text("subjectFa").notNull(),
    status: supportTicketStatus("status").default("OPEN").notNull(),
    lastMessageAt: timestamp("lastMessageAt", { mode: "date" }),
    createdAt,
    updatedAt,
  },
  (t) => [
    index("SupportTicket_userId_idx").on(t.userId),
    index("SupportTicket_status_idx").on(t.status),
  ],
);

export const supportMessages = pgTable(
  "SupportMessage",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ticketId: uuid("ticketId")
      .notNull()
      .references(() => supportTickets.id, { onDelete: "cascade" }),
    authorUserId: uuid("authorUserId").references(() => users.id, { onDelete: "set null" }),
    isStaff: boolean("isStaff").default(false).notNull(),
    bodyFa: text("bodyFa").notNull(),
    createdAt,
  },
  (t) => [index("SupportMessage_ticketId_idx").on(t.ticketId)],
);

// --- Relations -------------------------------------------------------------

export const analyticsEvents = pgTable(
  "AnalyticsEvent",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    type: analyticsEventType("type").notNull(),
    userId: uuid("userId").references(() => users.id, { onDelete: "set null" }),
    /** Anonymous visitor id (cookie) — lets us count unique visitors PII-free. */
    anonId: text("anonId"),
    sessionId: text("sessionId"),
    productId: uuid("productId").references(() => products.id, { onDelete: "set null" }),
    categoryId: uuid("categoryId").references(() => categories.id, { onDelete: "set null" }),
    /** Search term (SEARCH events). */
    query: text("query"),
    /** Result count for SEARCH (0 = zero-result search worth surfacing). */
    resultCount: integer("resultCount"),
    path: text("path"),
    referrer: text("referrer"),
    metadata: jsonb("metadata"),
    createdAt,
  },
  (t) => [
    index("AnalyticsEvent_type_createdAt_idx").on(t.type, t.createdAt),
    index("AnalyticsEvent_createdAt_idx").on(t.createdAt),
    index("AnalyticsEvent_anonId_idx").on(t.anonId),
    index("AnalyticsEvent_productId_idx").on(t.productId),
    index("AnalyticsEvent_categoryId_idx").on(t.categoryId),
    index("AnalyticsEvent_query_idx").on(t.query),
  ],
);

export const blogPosts = pgTable(
  "BlogPost",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    slug: text("slug").notNull().unique(),
    titleFa: text("titleFa").notNull(),
    excerptFa: text("excerptFa"),
    bodyFa: text("bodyFa").notNull(),
    coverImageUrl: text("coverImageUrl"),
    status: blogStatus("status").default("DRAFT").notNull(),
    authorUserId: uuid("authorUserId").references(() => users.id, { onDelete: "set null" }),
    /** Free-form tag slugs (string[]). */
    tags: jsonb("tags").$type<string[]>(),
    publishedAt: timestamp("publishedAt", { mode: "date" }),
    seoTitle: text("seoTitle"),
    seoDescription: text("seoDescription"),
    ogImageUrl: text("ogImageUrl"),
    noindex: boolean("noindex").default(false).notNull(),
    createdAt,
    updatedAt,
  },
  (t) => [
    index("BlogPost_status_publishedAt_idx").on(t.status, t.publishedAt),
    index("BlogPost_slug_idx").on(t.slug),
  ],
);

export const exchangeRates = pgTable("ExchangeRate", {
  id: uuid("id").primaryKey().defaultRandom(),
  /** "USD" | "EUR" — the foreign currency this rate converts FROM. */
  currency: text("currency").notNull().unique(),
  /** How many Toman one unit of `currency` is worth. */
  rateToman: numeric("rateToman", price).notNull(),
  updatedByUserId: uuid("updatedByUserId").references(() => users.id, { onDelete: "set null" }),
  updatedAt,
});

/**
 * Admin-editable runtime configuration (replaces most env vars). `value` holds
 * plaintext for normal config and an AES-256-GCM blob when `isSecret` is true.
 * The registry of valid keys + metadata lives in `src/lib/settings.ts`.
 */
export const appSettings = pgTable("AppSetting", {
  key: text("key").primaryKey(),
  value: text("value"),
  isSecret: boolean("isSecret").default(false).notNull(),
  updatedByUserId: uuid("updatedByUserId").references(() => users.id, { onDelete: "set null" }),
  updatedAt,
});
export type AppSetting = typeof appSettings.$inferSelect;

export const usersRelations = relations(users, ({ one, many }) => ({
  carts: many(carts),
  orders: many(orders),
  sessions: many(sessions),
  loginOtps: many(loginOtps),
  inventoryUnits: many(inventoryUnits),
  payments: many(payments),
  reviews: many(productReviews),
  addresses: many(userAddresses),
  wishlistItems: many(wishlistItems),
  notifications: many(notifications),
  referralsMade: many(referrals),
  supportTickets: many(supportTickets),
  loyaltyTransactions: many(loyaltyTransactions),
  wallet: one(wallets),
  loyaltyAccount: one(loyaltyAccounts),
  notificationPreferences: one(notificationPreferences),
  referredBy: one(users, {
    fields: [users.referredByUserId],
    references: [users.id],
    relationName: "UserReferral",
  }),
  referredUsers: many(users, { relationName: "UserReferral" }),
}));

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, { fields: [sessions.userId], references: [users.id] }),
}));

export const loginOtpsRelations = relations(loginOtps, ({ one }) => ({
  user: one(users, { fields: [loginOtps.userId], references: [users.id] }),
}));

export const categoriesRelations = relations(categories, ({ one, many }) => ({
  parent: one(categories, {
    fields: [categories.parentId],
    references: [categories.id],
    relationName: "CategoryTree",
  }),
  children: many(categories, { relationName: "CategoryTree" }),
  products: many(products),
  homeBlocks: many(homeBlocks),
}));

export const tagsRelations = relations(tags, ({ many }) => ({
  products: many(productTags),
  homeBlocks: many(homeBlocks),
}));

export const productsRelations = relations(products, ({ one, many }) => ({
  category: one(categories, {
    fields: [products.categoryId],
    references: [categories.id],
  }),
  tags: many(productTags),
  variants: many(productVariants),
  images: many(productImages),
  homeBlockItems: many(homeBlockItems),
  reviews: many(productReviews),
}));

export const productTagsRelations = relations(productTags, ({ one }) => ({
  product: one(products, {
    fields: [productTags.productId],
    references: [products.id],
  }),
  tag: one(tags, { fields: [productTags.tagId], references: [tags.id] }),
}));

export const productVariantsRelations = relations(productVariants, ({ one, many }) => ({
  product: one(products, {
    fields: [productVariants.productId],
    references: [products.id],
  }),
  images: many(productImages),
  inventoryUnits: many(inventoryUnits),
  cartItems: many(cartItems),
  orderItems: many(orderItems),
}));

export const inventoryUnitsRelations = relations(inventoryUnits, ({ one }) => ({
  variant: one(productVariants, {
    fields: [inventoryUnits.variantId],
    references: [productVariants.id],
  }),
  user: one(users, { fields: [inventoryUnits.userId], references: [users.id] }),
  order: one(orders, { fields: [inventoryUnits.orderId], references: [orders.id] }),
}));

export const productImagesRelations = relations(productImages, ({ one }) => ({
  product: one(products, {
    fields: [productImages.productId],
    references: [products.id],
  }),
  variant: one(productVariants, {
    fields: [productImages.variantId],
    references: [productVariants.id],
  }),
  watermarkImage: one(watermarkImages, {
    fields: [productImages.watermarkImageId],
    references: [watermarkImages.id],
  }),
}));

export const watermarkImagesRelations = relations(watermarkImages, ({ many }) => ({
  productImages: many(productImages),
}));

export const homeBlocksRelations = relations(homeBlocks, ({ one, many }) => ({
  category: one(categories, {
    fields: [homeBlocks.categoryId],
    references: [categories.id],
  }),
  tag: one(tags, { fields: [homeBlocks.tagId], references: [tags.id] }),
  items: many(homeBlockItems),
}));

export const homeBlockItemsRelations = relations(homeBlockItems, ({ one }) => ({
  block: one(homeBlocks, {
    fields: [homeBlockItems.blockId],
    references: [homeBlocks.id],
  }),
  product: one(products, {
    fields: [homeBlockItems.productId],
    references: [products.id],
  }),
}));

export const cartsRelations = relations(carts, ({ one, many }) => ({
  user: one(users, { fields: [carts.userId], references: [users.id] }),
  items: many(cartItems),
}));

export const cartItemsRelations = relations(cartItems, ({ one }) => ({
  cart: one(carts, { fields: [cartItems.cartId], references: [carts.id] }),
  variant: one(productVariants, {
    fields: [cartItems.variantId],
    references: [productVariants.id],
  }),
}));

export const ordersRelations = relations(orders, ({ one, many }) => ({
  user: one(users, { fields: [orders.userId], references: [users.id] }),
  items: many(orderItems),
  payments: many(payments),
  inventoryUnits: many(inventoryUnits),
}));

export const orderItemsRelations = relations(orderItems, ({ one }) => ({
  order: one(orders, { fields: [orderItems.orderId], references: [orders.id] }),
  variant: one(productVariants, {
    fields: [orderItems.variantId],
    references: [productVariants.id],
  }),
}));

export const paymentsRelations = relations(payments, ({ one }) => ({
  user: one(users, { fields: [payments.userId], references: [users.id] }),
  order: one(orders, { fields: [payments.orderId], references: [orders.id] }),
}));

export const productReviewsRelations = relations(productReviews, ({ one }) => ({
  product: one(products, {
    fields: [productReviews.productId],
    references: [products.id],
  }),
  user: one(users, { fields: [productReviews.userId], references: [users.id] }),
}));

export const userAddressesRelations = relations(userAddresses, ({ one }) => ({
  user: one(users, { fields: [userAddresses.userId], references: [users.id] }),
}));

export const wishlistItemsRelations = relations(wishlistItems, ({ one }) => ({
  user: one(users, { fields: [wishlistItems.userId], references: [users.id] }),
  product: one(products, {
    fields: [wishlistItems.productId],
    references: [products.id],
  }),
}));

export const walletsRelations = relations(wallets, ({ one, many }) => ({
  user: one(users, { fields: [wallets.userId], references: [users.id] }),
  transactions: many(walletTransactions),
}));

export const walletTransactionsRelations = relations(walletTransactions, ({ one }) => ({
  wallet: one(wallets, {
    fields: [walletTransactions.walletId],
    references: [wallets.id],
  }),
  order: one(orders, {
    fields: [walletTransactions.orderId],
    references: [orders.id],
  }),
  giftCard: one(giftCards, {
    fields: [walletTransactions.giftCardId],
    references: [giftCards.id],
  }),
}));

export const giftCardsRelations = relations(giftCards, ({ one }) => ({
  issuedTo: one(users, {
    fields: [giftCards.issuedToUserId],
    references: [users.id],
  }),
  redeemedBy: one(users, {
    fields: [giftCards.redeemedByUserId],
    references: [users.id],
  }),
}));

export const loyaltyAccountsRelations = relations(loyaltyAccounts, ({ one }) => ({
  user: one(users, { fields: [loyaltyAccounts.userId], references: [users.id] }),
}));

export const loyaltyTransactionsRelations = relations(loyaltyTransactions, ({ one }) => ({
  user: one(users, {
    fields: [loyaltyTransactions.userId],
    references: [users.id],
  }),
  order: one(orders, {
    fields: [loyaltyTransactions.orderId],
    references: [orders.id],
  }),
}));

export const referralsRelations = relations(referrals, ({ one }) => ({
  referrer: one(users, {
    fields: [referrals.referrerUserId],
    references: [users.id],
  }),
  referee: one(users, {
    fields: [referrals.refereeUserId],
    references: [users.id],
  }),
}));

export const notificationsRelations = relations(notifications, ({ one }) => ({
  user: one(users, { fields: [notifications.userId], references: [users.id] }),
}));

export const notificationPreferencesRelations = relations(notificationPreferences, ({ one }) => ({
  user: one(users, {
    fields: [notificationPreferences.userId],
    references: [users.id],
  }),
}));

export const supportTicketsRelations = relations(supportTickets, ({ one, many }) => ({
  user: one(users, { fields: [supportTickets.userId], references: [users.id] }),
  order: one(orders, {
    fields: [supportTickets.orderId],
    references: [orders.id],
  }),
  messages: many(supportMessages),
}));

export const supportMessagesRelations = relations(supportMessages, ({ one }) => ({
  ticket: one(supportTickets, {
    fields: [supportMessages.ticketId],
    references: [supportTickets.id],
  }),
  author: one(users, {
    fields: [supportMessages.authorUserId],
    references: [users.id],
  }),
}));

export const domainRegistrationsRelations = relations(domainRegistrations, ({ one, many }) => ({
  user: one(users, { fields: [domainRegistrations.userId], references: [users.id] }),
  dnsRecords: many(domainDnsRecords),
}));

export const domainDnsRecordsRelations = relations(domainDnsRecords, ({ one }) => ({
  domain: one(domainRegistrations, {
    fields: [domainDnsRecords.domainId],
    references: [domainRegistrations.id],
  }),
}));

export type DnsRecordType = (typeof dnsRecordType.enumValues)[number];
export type DomainDnsRecord = typeof domainDnsRecords.$inferSelect;

export const blogPostsRelations = relations(blogPosts, ({ one }) => ({
  author: one(users, { fields: [blogPosts.authorUserId], references: [users.id] }),
}));

export const analyticsEventsRelations = relations(analyticsEvents, ({ one }) => ({
  user: one(users, { fields: [analyticsEvents.userId], references: [users.id] }),
  product: one(products, { fields: [analyticsEvents.productId], references: [products.id] }),
  category: one(categories, { fields: [analyticsEvents.categoryId], references: [categories.id] }),
}));

export type BaseCurrency = (typeof baseCurrency.enumValues)[number];
export type ExchangeRate = typeof exchangeRates.$inferSelect;
export type AnalyticsEventType = (typeof analyticsEventType.enumValues)[number];
export type BlogStatus = (typeof blogStatus.enumValues)[number];
export type BlogPost = typeof blogPosts.$inferSelect;
export type AnalyticsEvent = typeof analyticsEvents.$inferSelect;

// --- Communications (SMS / voice / email / Telegram) -----------------------

export const commDirection = pgEnum("comm_direction", ["OUTBOUND", "INBOUND"]);
export const commChannel = pgEnum("comm_channel", [
  "SMS",
  "VOICE",
  "EMAIL",
  "TELEGRAM",
  "INAPP",
  "PUSH",
]);
export const commKind = pgEnum("comm_kind", [
  "OTP",
  "ORDER_CODES",
  "NOTIFICATION",
  "EVENT",
  "INBOUND",
  "TEST",
  "OTHER",
]);
export const commStatus = pgEnum("comm_status", [
  "QUEUED",
  "SENT",
  "PENDING",
  "DELIVERED",
  "FAILED",
  "SKIPPED",
  "RECEIVED",
  "UNDELIVERED",
]);

/**
 * Admin-editable message templates, one row per (eventKey × channel). A row here
 * overrides the seeded code default in `src/lib/comms/templates.ts`; absence
 * falls back to that default (or skips the channel). `subject` doubles as the
 * title for INAPP/PUSH; `body` is the SMS text / INAPP body / EMAIL inner HTML.
 */
export const commTemplates = pgTable(
  "CommTemplate",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    eventKey: text("eventKey").notNull(),
    channel: commChannel("channel").notNull(),
    enabled: boolean("enabled").default(true).notNull(),
    subject: text("subject"),
    body: text("body").notNull(),
    bodyText: text("bodyText"),
    /** SMS only: send via a provider-registered pattern instead of free text. */
    isPattern: boolean("isPattern").default(false).notNull(),
    updatedByUserId: uuid("updatedByUserId").references(() => users.id, { onDelete: "set null" }),
    createdAt,
    updatedAt,
  },
  (t) => [uniqueIndex("CommTemplate_eventKey_channel_uq").on(t.eventKey, t.channel)],
);

/**
 * The message ledger: one row per outbound or inbound message across every
 * channel. Written by the comms dispatch layer (`src/lib/comms`) on send, and
 * mutated by delivery-status callbacks (matched on `providerMessageId`).
 *
 * Full-data logging: `body` and `payload` are stored as sent; only long-lived
 * credentials are stripped from payloads (see `src/lib/comms/record.ts`). Rows
 * carry `eventKey`/`templateId` when produced by the dispatch engine.
 */
export const commLogs = pgTable(
  "CommLog",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    direction: commDirection("direction").notNull(),
    channel: commChannel("channel").notNull(),
    provider: text("provider").notNull(),
    kind: commKind("kind").notNull(),
    status: commStatus("status").notNull(),
    toAddress: text("toAddress").notNull(),
    fromAddress: text("fromAddress"),
    body: text("body"),
    providerMessageId: text("providerMessageId"),
    errorMessage: text("errorMessage"),
    cost: numeric("cost", price),
    payload: jsonb("payload"),
    userId: uuid("userId").references(() => users.id, { onDelete: "set null" }),
    orderId: uuid("orderId").references(() => orders.id, { onDelete: "set null" }),
    /** Dispatch event that produced this row (null for OTP/legacy sends). */
    eventKey: text("eventKey"),
    templateId: uuid("templateId").references(() => commTemplates.id, { onDelete: "set null" }),
    createdAt,
    updatedAt,
  },
  (t) => [
    index("CommLog_channel_createdAt_idx").on(t.channel, t.createdAt),
    index("CommLog_toAddress_createdAt_idx").on(t.toAddress, t.createdAt),
    index("CommLog_providerMessageId_idx").on(t.providerMessageId),
    index("CommLog_status_idx").on(t.status),
    index("CommLog_eventKey_createdAt_idx").on(t.eventKey, t.createdAt),
  ],
);

/**
 * Raw audit of every provider callback/webhook POST — delivery receipts and
 * inbound-message notifications — recorded exactly as received, including
 * unauthenticated or unmatched hits. The Callbacks tab reads this; it's the
 * first place to look when a provider webhook is misconfigured.
 */
export const commWebhookEvents = pgTable(
  "CommWebhookEvent",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    provider: text("provider").notNull(),
    channel: commChannel("channel").notNull(),
    /** "delivery_status" | "inbound" */
    type: text("type").notNull(),
    rawPayload: jsonb("rawPayload"),
    matchedLogId: uuid("matchedLogId").references(() => commLogs.id, { onDelete: "set null" }),
    signatureValid: boolean("signatureValid").notNull(),
    receivedAt: timestamp("receivedAt", { mode: "date" }).defaultNow().notNull(),
  },
  (t) => [
    index("CommWebhookEvent_provider_receivedAt_idx").on(t.provider, t.receivedAt),
    index("CommWebhookEvent_type_idx").on(t.type),
  ],
);

export const commLogsRelations = relations(commLogs, ({ one, many }) => ({
  user: one(users, { fields: [commLogs.userId], references: [users.id] }),
  order: one(orders, { fields: [commLogs.orderId], references: [orders.id] }),
  webhookEvents: many(commWebhookEvents),
}));

export const commWebhookEventsRelations = relations(commWebhookEvents, ({ one }) => ({
  matchedLog: one(commLogs, {
    fields: [commWebhookEvents.matchedLogId],
    references: [commLogs.id],
  }),
}));

export type CommDirection = (typeof commDirection.enumValues)[number];
export type CommChannel = (typeof commChannel.enumValues)[number];
export type CommKind = (typeof commKind.enumValues)[number];
export type CommStatus = (typeof commStatus.enumValues)[number];
export type CommLog = typeof commLogs.$inferSelect;
export type CommWebhookEvent = typeof commWebhookEvents.$inferSelect;
export type CommTemplate = typeof commTemplates.$inferSelect;
