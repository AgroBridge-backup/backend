/**
 * Encryption Service
 * AES-256-GCM encryption for sensitive data and PII
 */

import crypto from 'crypto';
import { logger } from '../logging/logger.js';

/**
 * Encryption configuration
 */
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16; // 128 bits for GCM
const AUTH_TAG_LENGTH = 16; // 128 bits
const SALT_LENGTH = 32;
const KEY_LENGTH = 32; // 256 bits
const PBKDF2_ITERATIONS = 100000;

/**
 * Get encryption key from environment
 */
function getEncryptionKey(): Buffer {
  const key = process.env.ENCRYPTION_KEY;
  if (!key) {
    throw new Error('ENCRYPTION_KEY environment variable is required');
  }

  // If key is base64 encoded (44 chars = 32 bytes in base64)
  if (key.length === 44) {
    return Buffer.from(key, 'base64');
  }

  // If key is hex encoded (64 chars = 32 bytes in hex)
  if (key.length === 64) {
    return Buffer.from(key, 'hex');
  }

  // Otherwise derive key from password using configurable salt
  const salt = getEncryptionSalt();
  return crypto.pbkdf2Sync(key, salt, PBKDF2_ITERATIONS, KEY_LENGTH, 'sha512');
}

/**
 * Get encryption salt from environment
 * SECURITY: Salt must be unique per deployment and stored securely
 */
function getEncryptionSalt(): Buffer {
  const salt = process.env.ENCRYPTION_SALT;

  if (salt) {
    // If salt is base64 encoded (44 chars = 32 bytes)
    if (salt.length === 44) {
      return Buffer.from(salt, 'base64');
    }
    // If salt is hex encoded (64 chars = 32 bytes)
    if (salt.length === 64) {
      return Buffer.from(salt, 'hex');
    }
    // Use raw string as salt (not recommended but supported)
    if (salt.length >= 16) {
      return Buffer.from(salt, 'utf8');
    }
  }

  // In production, salt is required
  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      'ENCRYPTION_SALT environment variable is required in production. ' +
      'Generate with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'base64\'))"'
    );
  }

  // Development/test fallback with warning
  logger.warn(
    'ENCRYPTION_SALT not configured - using development fallback. ' +
    'This is NOT secure for production!'
  );
  return crypto.createHash('sha256').update('agrobridge-dev-salt-v1').digest();
}

/**
 * Encryption result structure
 */
export interface EncryptedData {
  ciphertext: string;
  iv: string;
  authTag: string;
  version: number;
}

/**
 * Encrypt data using AES-256-GCM
 */
export function encrypt(plaintext: string, additionalData?: string): EncryptedData {
  try {
    const key = getEncryptionKey();
    const iv = crypto.randomBytes(IV_LENGTH);

    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

    if (additionalData) {
      cipher.setAAD(Buffer.from(additionalData, 'utf8'));
    }

    let ciphertext = cipher.update(plaintext, 'utf8', 'base64');
    ciphertext += cipher.final('base64');

    const authTag = cipher.getAuthTag();

    return {
      ciphertext,
      iv: iv.toString('base64'),
      authTag: authTag.toString('base64'),
      version: 1,
    };
  } catch (error) {
    logger.error('Encryption failed', { error });
    throw new Error('Encryption failed');
  }
}

/**
 * Decrypt data using AES-256-GCM
 */
export function decrypt(encrypted: EncryptedData, additionalData?: string): string {
  try {
    const key = getEncryptionKey();
    const iv = Buffer.from(encrypted.iv, 'base64');
    const authTag = Buffer.from(encrypted.authTag, 'base64');

    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);

    if (additionalData) {
      decipher.setAAD(Buffer.from(additionalData, 'utf8'));
    }

    let plaintext = decipher.update(encrypted.ciphertext, 'base64', 'utf8');
    plaintext += decipher.final('utf8');

    return plaintext;
  } catch (error) {
    logger.error('Decryption failed', { error });
    throw new Error('Decryption failed - data may be corrupted or key mismatch');
  }
}

/**
 * Encrypt data to a single string (for database storage)
 */
