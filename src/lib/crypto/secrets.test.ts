import { beforeAll, describe, expect, test } from "vitest";

import {
  decryptJson,
  decryptSecret,
  encryptJson,
  encryptSecret,
  isVaultConfigured,
} from "./secrets";

beforeAll(() => {
  process.env.APP_VAULT_KEY = "00112233445566778899aabbccddeeff00112233445566778899aabbccddeeff";
});

describe("secrets", () => {
  test("isVaultConfigured true when key set", () => {
    expect(isVaultConfigured()).toBe(true);
  });

  test("round-trips a string and hides plaintext", () => {
    const blob = encryptSecret("super-secret-token");
    expect(blob).not.toContain("super-secret-token");
    expect(decryptSecret(blob)).toBe("super-secret-token");
  });

  test("round-trips json", () => {
    const obj = { apiKey: "k", apiSecret: "s" };
    expect(decryptJson(encryptJson(obj))).toEqual(obj);
  });

  test("random IV → different ciphertext each call", () => {
    expect(encryptSecret("x")).not.toBe(encryptSecret("x"));
  });

  test("tampered ciphertext throws (GCM tag)", () => {
    const buf = Buffer.from(encryptSecret("hello"), "base64");
    buf[buf.length - 1] ^= 0xff;
    expect(() => decryptSecret(buf.toString("base64"))).toThrow();
  });
});
