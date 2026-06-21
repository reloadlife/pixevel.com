import { randomBytes } from "node:crypto";

import { and, eq, notInArray } from "drizzle-orm";

import {
  type BaseCurrency,
  categories,
  type FulfillmentType,
  inventoryUnits,
  productImages,
  products,
  productTags,
  productVariants,
  tags as tagsTable,
} from "@/db/schema";
import { getDb } from "@/lib/db";
import { slugify } from "@/lib/format";

type OptionInput = {
  label: string;
  slug?: string;
  hex?: string;
};

const FULFILLMENT_TYPES = new Set<FulfillmentType>(["DIGITAL", "PHYSICAL"]);

function cleanFulfillmentType(value: unknown): FulfillmentType | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const normalized = value.trim().toUpperCase();

  if (!FULFILLMENT_TYPES.has(normalized as FulfillmentType)) {
    throw new Error("INVALID_FULFILLMENT_TYPE");
  }

  return normalized as FulfillmentType;
}

/**
 * Normalize an operator-supplied list of inventory codes (real gift-card codes /
 * CD keys). Trims, drops blanks, and de-duplicates within the submitted batch
 * (case-sensitive — codes are secrets and casing can be significant).
 */
function normalizeCodes(codes: string[] | undefined): string[] {
  if (!codes || codes.length === 0) {
    return [];
  }

  const seen = new Set<string>();
  const result: string[] = [];

  for (const raw of codes) {
    if (typeof raw !== "string") {
      continue;
    }

    const code = raw.trim();

    if (!code || seen.has(code)) {
      continue;
    }

    seen.add(code);
    result.push(code);
  }

  return result;
}

export type StockInsertResult = {
  added: number;
  skipped: number;
  requested: number;
};

type TxLike = Parameters<Parameters<ReturnType<typeof getDb>["transaction"]>[0]>[0];

/**
 * Insert inventory units for a single variant.
 *
 * - When `codes` are provided, one InventoryUnit row is created per real code
 *   (the DIGITAL path — gift-card codes / CD keys). The UNIQUE(code) constraint
 *   is honored gracefully: codes that already exist (in this product or
 *   anywhere) are skipped and reported, not thrown.
 * - Otherwise, creates `quantity` units with auto-generated internal serials
 *   derived from the variant SKU. This is the PHYSICAL path (a "unit" is one
 *   physical item and its `code` is a meaningless serial), and is also the
 *   fallback for any operator who supplies a plain quantity instead of codes.
 *
 * Returns a summary of how many were added vs skipped.
 */
export async function addInventoryUnitsForVariant(
  tx: TxLike,
  params: { variantId: string; sku: string; codes?: string[]; quantity?: number },
): Promise<StockInsertResult> {
  const codes = normalizeCodes(params.codes);

  if (codes.length > 0) {
    const inserted = await tx
      .insert(inventoryUnits)
      .values(codes.map((code) => ({ variantId: params.variantId, code })))
      .onConflictDoNothing({ target: inventoryUnits.code })
      .returning({ id: inventoryUnits.id });

    return {
      added: inserted.length,
      skipped: codes.length - inserted.length,
      requested: codes.length,
    };
  }

  const quantity = sanitizeStockToAdd(params.quantity);

  if (quantity <= 0) {
    return { added: 0, skipped: 0, requested: 0 };
  }

  const inserted = await tx
    .insert(inventoryUnits)
    .values(
      Array.from({ length: quantity }, (_, index) => ({
        variantId: params.variantId,
        code: stockCode(params.sku, index),
      })),
    )
    .onConflictDoNothing({ target: inventoryUnits.code })
    .returning({ id: inventoryUnits.id });

  return {
    added: inserted.length,
    skipped: quantity - inserted.length,
    requested: quantity,
  };
}

