import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

const ALGORITHM = 'aes-256-gcm';
const KEY_BYTES = 32;

function keyBytes(key: string): Buffer {
  const normalized = key.trim();
  if (!/^[a-f0-9]{64}$/i.test(normalized)) {
    throw new Error('GITHUB_TOKEN_ENCRYPTION_KEY must be a 64-character hexadecimal key');
  }
  return Buffer.from(normalized, 'hex');
}

export function encryptSecret(secret: string, key: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, keyBytes(key), iv);
  const encrypted = Buffer.concat([cipher.update(secret, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1:${iv.toString('base64url')}:${tag.toString('base64url')}:${encrypted.toString('base64url')}`;
}

export function decryptSecret(payload: string, key: string): string {
  const [version, ivEncoded, tagEncoded, encryptedEncoded] = payload.split(':');
  if (version !== 'v1' || !ivEncoded || !tagEncoded || !encryptedEncoded) throw new Error('Invalid encrypted secret format');
  const decipher = createDecipheriv(ALGORITHM, keyBytes(key), Buffer.from(ivEncoded, 'base64url'));
  decipher.setAuthTag(Buffer.from(tagEncoded, 'base64url'));
  return Buffer.concat([decipher.update(Buffer.from(encryptedEncoded, 'base64url')), decipher.final()]).toString('utf8');
}

export function getSecretEncryptionKey(): string {
  const key = process.env.GITHUB_TOKEN_ENCRYPTION_KEY?.trim();
  if (!key) throw new Error('Set GITHUB_TOKEN_ENCRYPTION_KEY in .env before saving a GitHub token');
  keyBytes(key);
  return key;
}

export function generateSecretEncryptionKey(): string {
  return randomBytes(KEY_BYTES).toString('hex');
}
