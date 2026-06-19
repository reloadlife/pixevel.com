import "dotenv/config";
import { randomBytes } from "node:crypto";

import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import * as schema from "../src/db/schema";

/**
 * Seed Pixevel with digital gift-card catalog data.
 *
 * Gift cards reuse the generic variant model: each denomination is a variant
 * (size = denomination label), with color/material set to inert "standard" /
 * "digital" placeholders. Every denomination carries its own tiered price and a
 * batch of per-unit inventory rows (one redeemable slot per row).
 *
 * Idempotent: clears existing catalog (products / tags / categories / home
 * blocks) before inserting. Does NOT touch the User table.
 *
 * Run: npm run db:seed
 */

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle({ client: pool, schema });

const STOCK_PER_DENOM = 25;

// Placeholder stock photos (deterministic per product slug). Swap for real
// brand artwork via the admin panel later.
function stockImage(slug: string) {
  return `https://picsum.photos/seed/${encodeURIComponent(slug)}/800/1000`;
}

function tier(publicToman: number) {
  return {
    publicPriceAmount: String(publicToman),
    registeredPriceAmount: String(Math.round((publicToman * 0.98) / 1000) * 1000),
    premiumPriceAmount: String(Math.round((publicToman * 0.95) / 1000) * 1000),
  };
}

function stockCode(sku: string, index: number) {
  return `${sku}-${String(index + 1).padStart(4, "0")}-${randomBytes(3).toString("hex")}`;
}

// --- Catalog definition ----------------------------------------------------

type TagSeed = { slug: string; titleFa: string };

const TAGS: TagSeed[] = [
  { slug: "music", titleFa: "موزیک" },
  { slug: "streaming", titleFa: "استریم" },
  { slug: "gaming", titleFa: "گیمینگ" },
  { slug: "ios", titleFa: "اپل و iOS" },
  { slug: "bestseller", titleFa: "پرفروش" },
  { slug: "spotify", titleFa: "اسپاتیفای" },
  { slug: "apple", titleFa: "اپل" },
  { slug: "steam", titleFa: "استیم" },
  { slug: "google-play", titleFa: "گوگل پلی" },
  { slug: "playstation", titleFa: "پلی استیشن" },
  { slug: "xbox", titleFa: "ایکس باکس" },
  { slug: "netflix", titleFa: "نتفلیکس" },
];

type ProductSeed = {
  slug: string;
  titleFa: string;
  summaryFa: string;
  descriptionFa: string;
  categorySlug: string;
  color: string;
  tagSlugs: string[];
  denominations: Array<{ label: string; toman: number }>;
};

