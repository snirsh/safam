import { createDecipheriv } from "node:crypto";

/**
 * Standalone decrypt for the scraper package.
 * Matches the format produced by src/lib/crypto/encryption.ts in the app:
 * `iv:authTag:ciphertext` (all base64, AES-256-GCM).
 */
export function decrypt(encrypted: string, keyHex: string): string {
  if (keyHex.length !== 64) {
    throw new Error("ENCRYPTION_KEY must be 64 hex chars (32 bytes)");
  }

  const key = Buffer.from(keyHex, "hex");
  const parts = encrypted.split(":");
  if (parts.length !== 3) throw new Error("Invalid encrypted format");

  const iv = Buffer.from(parts[0] as string, "base64");
  const authTag = Buffer.from(parts[1] as string, "base64");
  const ciphertextB64 = parts[2] as string;

  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(ciphertextB64, "base64", "utf8");
  decrypted += decipher.final("utf8");

  return decrypted;
}
