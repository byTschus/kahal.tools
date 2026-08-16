import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

export type EncryptedValue = {
  encrypted: string;
  iv: string;
  tag: string;
};

export function encryptSecret(value: string): EncryptedValue {
  const keyHex = process.env.APP_ENCRYPTION_KEY;
  if (!keyHex || !/^[a-fA-F0-9]{64}$/.test(keyHex)) {
    throw new Error("APP_ENCRYPTION_KEY must contain exactly 64 hexadecimal characters");
  }
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", Buffer.from(keyHex, "hex"), iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return {
    encrypted: encrypted.toString("base64"),
    iv: iv.toString("hex"),
    tag: cipher.getAuthTag().toString("hex"),
  };
}

export function decryptSecret(encrypted: string, iv: string, tag: string) {
  const keyHex = process.env.APP_ENCRYPTION_KEY;
  if (!keyHex || !/^[a-fA-F0-9]{64}$/.test(keyHex)) throw new Error("Invalid APP_ENCRYPTION_KEY");
  const decipher = createDecipheriv("aes-256-gcm", Buffer.from(keyHex, "hex"), Buffer.from(iv, "hex"));
  decipher.setAuthTag(Buffer.from(tag, "hex"));
  return Buffer.concat([decipher.update(Buffer.from(encrypted, "base64")), decipher.final()]).toString("utf8");
}
