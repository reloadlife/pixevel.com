import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

/**
 * AES-256-GCM encryption for secrets stored at rest (admin-managed settings,
 * integration credentials). Key comes from APP_VAULT_KEY — the one key for all
 * at-rest secrets. It MUST stay an env var (it decrypts everything else, so it
 * can't itself live in the DB).
 */

const ALGO = "aes-256-gcm";
const IV_BYTES = 12;
const TAG_BYTES = 16;

/** Returns the 32-byte key from APP_VAULT_KEY (64 hex chars or base64). Throws when absent/invalid. */
function getKey(): Buffer {
  const raw = process.env.APP_VAULT_KEY;
  if (!raw) {
    throw new Error("APP_VAULT_KEY is required to encrypt/decrypt secrets.");
  }
  const key = raw.length === 64 ? Buffer.from(raw, "hex") : Buffer.from(raw, "base64");
  if (key.length !== 32) {
    throw new Error("APP_VAULT_KEY must decode to 32 bytes (64 hex chars or base64).");
  }
  return key;
}

/** True when a usable vault key is configured. Never throws. */
export function isVaultConfigured(): boolean {
  try {
    getKey();
    return true;
  } catch {
    return false;
  }
}

/** Encrypts to base64(iv | tag | ciphertext). */
export function encryptSecret(plain: string): string {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGO, getKey(), iv);
  const ct = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), ct]).toString("base64");
}

export function decryptSecret(blob: string): string {
  const buf = Buffer.from(blob, "base64");
  const iv = buf.subarray(0, IV_BYTES);
  const tag = buf.subarray(IV_BYTES, IV_BYTES + TAG_BYTES);
  const ct = buf.subarray(IV_BYTES + TAG_BYTES);
  const decipher = createDecipheriv(ALGO, getKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ct), decipher.final()]).toString("utf8");
}

export function encryptJson(value: unknown): string {
  return encryptSecret(JSON.stringify(value));
}

export function decryptJson<T = unknown>(blob: string): T {
  return JSON.parse(decryptSecret(blob)) as T;
}