type ProductCreateInput = {
  titleFa: string;
  slug?: string;
  summaryFa?: string;
  descriptionFa?: string;
  fitFa?: string;
  careFa?: string;
  baseCurrency?: BaseCurrency;
  seoTitle?: string | null;
  seoDescription?: string | null;
  ogImageUrl?: string | null;
  noindex?: boolean;
  status?: "DRAFT" | "ACTIVE" | "DISABLED" | "ARCHIVED";
  fulfillmentType?: FulfillmentType;
  categoryId?: string | null;
  categoryTitleFa?: string;
  categorySlug?: string;
  tagIds?: string[];
  newTags?: string[];
  tags?: string[];
  publicPriceAmount: string;
  registeredPriceAmount?: string;
  premiumPriceAmount?: string;
  compareAtAmount?: string;
  images?: Array<{
    url: string;
    altFa?: string;
    vipImage?: boolean;
    isPrimary?: boolean;
    showcasePublic?: boolean;
    showcasePremium?: boolean;
    sortOrder?: number;
    variantKey?: string | null;
  }>;
  colors: OptionInput[];
  materials: OptionInput[];
  sizes: string[];
  /** Auto-generate this many synthetic codes per variant (fallback when no real codes are supplied). */
  stockPerVariant: number;
  /**
   * Real sellable codes (gift-card codes / CD keys) keyed by variant key
   * (`colorSlug|materialSlug|size`). When present for a variant, one InventoryUnit
   * is created per code instead of auto-generating `stockPerVariant` units.
   */
  stockCodesByVariantKey?: Record<string, string[]>;
};

type ProductImageInput = {
  id?: string;
  url: string;
  altFa?: string | null;
  vipImage?: boolean;
  isPrimary?: boolean;
  showcasePublic?: boolean;
  showcasePremium?: boolean;
  sortOrder?: number;
  variantId?: string | null;
  variantKey?: string | null;
};

type ProductVariantUpdateInput = {
  id: string;
  sku?: string;
  titleFa?: string;
  colorNameFa?: string;
  colorSlug?: string;
  colorHex?: string | null;
  materialNameFa?: string;
  materialSlug?: string;
  size?: string;
  publicPriceAmount?: string;
  registeredPriceAmount?: string | null;
  premiumPriceAmount?: string | null;
  compareAtAmount?: string | null;
  isDefault?: boolean;
  /** Auto-generate this many synthetic codes (fallback when no real codes are supplied). */
  stockToAdd?: number;
  /** Real sellable codes to add to this variant (one InventoryUnit per code). */
  stockCodes?: string[];
};

type ProductUpdateInput = {
  titleFa?: string;
  slug?: string;
  summaryFa?: string | null;
  descriptionFa?: string | null;
  fitFa?: string | null;
  careFa?: string | null;
  baseCurrency?: BaseCurrency;
  seoTitle?: string | null;
  seoDescription?: string | null;
  ogImageUrl?: string | null;
  noindex?: boolean;
  status?: "DRAFT" | "ACTIVE" | "DISABLED" | "ARCHIVED";
  fulfillmentType?: FulfillmentType;
  categoryId?: string | null;
  categoryTitleFa?: string;
  categorySlug?: string;
  tagIds?: string[];
  newTags?: string[];
  tags?: string[];
  images?: ProductImageInput[];
  variants?: ProductVariantUpdateInput[];
};

const PRODUCT_STATUSES = new Set(["DRAFT", "ACTIVE", "DISABLED", "ARCHIVED"]);

function fetchAdminProductById(id: string) {
  return getDb().query.products.findFirst({
    where: (product, { eq }) => eq(product.id, id),
    with: {
      category: true,
      tags: {
        with: {
          tag: true,
        },
      },
      images: {
        orderBy: (image, { asc }) => [asc(image.sortOrder)],
      },
      variants: {
        with: {
          inventoryUnits: {
            columns: {
              id: true,
              status: true,
            },
          },
        },
        orderBy: (variant, { asc }) => [asc(variant.createdAt)],
      },
    },
  });
}

function normalizeOption(option: OptionInput, index: number) {
  const label = option.label.trim();
  const slug = slugify(option.slug || label) || `option-${index + 1}`;

  return {
    label,
    slug,
    hex: option.hex?.trim() || null,
  };
}

function variantSku(productSlug: string, color: string, material: string, size: string) {
  return [productSlug, color, material, slugify(size) || size.toLowerCase()]
    .join("-")
    .replace(/-+/g, "-")
    .toUpperCase();
}

