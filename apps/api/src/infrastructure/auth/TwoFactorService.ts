/**
 * @file Two-Factor Authentication Service
 * @description Enterprise-grade 2FA implementation using TOTP (Time-based One-Time Password)
 *
 * Features:
 * - TOTP secret generation (RFC 6238 compliant)
 * - QR code generation for authenticator apps
 * - Token verification with time window tolerance
 * - Backup codes for account recovery
 * - Encrypted secret storage
 *
 * Compatible with:
 * - Google Authenticator
 * - Authy
 * - Microsoft Authenticator
 * - 1Password
 *
 * @author AgroBridge Engineering Team
 */

import { authenticator } from "otplib";
import * as crypto from "crypto";
import QRCode from "qrcode";
import { prisma } from "../database/prisma/client.js";
import logger from "../../shared/utils/logger.js";

// ═══════════════════════════════════════════════════════════════════════════════
// TYPE DEFINITIONS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Two-factor secret with QR code
 */
export interface TwoFactorSecret {
  /** Base32 encoded secret (for manual entry) */
  secret: string;
  /** otpauth:// URI for QR code */
  otpauthUrl: string;
  /** Base64 encoded QR code image */
  qrCode: string;
}

/**
 * Backup codes result
 */
export interface BackupCodesResult {
  /** Plain text backup codes (show once to user) */
  codes: string[];
  /** Number of codes generated */
  count: number;
}

/**
 * 2FA verification result
 */
export interface TwoFactorVerifyResult {
  valid: boolean;
  method: "totp" | "backup_code";
  remainingBackupCodes?: number;
}

/**
 * 2FA status for a user
 */
export interface TwoFactorStatus {
  enabled: boolean;
  enabledAt: Date | null;
  backupCodesRemaining: number;
}

// ═══════════════════════════════════════════════════════════════════════════════
// CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * TOTP Configuration
 */
const TOTP_CONFIG = {
  /** Application name shown in authenticator apps */
  issuer: "AgroBridge",
  /** Time step in seconds (standard is 30) */
  step: 30,
  /** Number of digits in OTP (standard is 6) */
  digits: 6,
  /** Time window tolerance (allows 1 step before/after) */
  window: 1,
};

/**
 * Backup codes configuration
 */
const BACKUP_CODES_CONFIG = {
  /** Number of backup codes to generate */
  count: 10,
  /** Length of each backup code (in characters) */
  length: 8,
};

/**
 * Encryption configuration for storing secrets
 */
const ENCRYPTION_CONFIG = {
  algorithm: "aes-256-gcm" as const,
  keyLength: 32,
  ivLength: 16,
  tagLength: 16,
};

// ═══════════════════════════════════════════════════════════════════════════════
// TWO-FACTOR SERVICE
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Two-Factor Authentication Service
 *
 * Provides TOTP-based 2FA with backup codes for account recovery
 */
export class TwoFactorService {
  private static instance: TwoFactorService | null = null;
  private encryptionKey: Buffer;

  private constructor() {
    // Configure otplib
    authenticator.options = {
      step: TOTP_CONFIG.step,
      digits: TOTP_CONFIG.digits,
      window: TOTP_CONFIG.window,
    };

    // Get or generate encryption key
    this.encryptionKey = this.getEncryptionKey();
  }

  /**
   * Get singleton instance
   */
  public static getInstance(): TwoFactorService {
    if (!TwoFactorService.instance) {
      TwoFactorService.instance = new TwoFactorService();
    }
    return TwoFactorService.instance;
  }

