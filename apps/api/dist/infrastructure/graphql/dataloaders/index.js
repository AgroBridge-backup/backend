import { createBatchLoader, createBatchesByProducerLoader } from './BatchLoader.js';
import { createProducerLoader, createProducerByUserIdLoader, createProducerBatchCountLoader, createProducerActiveBatchCountLoader, } from './ProducerLoader.js';
import { createEventLoader, createEventsByBatchLoader, createEventCountByBatchLoader, createLatestEventByBatchLoader, } from './EventLoader.js';
import { createUserLoader, createUserByEmailLoader } from './UserLoader.js';
export function createDataLoaders(prisma) {
    return {
        batch: createBatchLoader(prisma),
        batchesByProducer: createBatchesByProducerLoader(prisma),
        producer: createProducerLoader(prisma),
        producerByUserId: createProducerByUserIdLoader(prisma),
        producerBatchCount: createProducerBatchCountLoader(prisma),
        producerActiveBatchCount: createProducerActiveBatchCountLoader(prisma),
        event: createEventLoader(prisma),
        eventsByBatch: createEventsByBatchLoader(prisma),
        eventCountByBatch: createEventCountByBatchLoader(prisma),
        latestEventByBatch: createLatestEventByBatchLoader(prisma),
        user: createUserLoader(prisma),
        userByEmail: createUserByEmailLoader(prisma),
    };
}
export { createBatchLoader, createBatchesByProducerLoader } from './BatchLoader.js';
export { createProducerLoader, createProducerByUserIdLoader, createProducerBatchCountLoader, createProducerActiveBatchCountLoader, } from './ProducerLoader.js';
export { createEventLoader, createEventsByBatchLoader, createEventCountByBatchLoader, createLatestEventByBatchLoader, } from './EventLoader.js';
export { createUserLoader, createUserByEmailLoader } from './UserLoader.js';
