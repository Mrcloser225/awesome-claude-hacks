import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

/**
 * AES-256-GCM for secrets at rest (calendar and CRM tokens). The key comes
 * from ENCRYPTION_KEY (any string; it is hashed to 32 bytes). Ciphertext is
 * "v1:" + base64(iv | tag | data). Without a key the Noop cipher stores
 * plaintext and the server warns loudly at boot.
 */
export interface Cipher {
  encrypt(plain: string): string;
  decrypt(stored: string): string;
}

export class AesGcmCipher implements Cipher {
  private readonly key: Buffer;
  constructor(secret: string) {
    if (!secret || secret.length < 16) throw new Error("ENCRYPTION_KEY must be at least 16 characters");
    this.key = createHash("sha256").update(secret).digest();
  }
  encrypt(plain: string): string {
    const iv = randomBytes(12);
    const c = createCipheriv("aes-256-gcm", this.key, iv);
    const data = Buffer.concat([c.update(plain, "utf8"), c.final()]);
    return `v1:${Buffer.concat([iv, c.getAuthTag(), data]).toString("base64")}`;
  }
  decrypt(stored: string): string {
    if (!stored.startsWith("v1:")) return stored; // legacy plaintext row
    const buf = Buffer.from(stored.slice(3), "base64");
    const iv = buf.subarray(0, 12), tag = buf.subarray(12, 28), data = buf.subarray(28);
    const d = createDecipheriv("aes-256-gcm", this.key, iv);
    d.setAuthTag(tag);
    return Buffer.concat([d.update(data), d.final()]).toString("utf8");
  }
}

export class NoopCipher implements Cipher {
  encrypt(p: string) { return p; }
  decrypt(s: string) { return s; }
}

export function sha256(s: string): string { return createHash("sha256").update(s).digest("hex"); }
export function randomToken(bytes = 32): string { return randomBytes(bytes).toString("base64url"); }