const PRODUCTS: ProductSeed[] = [
  {
    slug: "spotify-premium-gift-card",
    titleFa: "گیفت کارت اسپاتیفای پرمیوم",
    summaryFa: "اشتراک اسپاتیفای پرمیوم، تحویل آنی کد",
    descriptionFa: "کد قانونی اشتراک Spotify Premium با تحویل آنی پس از پرداخت.",
    categorySlug: "music-streaming",
    color: "#1DB954",
    tagSlugs: ["music", "streaming", "spotify", "bestseller"],
    denominations: [
      { label: "۱ ماهه", toman: 250000 },
      { label: "۳ ماهه", toman: 690000 },
      { label: "۱۲ ماهه", toman: 2400000 },
    ],
  },
  {
    slug: "apple-gift-card",
    titleFa: "گیفت کارت اپل (iTunes)",
    summaryFa: "شارژ اپل آیدی و خرید از App Store",
    descriptionFa: "گیفت کارت اپل برای شارژ Apple ID، خرید اپلیکیشن، موزیک و اشتراک iCloud.",
    categorySlug: "app-stores",
    color: "#111111",
    tagSlugs: ["ios", "apple", "bestseller"],
    denominations: [
      { label: "۵ دلاری", toman: 420000 },
      { label: "۱۰ دلاری", toman: 830000 },
      { label: "۲۵ دلاری", toman: 2050000 },
      { label: "۵۰ دلاری", toman: 4050000 },
      { label: "۱۰۰ دلاری", toman: 8000000 },
    ],
  },
  {
    slug: "steam-wallet-gift-card",
    titleFa: "گیفت کارت استیم (Steam Wallet)",
    summaryFa: "شارژ کیف پول استیم برای خرید بازی",
    descriptionFa: "کد شارژ Steam Wallet برای خرید بازی و آیتم روی پلتفرم استیم.",
    categorySlug: "gaming",
    color: "#1b2838",
    tagSlugs: ["gaming", "steam", "bestseller"],
    denominations: [
      { label: "۱۰ دلاری", toman: 850000 },
      { label: "۲۰ دلاری", toman: 1680000 },
      { label: "۵۰ دلاری", toman: 4150000 },
      { label: "۱۰۰ دلاری", toman: 8250000 },
    ],
  },
  {
    slug: "google-play-gift-card",
    titleFa: "گیفت کارت گوگل پلی",
    summaryFa: "خرید از Google Play Store",
    descriptionFa: "گیفت کارت Google Play برای خرید اپلیکیشن، بازی و محتوای دیجیتال اندروید.",
    categorySlug: "app-stores",
    color: "#0F9D58",
    tagSlugs: ["google-play", "gaming"],
    denominations: [
      { label: "۱۰ دلاری", toman: 840000 },
      { label: "۲۵ دلاری", toman: 2070000 },
      { label: "۵۰ دلاری", toman: 4080000 },
    ],
  },
  {
    slug: "playstation-network-gift-card",
    titleFa: "گیفت کارت پلی استیشن (PSN)",
    summaryFa: "شارژ کیف پول PlayStation Network",
    descriptionFa: "کد شارژ PSN برای خرید بازی و اشتراک PlayStation Plus.",
    categorySlug: "gaming",
    color: "#003791",
    tagSlugs: ["gaming", "playstation"],
    denominations: [
      { label: "۱۰ دلاری", toman: 870000 },
      { label: "۲۵ دلاری", toman: 2120000 },
      { label: "۵۰ دلاری", toman: 4180000 },
    ],
  },
  {
    slug: "xbox-gift-card",
    titleFa: "گیفت کارت ایکس باکس",
    summaryFa: "شارژ حساب Xbox و Microsoft Store",
    descriptionFa: "گیفت کارت Xbox برای خرید بازی، اشتراک Game Pass و محتوای مایکروسافت.",
    categorySlug: "gaming",
    color: "#107C10",
    tagSlugs: ["gaming", "xbox"],
    denominations: [
      { label: "۱۰ دلاری", toman: 860000 },
      { label: "۲۵ دلاری", toman: 2100000 },
    ],
  },
  {
    slug: "netflix-gift-card",
    titleFa: "گیفت کارت نتفلیکس",
    summaryFa: "اشتراک نتفلیکس، تحویل آنی",
    descriptionFa: "گیفت کارت Netflix برای فعال‌سازی یا تمدید اشتراک استریم.",
    categorySlug: "music-streaming",
    color: "#E50914",
    tagSlugs: ["streaming", "netflix", "bestseller"],
    denominations: [
      { label: "۳۰ دلاری", toman: 2450000 },
      { label: "۶۰ دلاری", toman: 4850000 },
    ],
  },
];

const CATEGORIES = [
  { slug: "gift-cards", titleFa: "گیفت کارت", parentSlug: null as string | null, sortOrder: 0 },
  { slug: "music-streaming", titleFa: "موزیک و استریم", parentSlug: "gift-cards", sortOrder: 1 },
  { slug: "gaming", titleFa: "گیمینگ", parentSlug: "gift-cards", sortOrder: 2 },
  { slug: "app-stores", titleFa: "اپ استورها", parentSlug: "gift-cards", sortOrder: 3 },
];

// --- Seed routine ----------------------------------------------------------

