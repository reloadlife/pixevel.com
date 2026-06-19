import { eq } from "drizzle-orm";

import { homeBlockItems, homeBlocks } from "@/db/schema";
import { getDb } from "@/lib/db";

type HomeBlockType =
  | "SHOWCASE"
  | "SHOWCASE_RANDOM"
  | "SHOWCASE_HERO"
  | "SHOWCASE_HERO_NO_PRODUCT_INFO"
  | "LEFT_TO_RIGHT_GALLERY"
  | "FULLSCREEN_HORIZONTAL_GALLERY";

export type HomeBlockInput = {
  titleFa: string;
  subtitleFa?: string;
  type?: HomeBlockType;
  source?: "MANUAL" | "DYNAMIC";
  isActive?: boolean;
  sortOrder?: number;
  categoryId?: string | null;
  categorySlug?: string;
  tagId?: string | null;
  tagSlug?: string;
  sortKey?: string;
  maxItems?: number;
  productIds?: string[];
  productSlugs?: string[];
};

type HomeBlockUpdateInput = Partial<HomeBlockInput>;

const HOME_BLOCK_TYPES = new Set([
  "SHOWCASE",
  "SHOWCASE_RANDOM",
  "SHOWCASE_HERO",
  "SHOWCASE_HERO_NO_PRODUCT_INFO",
  "LEFT_TO_RIGHT_GALLERY",
  "FULLSCREEN_HORIZONTAL_GALLERY",
]);
const HOME_BLOCK_SOURCES = new Set(["MANUAL", "DYNAMIC"]);

function cleanOptional(value?: string) {
  const clean = value?.trim();
  return clean || undefined;
}

function uniqueClean(values: string[] | undefined) {
  return Array.from(new Set((values ?? []).map((value) => value.trim()).filter(Boolean)));
}

function hasOwn(input: object, field: keyof HomeBlockInput) {
  return Object.prototype.hasOwnProperty.call(input, field);
}

function normalizeHomeBlockType(value: HomeBlockInput["type"] | undefined, fallback: HomeBlockInput["type"]) {
  const type = value ?? fallback;

  if (!type || !HOME_BLOCK_TYPES.has(type)) {
    throw new Error("INVALID_TYPE");
  }

  return type;
}

function normalizeHomeBlockSource(
  value: HomeBlockInput["source"] | undefined,
  fallback: HomeBlockInput["source"]
) {
  const source = value ?? fallback;

  if (!source || !HOME_BLOCK_SOURCES.has(source)) {
    throw new Error("INVALID_SOURCE");
  }

  return source;
}

function normalizeSortOrder(value: number | undefined, fallback: number) {
  const sortOrder = Number(value ?? fallback);
  return Number.isFinite(sortOrder) ? Math.trunc(sortOrder) : fallback;
}

function normalizeMaxItems(value: number | undefined, fallback: number) {
  const maxItems = Number(value ?? fallback);
  return Math.min(Math.max(Number.isFinite(maxItems) ? Math.trunc(maxItems) : fallback, 1), 48);
}

async function findCategoryId(categoryId?: string | null, categorySlug?: string) {
  if (categoryId) {
    const category = await getDb().query.categories.findFirst({
      where: (item, { eq }) => eq(item.id, categoryId),
      columns: { id: true },
    });

    return category?.id ?? null;
  }

  const clean = cleanOptional(categorySlug);

  if (!clean) {
    return null;
  }

  const category = await getDb().query.categories.findFirst({
    where: (item, { or, eq }) => or(eq(item.slug, clean), eq(item.titleFa, clean)),
    columns: { id: true },
  });

  return category?.id ?? null;
}

async function findTagId(tagId?: string | null, tagSlug?: string) {
  if (tagId) {
    const tag = await getDb().query.tags.findFirst({
      where: (item, { eq }) => eq(item.id, tagId),
      columns: { id: true },
    });

    return tag?.id ?? null;
  }

  const clean = cleanOptional(tagSlug);

  if (!clean) {
    return null;
  }

  const tag = await getDb().query.tags.findFirst({
    where: (item, { or, eq }) => or(eq(item.slug, clean), eq(item.titleFa, clean)),
    columns: { id: true },
  });

  return tag?.id ?? null;
}

