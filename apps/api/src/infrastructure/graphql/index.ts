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
  GraphQLContext,
  AuthenticatedContext,
  ContextUser,
  requireAuth,
  requireRole,
  hasRole,
  isAdmin,
  isAdminOrAuditor,
  isOwner,
  canAccess,
} from './context.js';

// Schema
export { typeDefs } from './schema/index.js';

// Resolvers
export { resolvers } from './resolvers/index.js';

// DataLoaders
export {
  createDataLoaders,
  DataLoaders,
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
