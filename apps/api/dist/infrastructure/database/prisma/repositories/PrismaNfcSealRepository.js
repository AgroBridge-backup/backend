import { NfcSealStatus, } from '../../../../domain/entities/NfcSeal.js';
export class PrismaNfcSealRepository {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    mapSealToDomain(seal) {
        return {
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
    }
    mapVerificationToDomain(verification) {
        return {
            id: verification.id,
            sealId: verification.sealId,
            verifiedBy: verification.verifiedBy,
            verifiedAt: verification.verifiedAt,
            latitude: verification.latitude ? Number(verification.latitude) : null,
            longitude: verification.longitude ? Number(verification.longitude) : null,
            location: verification.location,
            readCounter: verification.readCounter,
            signatureProvided: verification.signatureProvided,
            signatureExpected: verification.signatureExpected,
            challengeUsed: verification.challengeUsed,
            isValid: verification.isValid,
            tamperIndicator: verification.tamperIndicator,
            tamperDetails: verification.tamperDetails,
            deviceInfo: verification.deviceInfo,
        };
    }
    async findById(id) {
        const seal = await this.prisma.nfcSeal.findUnique({
            where: { id },
        });
        return seal ? this.mapSealToDomain(seal) : null;
    }
    async findBySerialNumber(serialNumber) {
        const seal = await this.prisma.nfcSeal.findUnique({
            where: { serialNumber },
        });
        return seal ? this.mapSealToDomain(seal) : null;
    }
    async findByBatchId(batchId) {
        const seals = await this.prisma.nfcSeal.findMany({
            where: { batchId },
            orderBy: { attachedAt: 'desc' },
        });
        return seals.map(this.mapSealToDomain);
    }
    async findByStatus(status) {
        const seals = await this.prisma.nfcSeal.findMany({
            where: { status: status },
            orderBy: { createdAt: 'desc' },
        });
        return seals.map(this.mapSealToDomain);
    }
    async findAvailable() {
        const seals = await this.prisma.nfcSeal.findMany({
            where: {
                status: 'PROVISIONED',
                batchId: null,
            },
            orderBy: { createdAt: 'asc' },
        });
        return seals.map(this.mapSealToDomain);
    }
    async create(input) {
        const seal = await this.prisma.nfcSeal.create({
            data: {
                serialNumber: input.serialNumber,
                status: 'PROVISIONED',
                publicKey: input.publicKey,
                encryptedPrivateKey: input.encryptedPrivateKey,
                challenge: input.challenge,
                expectedReadCount: 0,
                actualReadCount: 0,
                tamperIndicator: 'NONE',
                expiresAt: input.expiresAt,
            },
        });
        return this.mapSealToDomain(seal);
    }
    async update(id, data) {
        const updateData = {};
        if (data.status !== undefined)
            updateData.status = data.status;
        if (data.batchId !== undefined)
            updateData.batchId = data.batchId;
        if (data.challenge !== undefined)
            updateData.challenge = data.challenge;
        if (data.expectedReadCount !== undefined)
            updateData.expectedReadCount = data.expectedReadCount;
        if (data.actualReadCount !== undefined)
            updateData.actualReadCount = data.actualReadCount;
        if (data.attachedAt !== undefined)
            updateData.attachedAt = data.attachedAt;
        if (data.attachedBy !== undefined)
            updateData.attachedBy = data.attachedBy;
        if (data.attachedLocation !== undefined)
            updateData.attachedLocation = data.attachedLocation;
        if (data.attachedLatitude !== undefined)
            updateData.attachedLatitude = data.attachedLatitude;
        if (data.attachedLongitude !== undefined)
            updateData.attachedLongitude = data.attachedLongitude;
        if (data.removedAt !== undefined)
            updateData.removedAt = data.removedAt;
        if (data.removedBy !== undefined)
            updateData.removedBy = data.removedBy;
        if (data.removedLocation !== undefined)
            updateData.removedLocation = data.removedLocation;
        if (data.tamperIndicator !== undefined)
            updateData.tamperIndicator = data.tamperIndicator;
        if (data.tamperDetails !== undefined)
            updateData.tamperDetails = data.tamperDetails;
        const seal = await this.prisma.nfcSeal.update({
            where: { id },
            data: updateData,
        });
        return this.mapSealToDomain(seal);
    }
    async createVerification(data) {
        const verification = await this.prisma.nfcSealVerification.create({
            data: {
                sealId: data.sealId,
                verifiedBy: data.verifiedBy,
                verifiedAt: data.verifiedAt,
                latitude: data.latitude,
                longitude: data.longitude,
                location: data.location,
                readCounter: data.readCounter,
                signatureProvided: data.signatureProvided,
                signatureExpected: data.signatureExpected,
                challengeUsed: data.challengeUsed,
                isValid: data.isValid,
                tamperIndicator: data.tamperIndicator,
                tamperDetails: data.tamperDetails,
                deviceInfo: data.deviceInfo,
            },
        });
        return this.mapVerificationToDomain(verification);
    }
    async getVerifications(sealId) {
        const verifications = await this.prisma.nfcSealVerification.findMany({
            where: { sealId },
            orderBy: { verifiedAt: 'desc' },
        });
        return verifications.map(this.mapVerificationToDomain);
    }
    async getLatestVerification(sealId) {
        const verification = await this.prisma.nfcSealVerification.findFirst({
            where: { sealId },
            orderBy: { verifiedAt: 'desc' },
        });
        return verification ? this.mapVerificationToDomain(verification) : null;
    }
    async countByStatus() {
        const counts = await this.prisma.nfcSeal.groupBy({
            by: ['status'],
            _count: true,
        });
        const result = {
            [NfcSealStatus.PROVISIONED]: 0,
            [NfcSealStatus.ATTACHED]: 0,
            [NfcSealStatus.VERIFIED]: 0,
            [NfcSealStatus.TAMPERED]: 0,
            [NfcSealStatus.REMOVED]: 0,
            [NfcSealStatus.EXPIRED]: 0,
        };
        for (const count of counts) {
            result[count.status] = count._count;
        }
        return result;
    }
    async findExpiredSeals() {
        const seals = await this.prisma.nfcSeal.findMany({
            where: {
                status: { notIn: ['EXPIRED', 'TAMPERED', 'REMOVED'] },
                expiresAt: { lt: new Date() },
            },
        });
        return seals.map(this.mapSealToDomain);
    }
    async bulkUpdateStatus(ids, status) {
        const result = await this.prisma.nfcSeal.updateMany({
            where: { id: { in: ids } },
            data: { status: status },
        });
        return result.count;
    }
}
