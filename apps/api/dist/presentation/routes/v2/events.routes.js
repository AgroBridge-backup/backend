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
        const queryOptions = QueryBuilder.parse(req.query);
        const validationErrors = QueryBuilder.validate(queryOptions, 'Event');
        if (validationErrors.length > 0) {
            return res.status(400).json(ResponseFormatter.validationError(validationErrors.map((msg) => ({ field: 'query', message: msg })), req.path));
        }
        const prismaQuery = QueryBuilder.applyToPrismaQuery('Event', queryOptions);
        const roleFilter = await buildRoleBasedFilter(user);
        if (roleFilter) {
            prismaQuery.where = {
                ...prismaQuery.where,
                batch: roleFilter,
            };
        }
        const total = await prisma.traceabilityEvent.count({
            where: prismaQuery.where,
        });
        const events = await prisma.traceabilityEvent.findMany({
            where: prismaQuery.where,
            ...(prismaQuery.select
                ? { select: prismaQuery.select }
                : prismaQuery.include
                    ? { include: prismaQuery.include }
                    : {}),
            orderBy: prismaQuery.orderBy || [{ timestamp: 'desc' }],
            skip: prismaQuery.skip,
            take: prismaQuery.take,
        });
        res.json(ResponseFormatter.paginated(events, total, queryOptions.page, queryOptions.limit, '/api/v2/events', req.query));
    }
    catch (error) {
        logger.error('[EventsV2] List error:', error);
        next(error);
    }
});
router.get('/:id', authenticate(), async (req, res, next) => {
    try {
        const { id } = req.params;
        const user = req.user;
        const queryOptions = QueryBuilder.parse(req.query);
        const prismaQuery = QueryBuilder.applyToPrismaQuery('Event', queryOptions);
        const event = await prisma.traceabilityEvent.findUnique({
            where: { id },
            include: {
                batch: {
                    select: {
                        id: true,
                        producerId: true,
                    },
                },
            },
        });
        if (!event) {
            return res.status(404).json(ResponseFormatter.notFound('Event', id, req.path));
        }
        const hasAccess = await checkEventAccess(user, event);
        if (!hasAccess) {
            return res.status(403).json(ResponseFormatter.forbidden('Access denied to this event', req.path));
        }
        res.json(ResponseFormatter.success(event));
    }
    catch (error) {
        logger.error('[EventsV2] Get error:', error);
        next(error);
    }
});
router.get('/types/distribution', authenticate(), async (req, res, next) => {
    try {
        const user = req.user;
        let whereClause = {};
        if (user.role === 'PRODUCER') {
            const producer = await prisma.producer.findUnique({
                where: { userId: user.userId },
                select: { id: true },
            });
            if (producer) {
                whereClause = { batch: { producerId: producer.id } };
            }
        }
        else if (user.role !== 'ADMIN' && user.role !== 'CERTIFIER') {
            whereClause = { createdById: user.userId };
        }
        const distribution = await prisma.traceabilityEvent.groupBy({
            by: ['eventType'],
            where: whereClause,
            _count: true,
        });
        const result = {
            distribution: distribution.map((item) => ({
                eventType: item.eventType,
                count: item._count,
            })),
            total: distribution.reduce((sum, item) => sum + item._count, 0),
        };
        res.json(ResponseFormatter.success(result));
    }
    catch (error) {
        logger.error('[EventsV2] Get types distribution error:', error);
        next(error);
    }
});
router.get('/recent/list', authenticate(), async (req, res, next) => {
    try {
        const user = req.user;
        const limit = Math.min(parseInt(String(req.query.limit)) || 10, 50);
        let whereClause = {};
        if (user.role === 'PRODUCER') {
            const producer = await prisma.producer.findUnique({
                where: { userId: user.userId },
                select: { id: true },
            });
            if (producer) {
                whereClause = { batch: { producerId: producer.id } };
            }
        }
        else if (user.role !== 'ADMIN' && user.role !== 'CERTIFIER') {
            whereClause = { createdById: user.userId };
        }
        const events = await prisma.traceabilityEvent.findMany({
            where: whereClause,
            select: {
                id: true,
                eventType: true,
                timestamp: true,
                locationName: true,
                isVerified: true,
                batch: {
                    select: {
                        id: true,
                        origin: true,
                        variety: true,
                    },
                },
            },
            orderBy: { timestamp: 'desc' },
            take: limit,
        });
        res.json(ResponseFormatter.success({ events, count: events.length }));
    }
    catch (error) {
        logger.error('[EventsV2] Get recent events error:', error);
        next(error);
    }
});
async function buildRoleBasedFilter(user) {
    if (user.role === 'ADMIN' || user.role === 'CERTIFIER') {
        return null;
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
async function checkEventAccess(user, event) {
    if (user.role === 'ADMIN' || user.role === 'CERTIFIER') {
        return true;
    }
    if (event.createdById === user.userId) {
        return true;
    }
    if (event.batch) {
        if (event.batch.createdById === user.userId) {
            return true;
        }
        if (user.role === 'PRODUCER' && event.batch.producerId) {
            const producer = await prisma.producer.findUnique({
                where: { userId: user.userId },
                select: { id: true },
            });
            return producer?.id === event.batch.producerId;
        }
    }
    return false;
}
export { router as eventsV2Router };
export default router;
