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

export const fulfillmentType = pgEnum("fulfillment_type", ["DIGITAL", "PHYSICAL"]);

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
    createdAt,
    updatedAt,
  },
  (t) => [
    index("User_createdAt_idx").on(t.createdAt),
    index("User_role_idx").on(t.role),
    index("User_isPremium_idx").on(t.isPremium),
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

// --- Relations -------------------------------------------------------------

export const usersRelations = relations(users, ({ many }) => ({
  carts: many(carts),
  orders: many(orders),
  sessions: many(sessions),
  loginOtps: many(loginOtps),
  inventoryUnits: many(inventoryUnits),
  payments: many(payments),
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
