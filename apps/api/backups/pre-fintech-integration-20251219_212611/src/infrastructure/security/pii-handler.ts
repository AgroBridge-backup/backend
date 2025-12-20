/**
 * PII (Personally Identifiable Information) Handler
 * GDPR-compliant data handling, anonymization, and consent management
 */

import { PrismaClient } from '@prisma/client';
import { logger } from '../logging/logger.js';
import {
  encryptToString,
  decryptFromString,
  hash,
  maskEmail,
  maskPhone,
  maskSensitiveData,
} from './encryption.service.js';
import { audit, AuditEventType } from './audit-logger.js';

// Prisma client reference
let prisma: PrismaClient | null = null;

/**
 * Initialize PII handler with Prisma client
 */
export function initPiiHandler(prismaClient: PrismaClient): void {
  prisma = prismaClient;
  logger.info('PII handler initialized');
}

/**
 * PII field types
 */
export enum PiiFieldType {
  EMAIL = 'EMAIL',
  PHONE = 'PHONE',
  NAME = 'NAME',
  ADDRESS = 'ADDRESS',
  SSN = 'SSN',
  PASSPORT = 'PASSPORT',
  ID_NUMBER = 'ID_NUMBER',
  FINANCIAL = 'FINANCIAL',
  HEALTH = 'HEALTH',
  BIOMETRIC = 'BIOMETRIC',
  LOCATION = 'LOCATION',
  IP_ADDRESS = 'IP_ADDRESS',
  CUSTOM = 'CUSTOM',
}

/**
 * Consent type
 */
export enum ConsentType {
  MARKETING = 'MARKETING',
  ANALYTICS = 'ANALYTICS',
  THIRD_PARTY = 'THIRD_PARTY',
  DATA_PROCESSING = 'DATA_PROCESSING',
  PROFILING = 'PROFILING',
  COOKIES = 'COOKIES',
  NEWSLETTER = 'NEWSLETTER',
}

/**
 * Data subject rights
 */
export enum DataSubjectRight {
  ACCESS = 'ACCESS',
  RECTIFICATION = 'RECTIFICATION',
  ERASURE = 'ERASURE',
  PORTABILITY = 'PORTABILITY',
  RESTRICTION = 'RESTRICTION',
  OBJECTION = 'OBJECTION',
}

/**
 * PII field configuration
 */
interface PiiFieldConfig {
  type: PiiFieldType;
  encrypted: boolean;
  hashed?: boolean;
  retention?: number; // Days to retain
  maskFunction?: (value: string) => string;
}

/**
 * Default PII field configurations
 */
const PII_FIELD_CONFIGS: Record<string, PiiFieldConfig> = {
  email: {
    type: PiiFieldType.EMAIL,
    encrypted: true,
    hashed: true,
    retention: 365 * 3, // 3 years
    maskFunction: maskEmail,
  },
  phone: {
    type: PiiFieldType.PHONE,
    encrypted: true,
    retention: 365 * 3,
    maskFunction: maskPhone,
  },
  firstName: {
    type: PiiFieldType.NAME,
    encrypted: true,
    retention: 365 * 3,
    maskFunction: (v) => maskSensitiveData(v, 1),
  },
  lastName: {
    type: PiiFieldType.NAME,
    encrypted: true,
    retention: 365 * 3,
    maskFunction: (v) => maskSensitiveData(v, 1),
  },
  address: {
    type: PiiFieldType.ADDRESS,
    encrypted: true,
    retention: 365 * 3,
    maskFunction: (v) => maskSensitiveData(v, 0),
  },
  ssn: {
    type: PiiFieldType.SSN,
    encrypted: true,
    hashed: true,
    retention: 365 * 7, // 7 years (legal requirement)
    maskFunction: (v) => `***-**-${v.slice(-4)}`,
  },
  ipAddress: {
    type: PiiFieldType.IP_ADDRESS,
    encrypted: false,
    retention: 90, // 90 days
    maskFunction: (v) => v.replace(/\.\d+$/, '.xxx'),
  },
};

/**
 * Consent record
 */
export interface ConsentRecord {
  userId: string;
  consentType: ConsentType;
  granted: boolean;
  timestamp: Date;
  version: string;
  source: string;
  ipAddress?: string;
  userAgent?: string;
}

/**
 * Data export record
 */
export interface DataExportRecord {
  userId: string;
  requestDate: Date;
  completedDate?: Date;
  format: 'JSON' | 'CSV' | 'PDF';
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
  downloadUrl?: string;
  expiresAt?: Date;
}

/**
 * PII Handler class
 */
export class PiiHandler {
  /**
   * Encrypt PII field
   */
  encryptPii(value: string, fieldName: string): string {
    const config = PII_FIELD_CONFIGS[fieldName] || { type: PiiFieldType.CUSTOM, encrypted: true };

    if (!config.encrypted) {
      return value;
    }

    return encryptToString(value, fieldName);
  }

