import { Router } from 'express';
import { QueryBuilder } from '../../../infrastructure/http/QueryBuilder.js';
import { ResponseFormatter } from '../../../infrastructure/http/ResponseFormatter.js';
import { authenticate } from '../../middlewares/auth.middleware.js';
import { prisma } from '../../../infrastructure/database/prisma/client.js';
import logger from '../../../shared/utils/logger.js';
const router = Router();
router.get('/', authenticate(), async (req, res, next) => {
    try {
        const user = req.user;
        if (user.role !== 'ADMIN' && user.role !== 'CERTIFIER') {
            return res.status(403).json(ResponseFormatter.forbidden('Access denied', req.path));
        }
        const queryOptions = QueryBuilder.parse(req.query);
        const validationErrors = QueryBuilder.validate(queryOptions, 'Producer');
        if (validationErrors.length > 0) {
            return res.status(400).json(ResponseFormatter.validationError(validationErrors.map((msg) => ({ field: 'query', message: msg })), req.path));
        }
        const prismaQuery = QueryBuilder.applyToPrismaQuery('Producer', queryOptions);
        const total = await prisma.producer.count({
            where: prismaQuery.where,
        });
        const producers = await prisma.producer.findMany({
            where: prismaQuery.where,
            ...(prismaQuery.select
                ? { select: prismaQuery.select }
                : prismaQuery.include
                    ? { include: prismaQuery.include }
                    : {}),
            orderBy: prismaQuery.orderBy || [{ createdAt: 'desc' }],
            skip: prismaQuery.skip,
            take: prismaQuery.take,
        });
        res.json(ResponseFormatter.paginated(producers, total, queryOptions.page, queryOptions.limit, '/api/v2/producers', req.query));
    }
    catch (error) {
        logger.error('[ProducersV2] List error:', error);
        next(error);
    }
});
router.get('/:id', authenticate(), async (req, res, next) => {
    try {
        const { id } = req.params;
        const user = req.user;
        const queryOptions = QueryBuilder.parse(req.query);
        const prismaQuery = QueryBuilder.applyToPrismaQuery('Producer', queryOptions);
        const producer = await prisma.producer.findUnique({
            where: { id },
            ...(prismaQuery.select
                ? { select: prismaQuery.select }
                : prismaQuery.include
                    ? { include: prismaQuery.include }
                    : {}),
        });
        if (!producer) {
            return res.status(404).json(ResponseFormatter.notFound('Producer', id, req.path));
        }
        const hasAccess = await checkProducerAccess(user, producer);
        if (!hasAccess) {
            return res.status(403).json(ResponseFormatter.forbidden('Access denied to this producer', req.path));
        }
        res.json(ResponseFormatter.success(producer));
    }
    catch (error) {
        logger.error('[ProducersV2] Get error:', error);
        next(error);
    }
});
router.get('/:id/batches', authenticate(), async (req, res, next) => {
    try {
        const { id } = req.params;
        const user = req.user;
        const producer = await prisma.producer.findUnique({
            where: { id },
            select: { id: true, userId: true },
        });
        if (!producer) {
            return res.status(404).json(ResponseFormatter.notFound('Producer', id, req.path));
        }
        const hasAccess = await checkProducerAccess(user, producer);
        if (!hasAccess) {
            return res.status(403).json(ResponseFormatter.forbidden('Access denied', req.path));
        }
        const queryOptions = QueryBuilder.parse(req.query);
        const prismaQuery = QueryBuilder.applyToPrismaQuery('Batch', queryOptions);
        prismaQuery.where = {
            ...prismaQuery.where,
            producerId: id,
        };
        const total = await prisma.batch.count({
            where: prismaQuery.where,
        });
        const batches = await prisma.batch.findMany({
            where: prismaQuery.where,
            select: prismaQuery.select,
            orderBy: prismaQuery.orderBy || [{ createdAt: 'desc' }],
            skip: prismaQuery.skip,
            take: prismaQuery.take,
        });
        res.json(ResponseFormatter.paginated(batches, total, queryOptions.page, queryOptions.limit, `/api/v2/producers/${id}/batches`, req.query));
    }
    catch (error) {
        logger.error('[ProducersV2] Get batches error:', error);
        next(error);
    }
});
router.get('/:id/stats', authenticate(), async (req, res, next) => {
    try {
        const { id } = req.params;
        const user = req.user;
        const producer = await prisma.producer.findUnique({
            where: { id },
            select: { id: true, userId: true, businessName: true },
        });
        if (!producer) {
            return res.status(404).json(ResponseFormatter.notFound('Producer', id, req.path));
        }
        const hasAccess = await checkProducerAccess(user, producer);
        if (!hasAccess) {
            return res.status(403).json(ResponseFormatter.forbidden('Access denied', req.path));
        }
        const [totalBatches, batchesByStatus, totalEvents, verifiedEvents, recentBatches,] = await Promise.all([
            prisma.batch.count({ where: { producerId: id } }),
            prisma.batch.groupBy({
                by: ['status'],
                where: { producerId: id },
                _count: true,
            }),
            prisma.traceabilityEvent.count({
                where: { batch: { producerId: id } },
            }),
            prisma.traceabilityEvent.count({
                where: { batch: { producerId: id }, isVerified: true },
            }),
            prisma.batch.findMany({
                where: { producerId: id },
                select: {
                    id: true,
                    origin: true,
                    variety: true,
                    status: true,
                    createdAt: true,
                },
                orderBy: { createdAt: 'desc' },
                take: 5,
            }),
        ]);
        const stats = {
            producer: {
                id: producer.id,
                businessName: producer.businessName,
            },
            batches: {
                total: totalBatches,
                byStatus: batchesByStatus.reduce((acc, item) => ({
                    ...acc,
                    [item.status]: item._count,
                }), {}),
            },
            events: {
                total: totalEvents,
                verified: verifiedEvents,
                verificationRate: totalEvents > 0
                    ? Math.round((verifiedEvents / totalEvents) * 100)
                    : 0,
            },
            recent: {
                batches: recentBatches,
            },
        };
        res.json(ResponseFormatter.success(stats));
    }
    catch (error) {
        logger.error('[ProducersV2] Get stats error:', error);
        next(error);
    }
});
async function checkProducerAccess(user, producer) {
    if (user.role === 'ADMIN' || user.role === 'CERTIFIER') {
        return true;
    }
    return producer.userId === user.userId;
}
export { router as producersV2Router };
export default router;
