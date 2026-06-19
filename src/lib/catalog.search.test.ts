import { expect, test } from "vitest";
import {
  categories,
  inventoryUnits,
  products,
  productTags,
  productVariants,
  tags,
} from "@/db/schema";
import { withRollback } from "../../test/db";
import { getProductsForListing } from "./catalog";

const SEARCH_TERM = "جستجو-ویژه-تست";

// ─── Seed helpers ──────────────────────────────────────────────────────────────

async function seedProduct(
  tx: any,
  overrides: {
    titleFa?: string;
    summaryFa?: string;
    status?: "DRAFT" | "ACTIVE" | "DISABLED" | "ARCHIVED";
    withStock?: boolean;
  } = {},
) {
  const { titleFa = "محصول دیگر", summaryFa, status = "ACTIVE", withStock = true } = overrides;

  const [product] = await tx
    .insert(products)
    .values({
      slug: `test-product-${crypto.randomUUID()}`,
      titleFa,
      summaryFa: summaryFa ?? null,
      status,
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
      publicPriceAmount: "200000",
    })
    .returning({ id: productVariants.id });

  if (withStock) {
    await tx.insert(inventoryUnits).values({
      variantId: variant.id,
      code: `UNIT-${crypto.randomUUID()}`,
      status: "AVAILABLE",
    });
  }

  return product.id;
}

// ─── Tests ─────────────────────────────────────────────────────────────────────

test("search: includes DISABLED product matching query", async () => {
  await withRollback(async (tx) => {
    const disabledId = await seedProduct(tx, {
      titleFa: `محصول ${SEARCH_TERM}`,
      status: "DISABLED",
    });

    // Seed a non-matching product to ensure we are filtering correctly
    await seedProduct(tx, { titleFa: "محصول کاملاً متفاوت", status: "ACTIVE" });

    const { items } = await getProductsForListing(null, { q: SEARCH_TERM, _db: tx });
    const ids = items.map((p) => p.id);

    expect(ids).toContain(disabledId);
  });
});

test("search: includes out-of-stock (ACTIVE, zero units) product matching query", async () => {
  await withRollback(async (tx) => {
    const oosId = await seedProduct(tx, {
      titleFa: `محصول ${SEARCH_TERM}`,
      status: "ACTIVE",
      withStock: false,
    });

    await seedProduct(tx, { titleFa: "محصول کاملاً متفاوت", status: "ACTIVE" });

    const { items } = await getProductsForListing(null, { q: SEARCH_TERM, _db: tx });
    const ids = items.map((p) => p.id);

    expect(ids).toContain(oosId);
  });
});

test("search: excludes ARCHIVED product even if it matches query", async () => {
  await withRollback(async (tx) => {
    const archivedId = await seedProduct(tx, {
      titleFa: `محصول ${SEARCH_TERM}`,
      status: "ARCHIVED",
    });

    const { items } = await getProductsForListing(null, { q: SEARCH_TERM, _db: tx });
    const ids = items.map((p) => p.id);

    expect(ids).not.toContain(archivedId);
  });
});

test("search: excludes non-matching product", async () => {
  await withRollback(async (tx) => {
    const nonMatchId = await seedProduct(tx, {
      titleFa: "محصولی کاملاً دیگر بدون کلمه کلیدی",
      status: "ACTIVE",
    });

    // Seed one matching product so the query returns something
    await seedProduct(tx, {
      titleFa: `محصول ${SEARCH_TERM}`,
      status: "ACTIVE",
    });

    const { items } = await getProductsForListing(null, { q: SEARCH_TERM, _db: tx });
    const ids = items.map((p) => p.id);

    expect(ids).not.toContain(nonMatchId);
  });
});

test("search: matches summaryFa field", async () => {
  await withRollback(async (tx) => {
    const summaryMatchId = await seedProduct(tx, {
      titleFa: "عنوان بی‌ربط",
      summaryFa: `توضیح ${SEARCH_TERM}`,
      status: "ACTIVE",
    });

    const { items } = await getProductsForListing(null, { q: SEARCH_TERM, _db: tx });
    const ids = items.map((p) => p.id);

    expect(ids).toContain(summaryMatchId);
  });
});

test("search: matches by tag name", async () => {
  await withRollback(async (tx) => {
    const productId = await seedProduct(tx, {
      titleFa: "محصول بی‌عنوان",
      status: "ACTIVE",
    });

    const [tag] = await tx
      .insert(tags)
      .values({
        slug: `tag-${crypto.randomUUID()}`,
        titleFa: SEARCH_TERM,
      })
      .returning({ id: tags.id });

    await tx.insert(productTags).values({ productId, tagId: tag.id });

    // Non-matching product (no tag)
    await seedProduct(tx, { titleFa: "دیگری", status: "ACTIVE" });

    const { items } = await getProductsForListing(null, { q: SEARCH_TERM, _db: tx });
    const ids = items.map((p) => p.id);

    expect(ids).toContain(productId);
  });
});

test("search: matches by category name", async () => {
  await withRollback(async (tx) => {
    const [cat] = await tx
      .insert(categories)
      .values({
        slug: `cat-${crypto.randomUUID()}`,
        titleFa: SEARCH_TERM,
      })
      .returning({ id: categories.id });

    const [product] = await tx
      .insert(products)
      .values({
        slug: `test-product-${crypto.randomUUID()}`,
        titleFa: "عنوان بی‌ربط",
        status: "ACTIVE",
        fulfillmentType: "DIGITAL",
        categoryId: cat.id,
      })
      .returning({ id: products.id });

    await tx.insert(productVariants).values({
      productId: product.id,
      sku: `sku-${crypto.randomUUID()}`,
      titleFa: "واریانت",
      colorNameFa: "سبز",
      colorSlug: "green",
      materialNameFa: "پنبه",
      materialSlug: "cotton",
      size: "L",
      publicPriceAmount: "150000",
    });

    const { items } = await getProductsForListing(null, { q: SEARCH_TERM, _db: tx });
    const ids = items.map((p) => p.id);

    expect(ids).toContain(product.id);
  });
});

test("search: empty q returns all non-ARCHIVED products", async () => {
  await withRollback(async (tx) => {
    const activeId = await seedProduct(tx, { titleFa: "محصول فعال", status: "ACTIVE" });
    const disabledId = await seedProduct(tx, { titleFa: "محصول غیرفعال", status: "DISABLED" });
    const archivedId = await seedProduct(tx, { titleFa: "محصول آرشیو", status: "ARCHIVED" });

    const { items } = await getProductsForListing(null, { q: "", _db: tx });
    const ids = items.map((p) => p.id);

    expect(ids).toContain(activeId);
    expect(ids).toContain(disabledId);
    expect(ids).not.toContain(archivedId);
  });
});

test("search: no q at all returns all non-ARCHIVED products", async () => {
  await withRollback(async (tx) => {
    const activeId = await seedProduct(tx, { titleFa: "محصول فعال", status: "ACTIVE" });
    const archivedId = await seedProduct(tx, { titleFa: "محصول آرشیو", status: "ARCHIVED" });

    const { items } = await getProductsForListing(null, { _db: tx });
    const ids = items.map((p) => p.id);

    expect(ids).toContain(activeId);
    expect(ids).not.toContain(archivedId);
  });
});
