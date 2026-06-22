import { describe, expect, test } from "vitest";

import {
  mapIppanelDeliveryStatus,
  mapKavenegarDeliveryStatus,
  mapSelfhostedDeliveryStatus,
  safeEqual,
} from "./webhook";

describe("safeEqual", () => {
  test("true only on exact match", () => {
    expect(safeEqual("s3cr3t", "s3cr3t")).toBe(true);
    expect(safeEqual("s3cr3t", "s3cr3x")).toBe(false);
  });

  test("length mismatch is false, never throws", () => {
    expect(safeEqual("short", "longer-value")).toBe(false);
  });

  test("empty / nullish never matches", () => {
    expect(safeEqual("", "")).toBe(false);
    expect(safeEqual(null, "x")).toBe(false);
    expect(safeEqual("x", undefined)).toBe(false);
  });
});

describe("mapKavenegarDeliveryStatus", () => {
  test("maps Kavenegar delivery codes", () => {
    expect(mapKavenegarDeliveryStatus(10)).toBe("DELIVERED");
    expect(mapKavenegarDeliveryStatus(11)).toBe("UNDELIVERED");
    expect(mapKavenegarDeliveryStatus(6)).toBe("FAILED");
    expect(mapKavenegarDeliveryStatus(1)).toBe("QUEUED");
    expect(mapKavenegarDeliveryStatus(5)).toBe("SENT");
    expect(mapKavenegarDeliveryStatus(99)).toBe("PENDING");
  });

  test("coerces string codes", () => {
    expect(mapKavenegarDeliveryStatus("10")).toBe("DELIVERED");
  });
});

describe("mapSelfhostedDeliveryStatus", () => {
  test("delivered → DELIVERED", () => {
    expect(mapSelfhostedDeliveryStatus("delivered")).toBe("DELIVERED");
  });

  test("failed → UNDELIVERED", () => {
    expect(mapSelfhostedDeliveryStatus("failed")).toBe("UNDELIVERED");
  });

  test("undelivered → UNDELIVERED", () => {
    expect(mapSelfhostedDeliveryStatus("undelivered")).toBe("UNDELIVERED");
  });

  test("anything else → PENDING", () => {
    expect(mapSelfhostedDeliveryStatus("sent")).toBe("PENDING");
    expect(mapSelfhostedDeliveryStatus("queued")).toBe("PENDING");
    expect(mapSelfhostedDeliveryStatus("unknown")).toBe("PENDING");
  });
});

describe("mapIppanelDeliveryStatus", () => {
  test("maps common IPPanel statuses defensively", () => {
    expect(mapIppanelDeliveryStatus("delivered")).toBe("DELIVERED");
    expect(mapIppanelDeliveryStatus("DELIVERED")).toBe("DELIVERED");
    expect(mapIppanelDeliveryStatus("undelivered")).toBe("UNDELIVERED");
    expect(mapIppanelDeliveryStatus("failed")).toBe("UNDELIVERED");
    expect(mapIppanelDeliveryStatus("pending")).toBe("PENDING");
    expect(mapIppanelDeliveryStatus("anything-else")).toBe("PENDING");
  });
});
