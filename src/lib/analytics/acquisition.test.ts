import { describe, expect, test } from "vitest";

import { classifyTrafficSource, parseUtm, referrerHost } from "./acquisition";

describe("referrerHost", () => {
  test("extracts and lowercases host, strips www", () => {
    expect(referrerHost("https://www.Google.com/search?q=x")).toBe("google.com");
    expect(referrerHost("https://t.me/somechannel")).toBe("t.me");
  });

  test("returns null for empty or malformed input", () => {
    expect(referrerHost(null)).toBeNull();
    expect(referrerHost("")).toBeNull();
    expect(referrerHost("not a url")).toBeNull();
  });
});

describe("parseUtm", () => {
  test("parses the three utm params from a landing URL", () => {
    const utm = parseUtm(
      "https://shop.example/products?utm_source=insta&utm_medium=social&utm_campaign=spring",
    );
    expect(utm).toEqual({ source: "insta", medium: "social", campaign: "spring" });
  });

  test("works with a bare path+query string", () => {
    expect(parseUtm("/landing?utm_source=newsletter")).toEqual({ source: "newsletter" });
  });

  test("returns null when no utm params present", () => {
    expect(parseUtm("https://shop.example/products?q=hat")).toBeNull();
    expect(parseUtm(null)).toBeNull();
  });

  test("length-caps long values defensively", () => {
    const long = "a".repeat(500);
    const utm = parseUtm(`/x?utm_source=${long}`);
    expect(utm?.source?.length).toBe(128);
  });
});

describe("classifyTrafficSource", () => {
  test("campaign wins when utm source present", () => {
    expect(classifyTrafficSource("google.com", "newsletter")).toBe("Campaign");
  });

  test("direct when no host and no utm", () => {
    expect(classifyTrafficSource(null, null)).toBe("Direct");
  });

  test("recognises search engines", () => {
    expect(classifyTrafficSource("google.com", null)).toBe("Search");
    expect(classifyTrafficSource("bing.com", null)).toBe("Search");
  });

  test("recognises social hosts", () => {
    expect(classifyTrafficSource("instagram.com", null)).toBe("Social");
    expect(classifyTrafficSource("t.me", null)).toBe("Social");
    expect(classifyTrafficSource("x.com", null)).toBe("Social");
  });

  test("falls back to referral for any other host", () => {
    expect(classifyTrafficSource("blog.someone.ir", null)).toBe("Referral");
  });
});