export function encryptToString(plaintext: string, additionalData?: string): string {
  const encrypted = encrypt(plaintext, additionalData);
  return `v${encrypted.version}:${encrypted.iv}:${encrypted.authTag}:${encrypted.ciphertext}`;
}

/**
 * Decrypt from single string format
 */
export function decryptFromString(encryptedString: string, additionalData?: string): string {
  const parts = encryptedString.split(':');
  if (parts.length !== 4) {
    throw new Error('Invalid encrypted data format');
  }

  const version = parseInt(parts[0].substring(1), 10);
  const encrypted: EncryptedData = {
    iv: parts[1],
    authTag: parts[2],
    ciphertext: parts[3],
    version,
  };

  return decrypt(encrypted, additionalData);
}

/**
 * Hash data using SHA-256
 */
export function hash(data: string): string {
  return crypto.createHash('sha256').update(data).digest('hex');
}

/**
 * Hash data using SHA-512
 */
export function hashSha512(data: string): string {
  return crypto.createHash('sha512').update(data).digest('hex');
}

/**
 * Generate HMAC
 */
export function hmac(data: string, secret?: string): string {
  const key = secret || getEncryptionKey().toString('hex');
  return crypto.createHmac('sha256', key).update(data).digest('hex');
}

/**
 * Verify HMAC
 */
export function verifyHmac(data: string, expectedHmac: string, secret?: string): boolean {
  const calculatedHmac = hmac(data, secret);
  return crypto.timingSafeEqual(
    Buffer.from(calculatedHmac, 'hex'),
    Buffer.from(expectedHmac, 'hex')
  );
}

/**
 * Hash password using bcrypt-compatible PBKDF2
 */
export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(SALT_LENGTH);
  const hash = crypto.pbkdf2Sync(
    password,
    salt,
    PBKDF2_ITERATIONS,
    KEY_LENGTH,
    'sha512'
  );
  return `pbkdf2:sha512:${PBKDF2_ITERATIONS}:${salt.toString('base64')}:${hash.toString('base64')}`;
}

/**
 * Verify password hash
 */
export function verifyPassword(password: string, hashedPassword: string): boolean {
  try {
    const parts = hashedPassword.split(':');
    if (parts.length !== 5 || parts[0] !== 'pbkdf2') {
      return false;
    }

    const algorithm = parts[1];
    const iterations = parseInt(parts[2], 10);
    const salt = Buffer.from(parts[3], 'base64');
    const expectedHash = Buffer.from(parts[4], 'base64');

    const computedHash = crypto.pbkdf2Sync(
      password,
      salt,
      iterations,
      expectedHash.length,
      algorithm
    );

    return crypto.timingSafeEqual(computedHash, expectedHash);
  } catch (error) {
    logger.error('Password verification failed', { error });
    return false;
  }
}

/**
 * Generate secure random token
 */
export function generateToken(length: number = 32): string {
  return crypto.randomBytes(length).toString('hex');
}

/**
 * Generate secure random bytes
 */
export function generateRandomBytes(length: number = 32): Buffer {
  return crypto.randomBytes(length);
}

/**
 * Generate UUID v4
 */
export function generateUuid(): string {
  return crypto.randomUUID();
}

/**
 * Derive key from password
 */
export function deriveKey(password: string, salt?: Buffer): Buffer {
  const useSalt = salt || crypto.randomBytes(SALT_LENGTH);
  return crypto.pbkdf2Sync(password, useSalt, PBKDF2_ITERATIONS, KEY_LENGTH, 'sha512');
}

/**
 * Encrypt object fields
 */
export function encryptObject<T extends Record<string, unknown>>(
  obj: T,
  fieldsToEncrypt: (keyof T)[]
): T {
  const result = { ...obj };
  for (const field of fieldsToEncrypt) {
    const value = obj[field];
    if (typeof value === 'string') {
      (result as any)[field] = encryptToString(value);
    }
  }
  return result;
}

/**
 * Decrypt object fields
 */