  /**
   * Get encryption key from environment or generate one
   */
  private getEncryptionKey(): Buffer {
    const envKey = process.env.TWO_FACTOR_ENCRYPTION_KEY;
    if (envKey) {
      // Key should be base64 encoded 32-byte key
      return Buffer.from(envKey, "base64");
    }

    // In development, use a deterministic key (WARNING: Not secure for production!)
    if (
      process.env.NODE_ENV === "development" ||
      process.env.NODE_ENV === "test"
    ) {
      logger.warn(
        "[TwoFactorService] Using development encryption key - NOT SECURE FOR PRODUCTION",
      );
      return crypto.scryptSync(
        "agrobridge-dev-key",
        "salt",
        ENCRYPTION_CONFIG.keyLength,
      );
    }

    throw new Error(
      "TWO_FACTOR_ENCRYPTION_KEY environment variable is required in production",
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // SECRET GENERATION
  // ═══════════════════════════════════════════════════════════════════════════════

  /**
   * Generate a new 2FA secret for a user
   *
   * @param userId - User ID
   * @param email - User email (shown in authenticator app)
   * @returns Secret with QR code
   */
  async generateSecret(
    userId: string,
    email: string,
  ): Promise<TwoFactorSecret> {
    // Verify user exists
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, twoFactorEnabled: true },
    });

    if (!user) {
      throw new Error("User not found");
    }

    if (user.twoFactorEnabled) {
      throw new Error(
        "2FA is already enabled. Disable it first to generate a new secret.",
      );
    }

    // Generate secret
    const secret = authenticator.generateSecret();

    // Generate otpauth URL
    const otpauthUrl = authenticator.keyuri(email, TOTP_CONFIG.issuer, secret);

    // Generate QR code as base64 data URL
    const qrCode = await QRCode.toDataURL(otpauthUrl, {
      errorCorrectionLevel: "M",
      type: "image/png",
      width: 256,
      margin: 2,
      color: {
        dark: "#1B5E20",
        light: "#FFFFFF",
      },
    });

    // Store encrypted secret temporarily (not enabled yet)
    const encryptedSecret = this.encrypt(secret);
    await prisma.user.update({
      where: { id: userId },
      data: { twoFactorSecret: encryptedSecret },
    });

    logger.info("[TwoFactorService] 2FA secret generated", { userId });

    return {
      secret,
      otpauthUrl,
      qrCode,
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // TOKEN VERIFICATION
  // ═══════════════════════════════════════════════════════════════════════════════

  /**
   * Verify a TOTP token
   *
   * @param userId - User ID
   * @param token - 6-digit TOTP token
   * @returns Verification result
   */
  async verifyToken(
    userId: string,
    token: string,
  ): Promise<TwoFactorVerifyResult> {
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
      throw new Error("User not found");
    }

    if (!user.twoFactorSecret) {
      throw new Error("2FA is not set up for this user");
    }

    // Normalize token (remove spaces/dashes)
    const normalizedToken = token.replace(/[\s-]/g, "");

    // Try TOTP verification first
    if (
      normalizedToken.length === TOTP_CONFIG.digits &&
      /^\d+$/.test(normalizedToken)
    ) {
      const secret = this.decrypt(user.twoFactorSecret);
      const isValid = authenticator.verify({ token: normalizedToken, secret });

      if (isValid) {
        logger.info("[TwoFactorService] TOTP verified successfully", {
          userId,
        });
        return {
          valid: true,
          method: "totp",
          remainingBackupCodes: user.backupCodes.length,
        };
      }
    }

    // Try backup code verification
    const backupResult = await this.verifyBackupCode(userId, normalizedToken);
    if (backupResult.valid) {
      return backupResult;
    }

    logger.warn("[TwoFactorService] 2FA verification failed", { userId });
    return { valid: false, method: "totp" };
  }

