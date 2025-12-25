import { Router } from 'express';
import { z } from 'zod';
import { SatelliteImageryService } from '../../domain/services/SatelliteImageryService.js';
import { PrismaFieldRepository, PrismaFieldImageryRepository } from '../../infrastructure/database/prisma/repositories/PrismaFieldImageryRepository.js';
import { FieldStatus, ImageryType } from '../../domain/entities/FieldImagery.js';
import { authenticate } from '../middlewares/auth.middleware.js';
import { AppError } from '../../shared/errors/AppError.js';
import logger from '../../shared/utils/logger.js';
const router = Router();
const createFieldSchema = z.object({
    name: z.string().min(1).max(100),
    description: z.string().optional(),
    cropType: z.string().optional(),
    varietyName: z.string().optional(),
    plantingDate: z.string().datetime().optional().transform(val => val ? new Date(val) : undefined),
    expectedHarvestDate: z.string().datetime().optional().transform(val => val ? new Date(val) : undefined),
    areaHectares: z.number().positive().optional(),
    boundaryGeoJson: z.object({
        type: z.literal('Polygon'),
        coordinates: z.array(z.array(z.array(z.number()))),
    }),
    altitude: z.number().optional(),
    soilType: z.string().optional(),
    irrigationType: z.string().optional(),
});
const updateFieldSchema = z.object({
    name: z.string().min(1).max(100).optional(),
    description: z.string().optional(),
    status: z.nativeEnum(FieldStatus).optional(),
    cropType: z.string().optional(),
    varietyName: z.string().optional(),
    plantingDate: z.string().datetime().optional().transform(val => val ? new Date(val) : undefined),
    expectedHarvestDate: z.string().datetime().optional().transform(val => val ? new Date(val) : undefined),
});
const timeLapseQuerySchema = z.object({
    startDate: z.string().datetime().transform(val => new Date(val)),
    endDate: z.string().datetime().transform(val => new Date(val)),
    imageType: z.nativeEnum(ImageryType).optional().default(ImageryType.NDVI),
    maxCloudCover: z.string().transform(val => parseInt(val, 10)).pipe(z.number().min(0).max(100)).optional().default(30),
});
export function createSatelliteImageryRouter(prisma) {
    const fieldRepository = new PrismaFieldRepository(prisma);
    const imageryRepository = new PrismaFieldImageryRepository(prisma);
    const imageryService = new SatelliteImageryService(prisma, fieldRepository, imageryRepository);
    router.post('/fields', authenticate(['PRODUCER', 'ADMIN']), async (req, res, next) => {
        try {
            const validatedData = createFieldSchema.parse(req.body);
            const userProducerId = req.user?.producerId;
            const requestedProducerId = req.body.producerId;
            if (req.user?.role !== 'ADMIN' && requestedProducerId && requestedProducerId !== userProducerId) {
                throw new AppError('Cannot create field for another producer', 403);
            }
            const producerId = requestedProducerId || userProducerId;
            if (!producerId) {
                throw new AppError('Producer ID is required', 400);
            }
            const result = await imageryService.createField({
                producerId,
                ...validatedData,
                boundaryGeoJson: validatedData.boundaryGeoJson,
            });
            logger.info('Field created via API', {
                fieldId: result.field.id,
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
    router.get('/fields/:fieldId', authenticate(), async (req, res, next) => {
        try {
            const { fieldId } = req.params;
            if (!fieldId || !z.string().uuid().safeParse(fieldId).success) {
                throw new AppError('Invalid field ID', 400);
            }
            const field = await imageryService.getField(fieldId);
            if (!field) {
                throw new AppError('Field not found', 404);
            }
            res.json({
                success: true,
                data: field,
            });
        }
        catch (error) {
            next(error);
        }
    });
    router.get('/producers/:producerId/fields', authenticate(), async (req, res, next) => {
        try {
            const { producerId } = req.params;
            if (!producerId || !z.string().uuid().safeParse(producerId).success) {
                throw new AppError('Invalid producer ID', 400);
            }
            const fields = await imageryService.getProducerFields(producerId);
            res.json({
                success: true,
                data: fields,
            });
        }
        catch (error) {
            next(error);
        }
    });
    router.patch('/fields/:fieldId', authenticate(['PRODUCER', 'ADMIN']), async (req, res, next) => {
        try {
            const { fieldId } = req.params;
            if (!fieldId || !z.string().uuid().safeParse(fieldId).success) {
                throw new AppError('Invalid field ID', 400);
            }
            const validatedData = updateFieldSchema.parse(req.body);
            const field = await fieldRepository.update(fieldId, validatedData);
            res.json({
                success: true,
                data: field,
            });
        }
        catch (error) {
            next(error);
        }
    });
    router.get('/fields/:fieldId/imagery', authenticate(), async (req, res, next) => {
        try {
            const { fieldId } = req.params;
            const { startDate, endDate } = req.query;
            if (!fieldId || !z.string().uuid().safeParse(fieldId).success) {
                throw new AppError('Invalid field ID', 400);
            }
            const imagery = await imageryService.getFieldImagery(fieldId, startDate ? new Date(startDate) : undefined, endDate ? new Date(endDate) : undefined);
            res.json({
                success: true,
                data: imagery,
            });
        }
        catch (error) {
            next(error);
        }
    });
    router.get('/fields/:fieldId/imagery/latest', authenticate(), async (req, res, next) => {
        try {
            const { fieldId } = req.params;
            if (!fieldId || !z.string().uuid().safeParse(fieldId).success) {
                throw new AppError('Invalid field ID', 400);
            }
            const imagery = await imageryService.getLatestImagery(fieldId);
            res.json({
                success: true,
                data: imagery,
            });
        }
        catch (error) {
            next(error);
        }
    });
    router.get('/fields/:fieldId/time-lapse', authenticate(), async (req, res, next) => {
        try {
            const { fieldId } = req.params;
            if (!fieldId || !z.string().uuid().safeParse(fieldId).success) {
                throw new AppError('Invalid field ID', 400);
            }
            const query = timeLapseQuerySchema.parse(req.query);
            const result = await imageryService.generateTimeLapse(fieldId, query.startDate, query.endDate, query.imageType, query.maxCloudCover);
            res.json({
                success: true,
                data: result,
            });
        }
        catch (error) {
            next(error);
        }
    });
    router.get('/fields/:fieldId/health', authenticate(), async (req, res, next) => {
        try {
            const { fieldId } = req.params;
            if (!fieldId || !z.string().uuid().safeParse(fieldId).success) {
                throw new AppError('Invalid field ID', 400);
            }
            const analysis = await imageryService.analyzeFieldHealth(fieldId);
            res.json({
                success: true,
                data: analysis,
            });
        }
        catch (error) {
            next(error);
        }
    });
    router.get('/fields/:fieldId/ndvi-series', authenticate(), async (req, res, next) => {
        try {
            const { fieldId } = req.params;
            const { startDate, endDate, days } = req.query;
            if (!fieldId || !z.string().uuid().safeParse(fieldId).success) {
                throw new AppError('Invalid field ID', 400);
            }
            let start;
            let end;
            if (startDate && endDate) {
                start = new Date(startDate);
                end = new Date(endDate);
            }
            else {
                const daysBack = days ? parseInt(days) : 90;
                end = new Date();
                start = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000);
            }
            const series = await imageryService.getNdviTimeSeries(fieldId, start, end);
            res.json({
                success: true,
                data: {
                    fieldId,
                    startDate: start,
                    endDate: end,
                    series,
                },
            });
        }
        catch (error) {
            next(error);
        }
    });
    router.get('/fields/:fieldId/stats', authenticate(), async (req, res, next) => {
        try {
            const { fieldId } = req.params;
            if (!fieldId || !z.string().uuid().safeParse(fieldId).success) {
                throw new AppError('Invalid field ID', 400);
            }
            const stats = await imageryService.getFieldStats(fieldId);
            res.json({
                success: true,
                data: stats,
            });
        }
        catch (error) {
            next(error);
        }
    });
    router.post('/fields/:fieldId/link-batch', authenticate(['PRODUCER', 'ADMIN']), async (req, res, next) => {
        try {
            const { fieldId } = req.params;
            const { batchId } = req.body;
            if (!fieldId || !z.string().uuid().safeParse(fieldId).success) {
                throw new AppError('Invalid field ID', 400);
            }
            if (!batchId || !z.string().uuid().safeParse(batchId).success) {
                throw new AppError('Invalid batch ID', 400);
            }
            await imageryService.linkFieldToBatch(fieldId, batchId);
            res.json({
                success: true,
                message: 'Field linked to batch successfully',
            });
        }
        catch (error) {
            next(error);
        }
    });
    return router;
}
export default router;
