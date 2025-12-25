import { NfcSealStatus, TamperIndicator, generateSealKeyPair, generateChallenge, signChallenge, encryptPrivateKey, decryptPrivateKey, canAttachSeal, canVerifySeal, canRemoveSeal, isSealExpired, detectCounterAnomaly, isValidSerialNumber, calculateIntegrityScore, } from '../entities/NfcSeal.js';
import { AppError } from '../../shared/errors/AppError.js';
import logger from '../../shared/utils/logger.js';
export class NfcSealService {
    prisma;
    sealRepository;
    masterKey;
    constructor(prisma, sealRepository, masterKey) {
        this.prisma = prisma;
        this.sealRepository = sealRepository;
        const key = masterKey || process.env.NFC_SEAL_MASTER_KEY;
        if (!key) {
            if (process.env.NODE_ENV === 'production') {
                throw new Error('NFC_SEAL_MASTER_KEY is required in production environment');
            }
            logger.warn('Using default NFC master key - DO NOT USE IN PRODUCTION');
            this.masterKey = 'dev-only-insecure-key-32chars!';
        }
        else {
            if (key.length < 32) {
                throw new Error('NFC_SEAL_MASTER_KEY must be at least 32 characters');
            }
            this.masterKey = key;
        }
    }
    async provisionSeal(input) {
        if (!isValidSerialNumber(input.serialNumber)) {
            throw new AppError('Invalid NFC serial number format', 400);
        }
        const existing = await this.sealRepository.findBySerialNumber(input.serialNumber);
        if (existing) {
            throw new AppError('NFC seal with this serial number already exists', 409);
        }
        const { publicKey, privateKey } = generateSealKeyPair();
        const encryptedPrivateKey = encryptPrivateKey(privateKey, this.masterKey);
        const challenge = generateChallenge();
        const seal = await this.sealRepository.create({
            serialNumber: input.serialNumber,
            expiresAt: input.expiresAt,
            publicKey,
            encryptedPrivateKey,
            challenge,
        });
        logger.info('NFC seal provisioned', {
            sealId: seal.id,
            serialNumber: seal.serialNumber,
        });
        return { seal, publicKey };
    }
    async provisionSeals(inputs) {
        const results = [];
        for (const input of inputs) {
            const result = await this.provisionSeal(input);
            results.push(result);
        }
        logger.info('Batch NFC seal provisioning complete', {
            count: results.length,
        });
        return results;
    }
    async attachSeal(input) {
        const seal = await this.sealRepository.findById(input.sealId);
        if (!seal) {
            throw new AppError('NFC seal not found', 404);
        }
        if (!canAttachSeal(seal)) {
            throw new AppError(`Cannot attach seal in status: ${seal.status}`, 400);
        }
        if (isSealExpired(seal)) {
            await this.sealRepository.update(seal.id, {
                status: NfcSealStatus.EXPIRED,
            });
            throw new AppError('NFC seal has expired', 400);
        }
        const batch = await this.prisma.batch.findUnique({
            where: { id: input.batchId },
        });
        if (!batch) {
            throw new AppError('Batch not found', 404);
        }
        const updatedSeal = await this.sealRepository.update(seal.id, {
            batchId: input.batchId,
            status: NfcSealStatus.ATTACHED,
            attachedAt: new Date(),
            attachedBy: input.attachedBy,
            attachedLocation: input.location,
            attachedLatitude: input.latitude,
            attachedLongitude: input.longitude,
        });
        logger.info('NFC seal attached to batch', {
            sealId: seal.id,
            batchId: input.batchId,
            attachedBy: input.attachedBy,
        });
        return updatedSeal;
    }
    async verifySeal(input) {
        const seal = await this.sealRepository.findBySerialNumber(input.serialNumber);
        if (!seal) {
            throw new AppError('NFC seal not found', 404);
        }
        if (!canVerifySeal(seal)) {
            throw new AppError(`Cannot verify seal in status: ${seal.status}`, 400);
        }
        if (isSealExpired(seal)) {
            await this.sealRepository.update(seal.id, {
                status: NfcSealStatus.EXPIRED,
            });
            throw new AppError('NFC seal has expired', 400);
        }
        const challenge = seal.challenge;
        const privateKey = decryptPrivateKey(seal.encryptedPrivateKey, this.masterKey);
        const expectedSignature = signChallenge(challenge, privateKey);
        const signatureValid = input.signature === expectedSignature;
        const counterAnomaly = detectCounterAnomaly(seal.expectedReadCount, input.readCounter);
        let tamperIndicator = TamperIndicator.NONE;
        let tamperDetails = null;
        if (!signatureValid) {
            tamperIndicator = TamperIndicator.SIGNATURE_MISMATCH;
            tamperDetails = 'Cryptographic signature verification failed';
        }
        else if (counterAnomaly) {
            tamperIndicator = TamperIndicator.COUNTER_ANOMALY;
            tamperDetails = `Expected counter ${seal.expectedReadCount}, got ${input.readCounter}`;
        }
        const isValid = signatureValid && !counterAnomaly;
        const nextChallenge = generateChallenge();
        const verification = await this.sealRepository.createVerification({
            sealId: seal.id,
            verifiedBy: input.verifiedBy,
            verifiedAt: new Date(),
            latitude: input.latitude ?? null,
            longitude: input.longitude ?? null,
            location: input.location ?? null,
            readCounter: input.readCounter,
            signatureProvided: input.signature,
            signatureExpected: expectedSignature,
            challengeUsed: challenge,
            isValid,
            tamperIndicator,
            tamperDetails,
            deviceInfo: input.deviceInfo ?? null,
        });
        const newStatus = isValid ? NfcSealStatus.VERIFIED : NfcSealStatus.TAMPERED;
        const updatedSeal = await this.sealRepository.update(seal.id, {
            status: newStatus,
            challenge: nextChallenge,
            expectedReadCount: input.readCounter + 1,
            actualReadCount: input.readCounter,
            tamperIndicator: isValid ? seal.tamperIndicator : tamperIndicator,
            tamperDetails: isValid ? seal.tamperDetails : tamperDetails,
        });
        const verifications = await this.sealRepository.getVerifications(seal.id);
        const integrityScore = calculateIntegrityScore(updatedSeal, verifications);
        logger.info('NFC seal verification completed', {
            sealId: seal.id,
            serialNumber: seal.serialNumber,
            isValid,
            tamperIndicator,
            integrityScore,
        });
        return {
            seal: updatedSeal,
            verification,
            isValid,
            tamperIndicator,
            integrityScore,
            nextChallenge,
        };
    }
    async removeSeal(input) {
        const seal = await this.sealRepository.findById(input.sealId);
        if (!seal) {
            throw new AppError('NFC seal not found', 404);
        }
        if (!canRemoveSeal(seal)) {
            throw new AppError(`Cannot remove seal in status: ${seal.status}`, 400);
        }
        const updatedSeal = await this.sealRepository.update(seal.id, {
            status: NfcSealStatus.REMOVED,
            removedAt: new Date(),
            removedBy: input.removedBy,
            removedLocation: input.location,
        });
        logger.info('NFC seal removed', {
            sealId: seal.id,
            batchId: seal.batchId,
            removedBy: input.removedBy,
            reason: input.reason,
        });
        return updatedSeal;
    }
    async getSeal(sealId) {
        return this.sealRepository.findById(sealId);
    }
    async getSealBySerialNumber(serialNumber) {
        return this.sealRepository.findBySerialNumber(serialNumber);
    }
    async getBatchSeals(batchId) {
        return this.sealRepository.findByBatchId(batchId);
    }
    async getVerificationHistory(sealId) {
        return this.sealRepository.getVerifications(sealId);
    }
    async getBatchIntegritySummary(batchId) {
        const sealsWithVerifications = await this.prisma.nfcSeal.findMany({
            where: { batchId },
            include: {
                verifications: {
                    orderBy: { verifiedAt: 'desc' },
                },
            },
        });
        return sealsWithVerifications.map(seal => {
            const domainSeal = {
                id: seal.id,
                serialNumber: seal.serialNumber,
                batchId: seal.batchId,
                status: seal.status,
                publicKey: seal.publicKey,
                encryptedPrivateKey: seal.encryptedPrivateKey,
                challenge: seal.challenge,
                expectedReadCount: seal.expectedReadCount,
                actualReadCount: seal.actualReadCount,
                attachedAt: seal.attachedAt,
                attachedBy: seal.attachedBy,
                attachedLocation: seal.attachedLocation,
                attachedLatitude: seal.attachedLatitude ? Number(seal.attachedLatitude) : null,
                attachedLongitude: seal.attachedLongitude ? Number(seal.attachedLongitude) : null,
                removedAt: seal.removedAt,
                removedBy: seal.removedBy,
                removedLocation: seal.removedLocation,
                tamperIndicator: seal.tamperIndicator,
                tamperDetails: seal.tamperDetails,
                expiresAt: seal.expiresAt,
                createdAt: seal.createdAt,
                updatedAt: seal.updatedAt,
            };
            const domainVerifications = seal.verifications.map(v => ({
                id: v.id,
                sealId: v.sealId,
                verifiedBy: v.verifiedBy,
                verifiedAt: v.verifiedAt,
                latitude: v.latitude ? Number(v.latitude) : null,
                longitude: v.longitude ? Number(v.longitude) : null,
                location: v.location,
                readCounter: v.readCounter,
                signatureProvided: v.signatureProvided,
                signatureExpected: v.signatureExpected,
                challengeUsed: v.challengeUsed,
                isValid: v.isValid,
                tamperIndicator: v.tamperIndicator,
                tamperDetails: v.tamperDetails,
                deviceInfo: v.deviceInfo,
            }));
            const latestVerification = domainVerifications[0];
            return {
                sealId: seal.id,
                serialNumber: seal.serialNumber,
                status: seal.status,
                integrityScore: calculateIntegrityScore(domainSeal, domainVerifications),
                verificationCount: domainVerifications.length,
                lastVerification: latestVerification?.verifiedAt ?? null,
                tamperIndicator: seal.tamperIndicator,
            };
        });
    }
    async getAvailableSeals() {
        return this.sealRepository.findAvailable();
    }
    async getSealStats() {
        return this.sealRepository.countByStatus();
    }
    async processExpiredSeals() {
        const expiredSeals = await this.sealRepository.findExpiredSeals();
        if (expiredSeals.length === 0) {
            return 0;
        }
        const ids = expiredSeals.map(s => s.id);
        const count = await this.sealRepository.bulkUpdateStatus(ids, NfcSealStatus.EXPIRED);
        logger.info('Processed expired NFC seals', { count });
        return count;
    }
    async reportPhysicalDamage(sealId, reportedBy, description) {
        const seal = await this.sealRepository.findById(sealId);
        if (!seal) {
            throw new AppError('NFC seal not found', 404);
        }
        const updatedSeal = await this.sealRepository.update(seal.id, {
            status: NfcSealStatus.TAMPERED,
            tamperIndicator: TamperIndicator.PHYSICAL_DAMAGE,
            tamperDetails: `Reported by ${reportedBy}: ${description}`,
        });
        logger.warn('Physical damage reported for NFC seal', {
            sealId: seal.id,
            reportedBy,
            description,
        });
        return updatedSeal;
    }
    async getCurrentChallenge(serialNumber) {
        const seal = await this.sealRepository.findBySerialNumber(serialNumber);
        return seal?.challenge ?? null;
    }
}
