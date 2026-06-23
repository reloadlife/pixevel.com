import { randomBytes } from "node:crypto";

import { and, eq, inArray, notInArray } from "drizzle-orm";

import {
  type BaseCurrency,
  type BillingInterval,
  cartItems,
  categories,
  type FulfillmentType,
  type InventoryPolicy,
  inventoryUnits,
  type OptionInputKind,
  productImages,
  productOptions,
  productOptionValues,
  products,
  productTags,
  productVariants,
  subscriptionPlans,
  tags as tagsTable,
  variantOptionValues,
} from "@/db/schema";
import { getDb } from "@/lib/db";
import { slugify } from "@/lib/format";
import {
  cartesian,
  composeVariantSku,
  composeVariantTitle,
  optionsKeyFromPairs,
  optionValueKey,
} from "@/lib/variant-options";

const FULFILLMENT_TYPES = new Set<FulfillmentType>([
  "DIGITAL",
  "PHYSICAL",
  "DOMAIN",
  "SERVER",
  "SERVICE",
]);
const INVENTORY_POLICIES = new Set<InventoryPolicy>(["TRACKED", "INFINITE"]);
const OPTION_INPUT_KINDS = new Set<OptionInputKind>(["SELECT", "SWATCH", "PILL"]);
const BILLING_INTERVALS = new Set<BillingInterval>(["DAY", "WEEK", "MONTH", "YEAR"]);

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

function cleanInventoryPolicy(value: unknown): InventoryPolicy | undefined {
  if (typeof value !== "string") return undefined;
  const normalized = value.trim().toUpperCase();
  if (!INVENTORY_POLICIES.has(normalized as InventoryPolicy)) {
    throw new Error("INVALID_INVENTORY_POLICY");
  }
  return normalized as InventoryPolicy;
}

function cleanInputKind(value: unknown): OptionInputKind {
  if (typeof value !== "string") return "PILL";
  const normalized = value.trim().toUpperCase();
  return OPTION_INPUT_KINDS.has(normalized as OptionInputKind)
    ? (normalized as OptionInputKind)
    : "PILL";
}

function cleanBillingInterval(value: unknown): BillingInterval {
  if (typeof value !== "string") return "MONTH";
  const normalized = value.trim().toUpperCase();
  return BILLING_INTERVALS.has(normalized as BillingInterval)
    ? (normalized as BillingInterval)
    : "MONTH";
}

/**
 * Normalize an operator-supplied list of inventory codes (real gift-card codes /
 * CD keys). Trims, drops blanks, and de-duplicates within the submitted batch.
 */