function variantKey(colorSlug: string, materialSlug: string, size: string) {
  return [colorSlug, materialSlug, slugify(size) || size.trim().toLowerCase()]
    .join("|")
    .toLowerCase();
}

function stockCode(sku: string, index: number) {
  return `${sku}-${String(index + 1).padStart(4, "0")}-${randomBytes(3).toString("hex")}`;
}

function cleanOptionalText(value: string | null | undefined) {
  return value?.trim() || null;
}

function cleanRequiredText(value: string | undefined, fallback: string) {
  const cleanValue = value === undefined ? fallback.trim() : value.trim();

  if (!cleanValue) {
    throw new Error("INVALID_PRODUCT");
  }

  return cleanValue;
}

function cleanRequiredPrice(value: string | undefined, fallback?: unknown) {
  const cleanValue = value === undefined ? valueFromDecimal(fallback) : value.trim();

  if (!cleanValue) {
    throw new Error("INVALID_PRICE");
  }

  return cleanValue;
}

function cleanOptionalPrice(value: string | null | undefined) {
  if (value === undefined) {
    return undefined;
  }

  return value?.trim() || null;
}

function valueFromDecimal(value: unknown) {
  if (value == null) {
    return "";
  }

  const text = typeof value === "object" && "toString" in value ? value.toString() : String(value);
  return text.replace(/\.00$/, "");
}

function sanitizeStockToAdd(value: number | undefined) {
  if (!Number.isFinite(value) || !value || value <= 0) {
    return 0;
  }

  return Math.floor(value);
}

function assertSingleShowcaseImages(
  images: Array<{ showcasePublic?: boolean; showcasePremium?: boolean }>,
) {
  if (images.filter((image) => image.showcasePublic).length > 1) {
    throw new Error("DUPLICATE_SHOWCASE_IMAGE");
  }

  if (images.filter((image) => image.showcasePremium).length > 1) {
    throw new Error("DUPLICATE_SHOWCASE_IMAGE");
  }
}

async function ensureCategory(titleFa?: string, slug?: string) {
  const cleanTitle = titleFa?.trim();

  if (!cleanTitle) {
    return null;
  }

  const cleanSlug = slugify(slug || cleanTitle);

  const [category] = await getDb()
    .insert(categories)
    .values({
      slug: cleanSlug,
      titleFa: cleanTitle,
    })
    .onConflictDoUpdate({
      target: categories.slug,
      set: {
        titleFa: cleanTitle,
      },
    })
    .returning();

  return category;
}

async function resolveCategory(
  input: Pick<ProductCreateInput, "categoryId" | "categoryTitleFa" | "categorySlug">,
) {
  if (input.categoryId) {
    const category = await getDb().query.categories.findFirst({
      where: (item, { eq }) => eq(item.id, input.categoryId as string),
    });

    if (!category) {
      throw new Error("INVALID_CATEGORY");
    }

    return category;
  }

  return ensureCategory(input.categoryTitleFa, input.categorySlug);
}

async function ensureTags(tags: string[]) {
  const uniqueTags = Array.from(new Set(tags.map((tag) => tag.trim()).filter(Boolean)));

  return Promise.all(
    uniqueTags.map(async (tag) => {
      const slug = slugify(tag);

      const [row] = await getDb()
        .insert(tagsTable)
        .values({
          slug,
          titleFa: tag,
        })
        .onConflictDoUpdate({
          target: tagsTable.slug,
          set: {
            titleFa: tag,
          },
        })
        .returning();

      return row;
    }),
  );
}

async function resolveTags(input: Pick<ProductCreateInput, "tagIds" | "newTags" | "tags">) {
  const tagIds = Array.from(new Set(input.tagIds ?? [])).filter(Boolean);
  const [existingTags, createdTags] = await Promise.all([
    tagIds.length > 0
      ? getDb().query.tags.findMany({
          where: (tag, { inArray }) => inArray(tag.id, tagIds),
        })
      : [],
    ensureTags([...(input.newTags ?? []), ...(input.tags ?? [])]),
  ]);
  const tagsById = new Map([...existingTags, ...createdTags].map((tag) => [tag.id, tag]));

  return Array.from(tagsById.values());
}

