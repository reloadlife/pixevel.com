import { unstable_noStore as noStore } from "next/cache";

import type { ProductStatus } from "@/db/schema";
import { getDb } from "@/lib/db";
import { decimalToNumber } from "@/lib/format";

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
};

type CatalogVariant = {
  id: string;
  sku: string;
  titleFa: string;
  colorNameFa: string;
  colorSlug: string;
  colorHex: string | null;
  materialNameFa: string;
  materialSlug: string;
  size: string;
  publicPriceAmount: unknown;
  registeredPriceAmount?: unknown;
  premiumPriceAmount?: unknown;
  compareAtAmount?: unknown;
  images: CatalogImage[];
  inventoryUnits: Array<{ id: string }>;
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

export function variantPrice(
  variant: {
    publicPriceAmount: unknown;
    registeredPriceAmount?: unknown;
    premiumPriceAmount?: unknown;
  },
  tier: UserTier
) {
  if (tier === "PREMIUM" && variant.premiumPriceAmount != null) {
    return decimalToNumber(variant.premiumPriceAmount);
  }

  if (tier === "REGISTERED" && variant.registeredPriceAmount != null) {
    return decimalToNumber(variant.registeredPriceAmount);
  }

  return decimalToNumber(variant.publicPriceAmount);
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
  };
}

function visibleImages<T extends CatalogImage>(
  images: T[],
  tier: UserTier
) {
  return images
    .filter((image) => tier === "PREMIUM" || !image.vipImage)
    .map(mapImage);
}

function mapVariant(variant: CatalogVariant, tier: UserTier) {
  return {
    id: variant.id,
    sku: variant.sku,
    titleFa: variant.titleFa,
    colorNameFa: variant.colorNameFa,
    colorSlug: variant.colorSlug,
    colorHex: variant.colorHex,
    materialNameFa: variant.materialNameFa,
    materialSlug: variant.materialSlug,
    size: variant.size,
    price: variantPrice(variant, tier),
    compareAtAmount: decimalToNumber(variant.compareAtAmount),
    availableStock: variant.inventoryUnits.length,
    images: visibleImages(variant.images, tier),
  };
}

export type ListingProduct = {
  id: string;
  slug: string;
  titleFa: string;
  summaryFa: string | null;
  createdAt: string;
  status: ProductStatus;
  category: { id: string } | null;
  tags: Array<{ id: string }>;
  imageUrl?: string | null;
  images: ReturnType<typeof mapImage>[];
  showcaseImageUrl?: string | null;
  showcaseImages: ReturnType<typeof mapImage>[];
  price: number;
  availableStock: number;
  variants: ReturnType<typeof mapVariant>[];
};

function randomProduct(products: ListingProduct[]) {
  if (products.length === 0) {
    return [];
  }

  return [products[Math.floor(Math.random() * products.length)]];
}

function shouldResolveSingleRandomProduct(blockType: string) {
  return [
    "SHOWCASE",
    "SHOWCASE_RANDOM",
    "SHOWCASE_HERO",
    "SHOWCASE_HERO_NO_PRODUCT_INFO",
  ].includes(blockType);
}

function selectedShowcaseImage(
  images: ReturnType<typeof mapImage>[],
  tier: UserTier
) {
  const publicImage = images.find((image) => image.showcasePublic) ?? null;

  if (tier === "PREMIUM") {
    return images.find((image) => image.showcasePremium) ?? publicImage;
  }

  return publicImage;
}

function prioritizeImage(
  images: ReturnType<typeof mapImage>[],
  image: ReturnType<typeof mapImage> | null
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

  return sorted.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

export async function getProductsForListing(user: { isPremium: boolean } | null) {
  noStore();

  const tier = getUserTier(user);
  const products = await getDb().query.products.findMany({
    where: (product, { ne }) => ne(product.status, "ARCHIVED"),
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
          images: {
            orderBy: (image, { asc }) => [asc(image.sortOrder)],
          },
          inventoryUnits: {
            where: (unit, { eq }) => eq(unit.status, "AVAILABLE"),
            columns: {
              id: true,
            },
          },
        },
        orderBy: (variant, { asc }) => [asc(variant.createdAt)],
      },
    },
    orderBy: (product, { desc }) => [desc(product.createdAt)],
  });

  return products.map((product) => {
    const variants = product.variants.map((variant) => mapVariant(variant, tier));
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
            },
            ...images,
          ]
        : images;
    const showcaseImage = selectedShowcaseImage(galleryImages, tier);

    return {
      id: product.id,
      slug: product.slug,
      titleFa: product.titleFa,
      summaryFa: product.summaryFa,
      createdAt: product.createdAt.toISOString(),
      status: product.status,
      category: product.category,
      tags: product.tags.map((item) => item.tag),
      imageUrl: defaultImage,
      images: galleryImages,
      showcaseImageUrl: showcaseImage?.url ?? defaultImage,
      showcaseImages: prioritizeImage(galleryImages, showcaseImage),
      price: firstVariant?.price ?? 0,
      availableStock: variants.reduce((sum, variant) => sum + variant.availableStock, 0),
      variants,
    };
  });
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
        },
        orderBy: (variant, { asc, desc }) => [
          desc(variant.isDefault),
          asc(variant.createdAt),
        ],
      },
    },
  });

  if (!product) {
    return null;
  }

  return product;
}

function relatedProductsForDetail(product: NonNullable<Awaited<ReturnType<typeof getProductForDetail>>>, products: ListingProduct[]) {
  const tagIds = new Set(product.tags.map((item) => item.tag.id));
  const currentProductSeen = new Set([product.id]);
  const productCreatedAt = (listingProduct: ListingProduct) =>
    new Date(listingProduct.createdAt).getTime();

  const sameCategory =
    product.categoryId == null
      ? []
      : products
          .filter(
            (item) =>
              item.id !== product.id &&
              item.category?.id === product.categoryId
          )
          .sort((a, b) => productCreatedAt(b) - productCreatedAt(a))
          .slice(0, 15);

  sameCategory.forEach((item) => currentProductSeen.add(item.id));

  const similarTags =
    tagIds.size === 0
      ? []
      : products
          .map((item) => ({
            product: item,
            score: item.tags.reduce(
              (sum, tag) => sum + (tagIds.has(tag.id) ? 1 : 0),
              0
            ),
          }))
          .filter(
            (item) =>
              item.score > 0 && !currentProductSeen.has(item.product.id)
          )
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

export async function getProductDetailView(
  slug: string,
  user: { isPremium: boolean } | null
) {
  const product = await getProductForDetail(slug);

  if (!product) {
    return null;
  }

  const tier = getUserTier(user);
  const variants = product.variants.map((variant) => mapVariant(variant, tier));
  const images = visibleImages(product.images, tier);
  const products = await getProductsForListing(user);

  return {
    id: product.id,
    slug: product.slug,
    titleFa: product.titleFa,
    summaryFa: product.summaryFa,
    descriptionFa: product.descriptionFa,
    fitFa: product.fitFa,
    careFa: product.careFa,
    status: product.status,
    category: product.category,
    tags: product.tags.map((item) => item.tag),
    images,
    variants,
    relatedProducts: relatedProductsForDetail(product, products),
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
    getProductsForListing(user),
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
      products:
        shouldResolveSingleRandomProduct(block.type)
          ? randomProduct(visibleProducts)
          : visibleProducts,
    };
  });
}
