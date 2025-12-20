/**
 * @file GraphQL Resolvers Index
 * @description Combines all resolvers into a single resolver map
 *
 * @author AgroBridge Engineering Team
 */

import { scalarResolvers } from './scalars.js';
import { batchQueries, batchMutations, batchFieldResolvers } from './batch.resolvers.js';
import { producerQueries, producerMutations, producerFieldResolvers } from './producer.resolvers.js';
import { eventQueries, eventMutations, eventFieldResolvers } from './event.resolvers.js';
import { userQueries, userFieldResolvers } from './user.resolvers.js';
import { analyticsQueries, analyticsFieldResolvers } from './analytics.resolvers.js';
import { certificationMutations, certificationFieldResolvers } from './certification.resolvers.js';

// ═══════════════════════════════════════════════════════════════════════════════
// COMBINED RESOLVERS
// ═══════════════════════════════════════════════════════════════════════════════

export const resolvers = {
  // Scalars
  ...scalarResolvers,

  // Queries
  Query: {
    // User queries
    ...userQueries,

    // Batch queries
    ...batchQueries,

    // Producer queries
    ...producerQueries,

    // Event queries
    ...eventQueries,

    // Analytics queries
    ...analyticsQueries,
  },

  // Mutations
  Mutation: {
    // Batch mutations
    ...batchMutations,

    // Producer mutations
    ...producerMutations,

    // Event mutations
    ...eventMutations,

    // Certification mutations
    ...certificationMutations,
  },

  // Subscriptions placeholder (would need PubSub implementation)
  Subscription: {
    batchCreated: {
      subscribe: () => {
        throw new Error('Subscriptions not yet implemented');
      },
    },
    batchStatusChanged: {
      subscribe: () => {
        throw new Error('Subscriptions not yet implemented');
      },
    },
    eventCreated: {
      subscribe: () => {
        throw new Error('Subscriptions not yet implemented');
      },
    },
    producerWhitelisted: {
      subscribe: () => {
        throw new Error('Subscriptions not yet implemented');
      },
    },
  },

  // Field resolvers
  ...batchFieldResolvers,
  ...producerFieldResolvers,
  ...eventFieldResolvers,
  ...userFieldResolvers,
  ...analyticsFieldResolvers,
  ...certificationFieldResolvers,
};

// ═══════════════════════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════════════════════

export { scalarResolvers } from './scalars.js';
export { batchQueries, batchMutations, batchFieldResolvers } from './batch.resolvers.js';
export { producerQueries, producerMutations, producerFieldResolvers } from './producer.resolvers.js';
export { eventQueries, eventMutations, eventFieldResolvers } from './event.resolvers.js';
export { userQueries, userFieldResolvers } from './user.resolvers.js';
export { analyticsQueries, analyticsFieldResolvers } from './analytics.resolvers.js';
export { certificationMutations, certificationFieldResolvers } from './certification.resolvers.js';
