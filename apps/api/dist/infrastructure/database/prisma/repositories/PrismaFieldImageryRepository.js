import { calculateCentroid, } from '../../../../domain/entities/FieldImagery.js';
export class PrismaFieldRepository {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    mapToDomain(field) {
        return {
            id: field.id,
            producerId: field.producerId,
            name: field.name,
            description: field.description,
            status: field.status,
            cropType: field.cropType,
            varietyName: field.varietyName,
            plantingDate: field.plantingDate,
            expectedHarvestDate: field.expectedHarvestDate,
            areaHectares: Number(field.areaHectares),
            boundaryGeoJson: field.boundaryGeoJson,
            centroidLatitude: Number(field.centroidLatitude),
            centroidLongitude: Number(field.centroidLongitude),
            altitude: field.altitude ? Number(field.altitude) : null,
            soilType: field.soilType,
            irrigationType: field.irrigationType,
            createdAt: field.createdAt,
            updatedAt: field.updatedAt,
        };
    }
    async findById(id) {
        const field = await this.prisma.field.findUnique({
            where: { id },
        });
        return field ? this.mapToDomain(field) : null;
    }
    async findByProducerId(producerId) {
        const fields = await this.prisma.field.findMany({
            where: { producerId },
            orderBy: { name: 'asc' },
        });
        return fields.map(this.mapToDomain);
    }
    async findByStatus(status) {
        const fields = await this.prisma.field.findMany({
            where: { status: status },
            orderBy: { updatedAt: 'desc' },
        });
        return fields.map(this.mapToDomain);
    }
    async findInBoundingBox(minLat, minLng, maxLat, maxLng) {
        const fields = await this.prisma.field.findMany({
            where: {
                centroidLatitude: { gte: minLat, lte: maxLat },
                centroidLongitude: { gte: minLng, lte: maxLng },
            },
        });
        return fields.map(this.mapToDomain);
    }
    async create(input) {
        const centroid = calculateCentroid(input.boundaryGeoJson);
        const field = await this.prisma.field.create({
            data: {
                producerId: input.producerId,
                name: input.name,
                description: input.description,
                status: 'ACTIVE',
                cropType: input.cropType,
                varietyName: input.varietyName,
                plantingDate: input.plantingDate,
                expectedHarvestDate: input.expectedHarvestDate,
                areaHectares: input.areaHectares,
                boundaryGeoJson: input.boundaryGeoJson,
                centroidLatitude: centroid.latitude,
                centroidLongitude: centroid.longitude,
                altitude: input.altitude,
                soilType: input.soilType,
                irrigationType: input.irrigationType,
            },
        });
        return this.mapToDomain(field);
    }
    async update(id, data) {
        const updateData = {};
        if (data.name !== undefined)
            updateData.name = data.name;
        if (data.description !== undefined)
            updateData.description = data.description;
        if (data.status !== undefined)
            updateData.status = data.status;
        if (data.cropType !== undefined)
            updateData.cropType = data.cropType;
        if (data.varietyName !== undefined)
            updateData.varietyName = data.varietyName;
        if (data.plantingDate !== undefined)
            updateData.plantingDate = data.plantingDate;
        if (data.expectedHarvestDate !== undefined)
            updateData.expectedHarvestDate = data.expectedHarvestDate;
        if (data.areaHectares !== undefined)
            updateData.areaHectares = data.areaHectares;
        if (data.boundaryGeoJson !== undefined) {
            updateData.boundaryGeoJson = data.boundaryGeoJson;
            const centroid = calculateCentroid(data.boundaryGeoJson);
            updateData.centroidLatitude = centroid.latitude;
            updateData.centroidLongitude = centroid.longitude;
        }
        if (data.altitude !== undefined)
            updateData.altitude = data.altitude;
        if (data.soilType !== undefined)
            updateData.soilType = data.soilType;
        if (data.irrigationType !== undefined)
            updateData.irrigationType = data.irrigationType;
        const field = await this.prisma.field.update({
            where: { id },
            data: updateData,
        });
        return this.mapToDomain(field);
    }
    async delete(id) {
        await this.prisma.field.delete({
            where: { id },
        });
    }
    async countByProducerId(producerId) {
        return this.prisma.field.count({
            where: { producerId },
        });
    }
    async getTotalAreaByProducerId(producerId) {
        const result = await this.prisma.field.aggregate({
            where: { producerId },
            _sum: { areaHectares: true },
        });
        return result._sum.areaHectares ? Number(result._sum.areaHectares) : 0;
    }
}
export class PrismaFieldImageryRepository {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    mapToDomain(imagery) {
        return {
            id: imagery.id,
            fieldId: imagery.fieldId,
            source: imagery.source,
            imageType: imagery.imageType,
            captureDate: imagery.captureDate,
            cloudCoverPercent: Number(imagery.cloudCoverPercent),
            resolution: Number(imagery.resolution),
            imageUrl: imagery.imageUrl,
            thumbnailUrl: imagery.thumbnailUrl,
            ndviValue: imagery.ndviValue ? Number(imagery.ndviValue) : null,
            ndwiValue: imagery.ndwiValue ? Number(imagery.ndwiValue) : null,
            healthScore: imagery.healthScore ? Number(imagery.healthScore) : null,
            anomalyDetected: imagery.anomalyDetected,
            anomalyDetails: imagery.anomalyDetails,
            metadata: imagery.metadata,
            createdAt: imagery.createdAt,
        };
    }
    async findById(id) {
        const imagery = await this.prisma.fieldImagery.findUnique({
            where: { id },
        });
        return imagery ? this.mapToDomain(imagery) : null;
    }
    async findByFieldId(fieldId) {
        const imagery = await this.prisma.fieldImagery.findMany({
            where: { fieldId },
            orderBy: { captureDate: 'desc' },
        });
        return imagery.map(this.mapToDomain);
    }
    async findByFieldIdAndDateRange(fieldId, startDate, endDate) {
        const imagery = await this.prisma.fieldImagery.findMany({
            where: {
                fieldId,
                captureDate: { gte: startDate, lte: endDate },
            },
            orderBy: { captureDate: 'asc' },
        });
        return imagery.map(this.mapToDomain);
    }
    async findByFieldIdSourceAndType(fieldId, source, imageType) {
        const imagery = await this.prisma.fieldImagery.findMany({
            where: {
                fieldId,
                source: source,
                imageType: imageType,
            },
            orderBy: { captureDate: 'desc' },
        });
        return imagery.map(this.mapToDomain);
    }
    async findLatestByFieldId(fieldId) {
        const imagery = await this.prisma.fieldImagery.findFirst({
            where: { fieldId },
            orderBy: { captureDate: 'desc' },
        });
        return imagery ? this.mapToDomain(imagery) : null;
    }
    async findByFieldIdWithMaxCloudCover(fieldId, maxCloudCover) {
        const imagery = await this.prisma.fieldImagery.findMany({
            where: {
                fieldId,
                cloudCoverPercent: { lte: maxCloudCover },
            },
            orderBy: { captureDate: 'desc' },
        });
        return imagery.map(this.mapToDomain);
    }
    async create(data) {
        const imagery = await this.prisma.fieldImagery.create({
            data: {
                fieldId: data.fieldId,
                source: data.source,
                imageType: data.imageType,
                captureDate: data.captureDate,
                cloudCoverPercent: data.cloudCoverPercent,
                resolution: data.resolution,
                imageUrl: data.imageUrl,
                thumbnailUrl: data.thumbnailUrl,
                ndviValue: data.ndviValue,
                ndwiValue: data.ndwiValue,
                healthScore: data.healthScore,
                anomalyDetected: data.anomalyDetected,
                anomalyDetails: data.anomalyDetails,
                metadata: data.metadata,
            },
        });
        return this.mapToDomain(imagery);
    }
    async createMany(data) {
        const result = await this.prisma.fieldImagery.createMany({
            data: data.map(d => ({
                fieldId: d.fieldId,
                source: d.source,
                imageType: d.imageType,
                captureDate: d.captureDate,
                cloudCoverPercent: d.cloudCoverPercent,
                resolution: d.resolution,
                imageUrl: d.imageUrl,
                thumbnailUrl: d.thumbnailUrl,
                ndviValue: d.ndviValue,
                ndwiValue: d.ndwiValue,
                healthScore: d.healthScore,
                anomalyDetected: d.anomalyDetected,
                anomalyDetails: d.anomalyDetails,
                metadata: d.metadata,
            })),
        });
        return result.count;
    }
    async update(id, data) {
        const updateData = {};
        if (data.ndviValue !== undefined)
            updateData.ndviValue = data.ndviValue;
        if (data.ndwiValue !== undefined)
            updateData.ndwiValue = data.ndwiValue;
        if (data.healthScore !== undefined)
            updateData.healthScore = data.healthScore;
        if (data.anomalyDetected !== undefined)
            updateData.anomalyDetected = data.anomalyDetected;
        if (data.anomalyDetails !== undefined)
            updateData.anomalyDetails = data.anomalyDetails;
        if (data.metadata !== undefined)
            updateData.metadata = data.metadata;
        const imagery = await this.prisma.fieldImagery.update({
            where: { id },
            data: updateData,
        });
        return this.mapToDomain(imagery);
    }
    async deleteOlderThan(date) {
        const result = await this.prisma.fieldImagery.deleteMany({
            where: { captureDate: { lt: date } },
        });
        return result.count;
    }
    async getNdviTimeSeries(fieldId, startDate, endDate) {
        const imagery = await this.prisma.fieldImagery.findMany({
            where: {
                fieldId,
                captureDate: { gte: startDate, lte: endDate },
                ndviValue: { not: null },
            },
            select: {
                captureDate: true,
                ndviValue: true,
            },
            orderBy: { captureDate: 'asc' },
        });
        return imagery.map(i => ({
            date: i.captureDate,
            ndviValue: i.ndviValue ? Number(i.ndviValue) : null,
        }));
    }
    async getStatsByFieldId(fieldId) {
        const [count, latest, avgResult, anomalyCount] = await Promise.all([
            this.prisma.fieldImagery.count({ where: { fieldId } }),
            this.prisma.fieldImagery.findFirst({
                where: { fieldId },
                orderBy: { captureDate: 'desc' },
                select: { captureDate: true },
            }),
            this.prisma.fieldImagery.aggregate({
                where: { fieldId },
                _avg: { ndviValue: true, healthScore: true },
            }),
            this.prisma.fieldImagery.count({
                where: { fieldId, anomalyDetected: true },
            }),
        ]);
        return {
            totalImages: count,
            latestCapture: latest?.captureDate ?? null,
            averageNdvi: avgResult._avg.ndviValue ? Number(avgResult._avg.ndviValue) : null,
            averageHealthScore: avgResult._avg.healthScore ? Number(avgResult._avg.healthScore) : null,
            anomalyCount,
        };
    }
}
