import { and, asc, avg, count, desc, eq, ilike, inArray, ne, or, sql } from "drizzle-orm";
import { unstable_noStore as noStore } from "next/cache";

import type {
  BaseCurrency,
  BillingInterval,
  InventoryPolicy,
  OptionInputKind,
  ProductStatus,
} from "@/db/schema";
import {
  categories,
  inventoryUnits,
  productReviews,
  products as productsTable,
  productTags,
  productVariants,
  tags,
} from "@/db/schema";
import { getDb } from "@/lib/db";
import { decimalToNumber } from "@/lib/format";
import { convertToToman, loadExchangeRates } from "@/lib/pricing/exchange";

export type ProductSortKey = "price_asc" | "price_desc" | "newest" | "stock_desc";

export const PRODUCT_SORT_KEYS: ProductSortKey[] = [
  "newest",
  "price_asc",
  "price_desc",
  "stock_desc",
];

/** Sentinel "stock" for INFINITE-policy products (services / subscriptions): always addable. */
const UNLIMITED_STOCK = 999_999;

export type ProductListingOptions = {
  q?: string;
  category?: string; // category slug — when present, restrict to products in this category
  tag?: string; // tag slug — when present, restrict to products carrying this tag
  sort?: ProductSortKey;
  minPrice?: number; // inclusive lower bound on the displayed (tier) price
  maxPrice?: number; // inclusive upper bound on the displayed (tier) price
  inStock?: boolean; // when true, hide products with no available stock
  page?: number;
  pageSize?: number;
  // Optional transaction/db override — used in tests to share the rollback tx.
  _db?: ReturnType<typeof getDb>;
};

/**
 * Returns all active (isVisible=true) categories ordered by sortOrder then titleFa.
 */
export async function listCategories(
  _db?: ReturnType<typeof getDb>,
): Promise<{ id: string; slug: string; titleFa: string }[]> {
  const db = _db ?? getDb();
  return db
    .select({ id: categories.id, slug: categories.slug, titleFa: categories.titleFa })
    .from(categories)
    .where(eq(categories.isVisible, true))
    .orderBy(asc(categories.sortOrder), asc(categories.titleFa));
}

/**
 * Returns all visible (isVisible=true) tags ordered by titleFa.
 */
export async function listTags(
  _db?: ReturnType<typeof getDb>,
): Promise<{ id: string; slug: string; titleFa: string }[]> {
  const db = _db ?? getDb();
  return db
    .select({ id: tags.id, slug: tags.slug, titleFa: tags.titleFa })
    .from(tags)
    .where(eq(tags.isVisible, true))
    .orderBy(asc(tags.titleFa));
}

type UserTier = "PUBLIC" | "REGISTERED" | "PREMIUM";
type CatalogImage = {
  id: string;
  url: string;
  altFa: string | null;
  vipImage: boolean;
  isPrimary: boolean;
  showcasePublic: boolean;
  showcasePremium: boolean;
  sortOrder: number;
  variantId?: string | null;
  optionValueId?: string | null;
};

/** Shape of a variant's option-value rows as returned by the relational query. */
type CatalogVariantOptionValue = {
  optionId: string;
  optionValueId: string;
  option?: { slug: string; nameFa: string } | null;
  optionValue?: { slug: string; valueFa: string } | null;
};

type CatalogVariantSubscriptionPlan = {
  intervalUnit: BillingInterval;
  intervalCount: number;
  trialDays: number;
  termCount: number | null;
  gracePeriodDays: number;
  autoRenewDefault: boolean;
} | null;

type CatalogVariant = {
  id: string;
  sku: string;
  titleFa: string;
  publicPriceAmount: unknown;
  registeredPriceAmount?: unknown;
  premiumPriceAmount?: unknown;
  compareAtAmount?: unknown;
  salePriceAmount?: unknown;
  saleStartsAt?: Date | null;
  saleEndsAt?: Date | null;
  images: CatalogImage[];
  inventoryUnits: Array<{ id: string }>;
  optionValues?: CatalogVariantOptionValue[];
  subscriptionPlan?: CatalogVariantSubscriptionPlan;
};

export function getUserTier(user: { isPremium: boolean } | null): UserTier {
  if (user?.isPremium) {
    return "PREMIUM";
  }

  if (user) {
    return "REGISTERED";
  }

  return "PUBLIC";
}

