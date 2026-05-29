import {
  randomBytes,
  createCipheriv,
  createDecipheriv,
} from 'crypto';

interface EncryptedPayload {
  iv: string;
  ciphertext: string;
  tag: string;
}

/**
 * AES-256-GCM encrypt a plaintext string.
 * @param plaintext - UTF-8 string to encrypt
 * @param keyBase64 - 32-byte key as base64
 */
export function encrypt(plaintext: string, keyBase64: string): string {
  const key = Buffer.from(keyBase64, 'base64').slice(0, 32);
  const iv = randomBytes(12); // 96-bit IV for GCM
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  const payload: EncryptedPayload = {
    iv: iv.toString('base64'),
    ciphertext: encrypted.toString('base64'),
    tag: tag.toString('base64'),
  };
  return JSON.stringify(payload);
}

/**
 * AES-256-GCM decrypt an encrypted payload string.
 * @param encryptedJson - JSON string from encrypt()
 * @param keyBase64 - 32-byte key as base64
 */
export function decrypt(encryptedJson: string, keyBase64: string): string {
  const key = Buffer.from(keyBase64, 'base64').slice(0, 32);
  const payload: EncryptedPayload = JSON.parse(encryptedJson);
  const iv = Buffer.from(payload.iv, 'base64');
  const ciphertext = Buffer.from(payload.ciphertext, 'base64');
  const tag = Buffer.from(payload.tag, 'base64');
  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  const decrypted = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]);
  return decrypted.toString('utf8');
}