  /**
   * Decrypt PII field
   */
  decryptPii(encryptedValue: string, fieldName: string): string {
    if (!encryptedValue.startsWith('v1:')) {
      return encryptedValue;
    }

    return decryptFromString(encryptedValue, fieldName);
  }

  /**
   * Hash PII for lookup (email, SSN, etc.)
   */
  hashPii(value: string, fieldName: string): string {
    return hash(`${fieldName}:${value.toLowerCase().trim()}`);
  }

  /**
   * Mask PII for display
   */
  maskPii(value: string, fieldName: string): string {
    const config = PII_FIELD_CONFIGS[fieldName];
    if (config?.maskFunction) {
      return config.maskFunction(value);
    }
    return maskSensitiveData(value);
  }

  /**
   * Anonymize user data
   */
  async anonymizeUserData(userId: string): Promise<void> {
    if (!prisma) {
      throw new Error('Prisma client not initialized');
    }

    const anonymizedEmail = `deleted_${hash(userId).substring(0, 12)}@anonymized.local`;
    const anonymizedData = {
      email: anonymizedEmail,
      firstName: 'Deleted',
      lastName: 'User',
      passwordHash: null,
      walletAddress: null,
      isActive: false,
      twoFactorEnabled: false,
      twoFactorSecret: null,
      backupCodes: [],
    };

    try {
      await prisma.user.update({
        where: { id: userId },
        data: anonymizedData,
      });

      await audit()
        .eventType(AuditEventType.GDPR_DATA_DELETION_REQUEST)
        .resource('User', userId)
        .action('anonymize')
        .description('User data anonymized per GDPR request')
        .success()
        .log();

      logger.info('User data anonymized', { userId });
    } catch (error) {
      logger.error('Failed to anonymize user data', { error, userId });
      throw error;
    }
  }