export async function createAdminProduct(input: ProductCreateInput) {
  const productSlug = slugify(input.slug || input.titleFa);

  if (!productSlug) {
    throw new Error("INVALID_SLUG");
  }

  const colors = input.colors.map(normalizeOption).filter((item) => item.label);
  const materials = input.materials.map(normalizeOption).filter((item) => item.label);
  const sizes = input.sizes.map((size) => size.trim()).filter(Boolean);

  if (colors.length === 0 || materials.length === 0 || sizes.length === 0) {
    throw new Error("INVALID_VARIANTS");
  }

  const fulfillment = cleanFulfillmentType(input.fulfillmentType);
  const [category, tags] = await Promise.all([resolveCategory(input), resolveTags(input)]);
  const images = (input.images ?? []).filter((image) => image.url.trim());
  const primaryImage = images.find((image) => image.isPrimary) ?? images[0];
  assertSingleShowcaseImages(images);

  return getDb().transaction(async (tx) => {
    const [product] = await tx
      .insert(products)
      .values({
        slug: productSlug,
        titleFa: input.titleFa.trim(),
        summaryFa: input.summaryFa?.trim() || null,
        descriptionFa: input.descriptionFa?.trim() || null,
        fitFa: input.fitFa?.trim() || null,
        careFa: input.careFa?.trim() || null,
        baseCurrency: input.baseCurrency ?? "IRT",
        seoTitle: cleanOptionalText(input.seoTitle),
        seoDescription: cleanOptionalText(input.seoDescription),
        ogImageUrl: cleanOptionalText(input.ogImageUrl),
        noindex: Boolean(input.noindex),
        status: input.status ?? "DRAFT",
        fulfillmentType: fulfillment ?? "DIGITAL",
        categoryId: category?.id ?? null,
        primaryImageUrl: primaryImage?.url.trim() || null,
      })
      .returning();

    if (tags.length > 0) {
      await tx.insert(productTags).values(
        tags.map((tag) => ({
          productId: product.id,
          tagId: tag.id,
        })),
      );
    }

    let isFirstVariant = true;
    const variantIdsByKey = new Map<string, string>();

    for (const color of colors) {
      for (const material of materials) {
        for (const size of sizes) {
          const sku = variantSku(productSlug, color.slug, material.slug, size);
          const titleFa = `${color.label} / ${material.label} / ${size}`;

          const [variant] = await tx
            .insert(productVariants)
            .values({
              productId: product.id,
              sku,
              titleFa,
              colorNameFa: color.label,
              colorSlug: color.slug,
              colorHex: color.hex,
              materialNameFa: material.label,
              materialSlug: material.slug,
              size,
              publicPriceAmount: input.publicPriceAmount,
              registeredPriceAmount: input.registeredPriceAmount || null,
              premiumPriceAmount: input.premiumPriceAmount || null,
              compareAtAmount: input.compareAtAmount || null,
              isDefault: isFirstVariant,
            })
            .returning();

          isFirstVariant = false;
          const key = variantKey(color.slug, material.slug, size);
          variantIdsByKey.set(key, variant.id);

          const variantCodes = input.stockCodesByVariantKey?.[key];

          await addInventoryUnitsForVariant(tx, {
            variantId: variant.id,
            sku,
            codes: variantCodes,
            quantity: input.stockPerVariant,
          });
        }
      }
    }

    if (images.length > 0) {
      await tx.insert(productImages).values(
        images.map((image, index) => {
          const cleanVariantKey = image.variantKey?.trim();
          const variantId = cleanVariantKey ? variantIdsByKey.get(cleanVariantKey) : null;

          if (cleanVariantKey && !variantId) {
            throw new Error("INVALID_IMAGE_VARIANT");
          }

          return {
            productId: product.id,
            variantId: variantId ?? null,
            url: image.url.trim(),
            altFa: image.altFa?.trim() || input.titleFa.trim(),
            vipImage: Boolean(image.vipImage),
            isPrimary: image === primaryImage,
            showcasePublic: Boolean(image.showcasePublic),
            showcasePremium: Boolean(image.showcasePremium),
            sortOrder: image.sortOrder ?? index,
          };
        }),
      );
    }

    return product;
  });
}

