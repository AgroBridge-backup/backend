import { scalarResolvers } from './scalars.js';
import { batchQueries, batchMutations, batchFieldResolvers } from './batch.resolvers.js';
import { producerQueries, producerMutations, producerFieldResolvers } from './producer.resolvers.js';
import { eventQueries, eventMutations, eventFieldResolvers } from './event.resolvers.js';
import { userQueries, userFieldResolvers } from './user.resolvers.js';
import { analyticsQueries, analyticsFieldResolvers } from './analytics.resolvers.js';
import { certificationMutations, certificationFieldResolvers } from './certification.resolvers.js';
export const resolvers = {
    ...scalarResolvers,
    Query: {
        ...userQueries,
        ...batchQueries,
        ...producerQueries,
        ...eventQueries,
        ...analyticsQueries,
    },
    Mutation: {
        ...batchMutations,
        ...producerMutations,
        ...eventMutations,
        ...certificationMutations,
    },
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
    ...batchFieldResolvers,
    ...producerFieldResolvers,
    ...eventFieldResolvers,
    ...userFieldResolvers,
    ...analyticsFieldResolvers,
    ...certificationFieldResolvers,
};
export { scalarResolvers } from './scalars.js';
export { batchQueries, batchMutations, batchFieldResolvers } from './batch.resolvers.js';
export { producerQueries, producerMutations, producerFieldResolvers } from './producer.resolvers.js';
export { eventQueries, eventMutations, eventFieldResolvers } from './event.resolvers.js';
export { userQueries, userFieldResolvers } from './user.resolvers.js';
export { analyticsQueries, analyticsFieldResolvers } from './analytics.resolvers.js';
export { certificationMutations, certificationFieldResolvers } from './certification.resolvers.js';
