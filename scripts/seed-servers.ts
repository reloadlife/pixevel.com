import "dotenv/config";
import { randomBytes } from "node:crypto";

import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import * as schema from "../src/db/schema";

/**
 * Seed / reconcile sample VPS (cloud-server) plan products.
 *
 * VPS plans are ordinary products with `fulfillmentType = "SERVER"`. Each
 * billing period (1 / 3 / 12 months) is a variant whose `metadata` carries the
 * plan spec — `{ planCode, cpu, ram, diskGb, periodMonths }` — plus tiered
 * prices. Ordering reuses the normal cart → checkout → order flow; on PAID the
 * server-fulfillment dispatcher provisions one instance per period.
 *
 * IDEMPOTENT:
 *   - the «سرور و هاست» (hosting) category is upserted by slug.
 *   - each plan product is upserted by slug; its variants are upserted by SKU.
 *   - inventory units are topped up to STOCK_PER_VARIANT (never duplicated),
 *     so a re-run leaves the catalog identical, not multiplied.
 *
 * Run: bun run scripts/seed-servers.ts
 */

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle({ client: pool, schema });

// Servers are provisioned on demand, but the cart/checkout flow still requires
// an available inventory unit per purchase. We keep a generous pool of slots.
const STOCK_PER_VARIANT = 50;

const HOSTING_CATEGORY = {
  slug: "hosting",
  titleFa: "سرور و هاست",
  descriptionFa: "سرور مجازی، سرور ابری و هاست با تحویل سریع و آپ‌تایم بالا.",
};

function stockImage(slug: string) {
  return `https://picsum.photos/seed/${encodeURIComponent(slug)}/800/1000`;
}

// Tiered pricing: registered ~2% off, premium ~5% off, rounded to 1,000 toman.
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

type PlanSpec = {
  /** Stable plan code passed to the upstream provider. */
  planCode: string;
  cpu: number;
  ram: number; // GB
  diskGb: number;
};

type PeriodSpec = {
  periodMonths: number;
  label: string;
  /** Public price for the whole period (toman). */
  toman: number;
};

type ServerPlanSeed = {
  slug: string;
  titleFa: string;
  summaryFa: string;
  descriptionFa: string;
  spec: PlanSpec;
  periods: PeriodSpec[];
};

// 1 / 3 / 12-month billing for each plan; the 3-/12-month periods bake in a
// modest commitment discount versus 1-month × N.
const PLANS: ServerPlanSeed[] = [
  {
    slug: "cloud-server-s",
    titleFa: "سرور ابری S",
    summaryFa: "سرور ابری سبک برای پروژه‌های کوچک و توسعه",
    descriptionFa:
      "سرور ابری اقتصادی با ۱ هسته پردازنده، ۲ گیگابایت رم و ۲۵ گیگابایت دیسک NVMe. مناسب وب‌سایت‌های کم‌بازدید، ربات‌ها و محیط توسعه.",
    spec: { planCode: "cloud-s", cpu: 1, ram: 2, diskGb: 25 },
    periods: [
      { periodMonths: 1, label: "۱ ماهه", toman: 290000 },
      { periodMonths: 3, label: "۳ ماهه", toman: 820000 },
      { periodMonths: 12, label: "۱۲ ماهه", toman: 2990000 },
    ],
  },
  {
    slug: "cloud-server-m",
    titleFa: "سرور ابری M",
    summaryFa: "سرور ابری متعادل برای وب‌اپلیکیشن‌ها و API",
    descriptionFa:
      "سرور ابری با ۲ هسته پردازنده، ۴ گیگابایت رم و ۸۰ گیگابایت دیسک NVMe. مناسب وب‌اپلیکیشن‌ها، API و دیتابیس‌های با بار متوسط.",
    spec: { planCode: "cloud-m", cpu: 2, ram: 4, diskGb: 80 },
    periods: [
      { periodMonths: 1, label: "۱ ماهه", toman: 540000 },
      { periodMonths: 3, label: "۳ ماهه", toman: 1530000 },
      { periodMonths: 12, label: "۱۲ ماهه", toman: 5590000 },
    ],
  },
  {
    slug: "cloud-server-l",
    titleFa: "سرور ابری L",
    summaryFa: "سرور ابری پرقدرت برای بارهای سنگین",
    descriptionFa:
      "سرور ابری قدرتمند با ۴ هسته پردازنده، ۸ گیگابایت رم و ۱۶۰ گیگابایت دیسک NVMe. مناسب اپلیکیشن‌های پرترافیک، دیتابیس‌های بزرگ و محیط‌های production.",
    spec: { planCode: "cloud-l", cpu: 4, ram: 8, diskGb: 160 },
    periods: [
      { periodMonths: 1, label: "۱ ماهه", toman: 980000 },
      { periodMonths: 3, label: "۳ ماهه", toman: 2790000 },
      { periodMonths: 12, label: "۱۲ ماهه", toman: 9990000 },
    ],
  },
];

// ─── Idempotent upserts ─────────────────────────────────────────────────────

