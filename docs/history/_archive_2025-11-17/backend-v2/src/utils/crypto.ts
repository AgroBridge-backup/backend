import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto';

const algorithm = 'aes-256-gcm';
const ivLength = 16;
const saltLength = 64;
const tagLength = 16;

// Get encryption key from environment variables. Ensure this is a 32-byte key.
const secretKey = process.env.ENCRYPTION_KEY;
if (!secretKey || secretKey.length !== 32) {
  throw new Error('ENCRYPTION_KEY environment variable must be set and be 32 characters long.');
}

// Use scrypt to derive a key from the secret. This adds more security.
const salt = randomBytes(saltLength);
const derivedKey = scryptSync(secretKey, salt, 32);

export function encrypt(text: string): string {
  const iv = randomBytes(ivLength);
  const cipher = createCipheriv(algorithm, derivedKey, iv);

  const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();

  // Combine iv, tag, and encrypted text into a single string for storage
  return Buffer.concat([iv, tag, encrypted]).toString('hex');
}

export function decrypt(encryptedText: string): string {
  const data = Buffer.from(encryptedText, 'hex');
  
  const iv = data.slice(0, ivLength);
  const tag = data.slice(ivLength, ivLength + tagLength);
  const encrypted = data.slice(ivLength + tagLength);

  const decipher = createDecipheriv(algorithm, derivedKey, iv);
  decipher.setAuthTag(tag);

  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);

  return decrypted.toString('utf8');
}
