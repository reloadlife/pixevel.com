import { describe, expect, test } from "vitest";

import {
  HARDCODED_GLOBAL_DEFAULTS,
  parseGlobalDefaults,
  seoGlobalSchema,
} from "@/lib/seo/defaults";

describe("parseGlobalDefaults — safe fallback", () => {
  test("returns hardcoded defaults for null/empty", () => {
    expect(parseGlobalDefaults(null)).toEqual(HARDCODED_GLOBAL_DEFAULTS);
    expect(parseGlobalDefaults("")).toEqual(HARDCODED_GLOBAL_DEFAULTS);
    expect(parseGlobalDefaults(undefined)).toEqual(HARDCODED_GLOBAL_DEFAULTS);
  });

  test("returns hardcoded defaults for unparseable JSON", () => {
    expect(parseGlobalDefaults("{not json")).toEqual(HARDCODED_GLOBAL_DEFAULTS);
  });

  test("returns hardcoded defaults for schema-invalid JSON", () => {
    const bad = JSON.stringify({ titleTemplate: "", sitemap: { defaultPriority: 5 } });
    expect(parseGlobalDefaults(bad)).toEqual(HARDCODED_GLOBAL_DEFAULTS);
  });

  test("rejects out-of-range sitemap priority", () => {
    const bad = JSON.stringify({
      ...HARDCODED_GLOBAL_DEFAULTS,
      sitemap: { defaultPriority: 1.5, defaultChangefreq: "weekly" },
    });
    expect(parseGlobalDefaults(bad)).toEqual(HARDCODED_GLOBAL_DEFAULTS);
  });

  test("parses a valid stored value", () => {
    const valid = {
      titleTemplate: "%s — Shop",
      defaultDescription: "desc",
      defaultOgImageUrl: "https://cdn/og.png",
      robotsDefault: { index: false, follow: true },
      sitemap: { defaultPriority: 0.8, defaultChangefreq: "daily" as const },
    };
    expect(parseGlobalDefaults(JSON.stringify(valid))).toEqual(valid);
  });
});

describe("seoGlobalSchema", () => {
  test("rejects unknown changefreq", () => {
    const result = seoGlobalSchema.safeParse({
      ...HARDCODED_GLOBAL_DEFAULTS,
      sitemap: { defaultPriority: 0.5, defaultChangefreq: "fortnightly" },
    });
    expect(result.success).toBe(false);
  });

  test("accepts the hardcoded defaults", () => {
    expect(seoGlobalSchema.safeParse(HARDCODED_GLOBAL_DEFAULTS).success).toBe(true);
  });
});
