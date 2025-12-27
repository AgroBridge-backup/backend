/**
 * @file Producer GraphQL Resolvers
 * @description Resolvers for Producer queries and mutations
 *
 * @author AgroBridge Engineering Team
 */

import { Producer, Prisma } from "@prisma/client";
import {
  GraphQLContext,
  requireAuth,
  requireRole,
  isAdmin,
  isAdminOrAuditor,
} from "../context.js";
import { NotFoundError, ForbiddenError, ConflictError } from "../errors.js";

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

interface PaginationInput {
  page?: number;
  limit?: number;
}

interface ProducerFilterInput {
  isWhitelisted?: boolean;
  state?: string;
  municipality?: string;
  createdAt?: { from?: Date; to?: Date };
}

interface ProducerSortInput {
  field: string;
  direction: "ASC" | "DESC";
}

interface CreateProducerInput {
  businessName: string;
  rfc: string;
  state: string;
  municipality: string;
  address?: string;
  latitude: number;
  longitude: number;
  totalHectares?: number;
  cropTypes?: string[];
}

interface UpdateProducerInput {
  businessName?: string;
  address?: string;
  totalHectares?: number;
  cropTypes?: string[];
}

// ═══════════════════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

function buildProducerWhere(
  filter?: ProducerFilterInput,
): Prisma.ProducerWhereInput {
  const where: Prisma.ProducerWhereInput = {};

  if (filter) {
    if (filter.isWhitelisted !== undefined) {
      where.isWhitelisted = filter.isWhitelisted;
    }
    if (filter.state) {
      where.state = { contains: filter.state, mode: "insensitive" };
    }
    if (filter.municipality) {
      where.municipality = {
        contains: filter.municipality,
        mode: "insensitive",
      };
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

function buildProducerOrderBy(
  sort?: ProducerSortInput,
): Prisma.ProducerOrderByWithRelationInput {
  if (!sort) {
    return { createdAt: "desc" };
  }
  return { [sort.field]: sort.direction.toLowerCase() as "asc" | "desc" };
}

function encodeCursor(id: string): string {
  return Buffer.from(id).toString("base64");
}

// ═══════════════════════════════════════════════════════════════════════════════
// QUERY RESOLVERS
// ═══════════════════════════════════════════════════════════════════════════════

export const producerQueries = {
  producer: async (
    _parent: unknown,
    args: { id: string },
    context: GraphQLContext,
  ): Promise<Producer | null> => {
    return context.loaders.producer.load(args.id);
  },

  producerByUserId: async (
    _parent: unknown,
    args: { userId: string },
    context: GraphQLContext,
  ): Promise<Producer | null> => {
    return context.loaders.producerByUserId.load(args.userId);
  },

  producers: async (
    _parent: unknown,
    args: {
      pagination?: PaginationInput;
      filter?: ProducerFilterInput;
      sort?: ProducerSortInput;
    },
    context: GraphQLContext,
  ) => {
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

// ═══════════════════════════════════════════════════════════════════════════════
// MUTATION RESOLVERS
// ═══════════════════════════════════════════════════════════════════════════════

export const producerMutations = {
  createProducer: async (
    _parent: unknown,
    args: { userId: string; input: CreateProducerInput },
    context: GraphQLContext,
  ) => {
    requireAuth(context);
    requireRole(context, ["ADMIN"]);

    // Check if user exists
    const user = await context.loaders.user.load(args.userId);
    if (!user) {
      throw new NotFoundError("User", args.userId);
    }

    // Check if user already has a producer profile
    const existingProducer = await context.loaders.producerByUserId.load(
      args.userId,
    );
    if (existingProducer) {
      throw new ConflictError("User already has a producer profile");
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

    // Update user role to PRODUCER
    await context.prisma.user.update({
      where: { id: args.userId },
      data: { role: "PRODUCER" },
    });

    return {
      success: true,
      message: "Producer profile created successfully",
      producer,
    };
  },

  updateProducer: async (
    _parent: unknown,
    args: { id: string; input: UpdateProducerInput },
    context: GraphQLContext,
  ) => {
    requireAuth(context);

    const producer = await context.loaders.producer.load(args.id);
    if (!producer) {
      throw new NotFoundError("Producer", args.id);
    }

    // Check ownership or admin
    if (!isAdmin(context) && producer.userId !== context.user.id) {
      throw new ForbiddenError("You can only update your own producer profile");
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
      message: "Producer profile updated successfully",
      producer: updatedProducer,
    };
  },

  whitelistProducer: async (
    _parent: unknown,
    args: { id: string },
    context: GraphQLContext,
  ) => {
    requireAuth(context);
    requireRole(context, ["ADMIN", "CERTIFIER"]);

    const producer = await context.loaders.producer.load(args.id);
    if (!producer) {
      throw new NotFoundError("Producer", args.id);
    }

    if (producer.isWhitelisted) {
      throw new ConflictError("Producer is already whitelisted");
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
      message: "Producer whitelisted successfully",
      producer: updatedProducer,
    };
  },

  deleteProducer: async (
    _parent: unknown,
    args: { id: string },
    context: GraphQLContext,
  ) => {
    requireAuth(context);
    requireRole(context, ["ADMIN"]);

    const producer = await context.loaders.producer.load(args.id);
    if (!producer) {
      throw new NotFoundError("Producer", args.id);
    }

    // Check if producer has batches
    const batchCount = await context.loaders.producerBatchCount.load(args.id);
    if (batchCount > 0) {
      throw new ConflictError("Cannot delete producer with existing batches");
    }

    await context.prisma.producer.delete({
      where: { id: args.id },
    });

    return {
      success: true,
      message: "Producer deleted successfully",
      deletedId: args.id,
    };
  },
};

// ═══════════════════════════════════════════════════════════════════════════════
// FIELD RESOLVERS
// ═══════════════════════════════════════════════════════════════════════════════

export const producerFieldResolvers = {
  Producer: {
    user: async (parent: Producer, _args: unknown, context: GraphQLContext) => {
      return context.loaders.user.load(parent.userId);
    },

    batches: async (
      parent: Producer,
      args: { pagination?: PaginationInput },
      context: GraphQLContext,
    ) => {
      const page = args.pagination?.page || 1;
      const limit = Math.min(args.pagination?.limit || 20, 100);
      const skip = (page - 1) * limit;

      const where: Prisma.BatchWhereInput = { producerId: parent.id };

      const [batches, totalCount] = await Promise.all([
        context.prisma.batch.findMany({
          where,
          orderBy: { createdAt: "desc" },
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

    certifications: async (
      parent: Producer,
      _args: unknown,
      context: GraphQLContext,
    ) => {
      return context.prisma.certification.findMany({
        where: { producerId: parent.id },
        orderBy: { issuedAt: "desc" },
      });
    },

    batchCount: async (
      parent: Producer,
      _args: unknown,
      context: GraphQLContext,
    ) => {
      return context.loaders.producerBatchCount.load(parent.id);
    },

    activeBatchCount: async (
      parent: Producer,
      _args: unknown,
      context: GraphQLContext,
    ) => {
      return context.loaders.producerActiveBatchCount.load(parent.id);
    },
  },
};
