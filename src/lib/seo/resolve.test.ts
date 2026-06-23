import { describe, expect, test } from "vitest";

import { HARDCODED_GLOBAL_DEFAULTS, type SeoGlobalDefaults } from "@/lib/seo/defaults";
import {
  applyTitleTemplate,
  coercePriority,
  mergeEntitySeo,
  mergeStaticSeo,
} from "@/lib/seo/resolve";

const GLOBAL: SeoGlobalDefaults = {
  titleTemplate: "%s | پیسکول",
  defaultDescription: "GLOBAL_DESC",
  defaultOgImageUrl: "https://cdn/og-default.png",
  robotsDefault: { index: true, follow: true },
  sitemap: { defaultPriority: 0.5, defaultChangefreq: "weekly" },
};

describe("coercePriority", () => {
  test("parses numeric strings in range", () => {
    expect(coercePriority("0.7")).toBe(0.7);
    expect(coercePriority("0")).toBe(0);
    expect(coercePriority("1")).toBe(1);
    expect(coercePriority(0.3)).toBe(0.3);
  });

  test("rejects out-of-range and junk", () => {
    expect(coercePriority("1.5")).toBeNull();
    expect(coercePriority("-0.1")).toBeNull();
    expect(coercePriority("abc")).toBeNull();
    expect(coercePriority("")).toBeNull();
    expect(coercePriority(null)).toBeNull();
    expect(coercePriority(undefined)).toBeNull();
  });
});

describe("applyTitleTemplate", () => {
  test("substitutes %s", () => {
    expect(applyTitleTemplate("%s | پیسکول", "درباره ما")).toBe("درباره ما | پیسکول");
  });
  test("returns the page title unchanged when template lacks %s", () => {
    expect(applyTitleTemplate("پیسکول", "درباره ما")).toBe("درباره ما");
  });
});

describe("mergeStaticSeo — home page renders verbatim", () => {
  test("the home page title is NOT templated", () => {
    const r = mergeStaticSeo({
      pathKey: "/",
      row: null,
      staticDefaults: {
        title: "پیسکول | فروشگاه آنلاین همه‌چیز",
        description: "HOME_DESC",
        sitemapPriority: 1,
        sitemapChangefreq: "daily",
      },
      global: GLOBAL,
    });
    expect(r.title).toBe("پیسکول | فروشگاه آنلاین همه‌چیز");
    expect(r.pageTitle).toBe("پیسکول | فروشگاه آنلاین همه‌چیز");
  });
});