export async function updateAdminProduct(id: string, input: ProductUpdateInput) {
  const current = await fetchAdminProductById(id);

  if (!current) {
    throw new Error("PRODUCT_NOT_FOUND");
  }

  if (input.status && !PRODUCT_STATUSES.has(input.status)) {
    throw new Error("INVALID_STATUS");
  }

  const fulfillment = cleanFulfillmentType(input.fulfillmentType);

  const shouldUpdateCategory =
    input.categoryId !== undefined ||
    input.categoryTitleFa !== undefined ||
    input.categorySlug !== undefined;
  const shouldUpdateTags =
    input.tagIds !== undefined || input.newTags !== undefined || input.tags !== undefined;

  const [category, tags] = await Promise.all([
    shouldUpdateCategory ? resolveCategory(input) : Promise.resolve(null),
    shouldUpdateTags ? resolveTags(input) : Promise.resolve([]),
  ]);

  const variantIds = new Set(current.variants.map((variant) => variant.id));
  const imageIds = new Set(current.images.map((image) => image.id));
  const nextTitle =
    input.titleFa !== undefined
      ? cleanRequiredText(input.titleFa, current.titleFa)
      : current.titleFa;
  const nextSlug = input.slug !== undefined ? slugify(input.slug || nextTitle) : current.slug;

  if (!nextSlug) {
    throw new Error("INVALID_SLUG");
  }

  const normalizedImages = input.images
    ?.map((image, index) => ({
      ...image,
      url: image.url.trim(),
      altFa: image.altFa?.trim() || nextTitle,
      sortOrder: image.sortOrder ?? index,
      variantId: image.variantId?.trim() || null,
    }))
    .filter((image) => image.url);

  if (normalizedImages) {
    assertSingleShowcaseImages(normalizedImages);

    for (const image of normalizedImages) {
      if (image.id && !imageIds.has(image.id)) {
        throw new Error("INVALID_IMAGE");
      }

      if (image.variantId && !variantIds.has(image.variantId)) {
        throw new Error("INVALID_IMAGE_VARIANT");
      }
    }
  }

  if (input.variants) {
    for (const variant of input.variants) {
      if (!variantIds.has(variant.id)) {
        throw new Error("INVALID_VARIANT");
      }
    }
  }

  await getDb().transaction(async (tx) => {
    const productData = {
      ...(input.titleFa !== undefined ? { titleFa: nextTitle } : {}),
      ...(input.slug !== undefined ? { slug: nextSlug } : {}),
      ...(input.summaryFa !== undefined ? { summaryFa: cleanOptionalText(input.summaryFa) } : {}),
      ...(input.descriptionFa !== undefined
        ? { descriptionFa: cleanOptionalText(input.descriptionFa) }
        : {}),
      ...(input.fitFa !== undefined ? { fitFa: cleanOptionalText(input.fitFa) } : {}),
      ...(input.careFa !== undefined ? { careFa: cleanOptionalText(input.careFa) } : {}),
      ...(input.baseCurrency !== undefined ? { baseCurrency: input.baseCurrency } : {}),
      ...(input.seoTitle !== undefined ? { seoTitle: cleanOptionalText(input.seoTitle) } : {}),
      ...(input.seoDescription !== undefined
        ? { seoDescription: cleanOptionalText(input.seoDescription) }
        : {}),
      ...(input.ogImageUrl !== undefined
        ? { ogImageUrl: cleanOptionalText(input.ogImageUrl) }
        : {}),
      ...(input.noindex !== undefined ? { noindex: Boolean(input.noindex) } : {}),
      ...(input.status ? { status: input.status } : {}),
      ...(fulfillment ? { fulfillmentType: fulfillment } : {}),
      ...(shouldUpdateCategory ? { categoryId: category?.id ?? null } : {}),
      ...(normalizedImages
        ? {
            primaryImageUrl:
              (normalizedImages.find((image) => image.isPrimary) ?? normalizedImages[0])?.url ??
              null,
          }
        : {}),
    };

    if (Object.keys(productData).length > 0) {
      await tx.update(products).set(productData).where(eq(products.id, id));
    }

    if (shouldUpdateTags) {
      await tx.delete(productTags).where(eq(productTags.productId, id));

      if (tags.length > 0) {
        await tx
          .insert(productTags)
          .values(
            tags.map((tag) => ({
              productId: id,
              tagId: tag.id,
            })),
          )
          .onConflictDoNothing();
      }
    }

    if (input.variants?.length) {
      const defaultVariantId = input.variants.find((variant) => variant.isDefault)?.id;
      const variantsById = new Map(current.variants.map((variant) => [variant.id, variant]));

      if (defaultVariantId) {
        await tx
          .update(productVariants)
          .set({ isDefault: false })
          .where(eq(productVariants.productId, id));
      }

      for (const variantPatch of input.variants) {
        const currentVariant = variantsById.get(variantPatch.id);

        if (!currentVariant) {
          throw new Error("INVALID_VARIANT");
        }

        const nextSku = cleanRequiredText(variantPatch.sku, currentVariant.sku);
        const nextTitleFa = cleanRequiredText(variantPatch.titleFa, currentVariant.titleFa);
        const nextColorNameFa = cleanRequiredText(
          variantPatch.colorNameFa,
          currentVariant.colorNameFa,
        );
        const nextMaterialNameFa = cleanRequiredText(
          variantPatch.materialNameFa,
          currentVariant.materialNameFa,
        );
        const nextSize = cleanRequiredText(variantPatch.size, currentVariant.size);

        await tx
          .update(productVariants)
          .set({
            sku: nextSku,
            titleFa: nextTitleFa,
            colorNameFa: nextColorNameFa,
            colorSlug:
              variantPatch.colorSlug !== undefined
                ? slugify(variantPatch.colorSlug || nextColorNameFa)
                : currentVariant.colorSlug,
            colorHex:
              variantPatch.colorHex !== undefined
                ? variantPatch.colorHex?.trim() || null
                : currentVariant.colorHex,
            materialNameFa: nextMaterialNameFa,
            materialSlug:
              variantPatch.materialSlug !== undefined
                ? slugify(variantPatch.materialSlug || nextMaterialNameFa)
                : currentVariant.materialSlug,
            size: nextSize,
            publicPriceAmount: cleanRequiredPrice(
              variantPatch.publicPriceAmount,
              currentVariant.publicPriceAmount,
            ),
            ...(variantPatch.registeredPriceAmount !== undefined
              ? { registeredPriceAmount: cleanOptionalPrice(variantPatch.registeredPriceAmount) }
              : {}),
            ...(variantPatch.premiumPriceAmount !== undefined
              ? { premiumPriceAmount: cleanOptionalPrice(variantPatch.premiumPriceAmount) }
              : {}),
            ...(variantPatch.compareAtAmount !== undefined
              ? { compareAtAmount: cleanOptionalPrice(variantPatch.compareAtAmount) }
              : {}),
            ...(defaultVariantId ? { isDefault: variantPatch.id === defaultVariantId } : {}),
          })
          .where(eq(productVariants.id, variantPatch.id));

        await addInventoryUnitsForVariant(tx, {
          variantId: variantPatch.id,
          sku: nextSku,
          codes: variantPatch.stockCodes,
          quantity: variantPatch.stockToAdd,
        });
      }
    }

    if (normalizedImages) {
      const submittedImageIds = normalizedImages
        .map((image) => image.id)
        .filter((imageId): imageId is string => Boolean(imageId));
      const primaryImage = normalizedImages.find((image) => image.isPrimary) ?? normalizedImages[0];

      if (submittedImageIds.length > 0) {
        await tx
          .delete(productImages)
          .where(
            and(eq(productImages.productId, id), notInArray(productImages.id, submittedImageIds)),
          );
      } else {
        await tx.delete(productImages).where(eq(productImages.productId, id));
      }

      for (const [index, image] of normalizedImages.entries()) {
        const data = {
          url: image.url,
          altFa: image.altFa,
          vipImage: Boolean(image.vipImage),
          isPrimary: image === primaryImage,
          showcasePublic: Boolean(image.showcasePublic),
          showcasePremium: Boolean(image.showcasePremium),
          sortOrder: image.sortOrder ?? index,
          variantId: image.variantId,
        };

        if (image.id) {
          await tx.update(productImages).set(data).where(eq(productImages.id, image.id));
        } else {
          await tx.insert(productImages).values({
            ...data,
            productId: id,
          });
        }
      }
    }
  });

  const updated = await fetchAdminProductById(id);

  if (!updated) {
    throw new Error("PRODUCT_NOT_FOUND");
  }

  return updated;
}

