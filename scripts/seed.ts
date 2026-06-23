import "dotenv/config";
import { randomBytes } from "node:crypto";

import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { createAdminProduct } from "@/lib/admin/products";
import { STATIC_PAGES } from "@/lib/seo/static-pages";
import { optionsKeyFromPairs } from "@/lib/variant-options";
import * as schema from "../src/db/schema";

/**
 * Seed Pixevel with a diverse "sell anything" catalog that proves the generic
 * option model end-to-end: physical goods, digital codes, subscriptions
 * (servers / domains) and a service — each built through the same admin path
 * (`createAdminProduct`) the panel uses, so the seed and production share one
 * source of truth for variant generation, pricing tiers and inventory.
 *
 * Base bootstrap (categories, tags, home blocks) is created directly; products
 * go through `createAdminProduct` with arbitrary option dimensions.
 *
 * Idempotent: clears existing catalog (products / tags / categories / home
 * blocks) before inserting. Does NOT touch the User table.
 *
 * Run: bun run db:seed
 *
 * NOTE: `createAdminProduct` pulls in app code marked `server-only`; the
 * `db:seed` / `cron:tick` scripts run tsx with `--conditions=react-server` so
 * that marker resolves to its no-op variant outside the Next.js bundler.
 */

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle({ client: pool, schema });

// Placeholder stock photos (deterministic per slug). Swap for real artwork via
// the admin panel later.
function stockImage(slug: string) {
  return `https://picsum.photos/seed/${encodeURIComponent(slug)}/800/1000`;
}

// Fake redeemable code for DIGITAL inventory (gift-card codes / license keys).
function fakeCode(prefix: string, index: number) {
  const block = () => randomBytes(2).toString("hex").toUpperCase();
  return `${prefix}-${block()}-${block()}-${String(index + 1).padStart(3, "0")}`;
}

// --- Taxonomy ---------------------------------------------------------------

type TagSeed = { slug: string; titleFa: string };

const TAGS: TagSeed[] = [
  { slug: "bestseller", titleFa: "پرفروش" },
  { slug: "gaming", titleFa: "گیمینگ" },
  { slug: "hardware", titleFa: "سخت‌افزار" },
  { slug: "merch", titleFa: "پوشاک و مرچ" },
  { slug: "digital", titleFa: "دیجیتال" },
  { slug: "steam", titleFa: "استیم" },
  { slug: "license", titleFa: "لایسنس" },
  { slug: "windows", titleFa: "ویندوز" },
  { slug: "hosting", titleFa: "هاستینگ" },
  { slug: "subscription", titleFa: "اشتراکی" },
  { slug: "domain", titleFa: "دامنه" },
  { slug: "service", titleFa: "خدمات" },
];

const CATEGORIES = [
  { slug: "store", titleFa: "فروشگاه", parentSlug: null as string | null, sortOrder: 0 },
  { slug: "gaming", titleFa: "گیمینگ", parentSlug: "store", sortOrder: 1 },
  { slug: "merch", titleFa: "پوشاک و مرچ", parentSlug: "store", sortOrder: 2 },
  { slug: "digital-goods", titleFa: "کالای دیجیتال", parentSlug: "store", sortOrder: 3 },
  { slug: "hosting", titleFa: "هاست و سرور", parentSlug: "store", sortOrder: 4 },
  { slug: "domains", titleFa: "دامنه", parentSlug: "store", sortOrder: 5 },
  { slug: "services", titleFa: "خدمات", parentSlug: "store", sortOrder: 6 },
];

// --- Seed routine -----------------------------------------------------------

