import { randomUUID } from "node:crypto";

import { eq } from "drizzle-orm";

import { categories, inventoryUnits, products, productVariants } from "@/db/schema";
import { addToCart, type CartIdentity, type CartView } from "@/lib/cart";
import { getDb } from "@/lib/db";
import { quoteToToman } from "@/lib/domains/pricing";
import { searchDomain } from "@/lib/domains/spaceship";
import { loadExchangeRates } from "@/lib/pricing/exchange";

/**
 * Adds a domain to the caller's cart.
 *
 * Domains are not part of the normal catalog. For each add we mint a dedicated,
 * one-off ACTIVE product + variant under a hidden "domain" category. The variant
 * carries `metadata = { domainName, tld, years }` and is priced from a fresh
 * Spaceship quote. One inventory unit is created so the existing cart/checkout
 * stock rules pass unchanged, then we delegate to the shared `addToCart`.
 *
 * KEEPING DOMAINS OUT OF /products: these products are ACTIVE (required by
 * addToCart + placeOrder, which both reject non-ACTIVE items) and live under
 * the `DOMAIN_CATEGORY_SLUG` category. The listing query (getProductsForListing)
 * does not yet filter this category — see the README note in the stream summary
 * for the single-line filter to add there. They carry fulfillmentType DOMAIN
 * and the dedicated `domain` category/slug, so they are trivially filterable.
 */

export const DOMAIN_CATEGORY_SLUG = "domain";
const DOMAIN_CATEGORY_TITLE_FA = "دامنه";

export type DomainMetadata = {
  domainName: string;
  tld: string;
  years: number;
};

export class DomainCartError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

/** Ensures the hidden domain category exists; returns its id. */
async function ensureDomainCategory(): Promise<string> {
  const db = getDb();

  const existing = await db.query.categories.findFirst({
    where: eq(categories.slug, DOMAIN_CATEGORY_SLUG),
    columns: { id: true },
  });

  if (existing) {
    return existing.id;
  }

  const [created] = await db
    .insert(categories)
    .values({
      slug: DOMAIN_CATEGORY_SLUG,
      titleFa: DOMAIN_CATEGORY_TITLE_FA,
      // Hidden from category navigation; listing filter still TODO (see header).
      isVisible: false,
      sortOrder: 9000,
    })
    .onConflictDoNothing({ target: categories.slug })
    .returning({ id: categories.id });

  if (created) {
    return created.id;
  }

  // Lost the insert race — read the row the other writer created.
  const row = await db.query.categories.findFirst({
    where: eq(categories.slug, DOMAIN_CATEGORY_SLUG),
    columns: { id: true },
  });

  if (!row) {
    throw new DomainCartError("CATEGORY_FAILED", "خطا در آماده‌سازی دامنه.");
  }

  return row.id;
}

/**
 * Re-quotes the domain, mints the product/variant/inventory, and adds it to the
 * cart. Validates availability against the registrar before charging anything.
 */
export async function addDomainToCart(
  identity: CartIdentity,
  rawDomainName: string,
  rawYears = 1,
): Promise<CartView> {
  const domainName = rawDomainName.trim().toLowerCase().replace(/\.+$/, "");
  const years = Math.min(10, Math.max(1, Math.trunc(rawYears) || 1));

  if (!domainName?.includes(".")) {
    throw new DomainCartError("INVALID_DOMAIN", "نام دامنه معتبر نیست.");
  }

  const dot = domainName.indexOf(".");
  const tld = domainName.slice(dot + 1);

  // Re-check availability + price server-side (never trust the client preview).
  const search = await searchDomain(domainName);

  if (!search.configured) {
    throw new DomainCartError("NOT_CONFIGURED", "سرویس دامنه پیکربندی نشده است.");
  }

  const quote = search.quotes.find((entry) => entry.domainName === domainName);

  if (!quote?.available) {
    throw new DomainCartError("UNAVAILABLE", "این دامنه قابل ثبت نیست.");
  }

  await loadExchangeRates();
  const priceToman = quoteToToman(quote.priceUsd, years);
  const metadata: DomainMetadata = { domainName, tld, years };

  const db = getDb();
  const categoryId = await ensureDomainCategory();

  const unique = randomUUID().slice(0, 8);
  const slug = `domain-${domainName.replace(/[^a-z0-9]+/g, "-")}-${unique}`;
  const sku = `DOMAIN-${domainName.replace(/[^a-z0-9]+/g, "-").toUpperCase()}-${unique}`;

  // Mint the one-off product (ACTIVE so cart + checkout accept it).
  const [product] = await db
    .insert(products)
    .values({
      slug,
      titleFa: `دامنه ${domainName}`,
      summaryFa: `ثبت دامنه ${domainName} برای ${years} سال`,
      status: "ACTIVE",
      fulfillmentType: "DOMAIN",
      categoryId,
    })
    .returning({ id: products.id });

  // Mint its single variant carrying the domain metadata + price. All tiers pay
  // the same domain price, so only publicPriceAmount is set.
  const [variant] = await db
    .insert(productVariants)
    .values({
      productId: product.id,
      sku,
      titleFa: `${domainName} — ${years} سال`,
      colorNameFa: "—",
      colorSlug: "domain",
      materialNameFa: "—",
      materialSlug: "domain",
      size: `${years}Y`,
      publicPriceAmount: String(priceToman),
      isDefault: true,
      metadata,
    })
    .returning({ id: productVariants.id });

  // One physical "stock unit" so reservation/availability checks pass.
  await db.insert(inventoryUnits).values({
    variantId: variant.id,
    code: `DOMAIN-${unique}-${Date.now()}`,
    status: "AVAILABLE",
  });

  // Delegate to the shared cart adder (validates ACTIVE + stock, prices it).
  return addToCart(identity, variant.id, 1);
}
