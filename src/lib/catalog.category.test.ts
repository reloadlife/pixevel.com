import { expect, test } from "vitest";
import { categories, inventoryUnits, products, productVariants } from "@/db/schema";
import { withRollback } from "../../test/db";
import { getProductsForListing } from "./catalog";

// ─── Seed helpers ──────────────────────────────────────────────────────────────

async function seedCategory(tx: any, overrides: { slug?: string; titleFa?: string } = {}) {
  const [cat] = await tx
    .insert(categories)
    .values({
      slug: overrides.slug ?? `cat-${crypto.randomUUID()}`,
      titleFa: overrides.titleFa ?? "دسته تست",
    })
    .returning({ id: categories.id });
  return cat.id as string;
}

async function seedProduct(
  tx: any,
  categoryId: string | null,
  overrides: {
    titleFa?: string;
    status?: "DRAFT" | "ACTIVE" | "DISABLED" | "ARCHIVED";
    withStock?: boolean;
  } = {},
) {
  const { titleFa = "محصول تست دسته", status = "ACTIVE", withStock = true } = overrides;

  const [product] = await tx
    .insert(products)
    .values({
      slug: `cat-test-${crypto.randomUUID()}`,
      titleFa,
      status,
      fulfillmentType: "DIGITAL",
      categoryId,
    })
    .returning({ id: products.id });

  const [variant] = await tx
    .insert(productVariants)
    .values({
      productId: product.id,
      sku: `sku-${crypto.randomUUID()}`,
      titleFa: "واریانت",
      publicPriceAmount: "300000",
    })
    .returning({ id: productVariants.id });

  if (withStock) {
    await tx.insert(inventoryUnits).values({
      variantId: variant.id,
      code: `UNIT-${crypto.randomUUID()}`,
      status: "AVAILABLE",
    });
  }

  return product.id as string;
}

// ─── Tests ─────────────────────────────────────────────────────────────────────

test("category filter: returns only products in the target category", async () => {
  await withRollback(async (tx) => {
    const targetSlug = `target-${crypto.randomUUID()}`;
    const otherSlug = `other-${crypto.randomUUID()}`;

    const targetCatId = await seedCategory(tx, { slug: targetSlug, titleFa: "دسته هدف" });
    const otherCatId = await seedCategory(tx, { slug: otherSlug, titleFa: "دسته دیگر" });

    // Target category products
    const activeId = await seedProduct(tx, targetCatId, { status: "ACTIVE", withStock: true });
    const disabledId = await seedProduct(tx, targetCatId, { status: "DISABLED", withStock: true });
    const oosId = await seedProduct(tx, targetCatId, { status: "ACTIVE", withStock: false });

    // Other category product — must NOT appear
    const otherId = await seedProduct(tx, otherCatId, { status: "ACTIVE", withStock: true });

    // ARCHIVED product in target category — must NOT appear
    const archivedId = await seedProduct(tx, targetCatId, { status: "ARCHIVED", withStock: true });

    const { items } = await getProductsForListing(null, { category: targetSlug, _db: tx });
    const ids = items.map((p) => p.id);

    // Target category products are included (active, disabled, out-of-stock)
    expect(ids).toContain(activeId);
    expect(ids).toContain(disabledId);
    expect(ids).toContain(oosId);

    // Other category product is excluded
    expect(ids).not.toContain(otherId);

    // ARCHIVED product is excluded even if in target category
    expect(ids).not.toContain(archivedId);
  });
});

test("category filter: no results for unknown slug", async () => {
  await withRollback(async (tx) => {
    // Seed a product in a known category
    const catId = await seedCategory(tx, { slug: `known-${crypto.randomUUID()}` });
    await seedProduct(tx, catId);

    const { items } = await getProductsForListing(null, {
      category: `nonexistent-slug-${crypto.randomUUID()}`,
      _db: tx,
    });

    // Items from this rollback-isolated tx must be empty for unknown slug
    expect(items).toHaveLength(0);
  });
});

test("category filter: combined with q search narrows to intersection", async () => {
  await withRollback(async (tx) => {
    const targetSlug = `combo-${crypto.randomUUID()}`;
    const otherSlug = `combo-other-${crypto.randomUUID()}`;
    const UNIQUE = `یونیک-دسته-${crypto.randomUUID().slice(0, 8)}`;

    const targetCatId = await seedCategory(tx, { slug: targetSlug, titleFa: "دسته ترکیبی" });
    const otherCatId = await seedCategory(tx, { slug: otherSlug, titleFa: "دسته دیگر ترکیبی" });

    // Matches search term AND is in target category
    const matchInTarget = await seedProduct(tx, targetCatId, {
      titleFa: `محصول ${UNIQUE}`,
    });

    // Matches search term but in wrong category — should be excluded
    const matchInOther = await seedProduct(tx, otherCatId, {
      titleFa: `محصول ${UNIQUE}`,
    });

    const { items } = await getProductsForListing(null, {
      q: UNIQUE,
      category: targetSlug,
      _db: tx,
    });
    const ids = items.map((p) => p.id);

    expect(ids).toContain(matchInTarget);
    expect(ids).not.toContain(matchInOther);
  });
});