async function main() {
  console.log("Clearing existing catalog…");
  await db.delete(schema.homeBlockItems);
  await db.delete(schema.homeBlocks);
  await db.delete(schema.products); // cascades to variants, images, inventory, productTags
  await db.delete(schema.tags);
  await db.delete(schema.categories);

  console.log("Inserting categories…");
  const categoryIdBySlug = new Map<string, string>();
  // Insert parents first so parentId references resolve.
  for (const category of CATEGORIES) {
    const [row] = await db
      .insert(schema.categories)
      .values({
        slug: category.slug,
        titleFa: category.titleFa,
        parentId: category.parentSlug ? categoryIdBySlug.get(category.parentSlug) ?? null : null,
        sortOrder: category.sortOrder,
      })
      .returning({ id: schema.categories.id });
    categoryIdBySlug.set(category.slug, row.id);
  }

  console.log("Inserting tags…");
  const tagIdBySlug = new Map<string, string>();
  for (const t of TAGS) {
    const [row] = await db
      .insert(schema.tags)
      .values({ slug: t.slug, titleFa: t.titleFa })
      .returning({ id: schema.tags.id });
    tagIdBySlug.set(t.slug, row.id);
  }

  console.log("Inserting products…");
  let variantCount = 0;
  let unitCount = 0;
  const productIds: string[] = [];

  for (const product of PRODUCTS) {
    const imageUrl = stockImage(product.slug);
    const [productRow] = await db
      .insert(schema.products)
      .values({
        slug: product.slug,
        titleFa: product.titleFa,
        summaryFa: product.summaryFa,
        descriptionFa: product.descriptionFa,
        status: "ACTIVE",
        categoryId: categoryIdBySlug.get(product.categorySlug) ?? null,
        primaryImageUrl: imageUrl,
      })
      .returning({ id: schema.products.id });

    productIds.push(productRow.id);

    await db.insert(schema.productTags).values(
      product.tagSlugs
        .map((slug) => tagIdBySlug.get(slug))
        .filter((id): id is string => Boolean(id))
        .map((tagId) => ({ productId: productRow.id, tagId }))
    );

    // One showcase image per product (used by gallery + showcase blocks).
    await db.insert(schema.productImages).values({
      productId: productRow.id,
      url: imageUrl,
      altFa: product.titleFa,
      isPrimary: true,
      showcasePublic: true,
      showcasePremium: true,
      sortOrder: 0,
    });

    let isFirst = true;
    for (let i = 0; i < product.denominations.length; i += 1) {
      const denom = product.denominations[i];
      const sku = `${product.slug.toUpperCase().replace(/-/g, "")}-D${i + 1}`;
      const [variantRow] = await db
        .insert(schema.productVariants)
        .values({
          productId: productRow.id,
          sku,
          titleFa: `${product.titleFa} — ${denom.label}`,
          colorNameFa: "استاندارد",
          colorSlug: "standard",
          materialNameFa: "دیجیتال",
          materialSlug: "digital",
          size: denom.label,
          isDefault: isFirst,
          ...tier(denom.toman),
        })
        .returning({ id: schema.productVariants.id });
      isFirst = false;
      variantCount += 1;

      await db.insert(schema.inventoryUnits).values(
        Array.from({ length: STOCK_PER_DENOM }, (_, n) => ({
          variantId: variantRow.id,
          code: stockCode(sku, n),
        }))
      );
      unitCount += STOCK_PER_DENOM;
    }
  }

  console.log("Inserting home blocks…");
  // Dynamic best-seller gallery.
  await db.insert(schema.homeBlocks).values({
    titleFa: "گیفت کارت‌های پرفروش",
    subtitleFa: "محبوب‌ترین کدهای دیجیتال",
    type: "LEFT_TO_RIGHT_GALLERY",
    source: "DYNAMIC",
    isActive: true,
    sortOrder: 1,
    tagId: tagIdBySlug.get("bestseller") ?? null,
    sortKey: "newest",
    maxItems: 12,
  });

  // Manual showcase featuring the first product.
  const [showcaseBlock] = await db
    .insert(schema.homeBlocks)
    .values({
      titleFa: "پیشنهاد ویژه",
      subtitleFa: "اشتراک اسپاتیفای پرمیوم",
      type: "SHOWCASE_HERO",
      source: "MANUAL",
      isActive: true,
      sortOrder: 0,
      maxItems: 1,
    })
    .returning({ id: schema.homeBlocks.id });

  await db.insert(schema.homeBlockItems).values({
    blockId: showcaseBlock.id,
    productId: productIds[0],
    sortOrder: 0,
  });

  console.log(
    `Done. ${PRODUCTS.length} products, ${variantCount} variants, ${unitCount} inventory units, ${TAGS.length} tags, ${CATEGORIES.length} categories, 2 home blocks.`
  );
}

main()
  .then(() => pool.end())
  .catch(async (error) => {
    console.error(error);
    await pool.end();
    process.exit(1);
  });