async function findManualProducts(input: Pick<HomeBlockInput, "productIds" | "productSlugs">) {
  const productIds = uniqueClean(input.productIds);

  if (productIds.length > 0) {
    const products = await getDb().query.products.findMany({
      where: (product, { inArray }) => inArray(product.id, productIds),
      columns: { id: true },
    });
    const productById = new Map(products.map((product) => [product.id, product]));

    return productIds
      .map((id) => productById.get(id))
      .filter((product): product is { id: string } => Boolean(product));
  }

  const productSlugs = uniqueClean(input.productSlugs);

  if (productSlugs.length === 0) {
    return [];
  }

  const products = await getDb().query.products.findMany({
    where: (product, { inArray }) => inArray(product.slug, productSlugs),
    columns: { id: true, slug: true },
  });
  const productBySlug = new Map(products.map((product) => [product.slug, product]));

  return productSlugs
    .map((slug) => productBySlug.get(slug))
    .filter((product): product is { id: string; slug: string } => Boolean(product));
}

export async function createAdminHomeBlock(input: HomeBlockInput) {
  const titleFa = input.titleFa.trim();

  if (!titleFa) {
    throw new Error("INVALID_TITLE");
  }

  const type = normalizeHomeBlockType(input.type, "LEFT_TO_RIGHT_GALLERY");
  const source = normalizeHomeBlockSource(input.source, "MANUAL");
  const [categoryId, tagId, manualProducts] = await Promise.all([
    findCategoryId(input.categoryId, input.categorySlug),
    findTagId(input.tagId, input.tagSlug),
    findManualProducts(input),
  ]);

  return getDb().transaction(async (tx) => {
    const [block] = await tx
      .insert(homeBlocks)
      .values({
        titleFa,
        subtitleFa: input.subtitleFa?.trim() || null,
        type,
        source,
        isActive: input.isActive ?? true,
        sortOrder: normalizeSortOrder(input.sortOrder, 0),
        categoryId: source === "DYNAMIC" ? categoryId : null,
        tagId: source === "DYNAMIC" ? tagId : null,
        sortKey: input.sortKey ?? "newest",
        maxItems: normalizeMaxItems(input.maxItems, 12),
      })
      .returning();

    if (source === "MANUAL" && manualProducts.length > 0) {
      await tx.insert(homeBlockItems).values(
        manualProducts.map((product, index) => ({
          blockId: block.id,
          productId: product.id,
          sortOrder: index,
        }))
      );
    }

    const created = await tx.query.homeBlocks.findFirst({
      where: (item, { eq }) => eq(item.id, block.id),
      with: {
        category: true,
        tag: true,
        items: {
          with: {
            product: {
              columns: { id: true, slug: true, titleFa: true, status: true },
            },
          },
          orderBy: (item, { asc }) => [asc(item.sortOrder)],
        },
      },
    });

    if (!created) {
      throw new Error("HOME_BLOCK_NOT_FOUND");
    }

    return created;
  });
}

