/**
 * @file Event GraphQL Resolvers
 * @description Resolvers for TraceabilityEvent queries and mutations
 *
 * @author AgroBridge Engineering Team
 */

import { TraceabilityEvent, EventType, Prisma } from "@prisma/client";
import {
  GraphQLContext,
  requireAuth,
  requireRole,
  isAdmin,
  isAdminOrAuditor,
} from "../context.js";
import { NotFoundError, ForbiddenError } from "../errors.js";

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

interface PaginationInput {
  page?: number;
  limit?: number;
}

interface EventFilterInput {
  eventType?: EventType[];
  batchId?: string;
  createdById?: string;
  timestamp?: { from?: Date; to?: Date };
}

interface EventSortInput {
  field: string;
  direction: "ASC" | "DESC";
}

interface CreateEventInput {
  batchId: string;
  eventType: EventType;
  latitude: number;
  longitude: number;
  locationName?: string;
  temperature?: number;
  humidity?: number;
  notes?: string;
  photos?: string[];
}

// ═══════════════════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

function buildEventWhere(
  filter?: EventFilterInput,
  context?: GraphQLContext,
): Prisma.TraceabilityEventWhereInput {
  const where: Prisma.TraceabilityEventWhereInput = {};

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

  // Role-based filtering
  if (context?.user && !isAdminOrAuditor(context)) {
    if (context.user.role === "PRODUCER") {
      where.batch = { producer: { userId: context.user.id } };
    }
  }

  return where;
}

function buildEventOrderBy(
  sort?: EventSortInput,
): Prisma.TraceabilityEventOrderByWithRelationInput {
  if (!sort) {
    return { timestamp: "desc" };
  }
  return { [sort.field]: sort.direction.toLowerCase() as "asc" | "desc" };
}

function encodeCursor(id: string): string {
  return Buffer.from(id).toString("base64");
}

// ═══════════════════════════════════════════════════════════════════════════════
// QUERY RESOLVERS
// ═══════════════════════════════════════════════════════════════════════════════

export const eventQueries = {
  event: async (
    _parent: unknown,
    args: { id: string },
    context: GraphQLContext,
  ): Promise<TraceabilityEvent | null> => {
    return context.loaders.event.load(args.id);
  },

  events: async (
    _parent: unknown,
    args: {
      pagination?: PaginationInput;
      filter?: EventFilterInput;
      sort?: EventSortInput;
    },
    context: GraphQLContext,
  ) => {
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

  eventsByBatch: async (
    _parent: unknown,
    args: { batchId: string; pagination?: PaginationInput },
    context: GraphQLContext,
  ) => {
    const page = args.pagination?.page || 1;
    const limit = Math.min(args.pagination?.limit || 20, 100);
    const skip = (page - 1) * limit;

    const where: Prisma.TraceabilityEventWhereInput = { batchId: args.batchId };

    const [events, totalCount] = await Promise.all([
      context.prisma.traceabilityEvent.findMany({
        where,
        orderBy: { timestamp: "asc" },
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

// ═══════════════════════════════════════════════════════════════════════════════
// MUTATION RESOLVERS
// ═══════════════════════════════════════════════════════════════════════════════

export const eventMutations = {
  createEvent: async (
    _parent: unknown,
    args: { input: CreateEventInput },
    context: GraphQLContext,
  ) => {
    requireAuth(context);

    // Verify batch exists
    const batch = await context.loaders.batch.load(args.input.batchId);
    if (!batch) {
      throw new NotFoundError("Batch", args.input.batchId);
    }

    // Check authorization - producer can only add events to their batches
    if (!isAdmin(context) && context.user.role === "PRODUCER") {
      const producer = await context.loaders.producer.load(batch.producerId);
      if (!producer || producer.userId !== context.user.id) {
        throw new ForbiddenError("You can only add events to your own batches");
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
      message: "Event created successfully",
      event,
    };
  },

  verifyEvent: async (
    _parent: unknown,
    args: { id: string },
    context: GraphQLContext,
  ) => {
    requireAuth(context);
    requireRole(context, ["ADMIN", "CERTIFIER"]);

    const event = await context.loaders.event.load(args.id);
    if (!event) {
      throw new NotFoundError("Event", args.id);
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
      message: "Event verified successfully",
      event: updatedEvent,
    };
  },
};

// ═══════════════════════════════════════════════════════════════════════════════
// FIELD RESOLVERS
// ═══════════════════════════════════════════════════════════════════════════════

export const eventFieldResolvers = {
  TraceabilityEvent: {
    batch: async (
      parent: TraceabilityEvent,
      _args: unknown,
      context: GraphQLContext,
    ) => {
      return context.loaders.batch.load(parent.batchId);
    },

    createdBy: async (
      parent: TraceabilityEvent,
      _args: unknown,
      context: GraphQLContext,
    ) => {
      return context.loaders.user.load(parent.createdById);
    },

    verifier: async (
      parent: TraceabilityEvent,
      _args: unknown,
      context: GraphQLContext,
    ) => {
      if (!parent.verifiedBy) return null;
      return context.loaders.user.load(parent.verifiedBy);
    },
  },
};