async function main() {
  console.log("Clearing existing catalog…");
  await db.delete(schema.homeBlockItems);
  await db.delete(schema.homeBlocks);
  await db.delete(schema.products); // cascades to variants, images, inventory, productTags, options
  await db.delete(schema.tags);
  await db.delete(schema.categories);

  console.log("Inserting categories…");
  const categoryIdBySlug = new Map<string, string>();
  for (const category of CATEGORIES) {
    const [row] = await db
      .insert(schema.categories)
      .values({
        slug: category.slug,
        titleFa: category.titleFa,
        parentId: category.parentSlug ? (categoryIdBySlug.get(category.parentSlug) ?? null) : null,
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
  const productIdBySlug = new Map<string, string>();
  const cat = (slug: string) => categoryIdBySlug.get(slug);
  const tagTitles = (slugs: string[]) =>
    slugs
      .map((slug) => TAGS.find((t) => t.slug === slug)?.titleFa)
      .filter((v): v is string => Boolean(v));

  // 1) Gaming monitor — PHYSICAL · TRACKED · Size{24,27,32} × Panel{IPS,VA}.
  {
    const product = await createAdminProduct({
      titleFa: "مانیتور گیمینگ پیکسل‌پرو",
      slug: "gaming-monitor-pixelpro",
      summaryFa: "مانیتور گیمینگ با نرخ نوسازی بالا و رنگ دقیق.",
      descriptionFa: "مانیتور گیمینگ با پنل‌های IPS و VA در سه اندازه، مناسب بازی و کار حرفه‌ای.",
      status: "ACTIVE",
      fulfillmentType: "PHYSICAL",
      inventoryPolicy: "TRACKED",
      baseCurrency: "IRT",
      categoryId: cat("gaming"),
      tags: tagTitles(["gaming", "hardware", "bestseller"]),
      options: [
        {
          nameFa: "اندازه",
          slug: "size",
          inputKind: "PILL",
          values: [{ valueFa: "۲۴ اینچ" }, { valueFa: "۲۷ اینچ" }, { valueFa: "۳۲ اینچ" }],
        },
        {
          nameFa: "پنل",
          slug: "panel",
          inputKind: "PILL",
          values: [{ valueFa: "IPS" }, { valueFa: "VA" }],
        },
      ],
      publicPriceAmount: "18900000",
      registeredPriceAmount: "18500000",
      premiumPriceAmount: "17900000",
      compareAtAmount: "21000000",
      stockPerVariant: 5,
      images: [
        {
          url: stockImage("gaming-monitor-pixelpro"),
          altFa: "مانیتور گیمینگ پیکسل‌پرو",
          isPrimary: true,
          showcasePublic: true,
          showcasePremium: true,
          sortOrder: 0,
        },
      ],
    });
    productIdBySlug.set(product.slug, product.id);
  }

  // 2) Merch tee — PHYSICAL · TRACKED · Color (SWATCH) × Size{S,M,L,XL}.
  {
    const product = await createAdminProduct({
      titleFa: "تیشرت گیمینگ پیکسل",
      slug: "gaming-tee-pixel",
      summaryFa: "تیشرت نخی با چاپ اختصاصی پیکسل.",
      descriptionFa: "تیشرت گیمینگ از جنس نخ پنبه با چاپ باکیفیت، در چند رنگ و سایز.",
      status: "ACTIVE",
      fulfillmentType: "PHYSICAL",
      inventoryPolicy: "TRACKED",
      baseCurrency: "IRT",
      categoryId: cat("merch"),
      tags: tagTitles(["merch", "gaming"]),
      options: [
        {
          nameFa: "رنگ",
          slug: "color",
          inputKind: "SWATCH",
          values: [
            { valueFa: "مشکی", slug: "black", hex: "#111111" },
            { valueFa: "سفید", slug: "white", hex: "#f5f5f5" },
            { valueFa: "سرمه‌ای", slug: "navy", hex: "#1b2a4a" },
          ],
        },
        {
          nameFa: "سایز",
          slug: "size",
          inputKind: "PILL",
          values: [{ valueFa: "S" }, { valueFa: "M" }, { valueFa: "L" }, { valueFa: "XL" }],
        },
      ],
      publicPriceAmount: "690000",
      registeredPriceAmount: "670000",
      premiumPriceAmount: "640000",
      stockPerVariant: 10,
      images: [
        {
          url: stockImage("gaming-tee-pixel"),
          altFa: "تیشرت گیمینگ پیکسل",
          isPrimary: true,
          showcasePublic: true,
          showcasePremium: true,
          sortOrder: 0,
        },
      ],
    });
    productIdBySlug.set(product.slug, product.id);
  }

  // 3) Steam gift card — DIGITAL · TRACKED · Denomination × Region, with codes.
  {
    const denomOption = { slug: "denomination", values: ["10", "25", "50"] };
    const regionOption = { slug: "region", values: ["global", "europe"] };
    // Per-variant fake redeemable codes keyed by optionsKey.
    const overrides: Record<string, { stockCodes: string[] }> = {};
    for (const denom of denomOption.values) {
      for (const region of regionOption.values) {
        const key = optionsKeyFromPairs([
          { optionSlug: denomOption.slug, valueSlug: denom },
          { optionSlug: regionOption.slug, valueSlug: region },
        ]);
        const prefix = `STEAM${denom}-${region.slice(0, 2).toUpperCase()}`;
        overrides[key] = {
          stockCodes: Array.from({ length: 5 }, (_, i) => fakeCode(prefix, i)),
        };
      }
    }
    const product = await createAdminProduct({
      titleFa: "گیفت کارت استیم",
      slug: "steam-gift-card",
      summaryFa: "شارژ کیف پول استیم، تحویل آنی کد.",
      descriptionFa: "کد شارژ Steam Wallet با مبالغ و ریجن‌های مختلف، تحویل آنی پس از پرداخت.",
      status: "ACTIVE",
      fulfillmentType: "DIGITAL",
      inventoryPolicy: "TRACKED",
      baseCurrency: "IRT",
      categoryId: cat("digital-goods"),
      tags: tagTitles(["digital", "steam", "gaming", "bestseller"]),
      options: [
        {
          nameFa: "مبلغ",
          slug: denomOption.slug,
          inputKind: "PILL",
          values: [
            { valueFa: "۱۰$", slug: "10" },
            { valueFa: "۲۵$", slug: "25" },
            { valueFa: "۵۰$", slug: "50" },
          ],
        },
        {
          nameFa: "ریجن",
          slug: regionOption.slug,
          inputKind: "SELECT",
          values: [
            { valueFa: "گلوبال", slug: "global" },
            { valueFa: "اروپا", slug: "europe" },
          ],
        },
      ],
      publicPriceAmount: "950000",
      registeredPriceAmount: "930000",
      premiumPriceAmount: "900000",
      stockPerVariant: 0, // codes are supplied per-variant via overrides
      variantOverridesByKey: overrides,
      images: [
        {
          url: stockImage("steam-gift-card"),
          altFa: "گیفت کارت استیم",
          isPrimary: true,
          showcasePublic: true,
          showcasePremium: true,
          sortOrder: 0,
        },
      ],
    });
    productIdBySlug.set(product.slug, product.id);
  }

  // 4) Windows license — DIGITAL · TRACKED · Edition{Home,Pro}, with keys.
  {
    const editions = [
      { valueFa: "Home", slug: "home", prefix: "WINHOME" },
      { valueFa: "Pro", slug: "pro", prefix: "WINPRO" },
    ];
    const overrides: Record<string, { stockCodes: string[] }> = {};
    for (const edition of editions) {
      const key = optionsKeyFromPairs([{ optionSlug: "edition", valueSlug: edition.slug }]);
      overrides[key] = {
        stockCodes: Array.from({ length: 8 }, (_, i) => fakeCode(edition.prefix, i)),
      };
    }
    const product = await createAdminProduct({
      titleFa: "لایسنس ویندوز ۱۱",
      slug: "windows-11-license",
      summaryFa: "کلید فعال‌سازی اصل ویندوز ۱۱.",
      descriptionFa: "لایسنس قانونی Windows 11 با فعال‌سازی آنلاین، تحویل آنی کلید.",
      status: "ACTIVE",
      fulfillmentType: "DIGITAL",
      inventoryPolicy: "TRACKED",
      baseCurrency: "IRT",
      categoryId: cat("digital-goods"),
      tags: tagTitles(["digital", "license", "windows"]),
      options: [
        {
          nameFa: "نسخه",
          slug: "edition",
          inputKind: "PILL",
          values: editions.map((e) => ({ valueFa: e.valueFa, slug: e.slug })),
        },
      ],
      publicPriceAmount: "2400000",
      registeredPriceAmount: "2350000",
      premiumPriceAmount: "2250000",
      stockPerVariant: 0,
      variantOverridesByKey: overrides,
      images: [
        {
          url: stockImage("windows-11-license"),
          altFa: "لایسنس ویندوز ۱۱",
          isPrimary: true,
          showcasePublic: true,
          showcasePremium: true,
          sortOrder: 0,
        },
      ],
    });
    productIdBySlug.set(product.slug, product.id);
  }

  // 5) VPS host — SERVER · INFINITE · subscription (MONTH) · Plan{S,M,L}.
  {
    const plans = [
      { valueFa: "S", slug: "s", price: "390000" },
      { valueFa: "M", slug: "m", price: "690000" },
      { valueFa: "L", slug: "l", price: "1290000" },
    ];
    const overrides: Record<string, { publicPriceAmount: string }> = {};
    for (const plan of plans) {
      const key = optionsKeyFromPairs([{ optionSlug: "plan", valueSlug: plan.slug }]);
      overrides[key] = { publicPriceAmount: plan.price };
    }
    const product = await createAdminProduct({
      titleFa: "سرور مجازی ابری",
      slug: "cloud-vps",
      summaryFa: "VPS پرسرعت با تمدید ماهانه.",
      descriptionFa: "سرور مجازی ابری با منابع اختصاصی، صورتحساب و تمدید ماهانه.",
      status: "ACTIVE",
      fulfillmentType: "SERVER",
      inventoryPolicy: "INFINITE",
      baseCurrency: "IRT",
      isSubscription: true,
      subscriptionPlan: { intervalUnit: "MONTH", intervalCount: 1, autoRenewDefault: true },
      categoryId: cat("hosting"),
      tags: tagTitles(["hosting", "subscription"]),
      options: [
        {
          nameFa: "پلن",
          slug: "plan",
          inputKind: "PILL",
          values: plans.map((p) => ({ valueFa: p.valueFa, slug: p.slug })),
        },
      ],
      publicPriceAmount: "390000",
      stockPerVariant: 0,
      variantOverridesByKey: overrides,
      images: [
        {
          url: stockImage("cloud-vps"),
          altFa: "سرور مجازی ابری",
          isPrimary: true,
          showcasePublic: true,
          showcasePremium: true,
          sortOrder: 0,
        },
      ],
    });
    productIdBySlug.set(product.slug, product.id);
  }

  // 6) Domain (.com/.ir) — DOMAIN · INFINITE · subscription (YEAR) · TLD.
  {
    const tlds = [
      { valueFa: ".com", slug: "com", price: "450000" },
      { valueFa: ".ir", slug: "ir", price: "150000" },
    ];
    const overrides: Record<string, { publicPriceAmount: string }> = {};
    for (const tld of tlds) {
      const key = optionsKeyFromPairs([{ optionSlug: "tld", valueSlug: tld.slug }]);
      overrides[key] = { publicPriceAmount: tld.price };
    }
    const product = await createAdminProduct({
      titleFa: "ثبت دامنه",
      slug: "domain-registration",
      summaryFa: "ثبت و تمدید سالانه دامنه.",
      descriptionFa: "ثبت دامنه با پسوندهای .com و .ir، تمدید خودکار سالانه.",
      status: "ACTIVE",
      fulfillmentType: "DOMAIN",
      inventoryPolicy: "INFINITE",
      baseCurrency: "IRT",
      isSubscription: true,
      subscriptionPlan: { intervalUnit: "YEAR", intervalCount: 1, autoRenewDefault: true },
      categoryId: cat("domains"),
      tags: tagTitles(["domain", "subscription"]),
      options: [
        {
          nameFa: "پسوند",
          slug: "tld",
          inputKind: "PILL",
          values: tlds.map((t) => ({ valueFa: t.valueFa, slug: t.slug })),
        },
      ],
      publicPriceAmount: "450000",
      stockPerVariant: 0,
      variantOverridesByKey: overrides,
      images: [
        {
          url: stockImage("domain-registration"),
          altFa: "ثبت دامنه",
          isPrimary: true,
          showcasePublic: true,
          showcasePremium: true,
          sortOrder: 0,
        },
      ],
    });
    productIdBySlug.set(product.slug, product.id);
  }

  // 7) Design service — SERVICE · INFINITE · no options · single price.
  {
    const product = await createAdminProduct({
      titleFa: "طراحی لوگو اختصاصی",
      slug: "logo-design-service",
      summaryFa: "طراحی لوگوی حرفه‌ای توسط تیم دیزاین.",
      descriptionFa: "خدمت طراحی لوگوی اختصاصی شامل چند کانسپت و فایل‌های نهایی قابل تحویل.",
      status: "ACTIVE",
      fulfillmentType: "SERVICE",
      inventoryPolicy: "INFINITE",
      baseCurrency: "IRT",
      categoryId: cat("services"),
      tags: tagTitles(["service"]),
      options: [],
      publicPriceAmount: "3500000",
      registeredPriceAmount: "3400000",
      premiumPriceAmount: "3200000",
      stockPerVariant: 0,
      images: [
        {
          url: stockImage("logo-design-service"),
          altFa: "طراحی لوگو اختصاصی",
          isPrimary: true,
          showcasePublic: true,
          showcasePremium: true,
          sortOrder: 0,
        },
      ],
    });
    productIdBySlug.set(product.slug, product.id);
  }

  console.log("Inserting home blocks…");
  // Dynamic best-seller gallery.
  await db.insert(schema.homeBlocks).values({
    titleFa: "محبوب‌ترین‌ها",
    subtitleFa: "پرفروش‌ترین محصولات فروشگاه",
    type: "LEFT_TO_RIGHT_GALLERY",
    source: "DYNAMIC",
    isActive: true,
    sortOrder: 1,
    tagId: tagIdBySlug.get("bestseller") ?? null,
    sortKey: "newest",
    maxItems: 12,
  });

  // Manual showcase featuring the gaming monitor.
  const [showcaseBlock] = await db
    .insert(schema.homeBlocks)
    .values({
      titleFa: "پیشنهاد ویژه",
      subtitleFa: "مانیتور گیمینگ پیکسل‌پرو",
      type: "SHOWCASE_HERO",
      source: "MANUAL",
      isActive: true,
      sortOrder: 0,
      maxItems: 1,
    })
    .returning({ id: schema.homeBlocks.id });

  const showcaseProductId = productIdBySlug.get("gaming-monitor-pixelpro");
  if (showcaseProductId) {
    await db.insert(schema.homeBlockItems).values({
      blockId: showcaseBlock.id,
      productId: showcaseProductId,
      sortOrder: 0,
    });
  }

  // Idempotent SEO rows for indexable static pages — seeds each route's current
  // title/description so the rendered head stays identical until an operator edits
  // it. onConflictDoNothing(pathKey) never clobbers existing operator edits.
  await db
    .insert(schema.pageSeo)
    .values(
      STATIC_PAGES.map((page) => ({
        pathKey: page.pathKey,
        labelFa: page.labelFa,
        seoTitle: page.title,
        seoDescription: page.description,
        sitemapPriority: String(page.sitemapPriority),
        sitemapChangefreq: page.sitemapChangefreq,
      })),
    )
    .onConflictDoNothing({ target: schema.pageSeo.pathKey });

  console.log(
    `Done. ${productIdBySlug.size} products, ${TAGS.length} tags, ${CATEGORIES.length} categories, 2 home blocks, ${STATIC_PAGES.length} SEO pages.`,
  );
}

main()
  .then(() => pool.end())
  .catch(async (error) => {
    console.error(error);
    await pool.end();
    process.exit(1);
  });
