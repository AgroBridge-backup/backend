/**
 * @file Batch GraphQL Resolvers
 * @description Resolvers for Batch queries and mutations
 *
 * @author AgroBridge Engineering Team
 */

import { Batch, BatchStatus, TraceabilityEvent, Variety, Prisma } from '@prisma/client';
import { GraphQLContext, requireAuth, requireRole, isAdmin, isAdminOrAuditor } from '../context.js';
import { NotFoundError, ForbiddenError } from '../errors.js';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

interface PaginationInput {
  page?: number;
  limit?: number;
  cursor?: string;
}

interface BatchFilterInput {
  status?: BatchStatus[];
  producerId?: string;
  origin?: string;
  variety?: Variety;
  createdAt?: { from?: Date; to?: Date };
  weightKgMin?: number;
  weightKgMax?: number;
}

interface BatchSortInput {
  field: string;
  direction: 'ASC' | 'DESC';
}

interface CreateBatchInput {
  variety: Variety;
  origin: string;
  harvestDate: Date;
  weightKg: number;
  blockchainHash: string;
}

interface UpdateBatchStatusInput {
  status: BatchStatus;
}

// ═══════════════════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

function buildBatchWhere(
  filter?: BatchFilterInput,
  context?: GraphQLContext
): Prisma.BatchWhereInput {
  const where: Prisma.BatchWhereInput = {};

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
      where.weightKg = { ...(where.weightKg as object || {}), gte: filter.weightKgMin };
    }
    if (filter.weightKgMax !== undefined) {
      where.weightKg = { ...(where.weightKg as object || {}), lte: filter.weightKgMax };
    }
  }

  // Role-based filtering
  if (context?.user && !isAdminOrAuditor(context)) {
    if (context.user.role === 'PRODUCER') {
      where.producer = { userId: context.user.id };
    }
  }

  return where;
}

function buildBatchOrderBy(sort?: BatchSortInput): Prisma.BatchOrderByWithRelationInput {
  if (!sort) {
    return { createdAt: 'desc' };
  }
  return { [sort.field]: sort.direction.toLowerCase() as 'asc' | 'desc' };
}

function encodeCursor(id: string): string {
  return Buffer.from(id).toString('base64');
}

// ═══════════════════════════════════════════════════════════════════════════════
// QUERY RESOLVERS
// ═══════════════════════════════════════════════════════════════════════════════

export const batchQueries = {
  batch: async (
    _parent: unknown,
    args: { id: string },
    context: GraphQLContext
  ): Promise<Batch | null> => {
    return context.loaders.batch.load(args.id);
  },

  batches: async (
    _parent: unknown,
    args: {
      pagination?: PaginationInput;
      filter?: BatchFilterInput;
      sort?: BatchSortInput;
    },
    context: GraphQLContext
  ) => {
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

// ═══════════════════════════════════════════════════════════════════════════════
// MUTATION RESOLVERS
// ═══════════════════════════════════════════════════════════════════════════════

export const batchMutations = {
  createBatch: async (
    _parent: unknown,
    args: { input: CreateBatchInput },
    context: GraphQLContext
  ) => {
    requireAuth(context);
    requireRole(context, ['ADMIN', 'PRODUCER']);

    // Get producer for current user
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

  updateBatchStatus: async (
    _parent: unknown,
    args: { id: string; input: UpdateBatchStatusInput },
    context: GraphQLContext
  ) => {
    requireAuth(context);

    const batch = await context.loaders.batch.load(args.id);
    if (!batch) {
      throw new NotFoundError('Batch', args.id);
    }

    // Check ownership or admin
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

  deleteBatch: async (
    _parent: unknown,
    args: { id: string },
    context: GraphQLContext
  ) => {
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

// ═══════════════════════════════════════════════════════════════════════════════
// FIELD RESOLVERS
// ═══════════════════════════════════════════════════════════════════════════════

export const batchFieldResolvers = {
  Batch: {
    producer: async (parent: Batch, _args: unknown, context: GraphQLContext) => {
      return context.loaders.producer.load(parent.producerId);
    },

    events: async (
      parent: Batch,
      args: { pagination?: PaginationInput },
      context: GraphQLContext
    ) => {
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

    eventCount: async (parent: Batch, _args: unknown, context: GraphQLContext) => {
      return context.loaders.eventCountByBatch.load(parent.id);
    },

    latestEvent: async (parent: Batch, _args: unknown, context: GraphQLContext) => {
      return context.loaders.latestEventByBatch.load(parent.id);
    },

    timeline: async (parent: Batch, _args: unknown, context: GraphQLContext) => {
      const events = await context.loaders.eventsByBatch.load(parent.id);

      return events.map((event: TraceabilityEvent) => ({
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
    createdBy: async (parent: { createdById: string }, _args: unknown, context: GraphQLContext) => {
      return context.loaders.user.load(parent.createdById);
    },
  },
};

function formatEventTitle(eventType: string): string {
  const titles: Record<string, string> = {
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
