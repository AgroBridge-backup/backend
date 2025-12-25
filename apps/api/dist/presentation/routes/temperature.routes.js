import { Router } from 'express';
import { z } from 'zod';
import { TemperatureMonitoringService } from '../../domain/services/TemperatureMonitoringService.js';
import { PrismaTemperatureReadingRepository } from '../../infrastructure/database/prisma/repositories/PrismaTemperatureReadingRepository.js';
import { RecordTemperatureUseCase } from '../../application/use-cases/temperature/RecordTemperatureUseCase.js';
import { RecordBatchTemperaturesUseCase } from '../../application/use-cases/temperature/RecordBatchTemperaturesUseCase.js';
import { GetTemperatureSummaryUseCase } from '../../application/use-cases/temperature/GetTemperatureSummaryUseCase.js';
import { GetTemperatureReadingsUseCase } from '../../application/use-cases/temperature/GetTemperatureReadingsUseCase.js';
import { GetLatestTemperatureUseCase } from '../../application/use-cases/temperature/GetLatestTemperatureUseCase.js';
import { CheckComplianceUseCase } from '../../application/use-cases/temperature/CheckComplianceUseCase.js';
import { TemperatureSource } from '../../domain/entities/TemperatureReading.js';
import { authenticate } from '../middlewares/auth.middleware.js';
import { AppError } from '../../shared/errors/AppError.js';
import logger from '../../shared/utils/logger.js';
const router = Router();
const recordTemperatureSchema = z.object({
    batchId: z.string().uuid(),
    value: z.number().min(-50).max(60),
    humidity: z.number().min(0).max(100).optional(),
    source: z.nativeEnum(TemperatureSource),
    sensorId: z.string().optional(),
    deviceId: z.string().optional(),
    latitude: z.number().min(-90).max(90).optional(),
    longitude: z.number().min(-180).max(180).optional(),
});
const recordBatchTemperaturesSchema = z.object({
    readings: z.array(z.object({
        batchId: z.string().uuid(),
        value: z.number().min(-50).max(60),
        humidity: z.number().min(0).max(100).optional(),
        source: z.nativeEnum(TemperatureSource),
        sensorId: z.string().optional(),
        deviceId: z.string().optional(),
        latitude: z.number().min(-90).max(90).optional(),
        longitude: z.number().min(-180).max(180).optional(),
    })).min(1).max(1000),
});
export function createTemperatureRoutes(prisma) {
    const temperatureRepository = new PrismaTemperatureReadingRepository(prisma);
    const temperatureService = new TemperatureMonitoringService(prisma, temperatureRepository);
    const recordTemperatureUseCase = new RecordTemperatureUseCase(temperatureService);
    const recordBatchTemperaturesUseCase = new RecordBatchTemperaturesUseCase(temperatureService);
    const getTemperatureSummaryUseCase = new GetTemperatureSummaryUseCase(prisma, temperatureService);
    const getTemperatureReadingsUseCase = new GetTemperatureReadingsUseCase(prisma, temperatureService);
    const getLatestTemperatureUseCase = new GetLatestTemperatureUseCase(prisma, temperatureService);
    const checkComplianceUseCase = new CheckComplianceUseCase(prisma, temperatureService);
    router.post('/', authenticate(['DRIVER', 'QA', 'ADMIN']), async (req, res, next) => {
        try {
            const validatedData = recordTemperatureSchema.parse(req.body);
            const result = await recordTemperatureUseCase.execute({
                ...validatedData,
                recordedBy: req.user?.id,
            });
            logger.info('Temperature recorded via API', {
                readingId: result.reading.id,
                batchId: validatedData.batchId,
                userId: req.user?.id,
            });
            res.status(201).json({
                success: true,
                data: result,
            });
        }
        catch (error) {
            next(error);
        }
    });
    router.post('/batch', authenticate(['DRIVER', 'QA', 'ADMIN']), async (req, res, next) => {
        try {
            const validatedData = recordBatchTemperaturesSchema.parse(req.body);
            const result = await recordBatchTemperaturesUseCase.execute({
                readings: validatedData.readings,
            });
            logger.info('Batch temperatures recorded via API', {
                count: result.count,
                outOfRangeCount: result.outOfRangeCount,
                userId: req.user?.id,
            });
            res.status(201).json({
                success: true,
                data: result,
            });
        }
        catch (error) {
            next(error);
        }
    });
    router.get('/:batchId/summary', authenticate(), async (req, res, next) => {
        try {
            const { batchId } = req.params;
            if (!batchId || !z.string().uuid().safeParse(batchId).success) {
                throw new AppError('Invalid batch ID', 400);
            }
            const summary = await getTemperatureSummaryUseCase.execute({ batchId });
            res.json({
                success: true,
                data: summary,
            });
        }
        catch (error) {
            next(error);
        }
    });
    router.get('/:batchId/readings', authenticate(), async (req, res, next) => {
        try {
            const { batchId } = req.params;
            const { limit, startTime, endTime } = req.query;
            if (!batchId || !z.string().uuid().safeParse(batchId).success) {
                throw new AppError('Invalid batch ID', 400);
            }
            const result = await getTemperatureReadingsUseCase.execute({
                batchId,
                limit: limit ? parseInt(limit, 10) : undefined,
                startTime: startTime ? new Date(startTime) : undefined,
                endTime: endTime ? new Date(endTime) : undefined,
            });
            res.json({
                success: true,
                data: result,
            });
        }
        catch (error) {
            next(error);
        }
    });
    router.get('/:batchId/latest', authenticate(), async (req, res, next) => {
        try {
            const { batchId } = req.params;
            if (!batchId || !z.string().uuid().safeParse(batchId).success) {
                throw new AppError('Invalid batch ID', 400);
            }
            const reading = await getLatestTemperatureUseCase.execute({ batchId });
            res.json({
                success: true,
                data: reading,
            });
        }
        catch (error) {
            next(error);
        }
    });
    router.get('/:batchId/compliance', authenticate(['QA', 'CERTIFIER', 'ADMIN']), async (req, res, next) => {
        try {
            const { batchId } = req.params;
            if (!batchId || !z.string().uuid().safeParse(batchId).success) {
                throw new AppError('Invalid batch ID', 400);
            }
            const result = await checkComplianceUseCase.execute({ batchId });
            res.json({
                success: true,
                data: result,
            });
        }
        catch (error) {
            next(error);
        }
    });
    router.get('/:batchId/chart', authenticate(), async (req, res, next) => {
        try {
            const { batchId } = req.params;
            const { startTime, endTime, hours } = req.query;
            if (!batchId || !z.string().uuid().safeParse(batchId).success) {
                throw new AppError('Invalid batch ID', 400);
            }
            let start;
            let end;
            if (startTime && endTime) {
                start = new Date(startTime);
                end = new Date(endTime);
            }
            else {
                const hoursBack = hours ? parseInt(hours, 10) : 24;
                end = new Date();
                start = new Date(Date.now() - hoursBack * 60 * 60 * 1000);
            }
            const result = await getTemperatureReadingsUseCase.execute({
                batchId,
                startTime: start,
                endTime: end,
            });
            res.json({
                success: true,
                data: result.chartData || {
                    labels: [],
                    values: [],
                    thresholdMin: 0,
                    thresholdMax: 8,
                    outOfRangeIndices: [],
                },
            });
        }
        catch (error) {
            next(error);
        }
    });
    router.get('/:batchId/out-of-range', authenticate(['QA', 'CERTIFIER', 'ADMIN']), async (req, res, next) => {
        try {
            const { batchId } = req.params;
            if (!batchId || !z.string().uuid().safeParse(batchId).success) {
                throw new AppError('Invalid batch ID', 400);
            }
            const violations = await temperatureService.getOutOfRangeReadings(batchId);
            res.json({
                success: true,
                data: violations,
            });
        }
        catch (error) {
            next(error);
        }
    });
    return router;
}
export default router;
