import { requireAuth, requireRole, isAdmin, isAdminOrAuditor } from '../context.js';
import { NotFoundError, ForbiddenError } from '../errors.js';
function buildEventWhere(filter, context) {
    const where = {};
    if (filter) {
        if (filter.eventType?.length) {
            where.eventType = { in: filter.eventType };
        }
        if (filter.batchId) {
            where.batchId = filter.batchId;
        }
        if (filter.createdById) {
            where.createdById = filter.createdById;
        }
        if (filter.timestamp) {
            where.timestamp = {};
            if (filter.timestamp.from) {
                where.timestamp.gte = filter.timestamp.from;
            }
            if (filter.timestamp.to) {
                where.timestamp.lte = filter.timestamp.to;
            }
        }
    }
    if (context?.user && !isAdminOrAuditor(context)) {
        if (context.user.role === 'PRODUCER') {
            where.batch = { producer: { userId: context.user.id } };
        }
    }
    return where;
}
function buildEventOrderBy(sort) {
    if (!sort) {
        return { timestamp: 'desc' };
    }
    return { [sort.field]: sort.direction.toLowerCase() };
}
function encodeCursor(id) {
    return Buffer.from(id).toString('base64');
}
export const eventQueries = {
    event: async (_parent, args, context) => {
        return context.loaders.event.load(args.id);
    },
    events: async (_parent, args, context) => {
        const page = args.pagination?.page || 1;
        const limit = Math.min(args.pagination?.limit || 20, 100);
        const skip = (page - 1) * limit;
        const where = buildEventWhere(args.filter, context);
        const orderBy = buildEventOrderBy(args.sort);
        const [events, totalCount] = await Promise.all([
            context.prisma.traceabilityEvent.findMany({
                where,
                orderBy,
                skip,
                take: limit,
            }),
            context.prisma.traceabilityEvent.count({ where }),
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
    eventsByBatch: async (_parent, args, context) => {
        const page = args.pagination?.page || 1;
        const limit = Math.min(args.pagination?.limit || 20, 100);
        const skip = (page - 1) * limit;
        const where = { batchId: args.batchId };
        const [events, totalCount] = await Promise.all([
            context.prisma.traceabilityEvent.findMany({
                where,
                orderBy: { timestamp: 'asc' },
                skip,
                take: limit,
            }),
            context.prisma.traceabilityEvent.count({ where }),
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
};
export const eventMutations = {
    createEvent: async (_parent, args, context) => {
        requireAuth(context);
        const batch = await context.loaders.batch.load(args.input.batchId);
        if (!batch) {
            throw new NotFoundError('Batch', args.input.batchId);
        }
        if (!isAdmin(context) && context.user.role === 'PRODUCER') {
            const producer = await context.loaders.producer.load(batch.producerId);
            if (!producer || producer.userId !== context.user.id) {
                throw new ForbiddenError('You can only add events to your own batches');
            }
        }
        const event = await context.prisma.traceabilityEvent.create({
            data: {
                batchId: args.input.batchId,
                eventType: args.input.eventType,
                latitude: args.input.latitude,
                longitude: args.input.longitude,
                locationName: args.input.locationName,
                temperature: args.input.temperature,
                humidity: args.input.humidity,
                notes: args.input.notes,
                photos: args.input.photos || [],
                createdById: context.user.id,
                timestamp: new Date(),
            },
        });
        return {
            success: true,
            message: 'Event created successfully',
            event,
        };
    },
    verifyEvent: async (_parent, args, context) => {
        requireAuth(context);
        requireRole(context, ['ADMIN', 'CERTIFIER']);
        const event = await context.loaders.event.load(args.id);
        if (!event) {
            throw new NotFoundError('Event', args.id);
        }
        const updatedEvent = await context.prisma.traceabilityEvent.update({
            where: { id: args.id },
            data: {
                isVerified: true,
                verifiedBy: context.user.id,
                verifiedAt: new Date(),
            },
        });
        return {
            success: true,
            message: 'Event verified successfully',
            event: updatedEvent,
        };
    },
};
export const eventFieldResolvers = {
    TraceabilityEvent: {
        batch: async (parent, _args, context) => {
            return context.loaders.batch.load(parent.batchId);
        },
        createdBy: async (parent, _args, context) => {
            return context.loaders.user.load(parent.createdById);
        },
        verifier: async (parent, _args, context) => {
            if (!parent.verifiedBy)
                return null;
            return context.loaders.user.load(parent.verifiedBy);
        },
    },
};
