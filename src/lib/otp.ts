import { createHmac, randomInt } from "node:crypto";

export function generateOtpCode() {
  return String(randomInt(1000, 10000));
}

export function hashOtp(phone: string, code: string) {
  const secret = process.env.SESSION_SECRET || "pixevel-development-secret";

  return createHmac("sha256", secret)
    .update(`${phone}:${code}`)
    .digest("hex");
}
