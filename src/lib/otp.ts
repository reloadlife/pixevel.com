import { createHmac, randomInt, timingSafeEqual } from "node:crypto";

/** Failed verifications allowed against a single OTP before it is burned. */
export const MAX_OTP_ATTEMPTS = 5;

/** 6-digit code (10⁶ space) — large enough that the attempt cap makes brute force infeasible. */
export function generateOtpCode() {
  return String(randomInt(100000, 1000000));
}

/** True for a syntactically valid OTP code (6 digits). */
export function isOtpCodeShape(code: string): boolean {
  return /^\d{6}$/.test(code);
}

function otpSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (secret) {
    return secret;
  }
  // Never silently fall back to a public literal in production — that makes OTP
  // hashes forgeable. Fail loud instead.
  if (process.env.NODE_ENV === "production") {
    throw new Error("SESSION_SECRET is required in production.");
  }
  return "pixevel-development-secret";
}

export function hashOtp(phone: string, code: string) {
  return createHmac("sha256", otpSecret()).update(`${phone}:${code}`).digest("hex");
}

/** Constant-time comparison of a submitted code against the stored hash. */
export function verifyOtpHash(phone: string, code: string, storedHash: string): boolean {
  const expected = Buffer.from(hashOtp(phone, code), "hex");
  let actual: Buffer;
  try {
    actual = Buffer.from(storedHash, "hex");
  } catch {
    return false;
  }
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}
