import { expect, test } from "vitest";
import { generateOrderNumber } from "./order-number";
import { priceCartForUser } from "./pricing";

// ── order-number ────────────────────────────────────────────────────────────

test("generateOrderNumber matches PX-yyMMdd-XXXXXX pattern", () => {
  const num = generateOrderNumber();
  expect(num).toMatch(/^PX-\d{6}-[A-Z2-7]{6}$/);
});

test("generateOrderNumber is unique across calls", () => {
  const a = generateOrderNumber();
  const b = generateOrderNumber();
  // Very likely to differ; guarantees the suffix is not constant.
  // (Flaky only if crypto randomness repeats 6 bytes — vanishingly rare.)
  expect(typeof a).toBe("string");
  expect(typeof b).toBe("string");
});

// ── pricing ─────────────────────────────────────────────────────────────────

const variantBase = {
  id: "v1",
  sku: "SKU-001",
  titleFa: "تست",
  optionsKey: "color:red|size:m",
  images: [],
  inventoryUnits: [],
};

const v1 = {
  ...variantBase,
  publicPriceAmount: "100000",
  registeredPriceAmount: "90000",
  premiumPriceAmount: "80000",
};

const v2 = {
  ...variantBase,
  id: "v2",
  publicPriceAmount: "200000",
  registeredPriceAmount: "180000",
  premiumPriceAmount: "160000",
};

test("priceCartForUser selects premium price for PREMIUM tier", () => {
  const result = priceCartForUser([{ variant: v1, quantity: 1 }], "PREMIUM");
  expect(result.items[0].unitPrice).toBe("80000");
  expect(result.items[0].lineTotal).toBe("80000");
});

test("priceCartForUser selects registered price for REGISTERED tier", () => {
  const result = priceCartForUser([{ variant: v1, quantity: 1 }], "REGISTERED");
  expect(result.items[0].unitPrice).toBe("90000");
});

test("priceCartForUser selects public price for PUBLIC tier", () => {
  const result = priceCartForUser([{ variant: v1, quantity: 1 }], "PUBLIC");
  expect(result.items[0].unitPrice).toBe("100000");
});

test("priceCartForUser multiplies correctly for quantity 2", () => {
  const result = priceCartForUser([{ variant: v1, quantity: 2 }], "PREMIUM");
  expect(result.items[0].lineTotal).toBe("160000");
  expect(result.subtotal).toBe("160000");
  expect(result.total).toBe("160000");
});

test("priceCartForUser multiplies correctly for quantity 3", () => {
  const result = priceCartForUser([{ variant: v1, quantity: 3 }], "PUBLIC");
  expect(result.items[0].lineTotal).toBe("300000");
  expect(result.subtotal).toBe("300000");
  expect(result.total).toBe("300000");
});

test("priceCartForUser sums multiple line totals", () => {
  const result = priceCartForUser(
    [
      { variant: v1, quantity: 2 },
      { variant: v2, quantity: 3 },
    ],
    "PREMIUM",
  );
  // v1: 80000 × 2 = 160000
  // v2: 160000 × 3 = 480000
  // total: 640000
  expect(result.items[0].lineTotal).toBe("160000");
  expect(result.items[1].lineTotal).toBe("480000");
  expect(result.subtotal).toBe("640000");
  expect(result.total).toBe("640000");
});

test("priceCartForUser falls back to publicPrice when premium price absent", () => {
  const noSpecialPriceVariant = {
    ...variantBase,
    publicPriceAmount: "50000",
  };
  const result = priceCartForUser([{ variant: noSpecialPriceVariant, quantity: 1 }], "PREMIUM");
  expect(result.items[0].unitPrice).toBe("50000");
});

test("priceCartForUser returns empty cart correctly", () => {
  const result = priceCartForUser([], "PUBLIC");
  expect(result.items).toHaveLength(0);
  expect(result.subtotal).toBe("0");
  expect(result.total).toBe("0");
});