  /**
   * Verify a backup code
   *
   * @param userId - User ID
   * @param code - Backup code
   * @returns Verification result
   */
  async verifyBackupCode(
    userId: string,
    code: string,
  ): Promise<TwoFactorVerifyResult> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, backupCodes: true },
    });

    if (!user) {
      throw new Error("User not found");
    }

    // Normalize code (uppercase, no spaces/dashes)
    const normalizedCode = code.toUpperCase().replace(/[\s-]/g, "");

    // Check against hashed backup codes
    const codeHash = this.hashBackupCode(normalizedCode);
    const codeIndex = user.backupCodes.findIndex(
      (hashedCode) => hashedCode === codeHash,
    );

    if (codeIndex === -1) {
      return { valid: false, method: "backup_code" };
    }

    // Remove used backup code
    const updatedCodes = [...user.backupCodes];
    updatedCodes.splice(codeIndex, 1);

    await prisma.user.update({
      where: { id: userId },
      data: { backupCodes: updatedCodes },
    });

    logger.info("[TwoFactorService] Backup code verified and consumed", {
      userId,
      remainingCodes: updatedCodes.length,
    });

    return {
      valid: true,
      method: "backup_code",
      remainingBackupCodes: updatedCodes.length,
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // BACKUP CODES
  // ═══════════════════════════════════════════════════════════════════════════════

  /**
   * Generate new backup codes for a user
   *
   * @param userId - User ID
   * @returns Backup codes (show to user once)
   */
  async generateBackupCodes(userId: string): Promise<BackupCodesResult> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, twoFactorEnabled: true },
    });

    if (!user) {
      throw new Error("User not found");
    }

    if (!user.twoFactorEnabled) {
      throw new Error("2FA must be enabled before generating backup codes");
    }

    // Generate backup codes
    const codes: string[] = [];
    const hashedCodes: string[] = [];

    for (let i = 0; i < BACKUP_CODES_CONFIG.count; i++) {
      const code = this.generateBackupCode();
      codes.push(code);
      hashedCodes.push(this.hashBackupCode(code));
    }

    // Store hashed codes
    await prisma.user.update({
      where: { id: userId },
      data: { backupCodes: hashedCodes },
    });

    logger.info("[TwoFactorService] Backup codes generated", {
      userId,
      count: codes.length,
    });

    return {
      codes: codes.map(this.formatBackupCode),
      count: codes.length,
    };
  }

  /**
   * Generate a single backup code
   */
  private generateBackupCode(): string {
    const characters = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // Exclude confusing chars
    let code = "";
    const randomBytes = crypto.randomBytes(BACKUP_CODES_CONFIG.length);

    for (let i = 0; i < BACKUP_CODES_CONFIG.length; i++) {
      code += characters[randomBytes[i] % characters.length];
    }

    return code;
  }

  /**
   * Format backup code for display (XXXX-XXXX)
   */
  private formatBackupCode(code: string): string {
    return `${code.slice(0, 4)}-${code.slice(4)}`;
  }

  /**
   * Hash a backup code for storage
   */
  private hashBackupCode(code: string): string {
    return crypto.createHash("sha256").update(code).digest("hex");
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // ENABLE / DISABLE 2FA
  // ═══════════════════════════════════════════════════════════════════════════════

  /**
   * Enable 2FA for a user (after verifying setup token)
   *
   * @param userId - User ID
   * @param token - TOTP token to verify setup
   * @returns Backup codes
   */
  async enable2FA(userId: string, token: string): Promise<BackupCodesResult> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        twoFactorEnabled: true,
        twoFactorSecret: true,
      },
    });

    if (!user) {
      throw new Error("User not found");
    }

    if (user.twoFactorEnabled) {
      throw new Error("2FA is already enabled");
    }

    if (!user.twoFactorSecret) {
      throw new Error("No 2FA secret found. Call generateSecret first.");
    }

    // Verify the token using the stored (but not yet enabled) secret
    const secret = this.decrypt(user.twoFactorSecret);
    const isValid = authenticator.verify({
      token: token.replace(/[\s-]/g, ""),
      secret,
    });

    if (!isValid) {
      throw new Error("Invalid verification token");
    }

    // Generate backup codes
    const codes: string[] = [];
    const hashedCodes: string[] = [];

    for (let i = 0; i < BACKUP_CODES_CONFIG.count; i++) {
      const code = this.generateBackupCode();
      codes.push(code);
      hashedCodes.push(this.hashBackupCode(code));
    }

    // Enable 2FA and store backup codes
    await prisma.user.update({
      where: { id: userId },
      data: {
        twoFactorEnabled: true,
        twoFactorEnabledAt: new Date(),
        backupCodes: hashedCodes,
      },
    });

    logger.info("[TwoFactorService] 2FA enabled successfully", { userId });

    return {
      codes: codes.map(this.formatBackupCode),
      count: codes.length,
    };
  }

  /**
   * Disable 2FA for a user
   *
   * @param userId - User ID
   * @param token - TOTP token or backup code to verify
   */
  async disable2FA(userId: string, token: string): Promise<void> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        twoFactorEnabled: true,
        twoFactorSecret: true,
      },
    });

    if (!user) {
      throw new Error("User not found");
    }

    if (!user.twoFactorEnabled) {
      throw new Error("2FA is not enabled");
    }

    // Verify the token before disabling
    const verifyResult = await this.verifyToken(userId, token);
    if (!verifyResult.valid) {
      throw new Error("Invalid verification token");
    }

    // Disable 2FA and clear related data
    await prisma.user.update({
      where: { id: userId },
      data: {
        twoFactorEnabled: false,
        twoFactorSecret: null,
        twoFactorEnabledAt: null,
        backupCodes: [],
      },
    });

    logger.info("[TwoFactorService] 2FA disabled successfully", { userId });
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // STATUS & UTILITIES
  // ═══════════════════════════════════════════════════════════════════════════════

  /**
   * Get 2FA status for a user
   *
   * @param userId - User ID
   * @returns 2FA status
   */
  async getStatus(userId: string): Promise<TwoFactorStatus> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        twoFactorEnabled: true,
        twoFactorEnabledAt: true,
        backupCodes: true,
      },
    });

    if (!user) {
      throw new Error("User not found");
    }

    return {
      enabled: user.twoFactorEnabled,
      enabledAt: user.twoFactorEnabledAt,
      backupCodesRemaining: user.backupCodes.length,
    };
  }

  /**
   * Check if 2FA is enabled for a user
   *
   * @param userId - User ID
   * @returns Whether 2FA is enabled
   */
  async isEnabled(userId: string): Promise<boolean> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { twoFactorEnabled: true },
    });

    return user?.twoFactorEnabled ?? false;
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // ENCRYPTION HELPERS
  // ═══════════════════════════════════════════════════════════════════════════════

  /**
   * Encrypt a secret for storage
   */
  private encrypt(text: string): string {
    const iv = crypto.randomBytes(ENCRYPTION_CONFIG.ivLength);
    const cipher = crypto.createCipheriv(
      ENCRYPTION_CONFIG.algorithm,
      this.encryptionKey,
      iv,
    );

    let encrypted = cipher.update(text, "utf8", "hex");
    encrypted += cipher.final("hex");

    const authTag = cipher.getAuthTag();

    // Format: iv:authTag:encrypted
    return `${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted}`;
  }

  /**
   * Decrypt a stored secret
   */
  private decrypt(encrypted: string): string {
    const parts = encrypted.split(":");
    if (parts.length !== 3) {
      throw new Error("Invalid encrypted data format");
    }

    const [ivHex, authTagHex, encryptedText] = parts;
    const iv = Buffer.from(ivHex, "hex");
    const authTag = Buffer.from(authTagHex, "hex");

    const decipher = crypto.createDecipheriv(
      ENCRYPTION_CONFIG.algorithm,
      this.encryptionKey,
      iv,
    );
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encryptedText, "hex", "utf8");
    decrypted += decipher.final("utf8");

    return decrypted;
  }
}

// Export singleton instance
export const twoFactorService = TwoFactorService.getInstance();

export default twoFactorService;
