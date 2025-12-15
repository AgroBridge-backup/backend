import crypto from 'crypto';
import { logger } from '../logging/logger.js';
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;
const SALT_LENGTH = 32;
const KEY_LENGTH = 32;
const PBKDF2_ITERATIONS = 100000;
function getEncryptionKey() {
    const key = process.env.ENCRYPTION_KEY;
    if (!key) {
        throw new Error('ENCRYPTION_KEY environment variable is required');
    }
    if (key.length === 44) {
        return Buffer.from(key, 'base64');
    }
    if (key.length === 64) {
        return Buffer.from(key, 'hex');
    }
    const salt = getEncryptionSalt();
    return crypto.pbkdf2Sync(key, salt, PBKDF2_ITERATIONS, KEY_LENGTH, 'sha512');
}
function getEncryptionSalt() {
    const salt = process.env.ENCRYPTION_SALT;
    if (salt) {
        if (salt.length === 44) {
            return Buffer.from(salt, 'base64');
        }
        if (salt.length === 64) {
            return Buffer.from(salt, 'hex');
        }
        if (salt.length >= 16) {
            return Buffer.from(salt, 'utf8');
        }
    }
    if (process.env.NODE_ENV === 'production') {
        throw new Error('ENCRYPTION_SALT environment variable is required in production. ' +
            'Generate with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'base64\'))"');
    }
    logger.warn('ENCRYPTION_SALT not configured - using development fallback. ' +
        'This is NOT secure for production!');
    return crypto.createHash('sha256').update('agrobridge-dev-salt-v1').digest();
}
export function encrypt(plaintext, additionalData) {
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
    }
    catch (error) {
        logger.error('Encryption failed', { error });
        throw new Error('Encryption failed');
    }
}
export function decrypt(encrypted, additionalData) {
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
    }
    catch (error) {
        logger.error('Decryption failed', { error });
        throw new Error('Decryption failed - data may be corrupted or key mismatch');
    }
}
export function encryptToString(plaintext, additionalData) {
    const encrypted = encrypt(plaintext, additionalData);
    return `v${encrypted.version}:${encrypted.iv}:${encrypted.authTag}:${encrypted.ciphertext}`;
}
export function decryptFromString(encryptedString, additionalData) {
    const parts = encryptedString.split(':');
    if (parts.length !== 4) {
        throw new Error('Invalid encrypted data format');
    }
    const version = parseInt(parts[0].substring(1), 10);
    const encrypted = {
        iv: parts[1],
        authTag: parts[2],
        ciphertext: parts[3],
        version,
    };
    return decrypt(encrypted, additionalData);
}
export function hash(data) {
    return crypto.createHash('sha256').update(data).digest('hex');
}
export function hashSha512(data) {
    return crypto.createHash('sha512').update(data).digest('hex');
}
export function hmac(data, secret) {
    const key = secret || getEncryptionKey().toString('hex');
    return crypto.createHmac('sha256', key).update(data).digest('hex');
}
export function verifyHmac(data, expectedHmac, secret) {
    const calculatedHmac = hmac(data, secret);
    return crypto.timingSafeEqual(Buffer.from(calculatedHmac, 'hex'), Buffer.from(expectedHmac, 'hex'));
}
export function hashPassword(password) {
    const salt = crypto.randomBytes(SALT_LENGTH);
    const hash = crypto.pbkdf2Sync(password, salt, PBKDF2_ITERATIONS, KEY_LENGTH, 'sha512');
    return `pbkdf2:sha512:${PBKDF2_ITERATIONS}:${salt.toString('base64')}:${hash.toString('base64')}`;
}
export function verifyPassword(password, hashedPassword) {
    try {
        const parts = hashedPassword.split(':');
        if (parts.length !== 5 || parts[0] !== 'pbkdf2') {
            return false;
        }
        const algorithm = parts[1];
        const iterations = parseInt(parts[2], 10);
        const salt = Buffer.from(parts[3], 'base64');
        const expectedHash = Buffer.from(parts[4], 'base64');
        const computedHash = crypto.pbkdf2Sync(password, salt, iterations, expectedHash.length, algorithm);
        return crypto.timingSafeEqual(computedHash, expectedHash);
    }
    catch (error) {
        logger.error('Password verification failed', { error });
        return false;
    }
}
export function generateToken(length = 32) {
    return crypto.randomBytes(length).toString('hex');
}
export function generateRandomBytes(length = 32) {
    return crypto.randomBytes(length);
}
export function generateUuid() {
    return crypto.randomUUID();
}
export function deriveKey(password, salt) {
    const useSalt = salt || crypto.randomBytes(SALT_LENGTH);
    return crypto.pbkdf2Sync(password, useSalt, PBKDF2_ITERATIONS, KEY_LENGTH, 'sha512');
}
export function encryptObject(obj, fieldsToEncrypt) {
    const result = { ...obj };
    for (const field of fieldsToEncrypt) {
        const value = obj[field];
        if (typeof value === 'string') {
            result[field] = encryptToString(value);
        }
    }
    return result;
}
export function decryptObject(obj, fieldsToDecrypt) {
    const result = { ...obj };
    for (const field of fieldsToDecrypt) {
        const value = obj[field];
        if (typeof value === 'string' && value.startsWith('v1:')) {
            try {
                result[field] = decryptFromString(value);
            }
            catch (error) {
                logger.warn('Failed to decrypt field', { field });
            }
        }
    }
    return result;
}
export function maskSensitiveData(data, visibleChars = 4) {
    if (data.length <= visibleChars * 2) {
        return '*'.repeat(data.length);
    }
    const start = data.substring(0, visibleChars);
    const end = data.substring(data.length - visibleChars);
    return `${start}${'*'.repeat(data.length - visibleChars * 2)}${end}`;
}
export function maskEmail(email) {
    const [localPart, domain] = email.split('@');
    if (!domain)
        return maskSensitiveData(email);
    const maskedLocal = localPart.length <= 2
        ? '*'.repeat(localPart.length)
        : localPart[0] + '*'.repeat(localPart.length - 2) + localPart[localPart.length - 1];
    return `${maskedLocal}@${domain}`;
}
export function maskPhone(phone) {
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.length < 6)
        return '*'.repeat(cleaned.length);
    return '*'.repeat(cleaned.length - 4) + cleaned.slice(-4);
}
export function secureCompare(a, b) {
    if (a.length !== b.length) {
        return false;
    }
    return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
}
export function generateEncryptionKey() {
    return crypto.randomBytes(KEY_LENGTH).toString('base64');
}
export function validateEncryptionKey(key) {
    try {
        if (key.length === 44) {
            const buffer = Buffer.from(key, 'base64');
            return buffer.length === KEY_LENGTH;
        }
        if (key.length === 64) {
            const buffer = Buffer.from(key, 'hex');
            return buffer.length === KEY_LENGTH;
        }
        return false;
    }
    catch {
        return false;
    }
}
export function reEncrypt(encryptedString, oldKey, newKey, additionalData) {
    const originalKey = process.env.ENCRYPTION_KEY;
    process.env.ENCRYPTION_KEY = oldKey;
    try {
        const plaintext = decryptFromString(encryptedString, additionalData);
        process.env.ENCRYPTION_KEY = newKey;
        return encryptToString(plaintext, additionalData);
    }
    finally {
        process.env.ENCRYPTION_KEY = originalKey;
    }
}
export class EncryptionService {
    additionalData;
    constructor(additionalData) {
        this.additionalData = additionalData;
    }
    encrypt(plaintext) {
        return encryptToString(plaintext, this.additionalData);
    }
    decrypt(ciphertext) {
        return decryptFromString(ciphertext, this.additionalData);
    }
    hash(data) {
        return hash(data);
    }
    hmac(data) {
        return hmac(data);
    }
    verifyHmac(data, expectedHmac) {
        return verifyHmac(data, expectedHmac);
    }
    generateToken(length) {
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