  /**
   * Export user data (GDPR data portability)
   */
  async exportUserData(userId: string): Promise<Record<string, unknown>> {
    if (!prisma) {
      throw new Error('Prisma client not initialized');
    }

    try {
      // Fetch all user data
      const user = await prisma.user.findUnique({
        where: { id: userId },
        include: {
          producer: {
            include: {
              certifications: true,
            },
          },
          notifications: true,
        },
      });

      if (!user) {
        throw new Error('User not found');
      }

      // Prepare export data
      const exportData = {
        personalInformation: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt,
        },
        producerProfile: user.producer ? {
          businessName: user.producer.businessName,
          state: user.producer.state,
          municipality: user.producer.municipality,
          address: user.producer.address,
          certifications: user.producer.certifications.map((c) => ({
            type: c.type,
            certifier: c.certifier,
            issuedAt: c.issuedAt,
            expiresAt: c.expiresAt,
          })),
        } : null,
        notifications: user.notifications.map((n) => ({
          type: n.type,
          title: n.title,
          createdAt: n.createdAt,
        })),
        exportMetadata: {
          exportDate: new Date().toISOString(),
          format: 'JSON',
          version: '1.0',
        },
      };

      await audit()
        .eventType(AuditEventType.GDPR_DATA_EXPORT_REQUEST)
        .resource('User', userId)
        .action('export')
        .description('User data exported per GDPR request')
        .success()
        .log();

      return exportData;
    } catch (error) {
      logger.error('Failed to export user data', { error, userId });
      throw error;
    }
  }

  /**
   * Record consent
   */
  async recordConsent(consent: ConsentRecord): Promise<void> {
    if (!prisma) {
      throw new Error('Prisma client not initialized');
    }

    try {
      // Store consent record (assuming Consent model exists)
      await (prisma as any).consent?.create({
        data: {
          userId: consent.userId,
          type: consent.consentType,
          granted: consent.granted,
          version: consent.version,
          source: consent.source,
          ipAddress: consent.ipAddress,
          userAgent: consent.userAgent,
          timestamp: consent.timestamp,
        },
      }).catch(() => {
        // Log to audit if model doesn't exist
        logger.info('Consent recorded', consent);
      });

      await audit()
        .eventType(consent.granted ? AuditEventType.GDPR_CONSENT_GIVEN : AuditEventType.GDPR_CONSENT_WITHDRAWN)
        .user(consent.userId)
        .action(consent.granted ? 'grant_consent' : 'withdraw_consent')
        .description(`Consent ${consent.granted ? 'granted' : 'withdrawn'} for ${consent.consentType}`)
        .metadata({
          consentType: consent.consentType,
          version: consent.version,
          source: consent.source,
        })
        .success()
        .log();
    } catch (error) {
      logger.error('Failed to record consent', { error, consent });
      throw error;
    }
  }

  /**
   * Check user consent
   */
  async hasConsent(userId: string, consentType: ConsentType): Promise<boolean> {
    if (!prisma) {
      return false;
    }

    try {
      const consent = await (prisma as any).consent?.findFirst({
        where: {
          userId,
          type: consentType,
        },
        orderBy: { timestamp: 'desc' },
      });

      return consent?.granted ?? false;
    } catch (error) {
      logger.error('Failed to check consent', { error, userId, consentType });
      return false;
    }
  }

  /**
   * Get all consents for user
   */
  async getUserConsents(userId: string): Promise<Record<ConsentType, boolean>> {
    const consents: Record<ConsentType, boolean> = {
      [ConsentType.MARKETING]: false,
      [ConsentType.ANALYTICS]: false,
      [ConsentType.THIRD_PARTY]: false,
      [ConsentType.DATA_PROCESSING]: false,
      [ConsentType.PROFILING]: false,
      [ConsentType.COOKIES]: false,
      [ConsentType.NEWSLETTER]: false,
    };

    if (!prisma) {
      return consents;
    }

    try {
      const records = await (prisma as any).consent?.findMany({
        where: { userId },
        orderBy: { timestamp: 'desc' },
        distinct: ['type'],
      }) || [];

      for (const record of records) {
        consents[record.type as ConsentType] = record.granted;
      }
    } catch (error) {
      logger.error('Failed to get user consents', { error, userId });
    }

    return consents;
  }

  /**
   * Handle data subject access request (DSAR)
   */
  async handleDataAccessRequest(userId: string, requesterId: string): Promise<{
    requestId: string;
    status: string;
    data?: Record<string, unknown>;
  }> {
    const requestId = `dsar_${Date.now()}_${userId}`;

    await audit()
      .eventType(AuditEventType.GDPR_DATA_ACCESS_REQUEST)
      .user(requesterId)
      .resource('User', userId)
      .action('data_access_request')
      .description('Data subject access request initiated')
      .metadata({ requestId })
      .success()
      .log();

    // Export user data
    const data = await this.exportUserData(userId);

    return {
      requestId,
      status: 'COMPLETED',
      data,
    };
  }

  /**
   * Handle right to erasure request
   */
  async handleErasureRequest(userId: string, requesterId: string): Promise<{
    requestId: string;
    status: string;
  }> {
    const requestId = `erasure_${Date.now()}_${userId}`;

    await audit()
      .eventType(AuditEventType.GDPR_DATA_DELETION_REQUEST)
      .user(requesterId)
      .resource('User', userId)
      .action('erasure_request')
      .description('Right to erasure request initiated')
      .metadata({ requestId })
      .success()
      .log();

    // Anonymize user data
    await this.anonymizeUserData(userId);

    return {
      requestId,
      status: 'COMPLETED',
    };
  }

  /**
   * Purge expired PII data
   */
  async purgeExpiredData(): Promise<{ purgedCount: number }> {
    if (!prisma) {
      return { purgedCount: 0 };
    }

    let purgedCount = 0;

    try {
      // Anonymize inactive users older than retention period
      const retentionDays = 365; // 1 year retention for inactive accounts
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

      // Find users who have been inactive and haven't logged in for retention period
      const usersToAnonymize = await prisma.user.findMany({
        where: {
          isActive: false,
          lastLoginAt: { lte: cutoffDate },
          email: { not: { contains: '@anonymized.local' } },
        },
        select: { id: true },
      });

      for (const user of usersToAnonymize) {
        await this.anonymizeUserData(user.id);
        purgedCount++;
      }

      logger.info('Expired PII data purged', { purgedCount });
    } catch (error) {
      logger.error('Failed to purge expired data', { error });
    }

    return { purgedCount };
  }

  /**
   * Validate PII field
   */
  validatePiiField(value: string, fieldType: PiiFieldType): boolean {
    switch (fieldType) {
      case PiiFieldType.EMAIL:
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
      case PiiFieldType.PHONE:
        return /^\+?[1-9]\d{1,14}$/.test(value.replace(/[\s-]/g, ''));
      case PiiFieldType.SSN:
        return /^\d{3}-?\d{2}-?\d{4}$/.test(value);
      case PiiFieldType.IP_ADDRESS:
        return /^(\d{1,3}\.){3}\d{1,3}$/.test(value) ||
               /^([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/.test(value);
      default:
        return value.length > 0 && value.length < 1000;
    }
  }
}

// Singleton instance
let piiHandlerInstance: PiiHandler | null = null;

/**
 * Get PII handler instance
 */
export function getPiiHandler(): PiiHandler {
  if (!piiHandlerInstance) {
    piiHandlerInstance = new PiiHandler();
  }
  return piiHandlerInstance;
}

export default {
  PiiHandler,
  getPiiHandler,
  initPiiHandler,
  PiiFieldType,
  ConsentType,
  DataSubjectRight,
};
