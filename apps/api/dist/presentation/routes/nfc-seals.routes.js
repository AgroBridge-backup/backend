import { Router } from 'express';
import { z } from 'zod';
import { NfcSealService } from '../../domain/services/NfcSealService.js';
import { PrismaNfcSealRepository } from '../../infrastructure/database/prisma/repositories/PrismaNfcSealRepository.js';
import { ProvisionNfcSealUseCase } from '../../application/use-cases/nfc-seals/ProvisionNfcSealUseCase.js';
import { AttachNfcSealUseCase } from '../../application/use-cases/nfc-seals/AttachNfcSealUseCase.js';
import { VerifyNfcSealUseCase } from '../../application/use-cases/nfc-seals/VerifyNfcSealUseCase.js';
import { authenticate } from '../middlewares/auth.middleware.js';
import { AppError } from '../../shared/errors/AppError.js';
import logger from '../../shared/utils/logger.js';
const router = Router();
const provisionSealSchema = z.object({
    serialNumber: z.string().min(8).max(14).regex(/^[0-9A-Fa-f]+$/),
    expiresAt: z.string().datetime().optional().transform(val => val ? new Date(val) : undefined),
});
const provisionBatchSchema = z.object({
    seals: z.array(z.object({
        serialNumber: z.string().min(8).max(14).regex(/^[0-9A-Fa-f]+$/),
        expiresAt: z.string().datetime().optional().transform(val => val ? new Date(val) : undefined),
    })).min(1).max(100),
});
const attachSealSchema = z.object({
    batchId: z.string().uuid(),
    location: z.string().optional(),
    latitude: z.number().min(-90).max(90).optional(),
    longitude: z.number().min(-180).max(180).optional(),
});
const verifySealSchema = z.object({
    serialNumber: z.string().min(8).max(14),
    signature: z.string().min(1),
    readCounter: z.number().int().min(0),
    location: z.string().optional(),
    latitude: z.number().min(-90).max(90).optional(),
    longitude: z.number().min(-180).max(180).optional(),
    deviceInfo: z.string().optional(),
});
const removeSealSchema = z.object({
    location: z.string().optional(),
    latitude: z.number().min(-90).max(90).optional(),
    longitude: z.number().min(-180).max(180).optional(),
    reason: z.string().optional(),
});
const reportDamageSchema = z.object({
    description: z.string().min(10).max(500),
});
export function createNfcSealsRouter(prisma) {
    const sealRepository = new PrismaNfcSealRepository(prisma);
    const sealService = new NfcSealService(prisma, sealRepository);
    const provisionSealUseCase = new ProvisionNfcSealUseCase(sealService);
    const attachSealUseCase = new AttachNfcSealUseCase(sealService);
    const verifySealUseCase = new VerifyNfcSealUseCase(sealService);
    router.post('/', authenticate(['ADMIN']), async (req, res, next) => {
        try {
            const validatedData = provisionSealSchema.parse(req.body);
            const result = await provisionSealUseCase.execute({
                serialNumber: validatedData.serialNumber,
                expiresAt: validatedData.expiresAt,
            });
            logger.info('NFC seal provisioned via API', {
                sealId: result.seal.id,
                serialNumber: result.seal.serialNumber,
                userId: req.user?.id,
            });
            res.status(201).json({
                success: true,
                data: {
                    seal: result.seal,
                    publicKey: result.publicKey,
                },
            });
        }
        catch (error) {
            next(error);
        }
    });
    router.post('/batch', authenticate(['ADMIN']), async (req, res, next) => {
        try {
            const validatedData = provisionBatchSchema.parse(req.body);
            const results = await sealService.provisionSeals(validatedData.seals);
            logger.info('Batch NFC seal provisioning via API', {
                count: results.length,
                userId: req.user?.id,
            });
            res.status(201).json({
                success: true,
                data: {
                    count: results.length,
                    seals: results.map(r => ({
                        seal: r.seal,
                        publicKey: r.publicKey,
                    })),
                },
            });
        }
        catch (error) {
            next(error);
        }
    });
    router.get('/available', authenticate(['ADMIN', 'QA']), async (req, res, next) => {
        try {
            const seals = await sealService.getAvailableSeals();
            res.json({
                success: true,
                data: seals,
            });
        }
        catch (error) {
            next(error);
        }
    });
    router.get('/stats', authenticate(['ADMIN']), async (req, res, next) => {
        try {
            const stats = await sealService.getSealStats();
            res.json({
                success: true,
                data: stats,
            });
        }
        catch (error) {
            next(error);
        }
    });
    router.get('/:sealId', authenticate(), async (req, res, next) => {
        try {
            const { sealId } = req.params;
            if (!sealId || !z.string().uuid().safeParse(sealId).success) {
                throw new AppError('Invalid seal ID', 400);
            }
            const seal = await sealService.getSeal(sealId);
            if (!seal) {
                throw new AppError('NFC seal not found', 404);
            }
            res.json({
                success: true,
                data: seal,
            });
        }
        catch (error) {
            next(error);
        }
    });
    router.get('/serial/:serialNumber', authenticate(), async (req, res, next) => {
        try {
            const { serialNumber } = req.params;
            const seal = await sealService.getSealBySerialNumber(serialNumber.toUpperCase());
            if (!seal) {
                throw new AppError('NFC seal not found', 404);
            }
            res.json({
                success: true,
                data: seal,
            });
        }
        catch (error) {
            next(error);
        }
    });
    router.post('/:sealId/attach', authenticate(['ADMIN', 'QA', 'DRIVER']), async (req, res, next) => {
        try {
            const { sealId } = req.params;
            if (!sealId || !z.string().uuid().safeParse(sealId).success) {
                throw new AppError('Invalid seal ID', 400);
            }
            const validatedData = attachSealSchema.parse(req.body);
            const seal = await attachSealUseCase.execute({
                sealId,
                batchId: validatedData.batchId,
                attachedBy: req.user.userId,
                location: validatedData.location,
                latitude: validatedData.latitude,
                longitude: validatedData.longitude,
            });
            logger.info('NFC seal attached via API', {
                sealId: seal.id,
                batchId: validatedData.batchId,
                userId: req.user?.id,
            });
            res.json({
                success: true,
                data: seal,
            });
        }
        catch (error) {
            next(error);
        }
    });
    router.post('/verify', authenticate(['ADMIN', 'QA', 'DRIVER', 'EXPORTER']), async (req, res, next) => {
        try {
            const validatedData = verifySealSchema.parse(req.body);
            const result = await verifySealUseCase.execute({
                serialNumber: validatedData.serialNumber,
                signature: validatedData.signature,
                readCounter: validatedData.readCounter,
                verifiedBy: req.user.userId,
                location: validatedData.location,
                latitude: validatedData.latitude,
                longitude: validatedData.longitude,
                deviceInfo: validatedData.deviceInfo,
            });
            logger.info('NFC seal verification via API', {
                sealId: result.seal.id,
                serialNumber: validatedData.serialNumber,
                isValid: result.isValid,
                userId: req.user?.id,
            });
            res.json({
                success: true,
                data: {
                    seal: result.seal,
                    verification: result.verification,
                    isValid: result.isValid,
                    tamperIndicator: result.tamperIndicator,
                    integrityScore: result.integrityScore,
                    nextChallenge: result.nextChallenge,
                },
            });
        }
        catch (error) {
            next(error);
        }
    });
    router.post('/:sealId/remove', authenticate(['ADMIN', 'QA', 'DRIVER']), async (req, res, next) => {
        try {
            const { sealId } = req.params;
            if (!sealId || !z.string().uuid().safeParse(sealId).success) {
                throw new AppError('Invalid seal ID', 400);
            }
            const validatedData = removeSealSchema.parse(req.body);
            const seal = await sealService.removeSeal({
                sealId,
                removedBy: req.user.userId,
                location: validatedData.location,
                latitude: validatedData.latitude,
                longitude: validatedData.longitude,
                reason: validatedData.reason,
            });
            logger.info('NFC seal removed via API', {
                sealId: seal.id,
                userId: req.user?.id,
            });
            res.json({
                success: true,
                data: seal,
            });
        }
        catch (error) {
            next(error);
        }
    });
    router.get('/:sealId/verifications', authenticate(), async (req, res, next) => {
        try {
            const { sealId } = req.params;
            if (!sealId || !z.string().uuid().safeParse(sealId).success) {
                throw new AppError('Invalid seal ID', 400);
            }
            const verifications = await sealService.getVerificationHistory(sealId);
            res.json({
                success: true,
                data: verifications,
            });
        }
        catch (error) {
            next(error);
        }
    });
    router.post('/:sealId/report-damage', authenticate(['ADMIN', 'QA', 'DRIVER']), async (req, res, next) => {
        try {
            const { sealId } = req.params;
            if (!sealId || !z.string().uuid().safeParse(sealId).success) {
                throw new AppError('Invalid seal ID', 400);
            }
            const validatedData = reportDamageSchema.parse(req.body);
            const seal = await sealService.reportPhysicalDamage(sealId, req.user.userId, validatedData.description);
            logger.warn('Physical damage reported for NFC seal via API', {
                sealId: seal.id,
                userId: req.user?.id,
            });
            res.json({
                success: true,
                data: seal,
            });
        }
        catch (error) {
            next(error);
        }
    });
    router.get('/:sealId/challenge', authenticate(['ADMIN']), async (req, res, next) => {
        try {
            const { sealId } = req.params;
            const seal = await sealService.getSeal(sealId);
            if (!seal) {
                throw new AppError('NFC seal not found', 404);
            }
            res.json({
                success: true,
                data: {
                    sealId: seal.id,
                    serialNumber: seal.serialNumber,
                    challenge: seal.challenge,
                    expectedReadCount: seal.expectedReadCount,
                },
            });
        }
        catch (error) {
            next(error);
        }
    });
    router.get('/batches/:batchId/nfc-seals', authenticate(), async (req, res, next) => {
        try {
            const { batchId } = req.params;
            if (!batchId || !z.string().uuid().safeParse(batchId).success) {
                throw new AppError('Invalid batch ID', 400);
            }
            const seals = await sealService.getBatchSeals(batchId);
            res.json({
                success: true,
                data: seals,
            });
        }
        catch (error) {
            next(error);
        }
    });
    router.get('/batches/:batchId/nfc-seals/integrity', authenticate(['QA', 'CERTIFIER', 'ADMIN']), async (req, res, next) => {
        try {
            const { batchId } = req.params;
            if (!batchId || !z.string().uuid().safeParse(batchId).success) {
                throw new AppError('Invalid batch ID', 400);
            }
            const summary = await sealService.getBatchIntegritySummary(batchId);
            res.json({
                success: true,
                data: summary,
            });
        }
        catch (error) {
            next(error);
        }
    });
    return router;
}
export default router;