export function decryptObject<T extends Record<string, unknown>>(
  obj: T,
  fieldsToDecrypt: (keyof T)[]
): T {
  const result = { ...obj };
  for (const field of fieldsToDecrypt) {
    const value = obj[field];
    if (typeof value === 'string' && value.startsWith('v1:')) {
      try {
        (result as any)[field] = decryptFromString(value);
      } catch (error) {
        // Keep encrypted value if decryption fails
        logger.warn('Failed to decrypt field', { field });
      }
    }
  }
  return result;
}

/**
 * Mask sensitive data for logging
 */
export function maskSensitiveData(data: string, visibleChars: number = 4): string {
  if (data.length <= visibleChars * 2) {
    return '*'.repeat(data.length);
  }
  const start = data.substring(0, visibleChars);
  const end = data.substring(data.length - visibleChars);
  return `${start}${'*'.repeat(data.length - visibleChars * 2)}${end}`;
}

/**
 * Mask email address
 */
export function maskEmail(email: string): string {
  const [localPart, domain] = email.split('@');
  if (!domain) return maskSensitiveData(email);

  const maskedLocal = localPart.length <= 2
    ? '*'.repeat(localPart.length)
    : localPart[0] + '*'.repeat(localPart.length - 2) + localPart[localPart.length - 1];

  return `${maskedLocal}@${domain}`;
}

/**
 * Mask phone number
 */
export function maskPhone(phone: string): string {
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.length < 6) return '*'.repeat(cleaned.length);
  return '*'.repeat(cleaned.length - 4) + cleaned.slice(-4);
}

/**
 * Secure compare two strings (constant time)
 */
export function secureCompare(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }
  return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

/**
 * Generate encryption key (for key rotation)
 */
export function generateEncryptionKey(): string {
  return crypto.randomBytes(KEY_LENGTH).toString('base64');
}

/**
 * Validate encryption key format
 */
export function validateEncryptionKey(key: string): boolean {
  try {
    if (key.length === 44) {
      // Base64 encoded 256-bit key
      const buffer = Buffer.from(key, 'base64');
      return buffer.length === KEY_LENGTH;
    }
    if (key.length === 64) {
      // Hex encoded 256-bit key
      const buffer = Buffer.from(key, 'hex');
      return buffer.length === KEY_LENGTH;
    }
    return false;
  } catch {
    return false;
  }
}

/**
 * Re-encrypt data with new key
 */
export function reEncrypt(
  encryptedString: string,
  oldKey: string,
  newKey: string,
  additionalData?: string
): string {
  // Temporarily set old key
  const originalKey = process.env.ENCRYPTION_KEY;
  process.env.ENCRYPTION_KEY = oldKey;

  try {
    // Decrypt with old key
    const plaintext = decryptFromString(encryptedString, additionalData);

    // Set new key
    process.env.ENCRYPTION_KEY = newKey;

    // Re-encrypt with new key
    return encryptToString(plaintext, additionalData);
  } finally {
    // Restore original key
    process.env.ENCRYPTION_KEY = originalKey;
  }
}

/**
 * Encryption service class
 */
export class EncryptionService {
  private additionalData?: string;

  constructor(additionalData?: string) {
    this.additionalData = additionalData;
  }

  encrypt(plaintext: string): string {
    return encryptToString(plaintext, this.additionalData);
  }

  decrypt(ciphertext: string): string {
    return decryptFromString(ciphertext, this.additionalData);
  }

  hash(data: string): string {
    return hash(data);
  }

  hmac(data: string): string {
    return hmac(data);
  }

  verifyHmac(data: string, expectedHmac: string): boolean {
    return verifyHmac(data, expectedHmac);
  }

  generateToken(length?: number): string {
    return generateToken(length);
  }
}

export default {
  encrypt,
  decrypt,
  encryptToString,
  decryptFromString,
  hash,
  hashSha512,
  hmac,
  verifyHmac,
  hashPassword,
  verifyPassword,
  generateToken,
  generateRandomBytes,
  generateUuid,
  deriveKey,
  encryptObject,
  decryptObject,
  maskSensitiveData,
  maskEmail,
  maskPhone,
  secureCompare,
  generateEncryptionKey,
  validateEncryptionKey,
  reEncrypt,
  EncryptionService,
};