/**
 * Returns true when the variant's scheduled sale is currently active.
 * `saleStartsAt` defaults to -∞ and `saleEndsAt` defaults to +∞.
 */
function isSaleActive(variant: {
  salePriceAmount?: unknown;
  saleStartsAt?: Date | null;
  saleEndsAt?: Date | null;
}): boolean {
  if (variant.salePriceAmount == null) return false;
  const now = Date.now();
  const start = variant.saleStartsAt ? variant.saleStartsAt.getTime() : -Infinity;
  const end = variant.saleEndsAt ? variant.saleEndsAt.getTime() : Infinity;
  return now >= start && now <= end;
}

/**
 * Resolves the effective raw (pre-currency-conversion) price for a variant + tier,
 * applying an active sale when it beats the tier price.
 * Used internally; exposed as `variantPrice` for external callers.
 */
function effectiveVariantPrice(
  variant: {
    publicPriceAmount: unknown;
    registeredPriceAmount?: unknown;
    premiumPriceAmount?: unknown;
    salePriceAmount?: unknown;
    saleStartsAt?: Date | null;
    saleEndsAt?: Date | null;
  },
  tier: UserTier,
): number {
  const tierRaw =
    tier === "PREMIUM" && variant.premiumPriceAmount != null
      ? decimalToNumber(variant.premiumPriceAmount)
      : tier === "REGISTERED" && variant.registeredPriceAmount != null
        ? decimalToNumber(variant.registeredPriceAmount)
        : decimalToNumber(variant.publicPriceAmount);

  if (!isSaleActive(variant)) return tierRaw;

  const saleRaw = decimalToNumber(variant.salePriceAmount);
  // Sale wins only when it is actually lower than the tier price.
  return Math.min(tierRaw, saleRaw);
}

/**
 * Resolves the Toman price for a variant + tier. Amounts are authored in the
 * product's `baseCurrency`; when that is USD/EUR the figure is converted to Toman
 * via the cached exchange rate (defaults to IRT = no conversion, so callers that
 * don't pass a currency keep the legacy Toman behaviour).
 *
 * When a scheduled sale is active (`salePriceAmount` within [saleStartsAt, saleEndsAt]),
 * the effective price is min(tier price, sale price).
 */
export function variantPrice(
  variant: {
    publicPriceAmount: unknown;
    registeredPriceAmount?: unknown;
    premiumPriceAmount?: unknown;
    salePriceAmount?: unknown;
    saleStartsAt?: Date | null;
    saleEndsAt?: Date | null;
  },
  tier: UserTier,
  baseCurrency: BaseCurrency = "IRT",
) {
  return convertToToman(effectiveVariantPrice(variant, tier), baseCurrency);
}

function mapImage(image: CatalogImage) {
  return {
    id: image.id,
    url: image.url,
    altFa: image.altFa,
    vipImage: image.vipImage,
    isPrimary: image.isPrimary,
    showcasePublic: image.showcasePublic,
    showcasePremium: image.showcasePremium,
    sortOrder: image.sortOrder,
    variantId: image.variantId ?? null,
    optionValueId: image.optionValueId ?? null,
  };
}

function visibleImages<T extends CatalogImage>(images: T[], tier: UserTier) {
  return images.filter((image) => tier === "PREMIUM" || !image.vipImage).map(mapImage);
}

/** Map a variant's option-value rows into `{ optionSlug: valueSlug }` + ordered id list. */
function variantOptionMaps(variant: CatalogVariant) {
  const optionValueSlugs: Record<string, string> = {};
  const optionValueIds: string[] = [];

  for (const link of variant.optionValues ?? []) {
    optionValueIds.push(link.optionValueId);
    if (link.option?.slug && link.optionValue?.slug) {
      optionValueSlugs[link.option.slug] = link.optionValue.slug;
    }
  }

  return { optionValueSlugs, optionValueIds };
}

