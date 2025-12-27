/**
 * @file User GraphQL Resolvers
 * @description Resolvers for User queries
 *
 * @author AgroBridge Engineering Team
 */

import {
  GraphQLContext,
  requireAuth,
  requireRole,
  isAdmin,
} from "../context.js";
import { SafeUser } from "../dataloaders/UserLoader.js";

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

interface PaginationInput {
  page?: number;
  limit?: number;
}

// ═══════════════════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

function encodeCursor(id: string): string {
  return Buffer.from(id).toString("base64");
}

// ═══════════════════════════════════════════════════════════════════════════════
// QUERY RESOLVERS
// ═══════════════════════════════════════════════════════════════════════════════

export const userQueries = {
  me: async (
    _parent: unknown,
    _args: unknown,
    context: GraphQLContext,
  ): Promise<SafeUser | null> => {
    if (!context.user) {
      return null;
    }
    return context.loaders.user.load(context.user.id);
  },

  user: async (
    _parent: unknown,
    args: { id: string },
    context: GraphQLContext,
  ): Promise<SafeUser | null> => {
    requireAuth(context);

    // Non-admin can only see their own profile
    if (!isAdmin(context) && args.id !== context.user.id) {
      requireRole(context, ["ADMIN", "CERTIFIER"]);
    }

    return context.loaders.user.load(args.id);
  },

  users: async (
    _parent: unknown,
    args: { pagination?: PaginationInput },
    context: GraphQLContext,
  ) => {
    requireAuth(context);
    requireRole(context, ["ADMIN", "CERTIFIER"]);

    const page = args.pagination?.page || 1;
    const limit = Math.min(args.pagination?.limit || 20, 100);
    const skip = (page - 1) * limit;

    const [users, totalCount] = await Promise.all([
      context.prisma.user.findMany({
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          role: true,
          isActive: true,
          walletAddress: true,
          lastLoginAt: true,
          twoFactorEnabled: true,
          twoFactorEnabledAt: true,
          createdAt: true,
          updatedAt: true,
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      context.prisma.user.count(),
    ]);

    const totalPages = Math.ceil(totalCount / limit);

    return {
      edges: users.map((user) => ({
        node: user,
        cursor: encodeCursor(user.id),
      })),
      pageInfo: {
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1,
        startCursor: users[0] ? encodeCursor(users[0].id) : null,
        endCursor: users[users.length - 1]
          ? encodeCursor(users[users.length - 1].id)
          : null,
        totalCount,
        totalPages,
        currentPage: page,
      },
      nodes: users,
    };
  },
};

// ═══════════════════════════════════════════════════════════════════════════════
// FIELD RESOLVERS
// ═══════════════════════════════════════════════════════════════════════════════

export const userFieldResolvers = {
  User: {
    fullName: (parent: SafeUser): string => {
      return `${parent.firstName} ${parent.lastName}`;
    },

    producer: async (
      parent: SafeUser,
      _args: unknown,
      context: GraphQLContext,
    ) => {
      return context.loaders.producerByUserId.load(parent.id);
    },
  },
};
