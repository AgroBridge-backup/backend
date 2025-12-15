import { requireAuth, requireRole, isAdminOrAuditor } from '../context.js';
import { NotFoundError } from '../errors.js';
export const analyticsQueries = {
    dashboard: async (_parent, _args, context) => {
        requireAuth(context);
        requireRole(context, ['ADMIN', 'CERTIFIER']);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const [totalBatches, activeBatches, totalProducers, whitelistedProducers, totalEvents, eventsToday, batchesByStatus, eventsByType, recentEvents,] = await Promise.all([
            context.prisma.batch.count(),
            context.prisma.batch.count({
                where: { status: { in: ['REGISTERED', 'IN_TRANSIT', 'ARRIVED'] } },
            }),
            context.prisma.producer.count(),
            context.prisma.producer.count({ where: { isWhitelisted: true } }),
            context.prisma.traceabilityEvent.count(),
            context.prisma.traceabilityEvent.count({ where: { timestamp: { gte: today } } }),
            context.prisma.batch.groupBy({
                by: ['status'],
                _count: true,
            }),
            context.prisma.traceabilityEvent.groupBy({
                by: ['eventType'],
                _count: true,
            }),
            context.prisma.traceabilityEvent.findMany({
                take: 10,
                orderBy: { timestamp: 'desc' },
                include: { batch: true },
            }),
        ]);
        const statusCounts = batchesByStatus.map((item) => ({
            status: item.status,
            count: item._count,
            percentage: totalBatches > 0 ? (item._count / totalBatches) * 100 : 0,
        }));
        const typeCounts = eventsByType.map((item) => ({
            type: item.eventType,
            count: item._count,
            percentage: totalEvents > 0 ? (item._count / totalEvents) * 100 : 0,
        }));
        const recentActivity = recentEvents.map((event) => ({
            id: event.id,
            eventType: event.eventType,
            description: event.notes || `${event.eventType} event`,
            timestamp: event.timestamp,
            createdById: event.createdById,
            batchId: event.batchId,
        }));
        return {
            totalBatches,
            activeBatches,
            totalProducers,
            whitelistedProducers,
            totalEvents,
            eventsToday,
            batchesByStatus: statusCounts,
            eventsByType: typeCounts,
            recentActivity,
        };
    },
    batchTimeline: async (_parent, args, context) => {
        requireAuth(context);
        requireRole(context, ['ADMIN', 'CERTIFIER']);
        const batches = await context.prisma.batch.findMany({
            where: {
                createdAt: {
                    gte: args.startDate,
                    lte: args.endDate,
                },
            },
            orderBy: { createdAt: 'asc' },
        });
        const timeline = new Map();
        batches.forEach((batch) => {
            const dateKey = batch.createdAt.toISOString().split('T')[0];
            if (!timeline.has(dateKey)) {
                timeline.set(dateKey, {
                    registered: 0,
                    inTransit: 0,
                    arrived: 0,
                    delivered: 0,
                    rejected: 0,
                });
            }
            const entry = timeline.get(dateKey);
            switch (batch.status) {
                case 'REGISTERED':
                    entry.registered++;
                    break;
                case 'IN_TRANSIT':
                    entry.inTransit++;
                    break;
                case 'ARRIVED':
                    entry.arrived++;
                    break;
                case 'DELIVERED':
                    entry.delivered++;
                    break;
                case 'REJECTED':
                    entry.rejected++;
                    break;
            }
        });
        return Array.from(timeline.entries()).map(([dateStr, data]) => ({
            date: new Date(dateStr),
            ...data,
        }));
    },
    producerStats: async (_parent, args, context) => {
        requireAuth(context);
        const producer = await context.loaders.producer.load(args.producerId);
        if (!producer) {
            throw new NotFoundError('Producer', args.producerId);
        }
        if (!isAdminOrAuditor(context) && producer.userId !== context.user?.id) {
            requireRole(context, ['ADMIN', 'CERTIFIER']);
        }
        const [totalBatches, activeBatches, deliveredBatches, weightStats, certifications] = await Promise.all([
            context.prisma.batch.count({ where: { producerId: args.producerId } }),
            context.prisma.batch.count({
                where: {
                    producerId: args.producerId,
                    status: { in: ['REGISTERED', 'IN_TRANSIT', 'ARRIVED'] },
                },
            }),
            context.prisma.batch.count({
                where: { producerId: args.producerId, status: 'DELIVERED' },
            }),
            context.prisma.batch.aggregate({
                where: { producerId: args.producerId },
                _sum: { weightKg: true },
                _avg: { weightKg: true },
            }),
            context.prisma.certification.count({ where: { producerId: args.producerId } }),
        ]);
        return {
            producerId: args.producerId,
            totalBatches,
            activeBatches,
            deliveredBatches,
            totalWeightKg: weightStats._sum?.weightKg?.toNumber() || 0,
            averageWeightKg: weightStats._avg?.weightKg?.toNumber() || 0,
            certificationCount: certifications,
        };
    },
    topProducers: async (_parent, args, context) => {
        requireAuth(context);
        requireRole(context, ['ADMIN', 'CERTIFIER']);
        const limit = Math.min(args.limit || 10, 50);
        const topProducers = await context.prisma.batch.groupBy({
            by: ['producerId'],
            _count: true,
            _sum: { weightKg: true },
            orderBy: { _count: { producerId: 'desc' } },
            take: limit,
        });
        const results = await Promise.all(topProducers.map(async (item, index) => {
            const producer = await context.loaders.producer.load(item.producerId);
            return {
                producer,
                batchCount: item._count,
                totalWeightKg: item._sum?.weightKg?.toNumber() || 0,
                rank: index + 1,
            };
        }));
        return results.filter((r) => r.producer !== null);
    },
    eventDistribution: async (_parent, args, context) => {
        requireAuth(context);
        requireRole(context, ['ADMIN', 'CERTIFIER']);
        const where = {};
        if (args.dateRange) {
            where.timestamp = {};
            if (args.dateRange.from)
                where.timestamp.gte = args.dateRange.from;
            if (args.dateRange.to)
                where.timestamp.lte = args.dateRange.to;
        }
        const [distribution, total, lastEvents] = await Promise.all([
            context.prisma.traceabilityEvent.groupBy({
                by: ['eventType'],
                where,
                _count: true,
            }),
            context.prisma.traceabilityEvent.count({ where }),
            context.prisma.traceabilityEvent.groupBy({
                by: ['eventType'],
                where,
                _max: { timestamp: true },
            }),
        ]);
        const lastEventMap = new Map();
        lastEvents.forEach((item) => {
            lastEventMap.set(item.eventType, item._max.timestamp);
        });
        return distribution.map((item) => ({
            type: item.eventType,
            count: item._count,
            percentage: total > 0 ? (item._count / total) * 100 : 0,
            lastOccurrence: lastEventMap.get(item.eventType),
        }));
    },
    systemOverview: async (_parent, _args, context) => {
        requireAuth(context);
        requireRole(context, ['ADMIN']);
        const [totalUsers, activeUsers, usersByRole, totalBatches, totalEvents, totalProducers,] = await Promise.all([
            context.prisma.user.count(),
            context.prisma.user.count({ where: { isActive: true } }),
            context.prisma.user.groupBy({
                by: ['role'],
                _count: true,
            }),
            context.prisma.batch.count(),
            context.prisma.traceabilityEvent.count(),
            context.prisma.producer.count(),
        ]);
        return {
            totalUsers,
            activeUsers,
            usersByRole: usersByRole.map((item) => ({
                role: item.role,
                count: item._count,
            })),
            totalBatches,
            totalEvents,
            totalProducers,
            uptime: process.uptime(),
        };
    },
    search: async (_parent, args, context) => {
        requireAuth(context);
        const searchQuery = args.query.trim();
        const types = args.types || ['batches', 'producers', 'events'];
        const results = {
            batches: [],
            producers: [],
            events: [],
            totalCount: 0,
        };
        const searches = [];
        if (types.includes('batches')) {
            searches.push(context.prisma.batch
                .findMany({
                where: {
                    origin: { contains: searchQuery, mode: 'insensitive' },
                },
                take: 10,
            })
                .then((batches) => {
                results.batches = batches;
                results.totalCount += batches.length;
            }));
        }
        if (types.includes('producers')) {
            searches.push(context.prisma.producer
                .findMany({
                where: {
                    OR: [
                        { businessName: { contains: searchQuery, mode: 'insensitive' } },
                        { state: { contains: searchQuery, mode: 'insensitive' } },
                        { municipality: { contains: searchQuery, mode: 'insensitive' } },
                    ],
                },
                take: 10,
            })
                .then((producers) => {
                results.producers = producers;
                results.totalCount += producers.length;
            }));
        }
        if (types.includes('events')) {
            searches.push(context.prisma.traceabilityEvent
                .findMany({
                where: {
                    OR: [
                        { notes: { contains: searchQuery, mode: 'insensitive' } },
                        { locationName: { contains: searchQuery, mode: 'insensitive' } },
                    ],
                },
                take: 10,
            })
                .then((events) => {
                results.events = events;
                results.totalCount += events.length;
            }));
        }
        await Promise.all(searches);
        return results;
    },
};
export const analyticsFieldResolvers = {
    ActivityItem: {
        createdBy: async (parent, _args, context) => {
            if (!parent.createdById)
                return null;
            return context.loaders.user.load(parent.createdById);
        },
    },
    ProducerStats: {
        producer: async (parent, _args, context) => {
            return context.loaders.producer.load(parent.producerId);
        },
    },
};
