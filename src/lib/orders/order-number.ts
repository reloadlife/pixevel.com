import { randomBytes } from "node:crypto";

const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

function randomBase32(length: number): string {
  // Generate enough random bytes; each byte gives one base32 char via modulo 32
  const bytes = randomBytes(length);
  let result = "";
  for (let i = 0; i < length; i++) {
    result += BASE32_ALPHABET[bytes[i] % 32];
  }
  return result;
}

/**
 * Generates a unique order number in the format PX-yyMMdd-XXXXXX.
 * The suffix is 6 characters from the base32 alphabet (A-Z, 2-7) using
 * crypto-random bytes.
 *
 * Example: PX-260619-A3BZ7K
 */
export function generateOrderNumber(): string {
  const now = new Date();
  const yy = String(now.getFullYear()).slice(-2);
  const MM = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  const suffix = randomBase32(6);
  return `PX-${yy}${MM}${dd}-${suffix}`;
}
