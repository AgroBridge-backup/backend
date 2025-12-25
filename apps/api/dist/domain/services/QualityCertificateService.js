import { createHash } from 'crypto';
import { REQUIRED_STAGES_BY_GRADE, } from '../entities/QualityCertificate.js';
import { StageStatus } from '../entities/VerificationStage.js';
import { AppError } from '../../shared/errors/AppError.js';
import logger from '../../shared/utils/logger.js';
export class QualityCertificateService {
    prisma;
    certificateRepository;
    stageRepository;
    blockchainService;
    static VERSION = '1.0.0';
    constructor(prisma, certificateRepository, stageRepository, blockchainService) {
        this.prisma = prisma;
        this.certificateRepository = certificateRepository;
        this.stageRepository = stageRepository;
        this.blockchainService = blockchainService;
    }
    async issueCertificate(input) {
        const { batchId, grade, certifyingBody, validityDays, issuedBy } = input;
        const batch = await this.prisma.batch.findUnique({
            where: { id: batchId },
        });
        if (!batch) {
            throw new AppError('Batch not found', 404);
        }
        await this.validateRequiredStages(batchId, grade);
        const payload = await this.buildCertificatePayload(batchId, grade, certifyingBody, issuedBy);
        const payloadJson = JSON.stringify(payload);
        const hash = this.computeHash(payloadJson);
        let blockchainTxId = null;
        if (this.blockchainService) {
            try {
                const blockchainResult = await this.blockchainService.registerEventOnChain({
                    eventType: 'CERTIFICATE_ISSUED',
                    batchId,
                    latitude: batch.latitude ? Number(batch.latitude) : 0,
                    longitude: batch.longitude ? Number(batch.longitude) : 0,
                    ipfsHash: hash,
                });
                blockchainTxId = blockchainResult.txHash;
                logger.info('Certificate stored on blockchain', {
                    batchId,
                    grade,
                    txHash: blockchainTxId,
                });
            }
            catch (error) {
                logger.error('Failed to store certificate on blockchain', {
                    batchId,
                    error: error.message,
                });
            }
        }
        const validFrom = new Date();
        const validTo = new Date();
        validTo.setDate(validTo.getDate() + validityDays);
        const certificate = await this.certificateRepository.create({
            batchId,
            grade,
            certifyingBody,
            validFrom,
            validTo,
            issuedBy,
            hashOnChain: hash,
            payloadSnapshot: payloadJson,
        });
        logger.info('Quality certificate issued', {
            certificateId: certificate.id,
            batchId,
            grade,
            hash,
        });
        return {
            certificate,
            payload,
            hash,
            blockchainTxId,
        };
    }
    async getCertificate(certificateId) {
        return this.certificateRepository.findById(certificateId);
    }
    async getBatchCertificates(batchId) {
        return this.certificateRepository.findByBatchId(batchId);
    }
    async getValidCertificates(batchId) {
        return this.certificateRepository.findValidCertificates(batchId);
    }
    async verifyCertificate(certificateId) {
        const certificate = await this.certificateRepository.findById(certificateId);
        if (!certificate) {
            return {
                isValid: false,
                certificate: null,
                computedHash: null,
                storedHash: null,
                isExpired: false,
            };
        }
        const now = new Date();
        const isExpired = certificate.validTo < now;
        if (!certificate.payloadSnapshot) {
            return {
                isValid: false,
                certificate,
                computedHash: null,
                storedHash: certificate.hashOnChain,
                isExpired,
            };
        }
        const computedHash = this.computeHash(certificate.payloadSnapshot);
        const isValid = computedHash === certificate.hashOnChain && !isExpired;
        return {
            isValid,
            certificate,
            computedHash,
            storedHash: certificate.hashOnChain,
            isExpired,
        };
    }
    async canIssueCertificate(batchId, grade) {
        const requiredStages = REQUIRED_STAGES_BY_GRADE[grade];
        const stages = await this.stageRepository.findByBatchId(batchId);
        const approvedStageTypes = stages
            .filter(s => s.status === StageStatus.APPROVED)
            .map(s => s.stageType);
        const missingStages = requiredStages.filter(required => !approvedStageTypes.includes(required));
        if (missingStages.length > 0) {
            return {
                canIssue: false,
                missingStages,
                message: `Missing required stages: ${missingStages.join(', ')}`,
            };
        }
        return {
            canIssue: true,
            missingStages: [],
            message: 'All requirements met for certificate issuance',
        };
    }
    async validateRequiredStages(batchId, grade) {
        const { canIssue, missingStages } = await this.canIssueCertificate(batchId, grade);
        if (!canIssue) {
            throw new AppError(`Cannot issue ${grade} certificate. Missing approved stages: ${missingStages.join(', ')}`, 400);
        }
    }
    async buildCertificatePayload(batchId, grade, certifyingBody, issuedBy) {
        const batch = await this.prisma.batch.findUnique({
            where: { id: batchId },
        });
        if (!batch) {
            throw new AppError('Batch not found', 404);
        }
        const stages = await this.stageRepository.findByBatchId(batchId);
        const nfcSeals = await this.prisma.nfcSeal.findMany({
            where: { batchId },
            include: {
                verifications: {
                    orderBy: { verifiedAt: 'desc' },
                    take: 1,
                },
            },
        });
        const tempReadings = await this.prisma.temperatureReading.findMany({
            where: { batchId },
        });
        let temperatureSummary = undefined;
        if (tempReadings.length > 0) {
            const values = tempReadings.map(t => Number(t.value));
            temperatureSummary = {
                count: tempReadings.length,
                minValue: Math.min(...values),
                maxValue: Math.max(...values),
                avgValue: values.reduce((a, b) => a + b, 0) / values.length,
                outOfRangeCount: tempReadings.filter(t => t.isOutOfRange).length,
            };
        }
        const now = new Date();
        const certificateId = `CERT-${batch.code}-${now.getTime()}`;
        return {
            certificateId,
            batchId,
            batchCode: batch.code,
            grade,
            certifyingBody,
            validFrom: now.toISOString(),
            validTo: new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000).toISOString(),
            issuedAt: now.toISOString(),
            issuedBy,
            batch: {
                producerId: batch.producerId,
                cropType: batch.cropType,
                variety: batch.variety,
                quantity: batch.quantity ? Number(batch.quantity) : null,
                harvestDate: batch.harvestDate?.toISOString() ?? null,
                origin: batch.origin,
            },
            stages: stages.map(s => ({
                stageType: s.stageType,
                status: s.status,
                actorId: s.actorId,
                timestamp: s.timestamp.toISOString(),
                location: s.location,
            })),
            nfcSeals: nfcSeals.length > 0 ? nfcSeals.map(seal => ({
                uid: seal.serialNumber,
                status: seal.status,
                lastVerifiedAt: seal.verifications[0]?.verifiedAt?.toISOString() ?? null,
            })) : undefined,
            temperatureSummary,
            version: QualityCertificateService.VERSION,
            generatedAt: now.toISOString(),
        };
    }
    computeHash(payload) {
        return createHash('sha256').update(payload).digest('hex');
    }
}
