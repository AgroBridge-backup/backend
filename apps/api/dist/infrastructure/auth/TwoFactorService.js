import { authenticator } from 'otplib';
import * as crypto from 'crypto';
import QRCode from 'qrcode';
import { prisma } from '../database/prisma/client.js';
import logger from '../../shared/utils/logger.js';
const TOTP_CONFIG = {
    issuer: 'AgroBridge',
    step: 30,
    digits: 6,
    window: 1,
};
const BACKUP_CODES_CONFIG = {
    count: 10,
    length: 8,
};
const ENCRYPTION_CONFIG = {
    algorithm: 'aes-256-gcm',
    keyLength: 32,
    ivLength: 16,
    tagLength: 16,
};
export class TwoFactorService {
    static instance = null;
    encryptionKey;
    constructor() {
        authenticator.options = {
            step: TOTP_CONFIG.step,
            digits: TOTP_CONFIG.digits,
            window: TOTP_CONFIG.window,
        };
        this.encryptionKey = this.getEncryptionKey();
    }
    static getInstance() {
        if (!TwoFactorService.instance) {
            TwoFactorService.instance = new TwoFactorService();
        }
        return TwoFactorService.instance;
    }
    getEncryptionKey() {
        const envKey = process.env.TWO_FACTOR_ENCRYPTION_KEY;
        if (envKey) {
            return Buffer.from(envKey, 'base64');
        }
        if (process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test') {
            logger.warn('[TwoFactorService] Using development encryption key - NOT SECURE FOR PRODUCTION');
            return crypto.scryptSync('agrobridge-dev-key', 'salt', ENCRYPTION_CONFIG.keyLength);
        }
        throw new Error('TWO_FACTOR_ENCRYPTION_KEY environment variable is required in production');
    }
    async generateSecret(userId, email) {
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { id: true, twoFactorEnabled: true },
        });
        if (!user) {
            throw new Error('User not found');
        }
        if (user.twoFactorEnabled) {
            throw new Error('2FA is already enabled. Disable it first to generate a new secret.');
        }
        const secret = authenticator.generateSecret();
        const otpauthUrl = authenticator.keyuri(email, TOTP_CONFIG.issuer, secret);
        const qrCode = await QRCode.toDataURL(otpauthUrl, {
            errorCorrectionLevel: 'M',
            type: 'image/png',
            width: 256,
            margin: 2,
            color: {
                dark: '#1B5E20',
                light: '#FFFFFF',
            },
        });
        const encryptedSecret = this.encrypt(secret);
        await prisma.user.update({
            where: { id: userId },
            data: { twoFactorSecret: encryptedSecret },
        });
        logger.info('[TwoFactorService] 2FA secret generated', { userId });
        return {
            secret,
            otpauthUrl,
            qrCode,
        };
    }
    async verifyToken(userId, token) {
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: {
                id: true,
                twoFactorEnabled: true,
                twoFactorSecret: true,
                backupCodes: true,
            },
        });
        if (!user) {
            throw new Error('User not found');
        }
        if (!user.twoFactorSecret) {
            throw new Error('2FA is not set up for this user');
        }
        const normalizedToken = token.replace(/[\s-]/g, '');
        if (normalizedToken.length === TOTP_CONFIG.digits && /^\d+$/.test(normalizedToken)) {
            const secret = this.decrypt(user.twoFactorSecret);
            const isValid = authenticator.verify({ token: normalizedToken, secret });
            if (isValid) {
                logger.info('[TwoFactorService] TOTP verified successfully', { userId });
                return {
                    valid: true,
                    method: 'totp',
                    remainingBackupCodes: user.backupCodes.length,
                };
            }
        }
        const backupResult = await this.verifyBackupCode(userId, normalizedToken);
        if (backupResult.valid) {
            return backupResult;
        }
        logger.warn('[TwoFactorService] 2FA verification failed', { userId });
        return { valid: false, method: 'totp' };
    }
    async verifyBackupCode(userId, code) {
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { id: true, backupCodes: true },
        });
        if (!user) {
            throw new Error('User not found');
        }
        const normalizedCode = code.toUpperCase().replace(/[\s-]/g, '');
        const codeHash = this.hashBackupCode(normalizedCode);
        const codeIndex = user.backupCodes.findIndex((hashedCode) => hashedCode === codeHash);
        if (codeIndex === -1) {
            return { valid: false, method: 'backup_code' };
        }
        const updatedCodes = [...user.backupCodes];
        updatedCodes.splice(codeIndex, 1);
        await prisma.user.update({
            where: { id: userId },
            data: { backupCodes: updatedCodes },
        });
        logger.info('[TwoFactorService] Backup code verified and consumed', {
            userId,
            remainingCodes: updatedCodes.length,
        });
        return {
            valid: true,
            method: 'backup_code',
            remainingBackupCodes: updatedCodes.length,
        };
    }
    async generateBackupCodes(userId) {
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { id: true, twoFactorEnabled: true },
        });
        if (!user) {
            throw new Error('User not found');
        }
        if (!user.twoFactorEnabled) {
            throw new Error('2FA must be enabled before generating backup codes');
        }
        const codes = [];
        const hashedCodes = [];
        for (let i = 0; i < BACKUP_CODES_CONFIG.count; i++) {
            const code = this.generateBackupCode();
            codes.push(code);
            hashedCodes.push(this.hashBackupCode(code));
        }
        await prisma.user.update({
            where: { id: userId },
            data: { backupCodes: hashedCodes },
        });
        logger.info('[TwoFactorService] Backup codes generated', {
            userId,
            count: codes.length,
        });
        return {
            codes: codes.map(this.formatBackupCode),
            count: codes.length,
        };
    }
    generateBackupCode() {
        const characters = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
        let code = '';
        const randomBytes = crypto.randomBytes(BACKUP_CODES_CONFIG.length);
        for (let i = 0; i < BACKUP_CODES_CONFIG.length; i++) {
            code += characters[randomBytes[i] % characters.length];
        }
        return code;
    }
    formatBackupCode(code) {
        return `${code.slice(0, 4)}-${code.slice(4)}`;
    }
    hashBackupCode(code) {
        return crypto.createHash('sha256').update(code).digest('hex');
    }
    async enable2FA(userId, token) {
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: {
                id: true,
                twoFactorEnabled: true,
                twoFactorSecret: true,
            },
        });
        if (!user) {
            throw new Error('User not found');
        }
        if (user.twoFactorEnabled) {
            throw new Error('2FA is already enabled');
        }
        if (!user.twoFactorSecret) {
            throw new Error('No 2FA secret found. Call generateSecret first.');
        }
        const secret = this.decrypt(user.twoFactorSecret);
        const isValid = authenticator.verify({ token: token.replace(/[\s-]/g, ''), secret });
        if (!isValid) {
            throw new Error('Invalid verification token');
        }
        const codes = [];
        const hashedCodes = [];
        for (let i = 0; i < BACKUP_CODES_CONFIG.count; i++) {
            const code = this.generateBackupCode();
            codes.push(code);
            hashedCodes.push(this.hashBackupCode(code));
        }
        await prisma.user.update({
            where: { id: userId },
            data: {
                twoFactorEnabled: true,
                twoFactorEnabledAt: new Date(),
                backupCodes: hashedCodes,
            },
        });
        logger.info('[TwoFactorService] 2FA enabled successfully', { userId });
        return {
            codes: codes.map(this.formatBackupCode),
            count: codes.length,
        };
    }
    async disable2FA(userId, token) {
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: {
                id: true,
                twoFactorEnabled: true,
                twoFactorSecret: true,
            },
        });
        if (!user) {
            throw new Error('User not found');
        }
        if (!user.twoFactorEnabled) {
            throw new Error('2FA is not enabled');
        }
        const verifyResult = await this.verifyToken(userId, token);
        if (!verifyResult.valid) {
            throw new Error('Invalid verification token');
        }
        await prisma.user.update({
            where: { id: userId },
            data: {
                twoFactorEnabled: false,
                twoFactorSecret: null,
                twoFactorEnabledAt: null,
                backupCodes: [],
            },
        });
        logger.info('[TwoFactorService] 2FA disabled successfully', { userId });
    }
    async getStatus(userId) {
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: {
                twoFactorEnabled: true,
                twoFactorEnabledAt: true,
                backupCodes: true,
            },
        });
        if (!user) {
            throw new Error('User not found');
        }
        return {
            enabled: user.twoFactorEnabled,
            enabledAt: user.twoFactorEnabledAt,
            backupCodesRemaining: user.backupCodes.length,
        };
    }
    async isEnabled(userId) {
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { twoFactorEnabled: true },
        });
        return user?.twoFactorEnabled ?? false;
    }
    encrypt(text) {
        const iv = crypto.randomBytes(ENCRYPTION_CONFIG.ivLength);
        const cipher = crypto.createCipheriv(ENCRYPTION_CONFIG.algorithm, this.encryptionKey, iv);
        let encrypted = cipher.update(text, 'utf8', 'hex');
        encrypted += cipher.final('hex');
        const authTag = cipher.getAuthTag();
        return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
    }
    decrypt(encrypted) {
        const parts = encrypted.split(':');
        if (parts.length !== 3) {
            throw new Error('Invalid encrypted data format');
        }
        const [ivHex, authTagHex, encryptedText] = parts;
        const iv = Buffer.from(ivHex, 'hex');
        const authTag = Buffer.from(authTagHex, 'hex');
        const decipher = crypto.createDecipheriv(ENCRYPTION_CONFIG.algorithm, this.encryptionKey, iv);
        decipher.setAuthTag(authTag);
        let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
        decrypted += decipher.final('utf8');
        return decrypted;
    }
}
export const twoFactorService = TwoFactorService.getInstance();
export default twoFactorService;