async function upsertHostingCategory(): Promise<string> {
  const existing = await db.query.categories.findFirst({
    where: (category, { eq: whereEq }) => whereEq(category.slug, HOSTING_CATEGORY.slug),
    columns: { id: true },
  });

  if (existing) {
    await db
      .update(schema.categories)
      .set({
        titleFa: HOSTING_CATEGORY.titleFa,
        descriptionFa: HOSTING_CATEGORY.descriptionFa,
        isVisible: true,
      })
      .where(eq(schema.categories.id, existing.id));
    return existing.id;
  }

  const [row] = await db
    .insert(schema.categories)
    .values({
      slug: HOSTING_CATEGORY.slug,
      titleFa: HOSTING_CATEGORY.titleFa,
      descriptionFa: HOSTING_CATEGORY.descriptionFa,
      sortOrder: 40,
      isVisible: true,
    })
    .returning({ id: schema.categories.id });
  return row.id;
}

async function upsertProduct(plan: ServerPlanSeed, categoryId: string): Promise<string> {
  const imageUrl = stockImage(plan.slug);

  const existing = await db.query.products.findFirst({
    where: (product, { eq: whereEq }) => whereEq(product.slug, plan.slug),
    columns: { id: true },
  });

  if (existing) {
    await db
      .update(schema.products)
      .set({
        titleFa: plan.titleFa,
        summaryFa: plan.summaryFa,
        descriptionFa: plan.descriptionFa,
        status: "ACTIVE",
        fulfillmentType: "SERVER",
        categoryId,
        primaryImageUrl: imageUrl,
      })
      .where(eq(schema.products.id, existing.id));
    await ensurePrimaryImage(existing.id, imageUrl, plan.titleFa);
    return existing.id;
  }

  const [row] = await db
    .insert(schema.products)
    .values({
      slug: plan.slug,
      titleFa: plan.titleFa,
      summaryFa: plan.summaryFa,
      descriptionFa: plan.descriptionFa,
      status: "ACTIVE",
      fulfillmentType: "SERVER",
      categoryId,
      primaryImageUrl: imageUrl,
    })
    .returning({ id: schema.products.id });
  await ensurePrimaryImage(row.id, imageUrl, plan.titleFa);
  return row.id;
}

async function ensurePrimaryImage(productId: string, url: string, altFa: string): Promise<void> {
  const existing = await db.query.productImages.findFirst({
    where: (image, { eq: whereEq }) => whereEq(image.productId, productId),
    columns: { id: true },
  });

  if (existing) {
    return;
  }

  await db.insert(schema.productImages).values({
    productId,
    url,
    altFa,
    isPrimary: true,
    showcasePublic: true,
    showcasePremium: true,
    sortOrder: 0,
  });
}

async function upsertVariant(
  productId: string,
  plan: ServerPlanSeed,
  period: PeriodSpec,
  isDefault: boolean,
): Promise<{ variantId: string; sku: string }> {
  const sku = `${plan.spec.planCode.toUpperCase().replace(/-/g, "")}-${period.periodMonths}M`;

  const metadata = {
    planCode: plan.spec.planCode,
    cpu: plan.spec.cpu,
    ram: plan.spec.ram,
    diskGb: plan.spec.diskGb,
    periodMonths: period.periodMonths,
  };

  const values = {
    productId,
    sku,
    titleFa: `${plan.titleFa} — ${period.label}`,
    colorNameFa: "استاندارد",
    colorSlug: "standard",
    materialNameFa: "ابری",
    materialSlug: "cloud",
    size: period.label,
    isDefault,
    metadata,
    ...tier(period.toman),
  };

  const existing = await db.query.productVariants.findFirst({
    where: (variant, { eq: whereEq }) => whereEq(variant.sku, sku),
    columns: { id: true },
  });

  if (existing) {
    await db
      .update(schema.productVariants)
      .set(values)
      .where(eq(schema.productVariants.id, existing.id));
    return { variantId: existing.id, sku };
  }

  const [row] = await db
    .insert(schema.productVariants)
    .values(values)
    .returning({ id: schema.productVariants.id });
  return { variantId: row.id, sku };
}

// Top up AVAILABLE inventory units to STOCK_PER_VARIANT without duplicating.
async function topUpInventory(variantId: string, sku: string): Promise<number> {
  const available = await db.query.inventoryUnits.findMany({
    where: (unit, { and: andOp, eq: whereEq }) =>
      andOp(whereEq(unit.variantId, variantId), whereEq(unit.status, "AVAILABLE")),
    columns: { id: true },
  });

  const missing = STOCK_PER_VARIANT - available.length;

  if (missing <= 0) {
    return 0;
  }

  await db.insert(schema.inventoryUnits).values(
    Array.from({ length: missing }, (_, n) => ({
      variantId,
      code: stockCode(sku, available.length + n),
    })),
  );

  return missing;
}

async function main() {
  console.log("Seeding VPS plan products (idempotent)…");

  const categoryId = await upsertHostingCategory();

  let products = 0;
  let variants = 0;
  let units = 0;

  for (const plan of PLANS) {
    const productId = await upsertProduct(plan, categoryId);
    products += 1;

    for (let i = 0; i < plan.periods.length; i += 1) {
      const period = plan.periods[i];
      const { variantId, sku } = await upsertVariant(productId, plan, period, i === 0);
      variants += 1;
      units += await topUpInventory(variantId, sku);
    }
  }

  console.log(
    `Done. ${products} server plans reconciled, ${variants} variants upserted, ${units} inventory units added.`,
  );
}

main()
  .then(() => pool.end())
  .catch(async (error) => {
    console.error(error);
    await pool.end();
    process.exit(1);
  });
