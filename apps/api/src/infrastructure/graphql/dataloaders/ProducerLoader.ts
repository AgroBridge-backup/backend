/**
 * @file Producer DataLoader
 * @description DataLoader for batching and caching producer queries
 *
 * @author AgroBridge Engineering Team
 */

import DataLoader from "dataloader";
import { PrismaClient, Producer } from "@prisma/client";

/**
 * Create producer loader
 */
export function createProducerLoader(
  prisma: PrismaClient,
): DataLoader<string, Producer | null> {
  return new DataLoader<string, Producer | null>(
    async (ids: readonly string[]) => {
      const producers = await prisma.producer.findMany({
        where: {
          id: {
            in: ids as string[],
          },
        },
      });

      const producerMap = new Map<string, Producer>();
      producers.forEach((producer) => {
        producerMap.set(producer.id, producer);
      });

      return ids.map((id) => producerMap.get(id) || null);
    },
    { cache: true, maxBatchSize: 100 },
  );
}

/**
 * Create producer loader by user ID
 */
export function createProducerByUserIdLoader(
  prisma: PrismaClient,
): DataLoader<string, Producer | null> {
  return new DataLoader<string, Producer | null>(
    async (userIds: readonly string[]) => {
      const producers = await prisma.producer.findMany({
        where: {
          userId: {
            in: userIds as string[],
          },
        },
      });

      const producerMap = new Map<string, Producer>();
      producers.forEach((producer) => {
        producerMap.set(producer.userId, producer);
      });

      return userIds.map((id) => producerMap.get(id) || null);
    },
    { cache: true, maxBatchSize: 100 },
  );
}

/**
 * Load batch count per producer
 */
export function createProducerBatchCountLoader(
  prisma: PrismaClient,
): DataLoader<string, number> {
  return new DataLoader<string, number>(
    async (producerIds: readonly string[]) => {
      const counts = await prisma.batch.groupBy({
        by: ["producerId"],
        where: {
          producerId: {
            in: producerIds as string[],
          },
        },
        _count: true,
      });

      const countMap = new Map<string, number>();
      counts.forEach((item) => {
        countMap.set(item.producerId, item._count);
      });

      return producerIds.map((id) => countMap.get(id) || 0);
    },
    { cache: true, maxBatchSize: 100 },
  );
}

/**
 * Load active batch count per producer (REGISTERED, IN_TRANSIT, ARRIVED)
 */
export function createProducerActiveBatchCountLoader(
  prisma: PrismaClient,
): DataLoader<string, number> {
  return new DataLoader<string, number>(
    async (producerIds: readonly string[]) => {
      const counts = await prisma.batch.groupBy({
        by: ["producerId"],
        where: {
          producerId: {
            in: producerIds as string[],
          },
          status: {
            in: ["REGISTERED", "IN_TRANSIT", "ARRIVED"],
          },
        },
        _count: true,
      });

      const countMap = new Map<string, number>();
      counts.forEach((item) => {
        countMap.set(item.producerId, item._count);
      });

      return producerIds.map((id) => countMap.get(id) || 0);
    },
    { cache: true, maxBatchSize: 100 },
  );
}

export type ProducerLoaderType = ReturnType<typeof createProducerLoader>;
export type ProducerByUserIdLoaderType = ReturnType<
  typeof createProducerByUserIdLoader
>;
export type ProducerBatchCountLoaderType = ReturnType<
  typeof createProducerBatchCountLoader
>;
