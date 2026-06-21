import "dotenv/config";

import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import * as schema from "../src/db/schema";

/**
 * Seed / reconcile the Pixevel category tree across the four product worlds:
 *
 *   1. گیفت کارت        (gift-cards)   — digital codes: streaming, gaming, app stores
 *   2. سی‌دی‌کی و بازی   (cd-keys)      — game licences & top-ups (digital)
 *   3. گیمینگ و لوازم   (gaming-gear)  — physical controllers, headsets, keyboards…
 *   4. دامنه            (domains)      — domain registration
 *   5. سرور و هاست       (hosting)      — VPS / cloud servers & hosting
 *
 * IDEMPOTENT: every category is upserted by its unique `slug`. Re-running only
 * updates titleFa / parent / sortOrder / visibility — it never duplicates rows
 * and never deletes categories that already exist (including ones from the main
 * `seed.ts`, e.g. `music-streaming`, `gaming`, `app-stores`).
 *
 * Run: bun run scripts/seed-categories.ts   (or: tsx scripts/seed-categories.ts)
 */

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle({ client: pool, schema });

type CategorySeed = {
  slug: string;
  titleFa: string;
  descriptionFa?: string;
  parentSlug: string | null;
  sortOrder: number;
};

// Ordered parents-first so parentId references resolve during a fresh run.
// sortOrder ranges are spaced per world (0,10,20…) so worlds stay grouped and
// new children can slot in without renumbering everything.
const CATEGORIES: CategorySeed[] = [
  // — World 1: Gift cards (digital codes) ----------------------------------
  {
    slug: "gift-cards",
    titleFa: "گیفت کارت",
    descriptionFa: "کدهای دیجیتال استریم، گیمینگ و اپ استورها با تحویل آنی.",
    parentSlug: null,
    sortOrder: 0,
  },
  { slug: "music-streaming", titleFa: "موزیک و استریم", parentSlug: "gift-cards", sortOrder: 1 },
  { slug: "gaming", titleFa: "گیفت کارت گیمینگ", parentSlug: "gift-cards", sortOrder: 2 },
  { slug: "app-stores", titleFa: "اپ استورها", parentSlug: "gift-cards", sortOrder: 3 },
  { slug: "shopping-cards", titleFa: "خرید و شاپینگ", parentSlug: "gift-cards", sortOrder: 4 },

  // — World 2: CD-keys & games (digital licences) --------------------------
  {
    slug: "cd-keys",
    titleFa: "سی‌دی‌کی و بازی",
    descriptionFa: "لایسنس اورجینال بازی‌ها و آیتم‌های درون‌بازی برای استیم، اپیک و کنسول‌ها.",
    parentSlug: null,
    sortOrder: 10,
  },
  { slug: "pc-games", titleFa: "بازی‌های کامپیوتر", parentSlug: "cd-keys", sortOrder: 11 },
  { slug: "console-games", titleFa: "بازی‌های کنسول", parentSlug: "cd-keys", sortOrder: 12 },
  {
    slug: "game-subscriptions",
    titleFa: "اشتراک و سرویس بازی",
    parentSlug: "cd-keys",
    sortOrder: 13,
  },
  { slug: "in-game-topup", titleFa: "شارژ درون‌بازی", parentSlug: "cd-keys", sortOrder: 14 },

  // — World 3: Gaming gear (physical) --------------------------------------
  {
    slug: "gaming-gear",
    titleFa: "گیمینگ و لوازم جانبی",
    descriptionFa: "کنترلر، هدست، کیبورد و ماوس گیمینگ با ارسال فیزیکی.",
    parentSlug: null,
    sortOrder: 20,
  },
  { slug: "controllers", titleFa: "دسته و کنترلر", parentSlug: "gaming-gear", sortOrder: 21 },
  { slug: "headsets", titleFa: "هدست و صدا", parentSlug: "gaming-gear", sortOrder: 22 },
  { slug: "keyboards-mice", titleFa: "کیبورد و ماوس", parentSlug: "gaming-gear", sortOrder: 23 },
  { slug: "consoles", titleFa: "کنسول و سخت‌افزار", parentSlug: "gaming-gear", sortOrder: 24 },

  // — World 4: Domains -----------------------------------------------------
  {
    slug: "domains",
    titleFa: "دامنه",
    descriptionFa: "ثبت و تمدید دامنه با پسوندهای بین‌المللی و ملی.",
    parentSlug: null,
    sortOrder: 30,
  },
  {
    slug: "domains-international",
    titleFa: "دامنه بین‌المللی",
    parentSlug: "domains",
    sortOrder: 31,
  },
  { slug: "domains-ir", titleFa: "دامنه ملی (IR)", parentSlug: "domains", sortOrder: 32 },

  // — World 5: Servers & hosting (VPS) -------------------------------------
  {
    slug: "hosting",
    titleFa: "سرور و هاست",
    descriptionFa: "سرور مجازی، سرور ابری و هاست با تحویل سریع و آپ‌تایم بالا.",
    parentSlug: null,
    sortOrder: 40,
  },
  { slug: "vps", titleFa: "سرور مجازی (VPS)", parentSlug: "hosting", sortOrder: 41 },
  { slug: "cloud-servers", titleFa: "سرور ابری", parentSlug: "hosting", sortOrder: 42 },
  { slug: "web-hosting", titleFa: "هاست و میزبانی", parentSlug: "hosting", sortOrder: 43 },
];

async function upsertCategory(seed: CategorySeed, idBySlug: Map<string, string>) {
  const parentId = seed.parentSlug ? (idBySlug.get(seed.parentSlug) ?? null) : null;

  const existing = await db.query.categories.findFirst({
    where: (category, { eq: whereEq }) => whereEq(category.slug, seed.slug),
    columns: { id: true },
  });

  if (existing) {
    await db
      .update(schema.categories)
      .set({
        titleFa: seed.titleFa,
        descriptionFa: seed.descriptionFa ?? null,
        parentId,
        sortOrder: seed.sortOrder,
        isVisible: true,
      })
      .where(eq(schema.categories.id, existing.id));
    idBySlug.set(seed.slug, existing.id);
    return "updated" as const;
  }

  const [row] = await db
    .insert(schema.categories)
    .values({
      slug: seed.slug,
      titleFa: seed.titleFa,
      descriptionFa: seed.descriptionFa ?? null,
      parentId,
      sortOrder: seed.sortOrder,
      isVisible: true,
    })
    .returning({ id: schema.categories.id });
  idBySlug.set(seed.slug, row.id);
  return "inserted" as const;
}

async function main() {
  console.log("Upserting category tree (idempotent by slug)…");

  const idBySlug = new Map<string, string>();
  let inserted = 0;
  let updated = 0;

  // Parents are listed before children, so a single ordered pass resolves
  // every parentId from the running map.
  for (const seed of CATEGORIES) {
    const result = await upsertCategory(seed, idBySlug);
    if (result === "inserted") inserted += 1;
    else updated += 1;
  }

  console.log(
    `Done. ${CATEGORIES.length} categories reconciled (${inserted} inserted, ${updated} updated).`,
  );
}

main()
  .then(() => pool.end())
  .catch(async (error) => {
    console.error(error);
    await pool.end();
    process.exit(1);
  });
