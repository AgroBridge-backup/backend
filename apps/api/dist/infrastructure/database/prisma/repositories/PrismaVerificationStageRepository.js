import { STAGE_ORDER } from '../../../../domain/entities/VerificationStage.js';
export class PrismaVerificationStageRepository {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    mapToDomain(stage) {
        return {
            id: stage.id,
            batchId: stage.batchId,
            stageType: stage.stageType,
            status: stage.status,
            actorId: stage.actorId,
            timestamp: stage.timestamp,
            location: stage.location,
            latitude: stage.latitude ? Number(stage.latitude) : null,
            longitude: stage.longitude ? Number(stage.longitude) : null,
            notes: stage.notes,
            evidenceUrl: stage.evidenceUrl,
            createdAt: stage.createdAt,
            updatedAt: stage.updatedAt,
        };
    }
    async findById(id) {
        const stage = await this.prisma.verificationStage.findUnique({
            where: { id },
        });
        return stage ? this.mapToDomain(stage) : null;
    }
    async findByBatchId(batchId) {
        const stages = await this.prisma.verificationStage.findMany({
            where: { batchId },
            orderBy: { createdAt: 'asc' },
        });
        return stages
            .map(this.mapToDomain)
            .sort((a, b) => {
            const indexA = STAGE_ORDER.indexOf(a.stageType);
            const indexB = STAGE_ORDER.indexOf(b.stageType);
            return indexA - indexB;
        });
    }
    async findByBatchAndType(batchId, stageType) {
        const stage = await this.prisma.verificationStage.findUnique({
            where: {
                batchId_stageType: {
                    batchId,
                    stageType: stageType,
                },
            },
        });
        return stage ? this.mapToDomain(stage) : null;
    }
    async findLatestApprovedStage(batchId) {
        const stages = await this.prisma.verificationStage.findMany({
            where: {
                batchId,
                status: 'APPROVED',
            },
            orderBy: { createdAt: 'desc' },
        });
        if (stages.length === 0) {
            return null;
        }
        const domainStages = stages.map(this.mapToDomain);
        let latestStage = domainStages[0];
        let latestIndex = STAGE_ORDER.indexOf(latestStage.stageType);
        for (const stage of domainStages) {
            const index = STAGE_ORDER.indexOf(stage.stageType);
            if (index > latestIndex) {
                latestStage = stage;
                latestIndex = index;
            }
        }
        return latestStage;
    }
    async create(input) {
        const stage = await this.prisma.verificationStage.create({
            data: {
                batchId: input.batchId,
                stageType: input.stageType,
                actorId: input.actorId,
                status: 'PENDING',
                location: input.location,
                latitude: input.latitude,
                longitude: input.longitude,
                notes: input.notes,
                evidenceUrl: input.evidenceUrl,
            },
        });
        return this.mapToDomain(stage);
    }
    async update(id, input) {
        const stage = await this.prisma.verificationStage.update({
            where: { id },
            data: {
                status: input.status,
                notes: input.notes,
                location: input.location,
                latitude: input.latitude,
                longitude: input.longitude,
                evidenceUrl: input.evidenceUrl,
            },
        });
        return this.mapToDomain(stage);
    }
    async areAllStagesApproved(batchId) {
        const approvedCount = await this.prisma.verificationStage.count({
            where: {
                batchId,
                status: 'APPROVED',
            },
        });
        return approvedCount === STAGE_ORDER.length;
    }
    async countByStatus(batchId, status) {
        return this.prisma.verificationStage.count({
            where: {
                batchId,
                status: status,
            },
        });
    }
}
