/**
 * @file GraphQL Infrastructure Index
 * @description Main entry point for GraphQL infrastructure
 *
 * @author AgroBridge Engineering Team
 */

// Server
export {
  createGraphQLServer,
  createGraphQLMiddleware,
  getGraphQLInfo,
} from './server.js';

// Context
export {
  createContext,
  requireAuth,
  requireRole,
  hasRole,
  isAdmin,
  isAdminOrAuditor,
  isOwner,
  canAccess,
} from './context.js';
export type { GraphQLContext, AuthenticatedContext, ContextUser } from './context.js';

// Schema
export { typeDefs } from './schema/index.js';

// Resolvers
export { resolvers } from './resolvers/index.js';

// DataLoaders
export {
  createDataLoaders,
  createBatchLoader,
  createBatchesByProducerLoader,
  createProducerLoader,
  createProducerByUserIdLoader,
  createProducerBatchCountLoader,
  createProducerActiveBatchCountLoader,
  createEventLoader,
  createEventsByBatchLoader,
  createEventCountByBatchLoader,
  createLatestEventByBatchLoader,
  createUserLoader,
  createUserByEmailLoader,
} from './dataloaders/index.js';
export type { DataLoaders } from './dataloaders/index.js';

// Errors
export {
  AuthenticationError,
  ForbiddenError,
  ValidationError,
  NotFoundError,
  ConflictError,
  RateLimitError,
  InternalError,
} from './errors.js';