function normalizeCodes(codes: string[] | undefined): string[] {
  if (!codes || codes.length === 0) {
    return [];
  }
  const seen = new Set<string>();
  const result: string[] = [];
  for (const raw of codes) {
    if (typeof raw !== "string") continue;
    const code = raw.trim();
    if (!code || seen.has(code)) continue;
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
 * Insert inventory units for a single variant (TRACKED products only).
 *
 * - When `codes` are provided, one InventoryUnit row is created per real code
 *   (the DIGITAL path — gift-card codes / CD keys). UNIQUE(code) is honored
 *   gracefully: pre-existing codes are skipped and reported, not thrown.
 * - Otherwise, creates `quantity` units with auto-generated internal serials
 *   derived from the variant SKU (the PHYSICAL path / quantity fallback).
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

// --- Input types -----------------------------------------------------------

export type OptionValueInput = {
  valueFa: string;
  slug?: string;
  hex?: string | null;
  swatchImageUrl?: string | null;
};

export type OptionGroupInput = {
  nameFa: string;
  slug?: string;
  inputKind?: OptionInputKind | string;
  values: OptionValueInput[];
};

export type VariantOverrideInput = {
  publicPriceAmount?: string;
  registeredPriceAmount?: string | null;
  premiumPriceAmount?: string | null;
  compareAtAmount?: string | null;
  salePriceAmount?: string | null;
  saleStartsAt?: string | null;
  saleEndsAt?: string | null;
  stockCodes?: string[];
  stockToAdd?: number;
};

export type SubscriptionPlanInput = {
  intervalUnit: BillingInterval | string;
  intervalCount?: number;
  trialDays?: number;
  termCount?: number | null;
  gracePeriodDays?: number;
  autoRenewDefault?: boolean;
};

type ProductImageCreateInput = {
  url: string;
  altFa?: string;
  vipImage?: boolean;
  isPrimary?: boolean;
  showcasePublic?: boolean;
  showcasePremium?: boolean;
  sortOrder?: number;
  /** optionsKey of the variant this image belongs to (variant-specific image). */
  variantKey?: string | null;
  /** "optionSlug:valueSlug" — image shows for every variant carrying this value. */
  optionValueKey?: string | null;
};

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
  fulfillmentType?: FulfillmentType | string;
  inventoryPolicy?: InventoryPolicy | string;
  isSubscription?: boolean;
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
  images?: ProductImageCreateInput[];
  /** Arbitrary option dimensions; empty → a single default variant. */
  options: OptionGroupInput[];
  /** Default synthetic stock per variant (TRACKED, fallback when no codes). */
  stockPerVariant: number;
  /** Per-variant price/stock overrides keyed by optionsKey. */
  variantOverridesByKey?: Record<string, VariantOverrideInput>;
  /** Recurring plan applied to every variant when isSubscription is true. */
  subscriptionPlan?: SubscriptionPlanInput;
  /** Physical shipping attributes (null for non-physical products). */
  weightGram?: number | null;
  lengthMm?: number | null;
  widthMm?: number | null;
  heightMm?: number | null;
  /** Exclude this product from VAT. */
  taxExempt?: boolean;
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
  optionValueId?: string | null;
};

type ProductVariantUpdateInput = {
  id: string;
  sku?: string;
  titleFa?: string;
  publicPriceAmount?: string;
  registeredPriceAmount?: string | null;
  premiumPriceAmount?: string | null;
  compareAtAmount?: string | null;
  salePriceAmount?: string | null;
  saleStartsAt?: string | null;
  saleEndsAt?: string | null;
  isDefault?: boolean;
  stockToAdd?: number;
  stockCodes?: string[];
  subscriptionPlan?: SubscriptionPlanInput | null;
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
  fulfillmentType?: FulfillmentType | string;
  inventoryPolicy?: InventoryPolicy | string;
  isSubscription?: boolean;
  categoryId?: string | null;
  categoryTitleFa?: string;
  categorySlug?: string;
  tagIds?: string[];
  newTags?: string[];
  tags?: string[];
  images?: ProductImageInput[];
  variants?: ProductVariantUpdateInput[];
  /**
   * When provided, the variant set is reconciled against this option structure
   * (add/remove options, values, and variants) instead of the per-id `variants`
   * patch path. Empty options → a single default variant (optionsKey "").
   */
  options?: OptionGroupInput[];
  /** Per-variant price/stock/default overrides keyed by optionsKey (reconcile path). */
  variantOverridesByKey?: Record<string, VariantOverrideInput & { isDefault?: boolean }>;
  /** Default synthetic stock per newly-created variant (TRACKED reconcile path). */
  stockPerVariant?: number;
  /** Recurring plan applied to every variant when isSubscription is true (reconcile path). */
  subscriptionPlan?: SubscriptionPlanInput | null;
  /** Physical shipping attributes (null clears the value). */
  weightGram?: number | null;
  lengthMm?: number | null;
  widthMm?: number | null;
  heightMm?: number | null;
  /** Exclude this product from VAT. */
  taxExempt?: boolean;
};

const PRODUCT_STATUSES = new Set(["DRAFT", "ACTIVE", "DISABLED", "ARCHIVED"]);

function fetchAdminProductById(id: string) {
  return getDb().query.products.findFirst({
    where: (product, { eq }) => eq(product.id, id),
    with: {
      category: true,
      tags: { with: { tag: true } },
      options: {
        with: { values: { orderBy: (value, { asc }) => [asc(value.position)] } },
        orderBy: (option, { asc }) => [asc(option.position)],
      },
      images: { orderBy: (image, { asc }) => [asc(image.sortOrder)] },
      variants: {
        with: {
          inventoryUnits: { columns: { id: true, status: true } },
          optionValues: {
            with: {
              option: { columns: { id: true, slug: true, nameFa: true } },
              optionValue: { columns: { id: true, slug: true, valueFa: true } },
            },
          },
          subscriptionPlan: true,
        },
        orderBy: (variant, { asc }) => [asc(variant.createdAt)],
      },
    },
  });
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

/** Normalize option groups into a clean, deduped, slugged structure. */
type NormalizedOptionValue = {
  valueFa: string;
  slug: string;
  hex: string | null;
  swatchImageUrl: string | null;
};
type NormalizedOption = {
  nameFa: string;
  slug: string;
  inputKind: OptionInputKind;
  values: NormalizedOptionValue[];
};

function normalizeOptions(groups: OptionGroupInput[]): NormalizedOption[] {
  const usedOptionSlugs = new Set<string>();

  return groups
    .map((group, groupIndex) => {
      const nameFa = group.nameFa.trim();
      if (!nameFa) return null;

      let slug = slugify(group.slug || nameFa) || `option-${groupIndex + 1}`;
      while (usedOptionSlugs.has(slug)) slug = `${slug}-${groupIndex + 1}`;
      usedOptionSlugs.add(slug);

      const usedValueSlugs = new Set<string>();
      const values = group.values
        .map((value, valueIndex) => {
          const valueFa = value.valueFa.trim();
          if (!valueFa) return null;
          let valueSlug = slugify(value.slug || valueFa) || `value-${valueIndex + 1}`;
          while (usedValueSlugs.has(valueSlug)) valueSlug = `${valueSlug}-${valueIndex + 1}`;
          usedValueSlugs.add(valueSlug);
          return {
            valueFa,
            slug: valueSlug,
            hex: value.hex?.trim() || null,
            swatchImageUrl: value.swatchImageUrl?.trim() || null,
          };
        })
        .filter((v): v is NormalizedOptionValue => v != null);

      if (values.length === 0) return null;

      return { nameFa, slug, inputKind: cleanInputKind(group.inputKind), values };
    })
    .filter((option): option is NormalizedOption => option != null);
}

async function ensureCategory(titleFa?: string, slug?: string) {
  const cleanTitle = titleFa?.trim();
  if (!cleanTitle) {
    return null;
  }
  const cleanSlug = slugify(slug || cleanTitle);
  const [category] = await getDb()
    .insert(categories)
    .values({ slug: cleanSlug, titleFa: cleanTitle })
    .onConflictDoUpdate({ target: categories.slug, set: { titleFa: cleanTitle } })
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
        .values({ slug, titleFa: tag })
        .onConflictDoUpdate({ target: tagsTable.slug, set: { titleFa: tag } })
        .returning();
      return row;
    }),
  );
}