function mapVariant(
  variant: CatalogVariant,
  tier: UserTier,
  baseCurrency: BaseCurrency = "IRT",
  unlimited = false,
) {
  const compareAt = decimalToNumber(variant.compareAtAmount);
  const { optionValueSlugs, optionValueIds } = variantOptionMaps(variant);
  const plan = variant.subscriptionPlan ?? null;
  const onSale = isSaleActive(variant);

  return {
    id: variant.id,
    sku: variant.sku,
    titleFa: variant.titleFa,
    optionValueSlugs,
    optionValueIds,
    price: variantPrice(variant, tier, baseCurrency),
    compareAtAmount: convertToToman(compareAt, baseCurrency),
    onSale,
    availableStock: unlimited ? UNLIMITED_STOCK : variant.inventoryUnits.length,
    isUnlimited: unlimited,
    images: visibleImages(variant.images, tier),
    subscription: plan
      ? {
          intervalUnit: plan.intervalUnit,
          intervalCount: plan.intervalCount,
          trialDays: plan.trialDays,
          termCount: plan.termCount,
          gracePeriodDays: plan.gracePeriodDays,
          autoRenewDefault: plan.autoRenewDefault,
        }
      : null,
  };
}

/** Map a product's configured options into the storefront selector shape. */
type CatalogOptionRow = {
  id: string;
  nameFa: string;
  slug: string;
  inputKind: OptionInputKind;
  position: number;
  values?: Array<{
    id: string;
    valueFa: string;
    slug: string;
    hex: string | null;
    swatchImageUrl: string | null;
    position: number;
  }>;
};

function mapOption(option: CatalogOptionRow) {
  return {
    id: option.id,
    nameFa: option.nameFa,
    slug: option.slug,
    inputKind: option.inputKind,
    position: option.position,
    values: [...(option.values ?? [])]
      .sort((a, b) => a.position - b.position)
      .map((value) => ({
        id: value.id,
        valueFa: value.valueFa,
        slug: value.slug,
        hex: value.hex,
        swatchImageUrl: value.swatchImageUrl,
      })),
  };
}

export type CatalogProductOption = ReturnType<typeof mapOption>;

export type ListingProduct = {
  id: string;
  slug: string;
  titleFa: string;
  summaryFa: string | null;
  createdAt: string;
  status: ProductStatus;
  inventoryPolicy: InventoryPolicy;
  isSubscription: boolean;
  category: { id: string } | null;
  tags: Array<{ id: string }>;
  imageUrl?: string | null;
  images: ReturnType<typeof mapImage>[];
  showcaseImageUrl?: string | null;
  showcaseImages: ReturnType<typeof mapImage>[];
  price: number;
  compareAtAmount: number;
  availableStock: number;
  variants: ReturnType<typeof mapVariant>[];
  // Aggregate of APPROVED reviews. ratingAvg is null when there are no reviews.
  ratingAvg: number | null;
  ratingCount: number;
};

function randomProduct(products: ListingProduct[]) {
  if (products.length === 0) {
    return [];
  }

  return [products[Math.floor(Math.random() * products.length)]];
}

function shouldResolveSingleRandomProduct(blockType: string) {
  return ["SHOWCASE", "SHOWCASE_RANDOM", "SHOWCASE_HERO", "SHOWCASE_HERO_NO_PRODUCT_INFO"].includes(
    blockType,
  );
}

function selectedShowcaseImage(images: ReturnType<typeof mapImage>[], tier: UserTier) {
  const publicImage = images.find((image) => image.showcasePublic) ?? null;

  if (tier === "PREMIUM") {
    return images.find((image) => image.showcasePremium) ?? publicImage;
  }

  return publicImage;
}

function prioritizeImage(
  images: ReturnType<typeof mapImage>[],
  image: ReturnType<typeof mapImage> | null,
) {
  if (!image) {
    return images;
  }

  return [image, ...images.filter((item) => item.id !== image.id)];
}

