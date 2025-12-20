/**
 * @file GraphQL Context
 * @description Request-scoped context for GraphQL resolvers
 *
 * @author AgroBridge Engineering Team
 */

import { Request, Response } from 'express';
import { PrismaClient, User, UserRole } from '@prisma/client';
import { createDataLoaders, DataLoaders } from './dataloaders/index.js';
import { AuthenticationError } from './errors.js';
import jwt from 'jsonwebtoken';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * JWT payload structure
 */
interface JWTPayload {
  sub: string;
  email: string;
  role: UserRole;
  iat: number;
  exp: number;
}

/**
 * Authenticated user in context
 */
export interface ContextUser {
  id: string;
  email: string;
  role: UserRole;
}

/**
 * GraphQL context type
 */
export interface GraphQLContext {
  req: Request;
  res: Response;
  prisma: PrismaClient;
  loaders: DataLoaders;
  user: ContextUser | null;
  requestId: string;
  startTime: number;
}

/**
 * Context with authenticated user (for protected resolvers)
 */
export interface AuthenticatedContext extends GraphQLContext {
  user: ContextUser;
}

// ═══════════════════════════════════════════════════════════════════════════════
// CONTEXT FACTORY
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Extract user from JWT token
 */
function extractUserFromToken(req: Request): ContextUser | null {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.substring(7);

  try {
    const jwtSecret = process.env.JWT_SECRET || 'fallback-secret-key';
    const payload = jwt.verify(token, jwtSecret) as JWTPayload;

    return {
      id: payload.sub,
      email: payload.email,
      role: payload.role,
    };
  } catch {
    return null;
  }
}

/**
 * Generate unique request ID
 */
function generateRequestId(): string {
  return `gql-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Create GraphQL context for each request
 *
 * Creates fresh DataLoaders per request for proper request-scoped caching.
 */
export function createContext(
  prisma: PrismaClient
): (params: { req: Request; res: Response }) => GraphQLContext {
  return ({ req, res }) => {
    const user = extractUserFromToken(req);
    const requestId = (req.headers['x-request-id'] as string) || generateRequestId();
    const startTime = Date.now();

    return {
      req,
      res,
      prisma,
      loaders: createDataLoaders(prisma),
      user,
      requestId,
      startTime,
    };
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// AUTH HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Require authentication
 * @throws AuthenticationError if not authenticated
 */
export function requireAuth(context: GraphQLContext): asserts context is AuthenticatedContext {
  if (!context.user) {
    throw new AuthenticationError('Authentication required');
  }
}

/**
 * Require specific role(s)
 * @throws AuthenticationError if not authenticated
 * @throws ForbiddenError if role not allowed
 */
export function requireRole(
  context: GraphQLContext,
  allowedRoles: UserRole[]
): asserts context is AuthenticatedContext {
  requireAuth(context);

  if (!allowedRoles.includes(context.user.role)) {
    throw new AuthenticationError(
      `Access denied. Required roles: ${allowedRoles.join(', ')}`
    );
  }
}

/**
 * Check if user has role (without throwing)
 */
export function hasRole(context: GraphQLContext, roles: UserRole[]): boolean {
  return context.user !== null && roles.includes(context.user.role);
}

/**
 * Check if user is admin
 */
export function isAdmin(context: GraphQLContext): boolean {
  return context.user?.role === 'ADMIN';
}

/**
 * Check if user is admin or certifier (has elevated read access)
 */
export function isAdminOrAuditor(context: GraphQLContext): boolean {
  return context.user?.role === 'ADMIN' || context.user?.role === 'CERTIFIER';
}

/**
 * Check if user owns the resource
 */
export function isOwner(context: GraphQLContext, ownerId: string): boolean {
  return context.user?.id === ownerId;
}

/**
 * Check if user can access resource (owner, admin, or auditor)
 */
export function canAccess(context: GraphQLContext, ownerId: string): boolean {
  if (!context.user) return false;
  return isOwner(context, ownerId) || isAdminOrAuditor(context);
}