describe("mergeStaticSeo — precedence (page → catalog → global)", () => {
  const staticDefaults = {
    title: "CATALOG_TITLE",
    description: "CATALOG_DESC",
    sitemapPriority: 0.4,
    sitemapChangefreq: "yearly" as const,
  };

  test("PageSeo override wins over catalog and global", () => {
    const r = mergeStaticSeo({
      pathKey: "/about",
      row: {
        seoTitle: "ROW_TITLE",
        seoDescription: "ROW_DESC",
        ogImageUrl: "https://cdn/row.png",
        noindex: false,
        sitemapPriority: "0.9",
        sitemapChangefreq: "daily",
      },
      staticDefaults,
      global: GLOBAL,
    });
    expect(r.title).toBe("ROW_TITLE | پیسکول");
    expect(r.pageTitle).toBe("ROW_TITLE");
    expect(r.description).toBe("ROW_DESC");
    expect(r.ogImageUrl).toBe("https://cdn/row.png");
    expect(r.sitemapPriority).toBe(0.9);
    expect(r.sitemapChangefreq).toBe("daily");
    expect(r.canonical).toBe("/about");
  });

  test("falls back to catalog when the row is empty", () => {
    const r = mergeStaticSeo({
      pathKey: "/about",
      row: { seoTitle: null, seoDescription: "  ", sitemapPriority: null },
      staticDefaults,
      global: GLOBAL,
    });
    expect(r.title).toBe("CATALOG_TITLE | پیسکول");
    expect(r.pageTitle).toBe("CATALOG_TITLE");
    expect(r.description).toBe("CATALOG_DESC");
    expect(r.sitemapPriority).toBe(0.4);
    expect(r.sitemapChangefreq).toBe("yearly");
    // OG image falls through to the global default.
    expect(r.ogImageUrl).toBe("https://cdn/og-default.png");
  });

  test("falls back to global description when catalog has none", () => {
    const r = mergeStaticSeo({
      pathKey: "/x",
      row: null,
      staticDefaults: null,
      global: GLOBAL,
    });
    expect(r.description).toBe("GLOBAL_DESC");
    expect(r.sitemapPriority).toBe(0.5);
    expect(r.sitemapChangefreq).toBe("weekly");
  });

  test("noindex propagates from the row", () => {
    const r = mergeStaticSeo({
      pathKey: "/about",
      row: { noindex: true },
      staticDefaults,
      global: GLOBAL,
    });
    expect(r.noindex).toBe(true);
  });

  test("global robotsDefault.index=false forces noindex everywhere", () => {
    const r = mergeStaticSeo({
      pathKey: "/about",
      row: { noindex: false },
      staticDefaults,
      global: { ...GLOBAL, robotsDefault: { index: false, follow: true } },
    });
    expect(r.noindex).toBe(true);
  });

  test("canonicalOverride wins over the derived path", () => {
    const r = mergeStaticSeo({
      pathKey: "/about",
      row: { canonicalOverride: "https://pixevel.com/about-us" },
      staticDefaults,
      global: GLOBAL,
    });
    expect(r.canonical).toBe("https://pixevel.com/about-us");
  });
});

describe("mergeEntitySeo — precedence (entity → global)", () => {
  test("seoTitle/seoDescription win; falls back to titleFa", () => {
    const r = mergeEntitySeo({
      kind: "product",
      entity: {
        titleFa: "TITLE_FA",
        seoTitle: "SEO_TITLE",
        seoDescription: "SEO_DESC",
        ogImageUrl: "https://cdn/p.png",
      },
      canonical: "/products/foo",
      global: GLOBAL,
    });
    expect(r.title).toBe("SEO_TITLE | پیسکول");
    expect(r.pageTitle).toBe("SEO_TITLE");
    expect(r.description).toBe("SEO_DESC");
    expect(r.ogImageUrl).toBe("https://cdn/p.png");
    expect(r.ogType).toBe("website");
    expect(r.canonical).toBe("/products/foo");
  });

  test("uses titleFa and fallbackDescription when SEO fields empty", () => {
    const r = mergeEntitySeo({
      kind: "blog",
      entity: {
        titleFa: "POST_TITLE",
        seoTitle: null,
        seoDescription: "",
        fallbackDescription: "EXCERPT",
      },
      canonical: "/blog/foo",
      global: GLOBAL,
    });
    expect(r.title).toBe("POST_TITLE | پیسکول");
    expect(r.pageTitle).toBe("POST_TITLE");
    expect(r.description).toBe("EXCERPT");
    expect(r.ogType).toBe("article");
    // No entity OG image → global default.
    expect(r.ogImageUrl).toBe("https://cdn/og-default.png");
  });

  test("entity noindex propagates", () => {
    const r = mergeEntitySeo({
      kind: "category",
      entity: { titleFa: "C", noindex: true },
      canonical: "/category/c",
      global: GLOBAL,
    });
    expect(r.noindex).toBe(true);
  });

  test("description is undefined when no entity/fallback description", () => {
    const r = mergeEntitySeo({
      kind: "product",
      entity: { titleFa: "P" },
      canonical: "/products/p",
      global: GLOBAL,
    });
    expect(r.description).toBeUndefined();
  });
});

describe("hardcoded defaults sanity", () => {
  test("HARDCODED_GLOBAL_DEFAULTS has a title template with %s", () => {
    expect(HARDCODED_GLOBAL_DEFAULTS.titleTemplate).toContain("%s");
  });
});
