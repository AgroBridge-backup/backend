import { ImageryType, ndviToHealthScore, getHealthCategory, calculateNdviTrend, isValidGeoJsonPolygon, calculateAreaHectares, } from '../entities/FieldImagery.js';
import { AppError } from '../../shared/errors/AppError.js';
import logger from '../../shared/utils/logger.js';
export class SatelliteImageryService {
    prisma;
    fieldRepository;
    imageryRepository;
    constructor(prisma, fieldRepository, imageryRepository) {
        this.prisma = prisma;
        this.fieldRepository = fieldRepository;
        this.imageryRepository = imageryRepository;
    }
    async createField(input) {
        if (!isValidGeoJsonPolygon(input.boundaryGeoJson)) {
            throw new AppError('Invalid GeoJSON polygon boundary', 400);
        }
        const computedArea = input.areaHectares || calculateAreaHectares(input.boundaryGeoJson);
        const producer = await this.prisma.producer.findUnique({
            where: { id: input.producerId },
        });
        if (!producer) {
            throw new AppError('Producer not found', 404);
        }
        const field = await this.fieldRepository.create({
            ...input,
            areaHectares: computedArea,
        });
        logger.info('Field created', {
            fieldId: field.id,
            producerId: input.producerId,
            areaHectares: computedArea,
        });
        return { field, computedArea };
    }
    async getField(fieldId) {
        return this.fieldRepository.findById(fieldId);
    }
    async getProducerFields(producerId) {
        return this.fieldRepository.findByProducerId(producerId);
    }
    async updateFieldStatus(fieldId, status) {
        const field = await this.fieldRepository.findById(fieldId);
        if (!field) {
            throw new AppError('Field not found', 404);
        }
        return this.fieldRepository.update(fieldId, { status });
    }
    async storeImagery(fieldId, data) {
        const field = await this.fieldRepository.findById(fieldId);
        if (!field) {
            throw new AppError('Field not found', 404);
        }
        const imagery = await this.imageryRepository.create({
            fieldId,
            ...data,
        });
        logger.info('Imagery stored', {
            imageryId: imagery.id,
            fieldId,
            source: data.source,
            captureDate: data.captureDate,
        });
        return imagery;
    }
    async getFieldImagery(fieldId, startDate, endDate) {
        if (startDate && endDate) {
            return this.imageryRepository.findByFieldIdAndDateRange(fieldId, startDate, endDate);
        }
        return this.imageryRepository.findByFieldId(fieldId);
    }
    async getLatestImagery(fieldId) {
        return this.imageryRepository.findLatestByFieldId(fieldId);
    }
    async generateTimeLapse(fieldId, startDate, endDate, imageType = ImageryType.NDVI, maxCloudCover = 30) {
        const field = await this.fieldRepository.findById(fieldId);
        if (!field) {
            throw new AppError('Field not found', 404);
        }
        const allImagery = await this.imageryRepository.findByFieldIdAndDateRange(fieldId, startDate, endDate);
        const filteredImagery = allImagery.filter(img => img.imageType === imageType && img.cloudCoverPercent <= maxCloudCover);
        const frames = filteredImagery.map(img => ({
            date: img.captureDate,
            imageUrl: img.imageUrl,
            ndviValue: img.ndviValue,
            healthScore: img.healthScore,
            cloudCoverPercent: img.cloudCoverPercent,
        }));
        const ndviValues = frames
            .filter(f => f.ndviValue !== null)
            .map(f => f.ndviValue);
        const healthValues = frames
            .filter(f => f.healthScore !== null)
            .map(f => f.healthScore);
        const averageNdvi = ndviValues.length > 0
            ? ndviValues.reduce((a, b) => a + b, 0) / ndviValues.length
            : null;
        const timeLapse = {
            fieldId,
            startDate,
            endDate,
            imageType,
            frames,
            frameCount: frames.length,
            averageNdvi,
            ndviTrend: calculateNdviTrend(ndviValues),
            healthTrend: calculateNdviTrend(healthValues),
        };
        logger.info('Time-lapse generated', {
            fieldId,
            frameCount: frames.length,
            startDate,
            endDate,
        });
        return { timeLapse, generatedAt: new Date() };
    }
    async analyzeFieldHealth(fieldId) {
        const field = await this.fieldRepository.findById(fieldId);
        if (!field) {
            throw new AppError('Field not found', 404);
        }
        const endDate = new Date();
        const startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        const imagery = await this.imageryRepository.findByFieldIdAndDateRange(fieldId, startDate, endDate);
        const ndviImages = imagery.filter(img => img.imageType === ImageryType.NDVI &&
            img.cloudCoverPercent <= 20 &&
            img.ndviValue !== null);
        if (ndviImages.length === 0) {
            return {
                fieldId,
                analysisDate: new Date(),
                overallHealthScore: 0,
                ndviAverage: 0,
                ndviMin: 0,
                ndviMax: 0,
                healthDistribution: {
                    excellent: 0,
                    good: 0,
                    fair: 0,
                    poor: 0,
                    critical: 100,
                },
                anomalies: [],
                recommendations: ['Insufficient imagery data. Please ensure satellite coverage.'],
            };
        }
        const ndviValues = ndviImages.map(img => img.ndviValue);
        const ndviAverage = ndviValues.reduce((a, b) => a + b, 0) / ndviValues.length;
        const ndviMin = Math.min(...ndviValues);
        const ndviMax = Math.max(...ndviValues);
        const overallHealthScore = ndviToHealthScore(ndviAverage);
        const scores = ndviValues.map(ndviToHealthScore);
        const healthDistribution = {
            excellent: scores.filter(s => s >= 80).length / scores.length * 100,
            good: scores.filter(s => s >= 60 && s < 80).length / scores.length * 100,
            fair: scores.filter(s => s >= 40 && s < 60).length / scores.length * 100,
            poor: scores.filter(s => s >= 20 && s < 40).length / scores.length * 100,
            critical: scores.filter(s => s < 20).length / scores.length * 100,
        };
        const anomalies = imagery
            .filter(img => img.anomalyDetected && img.anomalyDetails)
            .map(img => ({
            type: 'OTHER',
            severity: 'MEDIUM',
            affectedAreaHectares: 0,
            affectedAreaPercent: 0,
            location: {
                latitude: field.centroidLatitude,
                longitude: field.centroidLongitude,
            },
            description: img.anomalyDetails,
            detectedAt: img.captureDate,
        }));
        const recommendations = [];
        const healthCategory = getHealthCategory(overallHealthScore);
        if (healthCategory === 'CRITICAL' || healthCategory === 'POOR') {
            recommendations.push('Immediate field inspection recommended.');
            recommendations.push('Check irrigation system and soil moisture levels.');
        }
        if (ndviMax - ndviMin > 0.3) {
            recommendations.push('High variability detected. Consider zone-specific treatment.');
        }
        const trend = calculateNdviTrend(ndviValues);
        if (trend === 'DECLINING') {
            recommendations.push('Declining health trend detected. Monitor closely.');
        }
        if (anomalies.length > 0) {
            recommendations.push(`${anomalies.length} anomalies detected. Review affected areas.`);
        }
        if (recommendations.length === 0) {
            recommendations.push('Field health is within normal parameters.');
        }
        logger.info('Field health analysis completed', {
            fieldId,
            overallHealthScore,
            ndviAverage,
            anomalyCount: anomalies.length,
        });
        return {
            fieldId,
            analysisDate: new Date(),
            overallHealthScore,
            ndviAverage: Math.round(ndviAverage * 1000) / 1000,
            ndviMin: Math.round(ndviMin * 1000) / 1000,
            ndviMax: Math.round(ndviMax * 1000) / 1000,
            healthDistribution,
            anomalies,
            recommendations,
        };
    }
    async getNdviTimeSeries(fieldId, startDate, endDate) {
        return this.imageryRepository.getNdviTimeSeries(fieldId, startDate, endDate);
    }
    async getFieldStats(fieldId) {
        return this.imageryRepository.getStatsByFieldId(fieldId);
    }
    async linkFieldToBatch(fieldId, batchId) {
        const field = await this.fieldRepository.findById(fieldId);
        if (!field) {
            throw new AppError('Field not found', 404);
        }
        const batch = await this.prisma.batch.findUnique({
            where: { id: batchId },
        });
        if (!batch) {
            throw new AppError('Batch not found', 404);
        }
        await this.prisma.batch.update({
            where: { id: batchId },
            data: { fieldId },
        });
        logger.info('Field linked to batch', { fieldId, batchId });
    }
}
