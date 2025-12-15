/**
 * @file Batch DataLoader
 * @description DataLoader for batching and caching batch queries
 *
 * Prevents N+1 queries by batching multiple individual fetch requests
 * into a single database query.
 *
 * @author AgroBridge Engineering Team
 */

import DataLoader from 'dataloader';
import { PrismaClient, Batch } from '@prisma/client';

/**
 * Create batch loader
 *
 * @param prisma - Prisma client instance
 * @returns DataLoader for batches
 */
export function createBatchLoader(
  prisma: PrismaClient
): DataLoader<string, Batch | null> {
  return new DataLoader<string, Batch | null>(
    async (ids: readonly string[]) => {
      // Fetch all batches in a single query
      const batches = await prisma.batch.findMany({
        where: {
          id: {
            in: ids as string[],
          },
        },
      });

      // Create a map for O(1) lookup
      const batchMap = new Map<string, Batch>();
      batches.forEach((batch) => {
        batchMap.set(batch.id, batch);
      });

      // Return in same order as requested IDs
      // Important: DataLoader requires results in same order as keys
      return ids.map((id) => batchMap.get(id) || null);
    },
    {
      // Cache results for the duration of the request
      cache: true,
      // Maximum batch size
      maxBatchSize: 100,
    }
  );
}

/**
 * Batch loader with specific fields
 */
export function createBatchLoaderWithFields<T>(
  prisma: PrismaClient,
  select: Record<string, boolean>
): DataLoader<string, T | null> {
  return new DataLoader<string, T | null>(
    async (ids: readonly string[]) => {
      const batches = await prisma.batch.findMany({
        where: {
          id: {
            in: ids as string[],
          },
        },
        select: {
          id: true,
          ...select,
        },
      });

      const batchMap = new Map<string, T>();
      batches.forEach((batch) => {
        batchMap.set(batch.id, batch as T);
      });

      return ids.map((id) => batchMap.get(id) || null);
    },
    { cache: true, maxBatchSize: 100 }
  );
}

/**
 * Load batches by producer ID
 */
export function createBatchesByProducerLoader(
  prisma: PrismaClient
): DataLoader<string, Batch[]> {
  return new DataLoader<string, Batch[]>(
    async (producerIds: readonly string[]) => {
      const batches = await prisma.batch.findMany({
        where: {
          producerId: {
            in: producerIds as string[],
          },
        },
        orderBy: { createdAt: 'desc' },
      });

      // Group batches by producer ID
      const batchesByProducer = new Map<string, Batch[]>();
      producerIds.forEach((id) => batchesByProducer.set(id, []));

      batches.forEach((batch) => {
        const existing = batchesByProducer.get(batch.producerId) || [];
        existing.push(batch);
        batchesByProducer.set(batch.producerId, existing);
      });

      return producerIds.map((id) => batchesByProducer.get(id) || []);
    },
    { cache: true, maxBatchSize: 50 }
  );
}

export type BatchLoaderType = ReturnType<typeof createBatchLoader>;
export type BatchesByProducerLoaderType = ReturnType<typeof createBatchesByProducerLoader>;
