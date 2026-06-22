import { describe, expect, test } from "vitest";

import {
  extractProviderMessageId,
  mapDeliveryStatus,
  redactBody,
  redactCommPayload,
} from "./record";

describe("mapDeliveryStatus", () => {
  test("maps provider delivery statuses to ledger statuses", () => {
    expect(mapDeliveryStatus("sent")).toBe("SENT");
    expect(mapDeliveryStatus("pending")).toBe("PENDING");
    expect(mapDeliveryStatus("skipped")).toBe("SKIPPED");
    expect(mapDeliveryStatus("failed")).toBe("FAILED");
  });
});

describe("redactBody", () => {
  test("OTP body is never stored — replaced with a marker", () => {
    expect(redactBody("OTP", "your code is 12345")).toBe("[otp]");
  });

  test("non-OTP body passes through", () => {
    expect(redactBody("ORDER_CODES", "PX-1 codes: ABC")).toBe("PX-1 codes: ABC");
  });

  test("null body stays null", () => {
    expect(redactBody("OTHER", null)).toBeNull();
  });
});

describe("redactCommPayload", () => {
  test("strips sensitive keys deeply, keeps the rest", () => {
    const input = {
      token: "live-otp-9999",
      code: "12345",
      receptor: "09120000000",
      meta: {
        status: true,
        message_code: "ok-200",
        api_key: "sk_secret",
        nested: { password: "p@ss", statusCode: 200 },
      },
      entries: [{ messageid: 42, cost: 120 }],
    };
    const out = redactCommPayload(input) as Record<string, unknown>;

    expect(out.token).toBe("[redacted]");
    expect(out.code).toBe("[redacted]");
    expect(out.receptor).toBe("09120000000");
    const meta = out.meta as Record<string, unknown>;
    expect(meta.message_code).toBe("ok-200"); // status code kept, not redacted
    expect(meta.api_key).toBe("[redacted]");
    const nested = meta.nested as Record<string, unknown>;
    expect(nested.password).toBe("[redacted]");
    expect(nested.statusCode).toBe(200); // status code kept
    expect((out.entries as unknown[])[0]).toEqual({ messageid: 42, cost: 120 });
  });

  test("null / primitives pass through untouched", () => {
    expect(redactCommPayload(null)).toBeNull();
    expect(redactCommPayload("hello")).toBe("hello");
    expect(redactCommPayload(7)).toBe(7);
  });
});

describe("extractProviderMessageId", () => {
  test("kavenegar — entries[0].messageid", () => {
    expect(
      extractProviderMessageId("kavenegar", {
        return: { status: 200 },
        entries: [{ messageid: 123 }],
      }),
    ).toBe("123");
  });

  test("ippanel — data.message_outbox_ids[0]", () => {
    expect(
      extractProviderMessageId("ippanel", { data: { message_outbox_ids: [456] }, meta: {} }),
    ).toBe("456");
  });

  test("telegram — result.messageId", () => {
    expect(extractProviderMessageId("telegram", { ok: true, result: { messageId: 789 } })).toBe(
      "789",
    );
  });

  test("selfhosted — payload.id", () => {
    expect(extractProviderMessageId("selfhosted", { id: "msg-abc-123" })).toBe("msg-abc-123");
    expect(extractProviderMessageId("selfhosted", { id: 42 })).toBe("42");
  });

  test("selfhosted — returns null when id absent or empty", () => {
    expect(extractProviderMessageId("selfhosted", {})).toBeNull();
    expect(extractProviderMessageId("selfhosted", { id: "" })).toBeNull();
    expect(extractProviderMessageId("selfhosted", null)).toBeNull();
  });

  test("returns null when absent / unknown provider", () => {
    expect(extractProviderMessageId("kavenegar", { return: { status: 400 } })).toBeNull();
    expect(extractProviderMessageId("nope", { id: "x" })).toBeNull();
    expect(extractProviderMessageId("ippanel", null)).toBeNull();
  });
});