export async function listAdminProducts() {
  return getDb().query.products.findMany({
    with: {
      category: true,
      tags: {
        with: {
          tag: true,
        },
      },
      images: {
        orderBy: (image, { asc }) => [asc(image.sortOrder)],
      },
      variants: {
        with: {
          inventoryUnits: {
            columns: {
              id: true,
              status: true,
            },
          },
        },
        orderBy: (variant, { asc }) => [asc(variant.createdAt)],
      },
    },
    orderBy: (product, { desc }) => [desc(product.createdAt)],
  });
}

export type AdminProductRecord = Awaited<ReturnType<typeof listAdminProducts>>[number];

export async function getAdminProduct(id: string) {
  return fetchAdminProductById(id);
}

export function toAdminProductRow(product: AdminProductRecord) {
  return {
    id: product.id,
    slug: product.slug,
    titleFa: product.titleFa,
    summaryFa: product.summaryFa ?? "",
    descriptionFa: product.descriptionFa ?? "",
    fitFa: product.fitFa ?? "",
    careFa: product.careFa ?? "",
    baseCurrency: product.baseCurrency,
    seoTitle: product.seoTitle ?? "",
    seoDescription: product.seoDescription ?? "",
    ogImageUrl: product.ogImageUrl ?? "",
    noindex: product.noindex,
    status: product.status,
    fulfillmentType: product.fulfillmentType,
    categoryId: product.categoryId ?? "",
    tagIds: product.tags.map((item) => item.tagId),
    tags: product.tags.map((item) => ({
      id: item.tag.id,
      slug: item.tag.slug,
      titleFa: item.tag.titleFa,
      isVisible: item.tag.isVisible,
    })),
    images: product.images.map((image) => ({
      id: image.id,
      url: image.url,
      originalUrl: image.originalUrl ?? "",
      altFa: image.altFa ?? "",
      vipImage: image.vipImage,
      isPrimary: image.isPrimary,
      showcasePublic: image.showcasePublic,
      showcasePremium: image.showcasePremium,
      sortOrder: image.sortOrder,
      variantId: image.variantId ?? "",
      watermarkEnabled: image.watermarkEnabled,
      watermarkImageId: image.watermarkImageId ?? "",
      watermarkX: image.watermarkX,
      watermarkY: image.watermarkY,
      watermarkSize: image.watermarkSize,
      watermarkOpacity: image.watermarkOpacity,
      watermarkAppliedUrl: image.watermarkAppliedUrl ?? "",
    })),
    variants: product.variants.map((variant) => ({
      id: variant.id,
      sku: variant.sku,
      titleFa: variant.titleFa,
      colorNameFa: variant.colorNameFa,
      colorSlug: variant.colorSlug,
      colorHex: variant.colorHex ?? "",
      materialNameFa: variant.materialNameFa,
      materialSlug: variant.materialSlug,
      size: variant.size,
      publicPriceAmount: valueFromDecimal(variant.publicPriceAmount),
      registeredPriceAmount: valueFromDecimal(variant.registeredPriceAmount),
      premiumPriceAmount: valueFromDecimal(variant.premiumPriceAmount),
      compareAtAmount: valueFromDecimal(variant.compareAtAmount),
      isDefault: variant.isDefault,
      inventoryUnits: variant.inventoryUnits.map((unit) => ({
        id: unit.id,
        status: unit.status,
      })),
    })),
  };
}

export function toAdminProductPickerOption(product: AdminProductRecord) {
  const primaryImage =
    product.images.find((image) => image.showcasePublic)?.url ||
    product.primaryImageUrl ||
    product.images.find((image) => image.isPrimary)?.url ||
    product.images[0]?.url ||
    null;

  return {
    id: product.id,
    slug: product.slug,
    titleFa: product.titleFa,
    status: product.status,
    imageUrl: primaryImage,
    categoryTitleFa: product.category?.titleFa ?? null,
  };
}
