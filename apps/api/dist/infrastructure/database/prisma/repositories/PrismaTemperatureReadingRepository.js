import { isTemperatureInRange, } from '../../../../domain/entities/TemperatureReading.js';
export class PrismaTemperatureReadingRepository {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    mapToDomain(reading) {
        return {
            id: reading.id,
            batchId: reading.batchId,
            value: Number(reading.value),
            humidity: reading.humidity ? Number(reading.humidity) : null,
            source: reading.source,
            minThreshold: Number(reading.minThreshold),
            maxThreshold: Number(reading.maxThreshold),
            isOutOfRange: reading.isOutOfRange,
            sensorId: reading.sensorId,
            deviceId: reading.deviceId,
            latitude: reading.latitude ? Number(reading.latitude) : null,
            longitude: reading.longitude ? Number(reading.longitude) : null,
            recordedBy: reading.recordedBy,
            timestamp: reading.timestamp,
        };
    }
    async findById(id) {
        const reading = await this.prisma.temperatureReading.findUnique({
            where: { id },
        });
        return reading ? this.mapToDomain(reading) : null;
    }
    async findByBatchId(batchId) {
        const readings = await this.prisma.temperatureReading.findMany({
            where: { batchId },
            orderBy: { timestamp: 'desc' },
        });
        return readings.map(this.mapToDomain);
    }
    async findByBatchIdPaginated(batchId, options) {
        const readings = await this.prisma.temperatureReading.findMany({
            where: { batchId },
            orderBy: { timestamp: options?.orderBy ?? 'desc' },
            take: options?.limit,
            skip: options?.offset,
        });
        return readings.map(this.mapToDomain);
    }
    async findByBatchIdAndTimeRange(batchId, startTime, endTime) {
        const readings = await this.prisma.temperatureReading.findMany({
            where: {
                batchId,
                timestamp: {
                    gte: startTime,
                    lte: endTime,
                },
            },
            orderBy: { timestamp: 'asc' },
        });
        return readings.map(this.mapToDomain);
    }
    async findOutOfRangeByBatchId(batchId) {
        const readings = await this.prisma.temperatureReading.findMany({
            where: {
                batchId,
                isOutOfRange: true,
            },
            orderBy: { timestamp: 'desc' },
        });
        return readings.map(this.mapToDomain);
    }
    async findBySensorId(sensorId) {
        const readings = await this.prisma.temperatureReading.findMany({
            where: { sensorId },
            orderBy: { timestamp: 'desc' },
        });
        return readings.map(this.mapToDomain);
    }
    async findLatestByBatchId(batchId) {
        const reading = await this.prisma.temperatureReading.findFirst({
            where: { batchId },
            orderBy: { timestamp: 'desc' },
        });
        return reading ? this.mapToDomain(reading) : null;
    }
    async create(input) {
        const minThreshold = input.minThreshold ?? 0;
        const maxThreshold = input.maxThreshold ?? 8;
        const isOutOfRange = !isTemperatureInRange(input.value, minThreshold, maxThreshold);
        const reading = await this.prisma.temperatureReading.create({
            data: {
                batchId: input.batchId,
                value: input.value,
                humidity: input.humidity,
                source: input.source,
                minThreshold,
                maxThreshold,
                isOutOfRange,
                sensorId: input.sensorId,
                deviceId: input.deviceId,
                latitude: input.latitude,
                longitude: input.longitude,
                recordedBy: input.recordedBy,
            },
        });
        return this.mapToDomain(reading);
    }
    async createMany(inputs) {
        const data = inputs.map(input => {
            const minThreshold = input.minThreshold ?? 0;
            const maxThreshold = input.maxThreshold ?? 8;
            return {
                batchId: input.batchId,
                value: input.value,
                humidity: input.humidity,
                source: input.source,
                minThreshold,
                maxThreshold,
                isOutOfRange: !isTemperatureInRange(input.value, minThreshold, maxThreshold),
                sensorId: input.sensorId,
                deviceId: input.deviceId,
                latitude: input.latitude,
                longitude: input.longitude,
                recordedBy: input.recordedBy,
            };
        });
        const result = await this.prisma.temperatureReading.createMany({ data });
        return result.count;
    }
    async countByBatchId(batchId) {
        return this.prisma.temperatureReading.count({
            where: { batchId },
        });
    }
    async countOutOfRangeByBatchId(batchId) {
        return this.prisma.temperatureReading.count({
            where: { batchId, isOutOfRange: true },
        });
    }
    async getStatsByBatchId(batchId) {
        const result = await this.prisma.temperatureReading.aggregate({
            where: { batchId },
            _min: { value: true },
            _max: { value: true },
            _avg: { value: true },
        });
        return {
            min: result._min.value ? Number(result._min.value) : null,
            max: result._max.value ? Number(result._max.value) : null,
            avg: result._avg.value ? Number(result._avg.value) : null,
        };
    }
    async deleteOlderThan(date) {
        const result = await this.prisma.temperatureReading.deleteMany({
            where: {
                timestamp: { lt: date },
            },
        });
        return result.count;
    }
}