async function resolveTags(input: Pick<ProductCreateInput, "tagIds" | "newTags" | "tags">) {
  const tagIds = Array.from(new Set(input.tagIds ?? [])).filter(Boolean);
  const [existingTags, createdTags] = await Promise.all([
    tagIds.length > 0
      ? getDb().query.tags.findMany({ where: (tag, { inArray }) => inArray(tag.id, tagIds) })
      : [],
    ensureTags([...(input.newTags ?? []), ...(input.tags ?? [])]),
  ]);
  const tagsById = new Map([...existingTags, ...createdTags].map((tag) => [tag.id, tag]));
  return Array.from(tagsById.values());
}

function buildSubscriptionPlanValues(variantId: string, plan: SubscriptionPlanInput) {
  return {
    variantId,
    intervalUnit: cleanBillingInterval(plan.intervalUnit),
    intervalCount: Math.max(1, Math.floor(plan.intervalCount ?? 1)),
    trialDays: Math.max(0, Math.floor(plan.trialDays ?? 0)),
    termCount: plan.termCount == null ? null : Math.max(1, Math.floor(plan.termCount)),
    gracePeriodDays: Math.max(0, Math.floor(plan.gracePeriodDays ?? 3)),
    autoRenewDefault: plan.autoRenewDefault ?? true,
  };
}

