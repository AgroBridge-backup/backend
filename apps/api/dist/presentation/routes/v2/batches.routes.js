import { Router } from 'express';
import { QueryBuilder } from '../../../infrastructure/http/QueryBuilder.js';
import { ResponseFormatter } from '../../../infrastructure/http/ResponseFormatter.js';
import { authenticate } from '../../middlewares/auth.middleware.js';
import { prisma } from '../../../infrastructure/database/prisma/client.js';
import { redisClient } from '../../../infrastructure/cache/RedisClient.js';
import logger from '../../../shared/utils/logger.js';
const router = Router();
const LIST_CACHE_TTL = 300;
router.get('/', authenticate(), async (req, res, next) => {
    try {
        const user = req.user;
        const queryOptions = QueryBuilder.parse(req.query);
        const validationErrors = QueryBuilder.validate(queryOptions, 'Batch');
        if (validationErrors.length > 0) {
            return res.status(400).json(ResponseFormatter.validationError(validationErrors.map((msg) => ({ field: 'query', message: msg })), req.path));
        }
        const prismaQuery = QueryBuilder.applyToPrismaQuery('Batch', queryOptions);
        const roleFilter = await buildRoleBasedFilter(user);
        prismaQuery.where = {
            ...prismaQuery.where,
            ...roleFilter,
        };
        const cacheKey = buildCacheKey('batches:list', queryOptions, user);
        const cached = await tryGetFromCache(cacheKey);
        if (cached) {
            logger.debug('[BatchesV2] Cache hit', { cacheKey });
            return res.json(ResponseFormatter.paginated(cached.data, cached.total, queryOptions.page, queryOptions.limit, '/api/v2/batches', req.query));
        }
        const total = await prisma.batch.count({
            where: prismaQuery.where,
        });
        const batches = await prisma.batch.findMany({
            where: prismaQuery.where,
            ...(prismaQuery.select
                ? { select: prismaQuery.select }
                : prismaQuery.include
                    ? { include: prismaQuery.include }
                    : {}),
            orderBy: prismaQuery.orderBy,
            skip: prismaQuery.skip,
            take: prismaQuery.take,
        });
        await cacheResult(cacheKey, { data: batches, total }, LIST_CACHE_TTL);
        const response = ResponseFormatter.paginated(batches, total, queryOptions.page, queryOptions.limit, '/api/v2/batches', req.query);
        logger.debug('[BatchesV2] List request', {
            query: QueryBuilder.getSummary(queryOptions),
            total,
            returned: batches.length,
        });
        res.json(response);
    }
    catch (error) {
        logger.error('[BatchesV2] List error:', error);
        next(error);
    }
});
router.get('/:id', authenticate(), async (req, res, next) => {
    try {
        const { id } = req.params;
        const user = req.user;
        const queryOptions = QueryBuilder.parse(req.query);
        const prismaQuery = QueryBuilder.applyToPrismaQuery('Batch', queryOptions);
        const batch = await prisma.batch.findUnique({
            where: { id },
            ...(prismaQuery.select
                ? { select: prismaQuery.select }
                : prismaQuery.include
                    ? { include: prismaQuery.include }
                    : {}),
        });
        if (!batch) {
            return res.status(404).json(ResponseFormatter.notFound('Batch', id, req.path));
        }
        const hasAccess = await checkBatchAccess(user, batch);
        if (!hasAccess) {
            return res.status(403).json(ResponseFormatter.forbidden('Access denied to this batch', req.path));
        }
        res.json(ResponseFormatter.success(batch));
    }
    catch (error) {
        logger.error('[BatchesV2] Get error:', error);
        next(error);
    }
});
router.get('/:id/events', authenticate(), async (req, res, next) => {
    try {
        const { id } = req.params;
        const user = req.user;
        const batch = await prisma.batch.findUnique({
            where: { id },
            select: { id: true, producerId: true },
        });
        if (!batch) {
            return res.status(404).json(ResponseFormatter.notFound('Batch', id, req.path));
        }
        const hasAccess = await checkBatchAccess(user, batch);
        if (!hasAccess) {
            return res.status(403).json(ResponseFormatter.forbidden('Access denied to this batch', req.path));
        }
        const queryOptions = QueryBuilder.parse(req.query);
        const prismaQuery = QueryBuilder.applyToPrismaQuery('Event', queryOptions);
        prismaQuery.where = {
            ...prismaQuery.where,
            batchId: id,
        };
        const total = await prisma.traceabilityEvent.count({
            where: prismaQuery.where,
        });
        const events = await prisma.traceabilityEvent.findMany({
            where: prismaQuery.where,
            select: prismaQuery.select,
            orderBy: prismaQuery.orderBy || [{ timestamp: 'asc' }],
            skip: prismaQuery.skip,
            take: prismaQuery.take,
        });
        res.json(ResponseFormatter.paginated(events, total, queryOptions.page, queryOptions.limit, `/api/v2/batches/${id}/events`, req.query));
    }
    catch (error) {
        logger.error('[BatchesV2] Get events error:', error);
        next(error);
    }
});
router.get('/:id/timeline', authenticate(), async (req, res, next) => {
    try {
        const { id } = req.params;
        const user = req.user;
        const batch = await prisma.batch.findUnique({
            where: { id },
            select: {
                id: true,
                origin: true,
                variety: true,
                status: true,
                producerId: true,
                createdAt: true,
            },
        });
        if (!batch) {
            return res.status(404).json(ResponseFormatter.notFound('Batch', id, req.path));
        }
        const hasAccess = await checkBatchAccess(user, batch);
        if (!hasAccess) {
            return res.status(403).json(ResponseFormatter.forbidden('Access denied to this batch', req.path));
        }
        const events = await prisma.traceabilityEvent.findMany({
            where: { batchId: id },
            select: {
                id: true,
                eventType: true,
                timestamp: true,
                locationName: true,
                latitude: true,
                longitude: true,
                temperature: true,
                humidity: true,
                notes: true,
                isVerified: true,
                blockchainTxHash: true,
            },
            orderBy: { timestamp: 'asc' },
        });
        const timeline = {
            batch: {
                id: batch.id,
                origin: batch.origin,
                variety: batch.variety,
                status: batch.status,
                createdAt: batch.createdAt,
            },
            events: events.map((event, index) => ({
                ...event,
                order: index + 1,
                isFirst: index === 0,
                isLast: index === events.length - 1,
            })),
            summary: {
                totalEvents: events.length,
                verifiedEvents: events.filter((e) => e.isVerified).length,
                firstEvent: events[0]?.timestamp || null,
                lastEvent: events[events.length - 1]?.timestamp || null,
            },
        };
        res.json(ResponseFormatter.success(timeline));
    }
    catch (error) {
        logger.error('[BatchesV2] Get timeline error:', error);
        next(error);
    }
});
async function buildRoleBasedFilter(user) {
    if (user.role === 'ADMIN' || user.role === 'CERTIFIER') {
        return {};
    }
    if (user.role === 'PRODUCER') {
        const producer = await prisma.producer.findUnique({
            where: { userId: user.userId },
            select: { id: true },
        });
        if (producer) {
            return { producerId: producer.id };
        }
    }
    return { createdById: user.userId };
}
async function checkBatchAccess(user, batch) {
    if (user.role === 'ADMIN' || user.role === 'CERTIFIER') {
        return true;
    }
    if (user.role === 'PRODUCER' && batch.producerId) {
        const producer = await prisma.producer.findUnique({
            where: { userId: user.userId },
            select: { id: true },
        });
        return producer?.id === batch.producerId;
    }
    return false;
}
function buildCacheKey(prefix, options, user) {
    const parts = [
        prefix,
        `u:${user.userId}`,
        `r:${user.role}`,
        `p:${options.page}`,
        `l:${options.limit}`,
    ];
    if (options.filter) {
        parts.push(`f:${JSON.stringify(options.filter)}`);
    }
    if (options.sort) {
        parts.push(`s:${JSON.stringify(options.sort)}`);
    }
    if (options.search) {
        parts.push(`q:${options.search}`);
    }
    return parts.join(':');
}
async function tryGetFromCache(key) {
    try {
        const cached = await redisClient.client.get(key);
        if (cached) {
            return JSON.parse(cached);
        }
    }
    catch (error) {
        logger.warn('[BatchesV2] Cache read error:', error);
    }
    return null;
}
async function cacheResult(key, data, ttl) {
    try {
        await redisClient.client.set(key, JSON.stringify(data), 'EX', ttl);
    }
    catch (error) {
        logger.warn('[BatchesV2] Cache write error:', error);
    }
}
export { router as batchesV2Router };
export default router;
