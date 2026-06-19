import { expect, test } from "vitest";
import { inventoryUnits, products, productVariants } from "@/db/schema";
import { withRollback } from "../../test/db";
import { getProductsForListing } from "./catalog";

// ─── Seed helper ──────────────────────────────────────────────────────────────

async function seedActiveProduct(tx: any, titleFa: string) {
  const [product] = await tx
    .insert(products)
    .values({
      slug: `pagination-test-${crypto.randomUUID()}`,
      titleFa,
      status: "ACTIVE",
      fulfillmentType: "DIGITAL",
    })
    .returning({ id: products.id });

  const [variant] = await tx
    .insert(productVariants)
    .values({
      productId: product.id,
      sku: `sku-${crypto.randomUUID()}`,
      titleFa: "واریانت تست",
      colorNameFa: "آبی",
      colorSlug: "blue",
      materialNameFa: "پارچه",
      materialSlug: "fabric",
      size: "M",
      publicPriceAmount: "100000",
    })
    .returning({ id: productVariants.id });

  await tx.insert(inventoryUnits).values({
    variantId: variant.id,
    code: `UNIT-${crypto.randomUUID()}`,
    status: "AVAILABLE",
  });

  return product.id;
}

// ─── Tests ─────────────────────────────────────────────────────────────────────

test("pagination: page 1 and page 2 return disjoint items", async () => {
  await withRollback(async (tx) => {
    // Seed 5 products so with pageSize=2 we have 3 pages
    for (let i = 0; i < 5; i++) {
      await seedActiveProduct(tx, `صفحه‌بندی محصول ${i + 1}`);
    }

    const page1 = await getProductsForListing(null, { page: 1, pageSize: 2, _db: tx });
    const page2 = await getProductsForListing(null, { page: 2, pageSize: 2, _db: tx });

    const ids1 = new Set(page1.items.map((p) => p.id));
    const ids2 = new Set(page2.items.map((p) => p.id));

    // Must be disjoint
    for (const id of ids2) {
      expect(ids1.has(id)).toBe(false);
    }

    expect(page1.items).toHaveLength(2);
    expect(page2.items).toHaveLength(2);
  });
});

test("pagination: meta.total reflects matching seeded products (not paginated)", async () => {
  await withRollback(async (tx) => {
    for (let i = 0; i < 5; i++) {
      await seedActiveProduct(tx, `مجموع محصول ${i + 1}`);
    }

    const { meta } = await getProductsForListing(null, { page: 1, pageSize: 2, _db: tx });

    // Total must include all 5 seeded + any pre-existing non-ARCHIVED products in the DB.
    // We only assert it is >= 5, since the DB may have other products.
    expect(meta.total).toBeGreaterThanOrEqual(5);
    expect(meta.page).toBe(1);
    expect(meta.pageSize).toBe(2);
  });
});

test("pagination: meta.hasNext true on page 1, false on last page", async () => {
  await withRollback(async (tx) => {
    // Seed exactly 5 products so with pageSize=2: pages 1,2 have hasNext=true, page 3 has hasNext=false
    for (let i = 0; i < 5; i++) {
      await seedActiveProduct(tx, `آخرین-صفحه-محصول ${i + 1}`);
    }

    const page1 = await getProductsForListing(null, { page: 1, pageSize: 2, _db: tx });
    expect(page1.meta.hasNext).toBe(true);

    // Last page for 5 items with pageSize 2 is page 3 (items 5..5)
    // total pages = ceil(total/2). total >= 5. Let's compute from total.
    const totalPages = Math.ceil(page1.meta.total / 2);
    const lastPage = await getProductsForListing(null, {
      page: totalPages,
      pageSize: 2,
      _db: tx,
    });
    expect(lastPage.meta.hasNext).toBe(false);
  });
});

test("pagination: meta.page and meta.pageSize echo the request", async () => {
  await withRollback(async (tx) => {
    await seedActiveProduct(tx, "تست اطلاعات متا");

    const { meta } = await getProductsForListing(null, { page: 3, pageSize: 7, _db: tx });

    expect(meta.page).toBe(3);
    expect(meta.pageSize).toBe(7);
  });
});

test("pagination: page clamped to 1 when below 1", async () => {
  await withRollback(async (tx) => {
    await seedActiveProduct(tx, "محصول کلمپ");

    const { meta } = await getProductsForListing(null, { page: 0, pageSize: 10, _db: tx });

    expect(meta.page).toBe(1);
  });
});

test("pagination: search + pagination — meta.total reflects filtered count", async () => {
  const UNIQUE_TERM = `پیجینیشن-یونیک-${crypto.randomUUID().slice(0, 8)}`;

  await withRollback(async (tx) => {
    // 3 matching products
    for (let i = 0; i < 3; i++) {
      await seedActiveProduct(tx, `${UNIQUE_TERM} ${i}`);
    }
    // 2 non-matching
    await seedActiveProduct(tx, "محصول بی‌ربط الف");
    await seedActiveProduct(tx, "محصول بی‌ربط ب");

    const { meta } = await getProductsForListing(null, {
      q: UNIQUE_TERM,
      page: 1,
      pageSize: 10,
      _db: tx,
    });

    expect(meta.total).toBe(3);
  });
});
