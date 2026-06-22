import { describe, expect, test } from "vitest";

import { channelAllowed } from "./dispatch";

type Prefs = Parameters<typeof channelAllowed>[2];

function prefs(over: Partial<NonNullable<Prefs>> = {}): NonNullable<Prefs> {
  return {
    id: "p",
    userId: "u",
    orderEmail: true,
    orderSms: true,
    promoEmail: false,
    promoSms: false,
    newsletterEmail: false,
    createdAt: new Date(0),
    updatedAt: new Date(0),
    ...over,
  };
}

describe("channelAllowed", () => {
  test("order gate respects orderEmail/orderSms; in-app/push never gated by those", () => {
    expect(channelAllowed("EMAIL", "order", prefs({ orderEmail: false }))).toBe(false);
    expect(channelAllowed("SMS", "order", prefs({ orderSms: false }))).toBe(false);
    expect(channelAllowed("EMAIL", "order", prefs())).toBe(true);
    expect(channelAllowed("INAPP", "order", prefs({ orderEmail: false }))).toBe(true);
    expect(channelAllowed("PUSH", "order", prefs({ orderEmail: false }))).toBe(true);
  });

  test("promo gate respects promo toggles (default off)", () => {
    expect(channelAllowed("EMAIL", "promo", prefs())).toBe(false);
    expect(channelAllowed("EMAIL", "promo", prefs({ promoEmail: true }))).toBe(true);
    expect(channelAllowed("SMS", "promo", prefs({ promoSms: true }))).toBe(true);
  });

  test("null gate or null prefs → always allowed", () => {
    expect(channelAllowed("EMAIL", null, prefs())).toBe(true);
    expect(channelAllowed("SMS", "order", null)).toBe(true);
  });
});