function sortBlockProducts(products: ListingProduct[], sortKey: string) {
  const sorted = [...products];

  if (sortKey === "price_asc") {
    return sorted.sort((a, b) => a.price - b.price);
  }

  if (sortKey === "price_desc") {
    return sorted.sort((a, b) => b.price - a.price);
  }

  if (sortKey === "stock_desc") {
    return sorted.sort((a, b) => b.availableStock - a.availableStock);
  }

  return sorted.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export type ListingMeta = {
  total: number;
  page: number;
  pageSize: number;
  hasNext: boolean;
};

export async function getProductsForListing(
  user: { isPremium: boolean } | null,
  opts: ProductListingOptions = {},
) {
  noStore();

  const { q, category, tag, sort, minPrice, maxPrice, inStock, _db } = opts;
  const page = Math.max(1, opts.page ?? 1);
  const pageSize = opts.pageSize ?? 24;
  const searchTerm = q?.trim();
  const db = _db ?? getDb();

  const tier = getUserTier(user);
  const offset = (page - 1) * pageSize;

  // Warm the exchange-rate cache so USD/EUR products convert to live Toman.
  // Must run before any price computation.
  await loadExchangeRates();

  // ---------------------------------------------------------------------------
  // Build the shared WHERE predicate for both the count query and the row query.
  // Generic listing hides the legacy per-order DOMAIN/SERVER products (minted via
  // /domains and /servers) but surfaces DOMAIN/SERVER products that are real
  // catalog subscriptions (isSubscription = true).
  // ---------------------------------------------------------------------------
  function buildBaseWhere() {
    const baseFilters = [
      ne(productsTable.status, "ARCHIVED"),
      or(
        eq(productsTable.isSubscription, true),
        and(
          ne(productsTable.fulfillmentType, "DOMAIN"),
          ne(productsTable.fulfillmentType, "SERVER"),
        ),
      ),
    ];

    if (category) {
      baseFilters.push(
        sql`EXISTS (
          SELECT 1 FROM ${categories} c
          WHERE c.id = ${productsTable.categoryId}
            AND c.slug = ${category}
        )`,
      );
    }

    if (tag) {
      baseFilters.push(
        sql`EXISTS (
          SELECT 1 FROM ${productTags} pt
          JOIN ${tags} t ON t.id = pt."tagId"
          WHERE pt."productId" = ${productsTable.id}
            AND t.slug = ${tag}
        )`,
      );
    }

    if (searchTerm) {
      const term = `%${searchTerm}%`;
      const textMatch = or(
        ilike(productsTable.titleFa, term),
        ilike(productsTable.summaryFa, term),
        sql`EXISTS (
          SELECT 1 FROM ${productTags} pt
          JOIN ${tags} t ON t.id = pt."tagId"
          WHERE pt."productId" = ${productsTable.id}
            AND t."titleFa" ILIKE ${term}
        )`,
        sql`EXISTS (
          SELECT 1 FROM ${categories} c
          WHERE c.id = ${productsTable.categoryId}
            AND c."titleFa" ILIKE ${term}
        )`,
      );
      if (textMatch) baseFilters.push(textMatch);
    }

    // ---------------------------------------------------------------------------
    // inStock: push into SQL via EXISTS on InventoryUnit with status=AVAILABLE.
    // INFINITE-policy products are always considered in-stock.
    // ---------------------------------------------------------------------------
    if (inStock) {
      baseFilters.push(
        sql`(
          ${productsTable.inventoryPolicy} = 'INFINITE'
          OR EXISTS (
            SELECT 1 FROM ${productVariants} pv
            JOIN ${inventoryUnits} iu ON iu."variantId" = pv.id
            WHERE pv."productId" = ${productsTable.id}
              AND iu.status = 'AVAILABLE'
          )
        )`,
      );
    }

    return and(...baseFilters);
  }

  // ---------------------------------------------------------------------------
  // Price filter: we filter on the stored tier price column in SQL.
  // Note: for USD/EUR products this filters on the foreign-currency amount, not
  // the converted Toman value — an accepted limitation documented below. In
  // practice all prices are authored in IRT unless baseCurrency differs.
  // ---------------------------------------------------------------------------
  function tierPriceColumn() {
    if (tier === "PREMIUM") {
      // COALESCE to publicPriceAmount when the tier-specific column is NULL
      return sql<string>`COALESCE(
        (SELECT MIN(pv."premiumPriceAmount"::numeric) FROM ${productVariants} pv WHERE pv."productId" = ${productsTable.id}),
        (SELECT MIN(pv."publicPriceAmount"::numeric)  FROM ${productVariants} pv WHERE pv."productId" = ${productsTable.id})
      )`;
    }
    if (tier === "REGISTERED") {
      return sql<string>`COALESCE(
        (SELECT MIN(pv."registeredPriceAmount"::numeric) FROM ${productVariants} pv WHERE pv."productId" = ${productsTable.id}),
        (SELECT MIN(pv."publicPriceAmount"::numeric)     FROM ${productVariants} pv WHERE pv."productId" = ${productsTable.id})
      )`;
    }
    return sql<string>`(SELECT MIN(pv."publicPriceAmount"::numeric) FROM ${productVariants} pv WHERE pv."productId" = ${productsTable.id})`;
  }

  function buildPriceFilters() {
    const filters: ReturnType<typeof sql>[] = [];
    if (typeof minPrice === "number") {
      filters.push(sql`${tierPriceColumn()} >= ${minPrice}`);
    }
    if (typeof maxPrice === "number") {
      filters.push(sql`${tierPriceColumn()} <= ${maxPrice}`);
    }
    return filters;
  }

  // ---------------------------------------------------------------------------
  // Sort order expression for SQL ORDER BY.
  // price_asc / price_desc use the same correlated subquery as the price filter.
  // stock_desc counts available inventory units across all variants.
  // ---------------------------------------------------------------------------
  function buildOrderBy() {
    if (sort === "price_asc") {
      return [asc(tierPriceColumn())];
    }
    if (sort === "price_desc") {
      return [desc(tierPriceColumn())];
    }
    if (sort === "stock_desc") {
      return [
        desc(
          sql`(SELECT COUNT(*) FROM ${productVariants} pv JOIN ${inventoryUnits} iu ON iu."variantId" = pv.id WHERE pv."productId" = ${productsTable.id} AND iu.status = 'AVAILABLE')`,
        ),
      ];
    }
    // "newest" (default)
    return [desc(productsTable.createdAt)];
  }

  const priceFilters = buildPriceFilters();
  const baseWhere = buildBaseWhere();
  const fullWhere = priceFilters.length > 0 ? and(baseWhere, ...priceFilters) : baseWhere;

  // Count query — includes all active filters so total is accurate.
  const [countRow] = await db.select({ total: count() }).from(productsTable).where(fullWhere);

  const total = countRow?.total ?? 0;

  // ---------------------------------------------------------------------------
  // Fetch only the page we need. ORDER BY is pushed to SQL so rows arrive
  // already sorted — no JS sort needed for listing pages.
  // ---------------------------------------------------------------------------
  const pageProductIds = await db
    .select({ id: productsTable.id })
    .from(productsTable)
    .where(fullWhere)
    // `id` is the unique tiebreaker — without it, ORDER BY a non-unique column
    // (createdAt / price / stock) lets rows shuffle between pages, so OFFSET
    // pagination would overlap or skip items.
    .orderBy(...buildOrderBy(), asc(productsTable.id))
    .limit(pageSize)
    .offset(offset);

  const ids = pageProductIds.map((r) => r.id);

  if (ids.length === 0) {
    return {
      items: [] as ListingProduct[],
      meta: { total, page, pageSize, hasNext: page * pageSize < total } satisfies ListingMeta,
    };
  }

  // Fetch full relational data only for the current page's product IDs.
  const rows = await db.query.products.findMany({
    where: (product, { inArray: inArrayOp }) => inArrayOp(product.id, ids),
    with: {
      category: true,
      tags: {
        with: {
          tag: true,
        },
      },
      images: {
        orderBy: (image, { asc: ascOp }) => [ascOp(image.sortOrder)],
      },
      variants: {
        with: {
          images: {
            orderBy: (image, { asc: ascOp }) => [ascOp(image.sortOrder)],
          },
          inventoryUnits: {
            where: (unit, { eq: eqOp }) => eqOp(unit.status, "AVAILABLE"),
            columns: {
              id: true,
            },
          },
          subscriptionPlan: true,
        },
        orderBy: (variant, { asc: ascOp }) => [ascOp(variant.createdAt)],
      },
    },
  });

  // Re-order rows to match the SQL-sorted ID order (findMany may reorder).
  const rowById = new Map(rows.map((r) => [r.id, r]));
  const orderedRows = ids.flatMap((id) => {
    const row = rowById.get(id);
    return row ? [row] : [];
  });

  const productIds = orderedRows.map((product) => product.id);
  const ratingByProductId = new Map<string, { avg: number | null; count: number }>();

  if (productIds.length > 0) {
    const ratingRows = await db
      .select({
        productId: productReviews.productId,
        avg: avg(productReviews.rating),
        count: count(productReviews.id),
      })
      .from(productReviews)
      .where(
        and(inArray(productReviews.productId, productIds), eq(productReviews.status, "APPROVED")),
      )
      .groupBy(productReviews.productId);

    for (const row of ratingRows) {
      ratingByProductId.set(row.productId, {
        avg: row.avg == null ? null : Number(row.avg),
        count: Number(row.count),
      });
    }
  }

  const mapped: ListingProduct[] = orderedRows.map((product) => {
    const unlimited = product.inventoryPolicy === "INFINITE";
    const variants = product.variants.map((variant) =>
      mapVariant(variant, tier, product.baseCurrency, unlimited),
    );
    const firstVariant = variants[0];
    const images = visibleImages(product.images, tier);
    const defaultImage =
      images.find((image) => image.isPrimary)?.url ??
      images[0]?.url ??
      firstVariant?.images.find((image) => image.isPrimary)?.url ??
      firstVariant?.images[0]?.url ??
      (product.images.length === 0 ? product.primaryImageUrl : null);
    const galleryImages =
      product.images.length === 0 &&
      product.primaryImageUrl &&
      !images.some((image) => image.url === product.primaryImageUrl)
        ? [
            {
              id: `${product.id}-primary`,
              url: product.primaryImageUrl,
              altFa: product.titleFa,
              vipImage: false,
              isPrimary: true,
              showcasePublic: false,
              showcasePremium: false,
              sortOrder: -1,
              variantId: null,
              optionValueId: null,
            },
            ...images,
          ]
        : images;
    const showcaseImage = selectedShowcaseImage(galleryImages, tier);
    const rating = ratingByProductId.get(product.id);

    return {
      id: product.id,
      slug: product.slug,
      titleFa: product.titleFa,
      summaryFa: product.summaryFa,
      createdAt: product.createdAt.toISOString(),
      status: product.status,
      inventoryPolicy: product.inventoryPolicy,
      isSubscription: product.isSubscription,
      category: product.category,
      tags: product.tags.map((item) => item.tag),
      imageUrl: defaultImage,
      images: galleryImages,
      showcaseImageUrl: showcaseImage?.url ?? defaultImage,
      showcaseImages: prioritizeImage(galleryImages, showcaseImage),
      price: firstVariant?.price ?? 0,
      compareAtAmount: firstVariant?.compareAtAmount ?? 0,
      availableStock: variants.reduce((sum, variant) => sum + variant.availableStock, 0),
      variants,
      ratingAvg: rating?.avg ?? null,
      ratingCount: rating?.count ?? 0,
    };
  });

  return {
    items: mapped,
    meta: {
      total,
      page,
      pageSize,
      hasNext: page * pageSize < total,
    } satisfies ListingMeta,
  };
}

export type ProductSuggestion = {
  id: string;
  slug: string;
  titleFa: string;
  primaryImageUrl: string | null;
  priceToman: number;
};

export type CategorySuggestion = {
  slug: string;
  titleFa: string;
};

export type SearchSuggestions = {
  products: ProductSuggestion[];
  categories: CategorySuggestion[];
};

/**
 * Lightweight autocomplete for the storefront search. Returns a few ACTIVE,
 * browsable products and a few visible categories whose Persian title matches
 * the query (ILIKE). Only selects the columns the suggestions UI needs.
 */
export async function getSearchSuggestions(
  rawQuery: string,
  opts: { productLimit?: number; categoryLimit?: number; _db?: ReturnType<typeof getDb> } = {},
): Promise<SearchSuggestions> {
  noStore();

  const term = rawQuery.trim();
  if (term.length < 2) {
    return { products: [], categories: [] };
  }

  const db = opts._db ?? getDb();
  const productLimit = opts.productLimit ?? 6;
  const categoryLimit = opts.categoryLimit ?? 4;
  const like = `%${term}%`;

  const [productRows, categoryRows] = await Promise.all([
    db.query.products.findMany({
      where: (product, { and, eq, ne, ilike, or }) =>
        and(
          eq(product.status, "ACTIVE"),
          or(
            eq(product.isSubscription, true),
            and(ne(product.fulfillmentType, "DOMAIN"), ne(product.fulfillmentType, "SERVER")),
          ),
          ilike(product.titleFa, like),
        ),
      columns: { id: true, slug: true, titleFa: true, primaryImageUrl: true },
      with: {
        images: {
          where: (image, { eq }) => eq(image.vipImage, false),
          columns: { url: true, isPrimary: true, sortOrder: true },
          orderBy: (image, { desc, asc }) => [desc(image.isPrimary), asc(image.sortOrder)],
          limit: 1,
        },
        variants: {
          columns: { publicPriceAmount: true },
        },
      },
      orderBy: (product, { desc }) => [desc(product.createdAt)],
      limit: productLimit,
    }),
    db
      .select({ slug: categories.slug, titleFa: categories.titleFa })
      .from(categories)
      .where(and(eq(categories.isVisible, true), ilike(categories.titleFa, like)))
      .orderBy(asc(categories.sortOrder), asc(categories.titleFa))
      .limit(categoryLimit),
  ]);

  const productSuggestions: ProductSuggestion[] = productRows.map((product) => {
    const prices = product.variants
      .map((variant) => decimalToNumber(variant.publicPriceAmount))
      .filter((value) => value > 0);

    return {
      id: product.id,
      slug: product.slug,
      titleFa: product.titleFa,
      primaryImageUrl: product.images[0]?.url ?? product.primaryImageUrl ?? null,
      priceToman: prices.length > 0 ? Math.min(...prices) : 0,
    };
  });

  return { products: productSuggestions, categories: categoryRows };
}

export async function getProductForDetail(slug: string) {
  noStore();

  const product = await getDb().query.products.findFirst({
    where: (item, { eq }) => eq(item.slug, slug),
    with: {
      category: true,
      tags: {
        with: {
          tag: true,
        },
      },
      options: {
        with: {
          values: {
            orderBy: (value, { asc }) => [asc(value.position)],
          },
        },
        orderBy: (option, { asc }) => [asc(option.position)],
      },
      images: {
        orderBy: (image, { asc }) => [asc(image.sortOrder)],
      },
      variants: {
        with: {
          images: {
            orderBy: (image, { asc }) => [asc(image.sortOrder)],
          },
          inventoryUnits: {
            where: (unit, { eq }) => eq(unit.status, "AVAILABLE"),
            columns: {
              id: true,
            },
          },
          optionValues: {
            with: {
              option: { columns: { slug: true, nameFa: true } },
              optionValue: { columns: { slug: true, valueFa: true } },
            },
          },
          subscriptionPlan: true,
        },
        orderBy: (variant, { asc, desc }) => [desc(variant.isDefault), asc(variant.createdAt)],
      },
    },
  });

  if (!product) {
    return null;
  }

  return product;
}

function relatedProductsForDetail(
  product: NonNullable<Awaited<ReturnType<typeof getProductForDetail>>>,
  products: ListingProduct[],
) {
  const tagIds = new Set(product.tags.map((item) => item.tag.id));
  const currentProductSeen = new Set([product.id]);
  const productCreatedAt = (listingProduct: ListingProduct) =>
    new Date(listingProduct.createdAt).getTime();

  const sameCategory =
    product.categoryId == null
      ? []
      : products
          .filter((item) => item.id !== product.id && item.category?.id === product.categoryId)
          .sort((a, b) => productCreatedAt(b) - productCreatedAt(a))
          .slice(0, 15);

  sameCategory.forEach((item) => {
    currentProductSeen.add(item.id);
  });

  const similarTags =
    tagIds.size === 0
      ? []
      : products
          .map((item) => ({
            product: item,
            score: item.tags.reduce((sum, tag) => sum + (tagIds.has(tag.id) ? 1 : 0), 0),
          }))
          .filter((item) => item.score > 0 && !currentProductSeen.has(item.product.id))
          .sort((a, b) => {
            if (b.score !== a.score) {
              return b.score - a.score;
            }

            return productCreatedAt(b.product) - productCreatedAt(a.product);
          })
          .slice(0, 15)
          .map((item) => item.product);

  return [...sameCategory, ...similarTags].slice(0, 30);
}

export async function getProductDetailView(slug: string, user: { isPremium: boolean } | null) {
  const product = await getProductForDetail(slug);

  if (!product) {
    return null;
  }

  const tier = getUserTier(user);
  await loadExchangeRates();
  const unlimited = product.inventoryPolicy === "INFINITE";
  const variants = product.variants.map((variant) =>
    mapVariant(variant, tier, product.baseCurrency, unlimited),
  );
  const options = product.options.map(mapOption);
  const images = visibleImages(product.images, tier);
  const db = getDb();
  const [{ items: allProducts }, [ratingRow]] = await Promise.all([
    getProductsForListing(user),
    db
      .select({ avg: avg(productReviews.rating), count: count(productReviews.id) })
      .from(productReviews)
      .where(and(eq(productReviews.productId, product.id), eq(productReviews.status, "APPROVED"))),
  ]);

  const defaultVariant = variants.find((variant) => variant.id === product.variants[0]?.id) ?? null;

  return {
    id: product.id,
    slug: product.slug,
    titleFa: product.titleFa,
    summaryFa: product.summaryFa,
    descriptionFa: product.descriptionFa,
    fitFa: product.fitFa,
    careFa: product.careFa,
    status: product.status,
    fulfillmentType: product.fulfillmentType,
    inventoryPolicy: product.inventoryPolicy,
    isSubscription: product.isSubscription,
    category: product.category,
    tags: product.tags.map((item) => item.tag),
    options,
    images,
    variants,
    defaultVariantId: defaultVariant?.id ?? null,
    relatedProducts: relatedProductsForDetail(product, allProducts),
    // SEO overrides — fall back to titleFa/summaryFa/primaryImageUrl when null.
    seoTitle: product.seoTitle,
    seoDescription: product.seoDescription,
    ogImageUrl: product.ogImageUrl,
    noindex: product.noindex,
    // primaryImageUrl is the raw DB column. For non-premium tiers it may point
    // to a VIP-only image that anonymous users must not see (e.g. in OG tags).
    // Only emit it if the URL appears among the tier-visible images; otherwise
    // fall back to the first tier-visible image URL (or null).
    primaryImageUrl: (() => {
      if (!product.primaryImageUrl) return null;
      const visibleUrls = new Set(images.map((img) => img.url));
      if (visibleUrls.has(product.primaryImageUrl)) return product.primaryImageUrl;
      return images[0]?.url ?? null;
    })(),
    // Aggregate of APPROVED reviews. ratingAvg is null when there are no reviews.
    ratingAvg: ratingRow?.avg == null ? null : Number(ratingRow.avg),
    ratingCount: ratingRow?.count == null ? 0 : Number(ratingRow.count),
  };
}

export async function getHomepageView(user: { isPremium: boolean } | null) {
  noStore();

  const [blocks, products] = await Promise.all([
    getDb().query.homeBlocks.findMany({
      where: (block, { eq }) => eq(block.isActive, true),
      with: {
        category: true,
        tag: true,
        items: {
          with: {
            product: true,
          },
          orderBy: (item, { asc }) => [asc(item.sortOrder)],
        },
      },
      orderBy: (block, { asc }) => [asc(block.sortOrder)],
    }),
    getProductsForListing(user).then((r) => r.items),
  ]);

  if (blocks.length === 0) {
    return [];
  }

  return blocks.map((block) => {
    let blockProducts: ListingProduct[];

    if (block.source === "MANUAL") {
      const productsById = new Map(products.map((product) => [product.id, product]));
      blockProducts = block.items.flatMap((item) => {
        const product = productsById.get(item.productId);
        return product ? [product] : [];
      });
    } else {
      const filteredProducts = products.filter((product) => {
        const categoryMatch = !block.categoryId || product.category?.id === block.categoryId;
        const tagMatch = !block.tagId || product.tags.some((tag) => tag.id === block.tagId);
        return categoryMatch && tagMatch;
      });
      blockProducts = sortBlockProducts(filteredProducts, block.sortKey);
    }

    const visibleProducts = blockProducts.slice(0, block.maxItems).map((product) => ({
      ...product,
      imageUrl: product.showcaseImageUrl ?? product.imageUrl,
      images: product.showcaseImages.length > 0 ? product.showcaseImages : product.images,
    }));

    return {
      id: block.id,
      titleFa: block.titleFa,
      subtitleFa: block.subtitleFa,
      type: block.type,
      sortKey: block.sortKey,
      products: shouldResolveSingleRandomProduct(block.type)
        ? randomProduct(visibleProducts)
        : visibleProducts,
    };
  });
}
