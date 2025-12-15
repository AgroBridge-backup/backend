/**
 * @file DataLoaders Index
 * @description Export all DataLoaders and create loader factory
 *
 * DataLoaders prevent N+1 queries by batching multiple individual
 * fetch requests into a single database query.
 *
 * @author AgroBridge Engineering Team
 */

import { PrismaClient } from '@prisma/client';

import {
  createBatchLoader,
  createBatchesByProducerLoader,
  BatchLoaderType,
  BatchesByProducerLoaderType,
} from './BatchLoader.js';

import {
  createProducerLoader,
  createProducerByUserIdLoader,
  createProducerBatchCountLoader,
  createProducerActiveBatchCountLoader,
  ProducerLoaderType,
  ProducerByUserIdLoaderType,
  ProducerBatchCountLoaderType,
} from './ProducerLoader.js';

import {
  createEventLoader,
  createEventsByBatchLoader,
  createEventCountByBatchLoader,
  createLatestEventByBatchLoader,
  EventLoaderType,
  EventsByBatchLoaderType,
  EventCountByBatchLoaderType,
  LatestEventByBatchLoaderType,
} from './EventLoader.js';

import {
  createUserLoader,
  createUserByEmailLoader,
  UserLoaderType,
} from './UserLoader.js';

// ═══════════════════════════════════════════════════════════════════════════════
// LOADER TYPES
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * All available data loaders
 */
export interface DataLoaders {
  // Batch loaders
  batch: BatchLoaderType;
  batchesByProducer: BatchesByProducerLoaderType;

  // Producer loaders
  producer: ProducerLoaderType;
  producerByUserId: ProducerByUserIdLoaderType;
  producerBatchCount: ProducerBatchCountLoaderType;
  producerActiveBatchCount: ProducerBatchCountLoaderType;

  // Event loaders
  event: EventLoaderType;
  eventsByBatch: EventsByBatchLoaderType;
  eventCountByBatch: EventCountByBatchLoaderType;
  latestEventByBatch: LatestEventByBatchLoaderType;

  // User loaders
  user: UserLoaderType;
  userByEmail: ReturnType<typeof createUserByEmailLoader>;
}

// ═══════════════════════════════════════════════════════════════════════════════
// LOADER FACTORY
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Create all data loaders
 *
 * Should be called once per request to ensure request-scoped caching.
 * Each request gets fresh loaders to prevent stale data across requests.
 *
 * @param prisma - Prisma client instance
 * @returns Object containing all data loaders
 */
export function createDataLoaders(prisma: PrismaClient): DataLoaders {
  return {
    // Batch loaders
    batch: createBatchLoader(prisma),
    batchesByProducer: createBatchesByProducerLoader(prisma),

    // Producer loaders
    producer: createProducerLoader(prisma),
    producerByUserId: createProducerByUserIdLoader(prisma),
    producerBatchCount: createProducerBatchCountLoader(prisma),
    producerActiveBatchCount: createProducerActiveBatchCountLoader(prisma),

    // Event loaders
    event: createEventLoader(prisma),
    eventsByBatch: createEventsByBatchLoader(prisma),
    eventCountByBatch: createEventCountByBatchLoader(prisma),
    latestEventByBatch: createLatestEventByBatchLoader(prisma),

    // User loaders
    user: createUserLoader(prisma),
    userByEmail: createUserByEmailLoader(prisma),
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════════════════════

export {
  // Batch
  createBatchLoader,
  createBatchesByProducerLoader,
  BatchLoaderType,
  BatchesByProducerLoaderType,
} from './BatchLoader.js';

export {
  // Producer
  createProducerLoader,
  createProducerByUserIdLoader,
  createProducerBatchCountLoader,
  createProducerActiveBatchCountLoader,
  ProducerLoaderType,
  ProducerByUserIdLoaderType,
  ProducerBatchCountLoaderType,
} from './ProducerLoader.js';

export {
  // Event
  createEventLoader,
  createEventsByBatchLoader,
  createEventCountByBatchLoader,
  createLatestEventByBatchLoader,
  EventLoaderType,
  EventsByBatchLoaderType,
  EventCountByBatchLoaderType,
  LatestEventByBatchLoaderType,
} from './EventLoader.js';

export {
  // User
  createUserLoader,
  createUserByEmailLoader,
  UserLoaderType,
  SafeUser,
} from './UserLoader.js';
