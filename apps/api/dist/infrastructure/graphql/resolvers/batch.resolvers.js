import { requireAuth, requireRole, isAdmin, isAdminOrAuditor } from '../context.js';
import { NotFoundError, ForbiddenError } from '../errors.js';
function buildBatchWhere(filter, context) {
    const where = {};
    if (filter) {
        if (filter.status?.length) {
            where.status = { in: filter.status };
        }
        if (filter.producerId) {
            where.producerId = filter.producerId;
        }
        if (filter.origin) {
            where.origin = { contains: filter.origin, mode: 'insensitive' };
        }
        if (filter.variety) {
            where.variety = filter.variety;
        }
        if (filter.createdAt) {
            where.createdAt = {};
            if (filter.createdAt.from) {
                where.createdAt.gte = filter.createdAt.from;
            }
            if (filter.createdAt.to) {
                where.createdAt.lte = filter.createdAt.to;
            }
        }
        if (filter.weightKgMin !== undefined) {
            where.weightKg = { ...(where.weightKg || {}), gte: filter.weightKgMin };
        }
        if (filter.weightKgMax !== undefined) {
            where.weightKg = { ...(where.weightKg || {}), lte: filter.weightKgMax };
        }
    }
    if (context?.user && !isAdminOrAuditor(context)) {
        if (context.user.role === 'PRODUCER') {
            where.producer = { userId: context.user.id };
        }
    }
    return where;
}
function buildBatchOrderBy(sort) {
    if (!sort) {
        return { createdAt: 'desc' };
    }
    return { [sort.field]: sort.direction.toLowerCase() };
}
function encodeCursor(id) {
    return Buffer.from(id).toString('base64');
}
export const batchQueries = {
    batch: async (_parent, args, context) => {
        return context.loaders.batch.load(args.id);
    },
    batches: async (_parent, args, context) => {
        const page = args.pagination?.page || 1;
        const limit = Math.min(args.pagination?.limit || 20, 100);
        const skip = (page - 1) * limit;
        const where = buildBatchWhere(args.filter, context);
        const orderBy = buildBatchOrderBy(args.sort);
        const [batches, totalCount] = await Promise.all([
            context.prisma.batch.findMany({
                where,
                orderBy,
                skip,
                take: limit,
            }),
            context.prisma.batch.count({ where }),
        ]);
        const totalPages = Math.ceil(totalCount / limit);
        return {
            edges: batches.map((batch) => ({
                node: batch,
                cursor: encodeCursor(batch.id),
            })),
            pageInfo: {
                hasNextPage: page < totalPages,
                hasPreviousPage: page > 1,
                startCursor: batches[0] ? encodeCursor(batches[0].id) : null,
                endCursor: batches[batches.length - 1]
                    ? encodeCursor(batches[batches.length - 1].id)
                    : null,
                totalCount,
                totalPages,
                currentPage: page,
            },
            nodes: batches,
        };
    },
};
export const batchMutations = {
    createBatch: async (_parent, args, context) => {
        requireAuth(context);
        requireRole(context, ['ADMIN', 'PRODUCER']);
        const producer = await context.loaders.producerByUserId.load(context.user.id);
        if (!producer && context.user.role === 'PRODUCER') {
            throw new ForbiddenError('You must have a producer profile to create batches');
        }
        const producerId = producer?.id;
        if (!producerId) {
            throw new ForbiddenError('Producer ID required');
        }
        const batch = await context.prisma.batch.create({
            data: {
                producerId,
                variety: args.input.variety,
                origin: args.input.origin,
                harvestDate: args.input.harvestDate,
                weightKg: args.input.weightKg,
                blockchainHash: args.input.blockchainHash,
                status: 'REGISTERED',
            },
        });
        return {
            success: true,
            message: 'Batch created successfully',
            batch,
        };
    },
    updateBatchStatus: async (_parent, args, context) => {
        requireAuth(context);
        const batch = await context.loaders.batch.load(args.id);
        if (!batch) {
            throw new NotFoundError('Batch', args.id);
        }
        const producer = await context.loaders.producer.load(batch.producerId);
        if (!isAdmin(context) && producer?.userId !== context.user.id) {
            throw new ForbiddenError('You can only update your own batches');
        }
        const updatedBatch = await context.prisma.batch.update({
            where: { id: args.id },
            data: {
                status: args.input.status,
            },
        });
        return {
            success: true,
            message: `Batch status updated to ${args.input.status}`,
            batch: updatedBatch,
        };
    },
    deleteBatch: async (_parent, args, context) => {
        requireAuth(context);
        requireRole(context, ['ADMIN']);
        const batch = await context.loaders.batch.load(args.id);
        if (!batch) {
            throw new NotFoundError('Batch', args.id);
        }
        await context.prisma.batch.delete({
            where: { id: args.id },
        });
        return {
            success: true,
            message: 'Batch deleted successfully',
            deletedId: args.id,
        };
    },
};
export const batchFieldResolvers = {
    Batch: {
        producer: async (parent, _args, context) => {
            return context.loaders.producer.load(parent.producerId);
        },
        events: async (parent, args, context) => {
            const page = args.pagination?.page || 1;
            const limit = Math.min(args.pagination?.limit || 20, 100);
            const skip = (page - 1) * limit;
            const [events, totalCount] = await Promise.all([
                context.prisma.traceabilityEvent.findMany({
                    where: { batchId: parent.id },
                    orderBy: { timestamp: 'desc' },
                    skip,
                    take: limit,
                }),
                context.prisma.traceabilityEvent.count({ where: { batchId: parent.id } }),
            ]);
            const totalPages = Math.ceil(totalCount / limit);
            return {
                edges: events.map((event) => ({
                    node: event,
                    cursor: encodeCursor(event.id),
                })),
                pageInfo: {
                    hasNextPage: page < totalPages,
                    hasPreviousPage: page > 1,
                    startCursor: events[0] ? encodeCursor(events[0].id) : null,
                    endCursor: events[events.length - 1]
                        ? encodeCursor(events[events.length - 1].id)
                        : null,
                    totalCount,
                    totalPages,
                    currentPage: page,
                },
                nodes: events,
            };
        },
        eventCount: async (parent, _args, context) => {
            return context.loaders.eventCountByBatch.load(parent.id);
        },
        latestEvent: async (parent, _args, context) => {
            return context.loaders.latestEventByBatch.load(parent.id);
        },
        timeline: async (parent, _args, context) => {
            const events = await context.loaders.eventsByBatch.load(parent.id);
            return events.map((event) => ({
                id: event.id,
                eventType: event.eventType,
                title: formatEventTitle(event.eventType),
                timestamp: event.timestamp,
                locationName: event.locationName,
                createdById: event.createdById,
            }));
        },
    },
    TimelineEntry: {
        createdBy: async (parent, _args, context) => {
            return context.loaders.user.load(parent.createdById);
        },
    },
};
function formatEventTitle(eventType) {
    const titles = {
        HARVEST: 'Harvest',
        PROCESSING: 'Processing',
        QUALITY_INSPECTION: 'Quality Inspection',
        PACKAGING: 'Packaging',
        TRANSPORT_START: 'Transport Started',
        TRANSPORT_ARRIVAL: 'Transport Arrived',
        CUSTOMS_CLEARANCE: 'Customs Clearance',
        DELIVERY: 'Delivery',
    };
    return titles[eventType] || eventType;
}
