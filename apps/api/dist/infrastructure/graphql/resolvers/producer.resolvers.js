import { requireAuth, requireRole, isAdmin } from '../context.js';
import { NotFoundError, ForbiddenError, ConflictError } from '../errors.js';
function buildProducerWhere(filter) {
    const where = {};
    if (filter) {
        if (filter.isWhitelisted !== undefined) {
            where.isWhitelisted = filter.isWhitelisted;
        }
        if (filter.state) {
            where.state = { contains: filter.state, mode: 'insensitive' };
        }
        if (filter.municipality) {
            where.municipality = { contains: filter.municipality, mode: 'insensitive' };
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
    }
    return where;
}
function buildProducerOrderBy(sort) {
    if (!sort) {
        return { createdAt: 'desc' };
    }
    return { [sort.field]: sort.direction.toLowerCase() };
}
function encodeCursor(id) {
    return Buffer.from(id).toString('base64');
}
export const producerQueries = {
    producer: async (_parent, args, context) => {
        return context.loaders.producer.load(args.id);
    },
    producerByUserId: async (_parent, args, context) => {
        return context.loaders.producerByUserId.load(args.userId);
    },
    producers: async (_parent, args, context) => {
        const page = args.pagination?.page || 1;
        const limit = Math.min(args.pagination?.limit || 20, 100);
        const skip = (page - 1) * limit;
        const where = buildProducerWhere(args.filter);
        const orderBy = buildProducerOrderBy(args.sort);
        const [producers, totalCount] = await Promise.all([
            context.prisma.producer.findMany({
                where,
                orderBy,
                skip,
                take: limit,
            }),
            context.prisma.producer.count({ where }),
        ]);
        const totalPages = Math.ceil(totalCount / limit);
        return {
            edges: producers.map((producer) => ({
                node: producer,
                cursor: encodeCursor(producer.id),
            })),
            pageInfo: {
                hasNextPage: page < totalPages,
                hasPreviousPage: page > 1,
                startCursor: producers[0] ? encodeCursor(producers[0].id) : null,
                endCursor: producers[producers.length - 1]
                    ? encodeCursor(producers[producers.length - 1].id)
                    : null,
                totalCount,
                totalPages,
                currentPage: page,
            },
            nodes: producers,
        };
    },
};
export const producerMutations = {
    createProducer: async (_parent, args, context) => {
        requireAuth(context);
        requireRole(context, ['ADMIN']);
        const user = await context.loaders.user.load(args.userId);
        if (!user) {
            throw new NotFoundError('User', args.userId);
        }
        const existingProducer = await context.loaders.producerByUserId.load(args.userId);
        if (existingProducer) {
            throw new ConflictError('User already has a producer profile');
        }
        const producer = await context.prisma.producer.create({
            data: {
                userId: args.userId,
                businessName: args.input.businessName,
                rfc: args.input.rfc,
                state: args.input.state,
                municipality: args.input.municipality,
                address: args.input.address,
                latitude: args.input.latitude,
                longitude: args.input.longitude,
                totalHectares: args.input.totalHectares,
                cropTypes: args.input.cropTypes || [],
            },
        });
        await context.prisma.user.update({
            where: { id: args.userId },
            data: { role: 'PRODUCER' },
        });
        return {
            success: true,
            message: 'Producer profile created successfully',
            producer,
        };
    },
    updateProducer: async (_parent, args, context) => {
        requireAuth(context);
        const producer = await context.loaders.producer.load(args.id);
        if (!producer) {
            throw new NotFoundError('Producer', args.id);
        }
        if (!isAdmin(context) && producer.userId !== context.user.id) {
            throw new ForbiddenError('You can only update your own producer profile');
        }
        const updatedProducer = await context.prisma.producer.update({
            where: { id: args.id },
            data: {
                businessName: args.input.businessName,
                address: args.input.address,
                totalHectares: args.input.totalHectares,
                cropTypes: args.input.cropTypes,
            },
        });
        return {
            success: true,
            message: 'Producer profile updated successfully',
            producer: updatedProducer,
        };
    },
    whitelistProducer: async (_parent, args, context) => {
        requireAuth(context);
        requireRole(context, ['ADMIN', 'CERTIFIER']);
        const producer = await context.loaders.producer.load(args.id);
        if (!producer) {
            throw new NotFoundError('Producer', args.id);
        }
        if (producer.isWhitelisted) {
            throw new ConflictError('Producer is already whitelisted');
        }
        const updatedProducer = await context.prisma.producer.update({
            where: { id: args.id },
            data: {
                isWhitelisted: true,
                whitelistedAt: new Date(),
                whitelistedBy: context.user.id,
            },
        });
        return {
            success: true,
            message: 'Producer whitelisted successfully',
            producer: updatedProducer,
        };
    },
    deleteProducer: async (_parent, args, context) => {
        requireAuth(context);
        requireRole(context, ['ADMIN']);
        const producer = await context.loaders.producer.load(args.id);
        if (!producer) {
            throw new NotFoundError('Producer', args.id);
        }
        const batchCount = await context.loaders.producerBatchCount.load(args.id);
        if (batchCount > 0) {
            throw new ConflictError('Cannot delete producer with existing batches');
        }
        await context.prisma.producer.delete({
            where: { id: args.id },
        });
        return {
            success: true,
            message: 'Producer deleted successfully',
            deletedId: args.id,
        };
    },
};
export const producerFieldResolvers = {
    Producer: {
        user: async (parent, _args, context) => {
            return context.loaders.user.load(parent.userId);
        },
        batches: async (parent, args, context) => {
            const page = args.pagination?.page || 1;
            const limit = Math.min(args.pagination?.limit || 20, 100);
            const skip = (page - 1) * limit;
            const where = { producerId: parent.id };
            const [batches, totalCount] = await Promise.all([
                context.prisma.batch.findMany({
                    where,
                    orderBy: { createdAt: 'desc' },
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
        certifications: async (parent, _args, context) => {
            return context.prisma.certification.findMany({
                where: { producerId: parent.id },
                orderBy: { issuedAt: 'desc' },
            });
        },
        batchCount: async (parent, _args, context) => {
            return context.loaders.producerBatchCount.load(parent.id);
        },
        activeBatchCount: async (parent, _args, context) => {
            return context.loaders.producerActiveBatchCount.load(parent.id);
        },
    },
};