export async function updateAdminHomeBlock(id: string, input: HomeBlockUpdateInput) {
  const db = getDb();
  const current = await db.query.homeBlocks.findFirst({
    where: (item, { eq }) => eq(item.id, id),
  });

  if (!current) {
    throw new Error("HOME_BLOCK_NOT_FOUND");
  }

  const titleFa = input.titleFa === undefined ? current.titleFa : input.titleFa.trim();

  if (!titleFa) {
    throw new Error("INVALID_TITLE");
  }

  const type = normalizeHomeBlockType(input.type, current.type);
  const source = normalizeHomeBlockSource(input.source, current.source);
  const shouldResolveCategory = hasOwn(input, "categoryId") || hasOwn(input, "categorySlug");
  const shouldResolveTag = hasOwn(input, "tagId") || hasOwn(input, "tagSlug");
  const shouldReplaceManualItems =
    source === "MANUAL" &&
    (hasOwn(input, "productIds") || hasOwn(input, "productSlugs") || input.source === "MANUAL");
  const [categoryId, tagId, manualProducts] = await Promise.all([
    source === "DYNAMIC" && shouldResolveCategory
      ? findCategoryId(input.categoryId, input.categorySlug)
      : Promise.resolve(source === "DYNAMIC" ? current.categoryId : null),
    source === "DYNAMIC" && shouldResolveTag
      ? findTagId(input.tagId, input.tagSlug)
      : Promise.resolve(source === "DYNAMIC" ? current.tagId : null),
    shouldReplaceManualItems ? findManualProducts(input) : Promise.resolve([]),
  ]);

  return db.transaction(async (tx) => {
    if (input.source === "DYNAMIC" || shouldReplaceManualItems) {
      await tx.delete(homeBlockItems).where(eq(homeBlockItems.blockId, id));
    }

    await tx
      .update(homeBlocks)
      .set({
        titleFa,
        subtitleFa:
          input.subtitleFa === undefined ? current.subtitleFa : input.subtitleFa.trim() || null,
        type,
        source,
        ...(typeof input.isActive === "boolean" ? { isActive: input.isActive } : {}),
        sortOrder: normalizeSortOrder(input.sortOrder, current.sortOrder),
        categoryId,
        tagId,
        sortKey: input.sortKey?.trim() || current.sortKey,
        maxItems: normalizeMaxItems(input.maxItems, current.maxItems),
      })
      .where(eq(homeBlocks.id, id));

    if (shouldReplaceManualItems && manualProducts.length > 0) {
      await tx.insert(homeBlockItems).values(
        manualProducts.map((product, index) => ({
          blockId: id,
          productId: product.id,
          sortOrder: index,
        }))
      );
    }

    const block = await tx.query.homeBlocks.findFirst({
      where: (item, { eq }) => eq(item.id, id),
      with: {
        category: true,
        tag: true,
        items: {
          with: {
            product: {
              columns: { id: true, slug: true, titleFa: true, status: true },
            },
          },
          orderBy: (item, { asc }) => [asc(item.sortOrder)],
        },
      },
    });

    if (!block) {
      throw new Error("HOME_BLOCK_NOT_FOUND");
    }

    return block;
  });
}

export async function deleteAdminHomeBlock(id: string) {
  const existing = await getDb().query.homeBlocks.findFirst({
    where: (item, { eq }) => eq(item.id, id),
    columns: { id: true },
  });

  if (!existing) {
    return null;
  }

  await getDb().delete(homeBlocks).where(eq(homeBlocks.id, id));

  return existing;
}

export async function listAdminHomeBlocks() {
  return getDb().query.homeBlocks.findMany({
    with: {
      category: true,
      tag: true,
      items: {
        with: {
          product: {
            columns: { id: true, slug: true, titleFa: true, status: true },
          },
        },
        orderBy: (item, { asc }) => [asc(item.sortOrder)],
      },
    },
    orderBy: (block, { asc }) => [asc(block.sortOrder)],
  });
}

export type AdminHomeBlockRecord = Awaited<ReturnType<typeof listAdminHomeBlocks>>[number];

export function toAdminHomeBlockRow(block: AdminHomeBlockRecord) {
  return {
    id: block.id,
    titleFa: block.titleFa,
    subtitleFa: block.subtitleFa,
    type: block.type,
    source: block.source,
    isActive: block.isActive,
    sortOrder: block.sortOrder,
    sortKey: block.sortKey,
    maxItems: block.maxItems,
    category: block.category
      ? {
          id: block.category.id,
          slug: block.category.slug,
          titleFa: block.category.titleFa,
        }
      : null,
    tag: block.tag
      ? {
          id: block.tag.id,
          slug: block.tag.slug,
          titleFa: block.tag.titleFa,
        }
      : null,
    items: block.items.map((item) => ({
      id: item.id,
      sortOrder: item.sortOrder,
      product: item.product,
    })),
  };
}
