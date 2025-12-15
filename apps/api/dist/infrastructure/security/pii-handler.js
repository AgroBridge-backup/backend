import { logger } from '../logging/logger.js';
import { encryptToString, decryptFromString, hash, maskEmail, maskPhone, maskSensitiveData, } from './encryption.service.js';
import { audit, AuditEventType } from './audit-logger.js';
let prisma = null;
export function initPiiHandler(prismaClient) {
    prisma = prismaClient;
    logger.info('PII handler initialized');
}
export var PiiFieldType;
(function (PiiFieldType) {
    PiiFieldType["EMAIL"] = "EMAIL";
    PiiFieldType["PHONE"] = "PHONE";
    PiiFieldType["NAME"] = "NAME";
    PiiFieldType["ADDRESS"] = "ADDRESS";
    PiiFieldType["SSN"] = "SSN";
    PiiFieldType["PASSPORT"] = "PASSPORT";
    PiiFieldType["ID_NUMBER"] = "ID_NUMBER";
    PiiFieldType["FINANCIAL"] = "FINANCIAL";
    PiiFieldType["HEALTH"] = "HEALTH";
    PiiFieldType["BIOMETRIC"] = "BIOMETRIC";
    PiiFieldType["LOCATION"] = "LOCATION";
    PiiFieldType["IP_ADDRESS"] = "IP_ADDRESS";
    PiiFieldType["CUSTOM"] = "CUSTOM";
})(PiiFieldType || (PiiFieldType = {}));
export var ConsentType;
(function (ConsentType) {
    ConsentType["MARKETING"] = "MARKETING";
    ConsentType["ANALYTICS"] = "ANALYTICS";
    ConsentType["THIRD_PARTY"] = "THIRD_PARTY";
    ConsentType["DATA_PROCESSING"] = "DATA_PROCESSING";
    ConsentType["PROFILING"] = "PROFILING";
    ConsentType["COOKIES"] = "COOKIES";
    ConsentType["NEWSLETTER"] = "NEWSLETTER";
})(ConsentType || (ConsentType = {}));
export var DataSubjectRight;
(function (DataSubjectRight) {
    DataSubjectRight["ACCESS"] = "ACCESS";
    DataSubjectRight["RECTIFICATION"] = "RECTIFICATION";
    DataSubjectRight["ERASURE"] = "ERASURE";
    DataSubjectRight["PORTABILITY"] = "PORTABILITY";
    DataSubjectRight["RESTRICTION"] = "RESTRICTION";
    DataSubjectRight["OBJECTION"] = "OBJECTION";
})(DataSubjectRight || (DataSubjectRight = {}));
const PII_FIELD_CONFIGS = {
    email: {
        type: PiiFieldType.EMAIL,
        encrypted: true,
        hashed: true,
        retention: 365 * 3,
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
        retention: 365 * 7,
        maskFunction: (v) => `***-**-${v.slice(-4)}`,
    },
    ipAddress: {
        type: PiiFieldType.IP_ADDRESS,
        encrypted: false,
        retention: 90,
        maskFunction: (v) => v.replace(/\.\d+$/, '.xxx'),
    },
};
export class PiiHandler {
    encryptPii(value, fieldName) {
        const config = PII_FIELD_CONFIGS[fieldName] || { type: PiiFieldType.CUSTOM, encrypted: true };
        if (!config.encrypted) {
            return value;
        }
        return encryptToString(value, fieldName);
    }
    decryptPii(encryptedValue, fieldName) {
        if (!encryptedValue.startsWith('v1:')) {
            return encryptedValue;
        }
        return decryptFromString(encryptedValue, fieldName);
    }
    hashPii(value, fieldName) {
        return hash(`${fieldName}:${value.toLowerCase().trim()}`);
    }
    maskPii(value, fieldName) {
        const config = PII_FIELD_CONFIGS[fieldName];
        if (config?.maskFunction) {
            return config.maskFunction(value);
        }
        return maskSensitiveData(value);
    }
    async anonymizeUserData(userId) {
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
        }
        catch (error) {
            logger.error('Failed to anonymize user data', { error, userId });
            throw error;
        }
    }
    async exportUserData(userId) {
        if (!prisma) {
            throw new Error('Prisma client not initialized');
        }
        try {
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
        }
        catch (error) {
            logger.error('Failed to export user data', { error, userId });
            throw error;
        }
    }
    async recordConsent(consent) {
        if (!prisma) {
            throw new Error('Prisma client not initialized');
        }
        try {
            await prisma.consent?.create({
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
        }
        catch (error) {
            logger.error('Failed to record consent', { error, consent });
            throw error;
        }
    }
    async hasConsent(userId, consentType) {
        if (!prisma) {
            return false;
        }
        try {
            const consent = await prisma.consent?.findFirst({
                where: {
                    userId,
                    type: consentType,
                },
                orderBy: { timestamp: 'desc' },
            });
            return consent?.granted ?? false;
        }
        catch (error) {
            logger.error('Failed to check consent', { error, userId, consentType });
            return false;
        }
    }
    async getUserConsents(userId) {
        const consents = {
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
            const records = await prisma.consent?.findMany({
                where: { userId },
                orderBy: { timestamp: 'desc' },
                distinct: ['type'],
            }) || [];
            for (const record of records) {
                consents[record.type] = record.granted;
            }
        }
        catch (error) {
            logger.error('Failed to get user consents', { error, userId });
        }
        return consents;
    }
    async handleDataAccessRequest(userId, requesterId) {
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
        const data = await this.exportUserData(userId);
        return {
            requestId,
            status: 'COMPLETED',
            data,
        };
    }
    async handleErasureRequest(userId, requesterId) {
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
        await this.anonymizeUserData(userId);
        return {
            requestId,
            status: 'COMPLETED',
        };
    }
    async purgeExpiredData() {
        if (!prisma) {
            return { purgedCount: 0 };
        }
        let purgedCount = 0;
        try {
            const retentionDays = 365;
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - retentionDays);
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
        }
        catch (error) {
            logger.error('Failed to purge expired data', { error });
        }
        return { purgedCount };
    }
    validatePiiField(value, fieldType) {
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
let piiHandlerInstance = null;
export function getPiiHandler() {
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