export async function createAdminProduct(input: ProductCreateInput) {
  const productSlug = slugify(input.slug || input.titleFa);
  if (!productSlug) {
    throw new Error("INVALID_SLUG");
  }

  const options = normalizeOptions(input.options ?? []);
  const fulfillment = cleanFulfillmentType(input.fulfillmentType);
  const inventoryPolicyValue = cleanInventoryPolicy(input.inventoryPolicy) ?? "TRACKED";
  const isSubscription = Boolean(input.isSubscription);
  const tracked = inventoryPolicyValue === "TRACKED";

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
        inventoryPolicy: inventoryPolicyValue,
        isSubscription,
        categoryId: category?.id ?? null,
        primaryImageUrl: primaryImage?.url.trim() || null,
        taxExempt: Boolean(input.taxExempt),
        weightGram: input.weightGram ?? null,
        lengthMm: input.lengthMm ?? null,
        widthMm: input.widthMm ?? null,
        heightMm: input.heightMm ?? null,
      })
      .returning();

    if (tags.length > 0) {
      await tx
        .insert(productTags)
        .values(tags.map((tag) => ({ productId: product.id, tagId: tag.id })));
    }

    // Insert options + values, capturing ids by slug for the variant junction.
    const optionMeta = new Map<
      string,
      { id: string; nameFa: string; valuesBySlug: Map<string, { id: string; valueFa: string }> }
    >();

    for (const [position, option] of options.entries()) {
      const [optionRow] = await tx
        .insert(productOptions)
        .values({
          productId: product.id,
          nameFa: option.nameFa,
          slug: option.slug,
          position,
          inputKind: option.inputKind,
        })
        .returning();

      const valuesBySlug = new Map<string, { id: string; valueFa: string }>();
      for (const [valuePosition, value] of option.values.entries()) {
        const [valueRow] = await tx
          .insert(productOptionValues)
          .values({
            optionId: optionRow.id,
            valueFa: value.valueFa,
            slug: value.slug,
            hex: value.hex,
            swatchImageUrl: value.swatchImageUrl,
            position: valuePosition,
          })
          .returning();
        valuesBySlug.set(value.slug, { id: valueRow.id, valueFa: value.valueFa });
      }

      optionMeta.set(option.slug, { id: optionRow.id, nameFa: option.nameFa, valuesBySlug });
    }

    // Cartesian product over option values → one variant per combination.
    // No options → a single default variant (combos = [[]]).
    const combos = cartesian(
      options.map((option) => option.values.map((v) => ({ option, value: v }))),
    );

    const variantIdsByKey = new Map<string, string>();
    const optionValueIdByKey = new Map<string, string>();
    for (const [slug, meta] of optionMeta) {
      for (const [valueSlug, value] of meta.valuesBySlug) {
        optionValueIdByKey.set(optionValueKey(slug, valueSlug), value.id);
      }
    }

    let isFirstVariant = true;
    for (const combo of combos) {
      const pairs = combo.map((item) => ({
        optionSlug: item.option.slug,
        valueSlug: item.value.slug,
      }));
      const optionsKey = optionsKeyFromPairs(pairs);
      const valueSlugs = combo.map((item) => item.value.slug);
      const valueLabels = combo.map((item) => item.value.valueFa);
      const sku =
        combo.length === 0 ? productSlug.toUpperCase() : composeVariantSku(productSlug, valueSlugs);
      const titleFa = composeVariantTitle(valueLabels, input.titleFa.trim());
      const override = input.variantOverridesByKey?.[optionsKey];

      const [variant] = await tx
        .insert(productVariants)
        .values({
          productId: product.id,
          sku,
          titleFa,
          optionsKey,
          publicPriceAmount: override?.publicPriceAmount || input.publicPriceAmount,
          registeredPriceAmount:
            override?.registeredPriceAmount ?? input.registeredPriceAmount ?? null,
          premiumPriceAmount: override?.premiumPriceAmount ?? input.premiumPriceAmount ?? null,
          compareAtAmount: override?.compareAtAmount ?? input.compareAtAmount ?? null,
          salePriceAmount: override?.salePriceAmount ?? null,
          saleStartsAt: override?.saleStartsAt ? new Date(override.saleStartsAt) : null,
          saleEndsAt: override?.saleEndsAt ? new Date(override.saleEndsAt) : null,
          isDefault: isFirstVariant,
        })
        .returning();

      isFirstVariant = false;
      variantIdsByKey.set(optionsKey, variant.id);

      // Variant ↔ option-value junction rows.
      if (combo.length > 0) {
        await tx.insert(variantOptionValues).values(
          combo.map((item) => ({
            variantId: variant.id,
            optionId: optionMeta.get(item.option.slug)?.id as string,
            optionValueId: optionMeta.get(item.option.slug)?.valuesBySlug.get(item.value.slug)
              ?.id as string,
          })),
        );
      }

      if (isSubscription && input.subscriptionPlan) {
        await tx
          .insert(subscriptionPlans)
          .values(buildSubscriptionPlanValues(variant.id, input.subscriptionPlan));
      }

      if (tracked) {
        await addInventoryUnitsForVariant(tx, {
          variantId: variant.id,
          sku,
          codes: override?.stockCodes,
          quantity: override?.stockToAdd ?? input.stockPerVariant,
        });
      }
    }

    if (images.length > 0) {
      await tx.insert(productImages).values(
        images.map((image, index) => {
          const variantKey = image.variantKey?.trim();
          const optionValueRef = image.optionValueKey?.trim();
          const variantId = variantKey ? variantIdsByKey.get(variantKey) : null;
          const optionValueId = optionValueRef ? optionValueIdByKey.get(optionValueRef) : null;

          if (variantKey && !variantId) throw new Error("INVALID_IMAGE_VARIANT");
          if (optionValueRef && !optionValueId) throw new Error("INVALID_IMAGE_OPTION_VALUE");

          return {
            productId: product.id,
            variantId: variantId ?? null,
            optionValueId: optionValueId ?? null,
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

type ReconcileVariantsParams = {
  productId: string;
  productSlug: string;
  fallbackTitle: string;
  options: OptionGroupInput[];
  overridesByKey: Record<string, VariantOverrideInput & { isDefault?: boolean }>;
  stockPerVariant: number;
  tracked: boolean;
  isSubscription: boolean;
  subscriptionPlan: SubscriptionPlanInput | null | undefined;
  /** Default price floor used when a brand-new variant has no override. */
  defaults: {
    publicPriceAmount: string;
    registeredPriceAmount: string | null;
    premiumPriceAmount: string | null;
    compareAtAmount: string | null;
  };
};

/**
 * Reconcile a product's options/values/variants against a desired option
 * structure inside an open transaction. Returns warnings for variants that
 * could not be deleted because they hold SOLD/RESERVED inventory.
 */
async function reconcileProductVariants(
  tx: TxLike,
  params: ReconcileVariantsParams,
): Promise<{ warnings: string[] }> {
  const warnings: string[] = [];
  const { productId, productSlug } = params;
  const options = normalizeOptions(params.options);

  // ── Load existing options + values (slug-keyed) for diffing. ────────────────
  const existingOptions = await tx.query.productOptions.findMany({
    where: (option, { eq: eqOp }) => eqOp(option.productId, productId),
    with: { values: true },
  });
  const existingOptionBySlug = new Map(existingOptions.map((option) => [option.slug, option]));
  const desiredOptionSlugs = new Set(options.map((option) => option.slug));

  // Delete options whose slug is gone (cascade removes values + junction rows).
  const optionsToDelete = existingOptions
    .filter((option) => !desiredOptionSlugs.has(option.slug))
    .map((option) => option.id);
  if (optionsToDelete.length > 0) {
    await tx.delete(productOptions).where(inArray(productOptions.id, optionsToDelete));
  }

  // Upsert options + values; capture ids by slug for the variant junction.
  const optionMeta = new Map<
    string,
    { id: string; nameFa: string; valuesBySlug: Map<string, { id: string; valueFa: string }> }
  >();

  for (const [position, option] of options.entries()) {
    const existing = existingOptionBySlug.get(option.slug);
    let optionId: string;
    if (existing) {
      await tx
        .update(productOptions)
        .set({ nameFa: option.nameFa, inputKind: option.inputKind, position })
        .where(eq(productOptions.id, existing.id));
      optionId = existing.id;
    } else {
      const [optionRow] = await tx
        .insert(productOptions)
        .values({
          productId,
          nameFa: option.nameFa,
          slug: option.slug,
          position,
          inputKind: option.inputKind,
        })
        .returning();
      optionId = optionRow.id;
    }

    const existingValueBySlug = new Map(
      (existing?.values ?? []).map((value) => [value.slug, value]),
    );
    const desiredValueSlugs = new Set(option.values.map((value) => value.slug));
    const valuesToDelete = (existing?.values ?? [])
      .filter((value) => !desiredValueSlugs.has(value.slug))
      .map((value) => value.id);
    if (valuesToDelete.length > 0) {
      await tx.delete(productOptionValues).where(inArray(productOptionValues.id, valuesToDelete));
    }

    const valuesBySlug = new Map<string, { id: string; valueFa: string }>();
    for (const [valuePosition, value] of option.values.entries()) {
      const existingValue = existingValueBySlug.get(value.slug);
      if (existingValue) {
        await tx
          .update(productOptionValues)
          .set({
            valueFa: value.valueFa,
            hex: value.hex,
            swatchImageUrl: value.swatchImageUrl,
            position: valuePosition,
          })
          .where(eq(productOptionValues.id, existingValue.id));
        valuesBySlug.set(value.slug, { id: existingValue.id, valueFa: value.valueFa });
      } else {
        const [valueRow] = await tx
          .insert(productOptionValues)
          .values({
            optionId,
            valueFa: value.valueFa,
            slug: value.slug,
            hex: value.hex,
            swatchImageUrl: value.swatchImageUrl,
            position: valuePosition,
          })
          .returning();
        valuesBySlug.set(value.slug, { id: valueRow.id, valueFa: value.valueFa });
      }
    }

    optionMeta.set(option.slug, { id: optionId, nameFa: option.nameFa, valuesBySlug });
  }

  // ── Desired variant set = cartesian product of normalized option values. ────
  const combos = cartesian(
    options.map((option) => option.values.map((value) => ({ option, value }))),
  );
  type DesiredVariant = {
    optionsKey: string;
    sku: string;
    titleFa: string;
    combo: Array<{ optionSlug: string; valueSlug: string }>;
  };
  const desired = new Map<string, DesiredVariant>();
  for (const combo of combos) {
    const pairs = combo.map((item) => ({
      optionSlug: item.option.slug,
      valueSlug: item.value.slug,
    }));
    const optionsKey = optionsKeyFromPairs(pairs);
    const valueSlugs = combo.map((item) => item.value.slug);
    const valueLabels = combo.map((item) => item.value.valueFa);
    const sku =
      combo.length === 0 ? productSlug.toUpperCase() : composeVariantSku(productSlug, valueSlugs);
    desired.set(optionsKey, {
      optionsKey,
      sku,
      titleFa: composeVariantTitle(valueLabels, params.fallbackTitle),
      combo: pairs,
    });
  }

  // ── Load existing variants (with inventory unit statuses) for diffing. ──────
  const existingVariants = await tx.query.productVariants.findMany({
    where: (variant, { eq: eqOp }) => eqOp(variant.productId, productId),
    with: { inventoryUnits: { columns: { status: true } } },
  });
  const existingByKey = new Map(existingVariants.map((variant) => [variant.optionsKey, variant]));

  const fallbackPrices = existingVariants[0];

  function priceFor(field: "registeredPriceAmount" | "premiumPriceAmount" | "compareAtAmount") {
    return params.defaults[field] ?? (fallbackPrices ? fallbackPrices[field] : null);
  }

  async function insertJunction(variantId: string, combo: DesiredVariant["combo"]) {
    if (combo.length === 0) return;
    await tx.insert(variantOptionValues).values(
      combo.map((pair) => ({
        variantId,
        optionId: optionMeta.get(pair.optionSlug)?.id as string,
        optionValueId: optionMeta.get(pair.optionSlug)?.valuesBySlug.get(pair.valueSlug)
          ?.id as string,
      })),
    );
  }

  async function upsertSubscriptionPlan(variantId: string) {
    if (params.subscriptionPlan === undefined) return;
    await tx.delete(subscriptionPlans).where(eq(subscriptionPlans.variantId, variantId));
    if (params.isSubscription && params.subscriptionPlan) {
      await tx
        .insert(subscriptionPlans)
        .values(buildSubscriptionPlanValues(variantId, params.subscriptionPlan));
    }
  }

  let anyDefault = false;

  // existing ∉ desired → delete (guarded against SOLD/RESERVED inventory).
  for (const variant of existingVariants) {
    if (desired.has(variant.optionsKey)) continue;
    const held = variant.inventoryUnits.some(
      (unit) => unit.status === "SOLD" || unit.status === "RESERVED",
    );
    if (held) {
      warnings.push(variant.optionsKey || variant.sku);
      continue;
    }
    // cartItems FK is ON DELETE RESTRICT — clear them first; orderItems are SET NULL.
    await tx.delete(cartItems).where(eq(cartItems.variantId, variant.id));
    await tx.delete(productVariants).where(eq(productVariants.id, variant.id));
    existingByKey.delete(variant.optionsKey);
  }

  // desired entries → insert (new) or update (kept).
  for (const variant of desired.values()) {
    const override = params.overridesByKey[variant.optionsKey];
    const existing = existingByKey.get(variant.optionsKey);
    const wantsDefault = override?.isDefault ?? false;
    if (wantsDefault) anyDefault = true;

    if (existing) {
      await tx
        .update(productVariants)
        .set({
          sku: variant.sku,
          titleFa: variant.titleFa,
          ...(override?.publicPriceAmount ? { publicPriceAmount: override.publicPriceAmount } : {}),
          ...(override?.registeredPriceAmount !== undefined
            ? { registeredPriceAmount: override.registeredPriceAmount }
            : {}),
          ...(override?.premiumPriceAmount !== undefined
            ? { premiumPriceAmount: override.premiumPriceAmount }
            : {}),
          ...(override?.compareAtAmount !== undefined
            ? { compareAtAmount: override.compareAtAmount }
            : {}),
          ...(override?.salePriceAmount !== undefined
            ? { salePriceAmount: override.salePriceAmount || null }
            : {}),
          ...(override?.saleStartsAt !== undefined
            ? { saleStartsAt: override.saleStartsAt ? new Date(override.saleStartsAt) : null }
            : {}),
          ...(override?.saleEndsAt !== undefined
            ? { saleEndsAt: override.saleEndsAt ? new Date(override.saleEndsAt) : null }
            : {}),
          ...(override?.isDefault !== undefined ? { isDefault: override.isDefault } : {}),
        })
        .where(eq(productVariants.id, existing.id));

      await upsertSubscriptionPlan(existing.id);

      if (params.tracked) {
        await addInventoryUnitsForVariant(tx, {
          variantId: existing.id,
          sku: variant.sku,
          codes: override?.stockCodes,
          quantity: override?.stockToAdd,
        });
      }
    } else {
      const [inserted] = await tx
        .insert(productVariants)
        .values({
          productId,
          sku: variant.sku,
          titleFa: variant.titleFa,
          optionsKey: variant.optionsKey,
          publicPriceAmount: override?.publicPriceAmount || params.defaults.publicPriceAmount,
          registeredPriceAmount:
            override?.registeredPriceAmount ?? priceFor("registeredPriceAmount"),
          premiumPriceAmount: override?.premiumPriceAmount ?? priceFor("premiumPriceAmount"),
          compareAtAmount: override?.compareAtAmount ?? priceFor("compareAtAmount"),
          salePriceAmount: override?.salePriceAmount ?? null,
          saleStartsAt: override?.saleStartsAt ? new Date(override.saleStartsAt) : null,
          saleEndsAt: override?.saleEndsAt ? new Date(override.saleEndsAt) : null,
          isDefault: wantsDefault,
        })
        .returning();

      await insertJunction(inserted.id, variant.combo);
      await upsertSubscriptionPlan(inserted.id);

      if (params.tracked) {
        await addInventoryUnitsForVariant(tx, {
          variantId: inserted.id,
          sku: variant.sku,
          codes: override?.stockCodes,
          quantity: override?.stockToAdd ?? params.stockPerVariant,
        });
      }
    }
  }

  // Ensure exactly one default variant survives.
  await tx
    .update(productVariants)
    .set({ isDefault: false })
    .where(eq(productVariants.productId, productId));
  const remaining = await tx.query.productVariants.findMany({
    where: (variant, { eq: eqOp }) => eqOp(variant.productId, productId),
    columns: { id: true, optionsKey: true, isDefault: true },
  });
  const explicitDefaultKey = anyDefault
    ? Object.entries(params.overridesByKey).find(([, override]) => override.isDefault)?.[0]
    : undefined;
  const defaultVariant =
    (explicitDefaultKey != null
      ? remaining.find((variant) => variant.optionsKey === explicitDefaultKey)
      : undefined) ?? remaining[0];
  if (defaultVariant) {
    await tx
      .update(productVariants)
      .set({ isDefault: true })
      .where(eq(productVariants.id, defaultVariant.id));
  }

  return { warnings };
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
  const inventoryPolicyValue = cleanInventoryPolicy(input.inventoryPolicy);

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
  const optionValueIds = new Set(
    current.options.flatMap((option) => option.values.map((value) => value.id)),
  );
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
      optionValueId: image.optionValueId?.trim() || null,
    }))
    .filter((image) => image.url);

  if (normalizedImages) {
    assertSingleShowcaseImages(normalizedImages);
    for (const image of normalizedImages) {
      if (image.id && !imageIds.has(image.id)) throw new Error("INVALID_IMAGE");
      if (image.variantId && !variantIds.has(image.variantId))
        throw new Error("INVALID_IMAGE_VARIANT");
      if (image.optionValueId && !optionValueIds.has(image.optionValueId)) {
        throw new Error("INVALID_IMAGE_OPTION_VALUE");
      }
    }
  }

  const reconcileVariants = input.options !== undefined;

  if (input.variants && !reconcileVariants) {
    for (const variant of input.variants) {
      if (!variantIds.has(variant.id)) throw new Error("INVALID_VARIANT");
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
      ...(inventoryPolicyValue ? { inventoryPolicy: inventoryPolicyValue } : {}),
      ...(input.isSubscription !== undefined
        ? { isSubscription: Boolean(input.isSubscription) }
        : {}),
      ...(shouldUpdateCategory ? { categoryId: category?.id ?? null } : {}),
      ...(normalizedImages
        ? {
            primaryImageUrl:
              (normalizedImages.find((image) => image.isPrimary) ?? normalizedImages[0])?.url ??
              null,
          }
        : {}),
      ...(input.taxExempt !== undefined ? { taxExempt: Boolean(input.taxExempt) } : {}),
      ...(input.weightGram !== undefined ? { weightGram: input.weightGram ?? null } : {}),
      ...(input.lengthMm !== undefined ? { lengthMm: input.lengthMm ?? null } : {}),
      ...(input.widthMm !== undefined ? { widthMm: input.widthMm ?? null } : {}),
      ...(input.heightMm !== undefined ? { heightMm: input.heightMm ?? null } : {}),
    };

    if (Object.keys(productData).length > 0) {
      await tx.update(products).set(productData).where(eq(products.id, id));
    }

    if (shouldUpdateTags) {
      await tx.delete(productTags).where(eq(productTags.productId, id));
      if (tags.length > 0) {
        await tx
          .insert(productTags)
          .values(tags.map((tag) => ({ productId: id, tagId: tag.id })))
          .onConflictDoNothing();
      }
    }

    if (reconcileVariants) {
      const trackedAfter = (inventoryPolicyValue ?? current.inventoryPolicy) === "TRACKED";
      const isSubscriptionAfter =
        input.isSubscription !== undefined ? Boolean(input.isSubscription) : current.isSubscription;
      const firstVariant = current.variants[0];

      await reconcileProductVariants(tx, {
        productId: id,
        productSlug: nextSlug,
        fallbackTitle: nextTitle,
        options: input.options ?? [],
        overridesByKey: input.variantOverridesByKey ?? {},
        stockPerVariant: input.stockPerVariant ?? 0,
        tracked: trackedAfter,
        isSubscription: isSubscriptionAfter,
        subscriptionPlan: input.subscriptionPlan,
        defaults: {
          publicPriceAmount: valueFromDecimal(firstVariant?.publicPriceAmount) || "0",
          registeredPriceAmount: firstVariant?.registeredPriceAmount
            ? valueFromDecimal(firstVariant.registeredPriceAmount)
            : null,
          premiumPriceAmount: firstVariant?.premiumPriceAmount
            ? valueFromDecimal(firstVariant.premiumPriceAmount)
            : null,
          compareAtAmount: firstVariant?.compareAtAmount
            ? valueFromDecimal(firstVariant.compareAtAmount)
            : null,
        },
      });
    } else if (input.variants?.length) {
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
        if (!currentVariant) throw new Error("INVALID_VARIANT");

        const nextSku = cleanRequiredText(variantPatch.sku, currentVariant.sku);
        const nextTitleFa = cleanRequiredText(variantPatch.titleFa, currentVariant.titleFa);

        await tx
          .update(productVariants)
          .set({
            sku: nextSku,
            titleFa: nextTitleFa,
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
            ...(variantPatch.salePriceAmount !== undefined
              ? { salePriceAmount: cleanOptionalPrice(variantPatch.salePriceAmount) }
              : {}),
            ...(variantPatch.saleStartsAt !== undefined
              ? {
                  saleStartsAt: variantPatch.saleStartsAt
                    ? new Date(variantPatch.saleStartsAt)
                    : null,
                }
              : {}),
            ...(variantPatch.saleEndsAt !== undefined
              ? { saleEndsAt: variantPatch.saleEndsAt ? new Date(variantPatch.saleEndsAt) : null }
              : {}),
            ...(defaultVariantId ? { isDefault: variantPatch.id === defaultVariantId } : {}),
          })
          .where(eq(productVariants.id, variantPatch.id));

        // Upsert / clear the subscription plan for this variant when provided.
        if (variantPatch.subscriptionPlan !== undefined) {
          await tx
            .delete(subscriptionPlans)
            .where(eq(subscriptionPlans.variantId, variantPatch.id));
          if (variantPatch.subscriptionPlan) {
            await tx
              .insert(subscriptionPlans)
              .values(buildSubscriptionPlanValues(variantPatch.id, variantPatch.subscriptionPlan));
          }
        }

        if (current.inventoryPolicy === "TRACKED") {
          await addInventoryUnitsForVariant(tx, {
            variantId: variantPatch.id,
            sku: nextSku,
            codes: variantPatch.stockCodes,
            quantity: variantPatch.stockToAdd,
          });
        }
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
          optionValueId: image.optionValueId,
        };

        if (image.id) {
          await tx.update(productImages).set(data).where(eq(productImages.id, image.id));
        } else {
          await tx.insert(productImages).values({ ...data, productId: id });
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
      tags: { with: { tag: true } },
      options: {
        with: { values: { orderBy: (value, { asc }) => [asc(value.position)] } },
        orderBy: (option, { asc }) => [asc(option.position)],
      },
      images: { orderBy: (image, { asc }) => [asc(image.sortOrder)] },
      variants: {
        with: {
          inventoryUnits: { columns: { id: true, status: true } },
          optionValues: {
            with: {
              option: { columns: { id: true, slug: true, nameFa: true } },
              optionValue: { columns: { id: true, slug: true, valueFa: true } },
            },
          },
          subscriptionPlan: true,
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
    inventoryPolicy: product.inventoryPolicy,
    isSubscription: product.isSubscription,
    taxExempt: product.taxExempt,
    weightGram: product.weightGram ?? null,
    lengthMm: product.lengthMm ?? null,
    widthMm: product.widthMm ?? null,
    heightMm: product.heightMm ?? null,
    categoryId: product.categoryId ?? "",
    tagIds: product.tags.map((item) => item.tagId),
    tags: product.tags.map((item) => ({
      id: item.tag.id,
      slug: item.tag.slug,
      titleFa: item.tag.titleFa,
      isVisible: item.tag.isVisible,
    })),
    options: product.options.map((option) => ({
      id: option.id,
      nameFa: option.nameFa,
      slug: option.slug,
      inputKind: option.inputKind,
      position: option.position,
      values: option.values.map((value) => ({
        id: value.id,
        valueFa: value.valueFa,
        slug: value.slug,
        hex: value.hex ?? "",
        swatchImageUrl: value.swatchImageUrl ?? "",
        position: value.position,
      })),
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
      optionValueId: image.optionValueId ?? "",
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
      optionsKey: variant.optionsKey,
      optionValues: variant.optionValues.map((link) => ({
        optionId: link.option?.id ?? link.optionId,
        optionSlug: link.option?.slug ?? "",
        optionNameFa: link.option?.nameFa ?? "",
        optionValueId: link.optionValue?.id ?? link.optionValueId,
        valueSlug: link.optionValue?.slug ?? "",
        valueFa: link.optionValue?.valueFa ?? "",
      })),
      publicPriceAmount: valueFromDecimal(variant.publicPriceAmount),
      registeredPriceAmount: valueFromDecimal(variant.registeredPriceAmount),
      premiumPriceAmount: valueFromDecimal(variant.premiumPriceAmount),
      compareAtAmount: valueFromDecimal(variant.compareAtAmount),
      salePriceAmount: valueFromDecimal(variant.salePriceAmount),
      saleStartsAt: variant.saleStartsAt ? variant.saleStartsAt.toISOString().slice(0, 10) : "",
      saleEndsAt: variant.saleEndsAt ? variant.saleEndsAt.toISOString().slice(0, 10) : "",
      isDefault: variant.isDefault,
      subscriptionPlan: variant.subscriptionPlan
        ? {
            intervalUnit: variant.subscriptionPlan.intervalUnit,
            intervalCount: variant.subscriptionPlan.intervalCount,
            trialDays: variant.subscriptionPlan.trialDays,
            termCount: variant.subscriptionPlan.termCount,
            gracePeriodDays: variant.subscriptionPlan.gracePeriodDays,
            autoRenewDefault: variant.subscriptionPlan.autoRenewDefault,
          }
        : null,
      inventoryUnits: variant.inventoryUnits.map((unit) => ({ id: unit.id, status: unit.status })),
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
