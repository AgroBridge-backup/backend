import { Router } from 'express';
import { z } from 'zod';
import { authenticate } from '../middlewares/auth.middleware.js';
import { validateRequest } from '../middlewares/validator.middleware.js';
import { UserRole, CertificateGrade } from '@prisma/client';
import { RateLimiterConfig } from '../../infrastructure/http/middleware/rate-limiter.middleware.js';
export function createCertificatesRouter(useCases) {
    const router = Router();
    const issueCertificateSchema = z.object({
        body: z.object({
            grade: z.nativeEnum(CertificateGrade),
            certifyingBody: z.string().min(1).max(255),
            validityDays: z.number().int().min(1).max(3650).optional(),
        }),
        params: z.object({
            id: z.string().uuid(),
        }),
    });
    const checkEligibilitySchema = z.object({
        params: z.object({
            id: z.string().uuid(),
        }),
        query: z.object({
            grade: z.nativeEnum(CertificateGrade),
        }),
    });
    const certificateIdSchema = z.object({
        params: z.object({
            certificateId: z.string().uuid(),
        }),
    });
    const listCertificatesSchema = z.object({
        params: z.object({
            id: z.string().uuid(),
        }),
        query: z.object({
            validOnly: z.string().optional().transform(val => val === 'true'),
        }),
    });
    router.post('/batches/:id/certificates', authenticate([UserRole.CERTIFIER, UserRole.ADMIN]), RateLimiterConfig.creation(), validateRequest(issueCertificateSchema), async (req, res, next) => {
        try {
            const result = await useCases.issueCertificateUseCase.execute({
                batchId: req.params.id,
                grade: req.body.grade,
                certifyingBody: req.body.certifyingBody,
                validityDays: req.body.validityDays,
                issuedBy: req.user.userId,
            });
            res.status(201).json({
                success: true,
                data: {
                    certificate: result.certificate,
                    hash: result.hash,
                    blockchainTxId: result.blockchainTxId,
                },
                message: result.blockchainTxId
                    ? 'Certificate issued and stored on blockchain.'
                    : 'Certificate issued. Blockchain storage pending.',
            });
        }
        catch (error) {
            next(error);
        }
    });
    router.get('/batches/:id/certificates', authenticate(), validateRequest(listCertificatesSchema), async (req, res, next) => {
        try {
            const certificates = await useCases.listBatchCertificatesUseCase.execute({
                batchId: req.params.id,
                validOnly: req.query.validOnly === 'true',
            });
            res.status(200).json({
                success: true,
                data: {
                    certificates,
                    count: certificates.length,
                },
            });
        }
        catch (error) {
            next(error);
        }
    });
    router.get('/batches/:id/certificates/eligibility', authenticate(), validateRequest(checkEligibilitySchema), async (req, res, next) => {
        try {
            const result = await useCases.checkCertificateEligibilityUseCase.execute({
                batchId: req.params.id,
                grade: req.query.grade,
            });
            res.status(200).json({
                success: true,
                data: result,
            });
        }
        catch (error) {
            next(error);
        }
    });
    router.get('/certificates/:certificateId', authenticate(), validateRequest(certificateIdSchema), async (req, res, next) => {
        try {
            const certificate = await useCases.getCertificateUseCase.execute({
                certificateId: req.params.certificateId,
            });
            res.status(200).json({
                success: true,
                data: certificate,
            });
        }
        catch (error) {
            next(error);
        }
    });
    router.get('/certificates/:certificateId/verify', RateLimiterConfig.api(), validateRequest(certificateIdSchema), async (req, res, next) => {
        try {
            const result = await useCases.verifyCertificateUseCase.execute({
                certificateId: req.params.certificateId,
            });
            res.status(200).json({
                success: true,
                data: {
                    isValid: result.isValid,
                    isExpired: result.isExpired,
                    message: result.message,
                    certificate: result.certificate
                        ? {
                            id: result.certificate.id,
                            batchId: result.certificate.batchId,
                            grade: result.certificate.grade,
                            certifyingBody: result.certificate.certifyingBody,
                            validFrom: result.certificate.validFrom,
                            validTo: result.certificate.validTo,
                            issuedAt: result.certificate.issuedAt,
                        }
                        : null,
                    verification: {
                        computedHash: result.computedHash,
                        storedHash: result.storedHash,
                        hashMatch: result.computedHash === result.storedHash,
                    },
                },
            });
        }
        catch (error) {
            next(error);
        }
    });
    return router;
}
export const certificatesRouter = Router();
certificatesRouter.all('*', (_req, res) => {
    res.status(501).json({
        message: 'Legacy certificates router deprecated. Use createCertificatesRouter().'
    });
});
