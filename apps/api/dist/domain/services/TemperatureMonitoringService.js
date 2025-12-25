import { calculateTemperatureStats, detectRapidChange, getAlertSeverity, DEFAULT_THRESHOLDS, } from '../entities/TemperatureReading.js';
import { AppError } from '../../shared/errors/AppError.js';
import logger from '../../shared/utils/logger.js';
export class TemperatureMonitoringService {
    prisma;
    readingRepository;
    constructor(prisma, readingRepository) {
        this.prisma = prisma;
        this.readingRepository = readingRepository;
    }
    async recordTemperature(input) {
        const batch = await this.prisma.batch.findUnique({
            where: { id: input.batchId },
        });
        if (!batch) {
            throw new AppError('Batch not found', 404);
        }
        const thresholds = this.getThresholdsForCrop(batch.variety || 'DEFAULT');
        const readingInput = {
            batchId: input.batchId,
            value: input.value,
            humidity: input.humidity,
            source: input.source,
            minThreshold: thresholds.min,
            maxThreshold: thresholds.max,
            sensorId: input.sensorId,
            deviceId: input.deviceId,
            latitude: input.latitude,
            longitude: input.longitude,
            recordedBy: input.recordedBy,
        };
        const reading = await this.readingRepository.create(readingInput);
        let alert = null;
        if (reading.isOutOfRange) {
            const severity = getAlertSeverity(reading.value, thresholds.min, thresholds.max);
            if (severity) {
                alert = {
                    id: `alert-${reading.id}`,
                    readingId: reading.id,
                    batchId: input.batchId,
                    type: reading.value < thresholds.min ? 'LOW_TEMP' : 'HIGH_TEMP',
                    severity,
                    message: reading.value < thresholds.min
                        ? `Temperature ${reading.value}°C is below minimum ${thresholds.min}°C`
                        : `Temperature ${reading.value}°C exceeds maximum ${thresholds.max}°C`,
                    value: reading.value,
                    threshold: reading.value < thresholds.min ? thresholds.min : thresholds.max,
                    timestamp: reading.timestamp,
                    acknowledged: false,
                    acknowledgedBy: null,
                    acknowledgedAt: null,
                };
                logger.warn('Temperature alert generated', {
                    batchId: input.batchId,
                    value: reading.value,
                    type: alert.type,
                    severity: alert.severity,
                });
            }
        }
        const recentReadings = await this.readingRepository.findByBatchIdAndTimeRange(input.batchId, new Date(Date.now() - 2 * 60 * 60 * 1000), new Date());
        const rapidChanges = detectRapidChange(recentReadings);
        if (rapidChanges.length > 0 && rapidChanges[rapidChanges.length - 1].id === reading.id) {
            if (!alert) {
                alert = {
                    id: `alert-rapid-${reading.id}`,
                    readingId: reading.id,
                    batchId: input.batchId,
                    type: 'RAPID_CHANGE',
                    severity: 'WARNING',
                    message: 'Rapid temperature change detected - possible cold chain breach',
                    value: reading.value,
                    threshold: 3,
                    timestamp: reading.timestamp,
                    acknowledged: false,
                    acknowledgedBy: null,
                    acknowledgedAt: null,
                };
            }
        }
        logger.info('Temperature reading recorded', {
            readingId: reading.id,
            batchId: input.batchId,
            value: reading.value,
            isOutOfRange: reading.isOutOfRange,
            source: input.source,
        });
        return {
            reading,
            isOutOfRange: reading.isOutOfRange,
            alert,
        };
    }
    async recordBatchTemperatures(inputs) {
        if (inputs.length === 0) {
            return { count: 0, outOfRangeCount: 0 };
        }
        const batchIds = [...new Set(inputs.map(i => i.batchId))];
        const batches = await this.prisma.batch.findMany({
            where: { id: { in: batchIds } },
        });
        const batchThresholds = new Map();
        batches.forEach(batch => {
            batchThresholds.set(batch.id, this.getThresholdsForCrop(batch.variety || 'DEFAULT'));
        });
        const readingInputs = inputs.map(input => {
            const thresholds = batchThresholds.get(input.batchId) || DEFAULT_THRESHOLDS.DEFAULT;
            return {
                batchId: input.batchId,
                value: input.value,
                humidity: input.humidity,
                source: input.source,
                minThreshold: thresholds.min,
                maxThreshold: thresholds.max,
                sensorId: input.sensorId,
                deviceId: input.deviceId,
                latitude: input.latitude,
                longitude: input.longitude,
                recordedBy: input.recordedBy,
            };
        });
        const count = await this.readingRepository.createMany(readingInputs);
        const outOfRangeCount = inputs.filter(input => {
            const thresholds = batchThresholds.get(input.batchId) || DEFAULT_THRESHOLDS.DEFAULT;
            return input.value < thresholds.min || input.value > thresholds.max;
        }).length;
        logger.info('Batch temperature readings recorded', {
            count,
            outOfRangeCount,
            batchIds,
        });
        return { count, outOfRangeCount };
    }
    async getTemperatureSummary(batchId) {
        const readings = await this.readingRepository.findByBatchId(batchId);
        return calculateTemperatureStats(readings);
    }
    async getReadings(batchId, limit) {
        if (limit) {
            return this.readingRepository.findByBatchIdPaginated(batchId, { limit });
        }
        return this.readingRepository.findByBatchId(batchId);
    }
    async getLatestReading(batchId) {
        return this.readingRepository.findLatestByBatchId(batchId);
    }
    async getChartData(batchId, startTime, endTime) {
        const readings = await this.readingRepository.findByBatchIdAndTimeRange(batchId, startTime, endTime);
        if (readings.length === 0) {
            return {
                labels: [],
                values: [],
                thresholdMin: 0,
                thresholdMax: 8,
                outOfRangeIndices: [],
            };
        }
        const labels = readings.map(r => r.timestamp.toISOString());
        const values = readings.map(r => r.value);
        const outOfRangeIndices = readings
            .map((r, i) => (r.isOutOfRange ? i : -1))
            .filter(i => i >= 0);
        return {
            labels,
            values,
            thresholdMin: readings[0].minThreshold,
            thresholdMax: readings[0].maxThreshold,
            outOfRangeIndices,
        };
    }
    async getOutOfRangeReadings(batchId) {
        return this.readingRepository.findOutOfRangeByBatchId(batchId);
    }
    async checkCompliance(batchId) {
        const readings = await this.readingRepository.findByBatchId(batchId);
        if (readings.length === 0) {
            return {
                isCompliant: true,
                summary: null,
                violations: [],
                rapidChanges: [],
            };
        }
        const summary = calculateTemperatureStats(readings);
        const violations = readings.filter(r => r.isOutOfRange);
        const rapidChanges = detectRapidChange(readings);
        return {
            isCompliant: violations.length === 0 && rapidChanges.length === 0,
            summary,
            violations,
            rapidChanges,
        };
    }
    getThresholdsForCrop(variety) {
        const upperVariety = variety.toUpperCase();
        return DEFAULT_THRESHOLDS[upperVariety] || DEFAULT_THRESHOLDS.DEFAULT;
    }
}
