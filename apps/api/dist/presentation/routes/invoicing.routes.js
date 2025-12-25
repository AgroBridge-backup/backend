import { Router } from 'express';
import { z } from 'zod';
import { PrismaInvoiceRepository } from '../../infrastructure/database/prisma/repositories/PrismaInvoiceRepository.js';
import { CreateInvoiceUseCase, GetInvoiceUseCase, ListProducerInvoicesUseCase, MarkInvoicePaidUseCase, } from '../../application/use-cases/invoicing/index.js';
import { InvoiceStatus } from '../../domain/entities/Invoice.js';
import { authenticate } from '../middlewares/auth.middleware.js';
import { RateLimiterConfig } from '../../infrastructure/http/middleware/rate-limiter.middleware.js';
import { logger } from '../../infrastructure/logging/logger.js';
const createInvoiceSchema = z.object({
    producerId: z.string().uuid().optional(),
    batchId: z.string().uuid().optional(),
    recipientRfc: z.string().min(12).max(13),
    recipientName: z.string().min(1).max(255),
    recipientEmail: z.string().email().optional(),
    lineItems: z.array(z.object({
        description: z.string().min(1),
        quantity: z.number().positive(),
        unitPrice: z.number().positive(),
        unit: z.string().default('PZA'),
        productKey: z.string().default('01010101'),
    })).min(1),
    notes: z.string().optional(),
    currency: z.enum(['MXN', 'USD']).default('MXN'),
    ivaRate: z.number().min(0).max(100).default(16),
});
const markPaidSchema = z.object({
    blockchainTxHash: z.string().optional(),
    paidAt: z.string().datetime().optional(),
});
const listInvoicesSchema = z.object({
    status: z.nativeEnum(InvoiceStatus).optional(),
    fromDate: z.string().datetime().optional(),
    toDate: z.string().datetime().optional(),
    limit: z.coerce.number().int().positive().max(100).default(50),
    offset: z.coerce.number().int().nonnegative().default(0),
});
export default function createInvoicingRouter(prisma) {
    const router = Router();
    const invoiceRepository = new PrismaInvoiceRepository(prisma);
    const createInvoiceUseCase = new CreateInvoiceUseCase(invoiceRepository);
    const getInvoiceUseCase = new GetInvoiceUseCase(invoiceRepository);
    const listProducerInvoicesUseCase = new ListProducerInvoicesUseCase(invoiceRepository);
    const markInvoicePaidUseCase = new MarkInvoicePaidUseCase(invoiceRepository);
    router.post('/', authenticate(['PRODUCER', 'ADMIN']), RateLimiterConfig.creation(), async (req, res, next) => {
        try {
            const validation = createInvoiceSchema.safeParse(req.body);
            if (!validation.success) {
                return res.status(400).json({
                    success: false,
                    error: 'Validation error',
                    details: validation.error.errors,
                });
            }
            const userId = req.user?.userId;
            if (!userId) {
                return res.status(401).json({
                    success: false,
                    error: 'Authentication required',
                });
            }
            const result = await createInvoiceUseCase.execute({
                userId,
                ...validation.data,
            });
            logger.info('Invoice created via API', {
                invoiceId: result.invoice.id,
                userId,
            });
            res.status(201).json({
                success: true,
                data: result.invoice,
                message: result.message,
            });
        }
        catch (error) {
            next(error);
        }
    });
    router.get('/producer/me', authenticate(), RateLimiterConfig.api(), async (req, res, next) => {
        try {
            const validation = listInvoicesSchema.safeParse(req.query);
            if (!validation.success) {
                return res.status(400).json({
                    success: false,
                    error: 'Validation error',
                    details: validation.error.errors,
                });
            }
            const userId = req.user?.userId;
            if (!userId) {
                return res.status(401).json({
                    success: false,
                    error: 'Authentication required',
                });
            }
            const result = await listProducerInvoicesUseCase.execute({
                userId,
                status: validation.data.status,
                fromDate: validation.data.fromDate ? new Date(validation.data.fromDate) : undefined,
                toDate: validation.data.toDate ? new Date(validation.data.toDate) : undefined,
                limit: validation.data.limit,
                offset: validation.data.offset,
            });
            res.json({
                success: true,
                data: result.invoices,
                meta: {
                    total: result.total,
                    limit: validation.data.limit,
                    offset: validation.data.offset,
                },
            });
        }
        catch (error) {
            next(error);
        }
    });
    router.get('/:id', authenticate(), RateLimiterConfig.api(), async (req, res, next) => {
        try {
            const { id } = req.params;
            const userId = req.user?.userId;
            if (!userId) {
                return res.status(401).json({
                    success: false,
                    error: 'Authentication required',
                });
            }
            const result = await getInvoiceUseCase.execute({
                invoiceId: id,
                userId,
            });
            res.json({
                success: true,
                data: result.invoice,
            });
        }
        catch (error) {
            next(error);
        }
    });
    router.post('/:id/mark-paid', authenticate(['PRODUCER', 'ADMIN']), RateLimiterConfig.api(), async (req, res, next) => {
        try {
            const { id } = req.params;
            const validation = markPaidSchema.safeParse(req.body);
            if (!validation.success) {
                return res.status(400).json({
                    success: false,
                    error: 'Validation error',
                    details: validation.error.errors,
                });
            }
            const userId = req.user?.userId;
            if (!userId) {
                return res.status(401).json({
                    success: false,
                    error: 'Authentication required',
                });
            }
            const result = await markInvoicePaidUseCase.execute({
                invoiceId: id,
                userId,
                blockchainTxHash: validation.data.blockchainTxHash,
                paidAt: validation.data.paidAt ? new Date(validation.data.paidAt) : undefined,
            });
            logger.info('Invoice marked as paid via API', {
                invoiceId: id,
                userId,
            });
            res.json({
                success: true,
                data: result.invoice,
                message: result.message,
            });
        }
        catch (error) {
            next(error);
        }
    });
    return router;
}
