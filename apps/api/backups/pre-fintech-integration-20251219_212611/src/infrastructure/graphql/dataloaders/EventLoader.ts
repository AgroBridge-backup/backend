/**
 * @file Event DataLoader
 * @description DataLoader for batching and caching TraceabilityEvent queries
 *
 * @author AgroBridge Engineering Team
 */

import DataLoader from 'dataloader';
import { PrismaClient, TraceabilityEvent } from '@prisma/client';

/**
 * Create event loader
 */
export function createEventLoader(
  prisma: PrismaClient
): DataLoader<string, TraceabilityEvent | null> {
  return new DataLoader<string, TraceabilityEvent | null>(
    async (ids: readonly string[]) => {
      const events = await prisma.traceabilityEvent.findMany({
        where: {
          id: {
            in: ids as string[],
          },
        },
      });

      const eventMap = new Map<string, TraceabilityEvent>();
      events.forEach((event) => {
        eventMap.set(event.id, event);
      });

      return ids.map((id) => eventMap.get(id) || null);
    },
    { cache: true, maxBatchSize: 100 }
  );
}

/**
 * Load events by batch ID
 */
export function createEventsByBatchLoader(
  prisma: PrismaClient
): DataLoader<string, TraceabilityEvent[]> {
  return new DataLoader<string, TraceabilityEvent[]>(
    async (batchIds: readonly string[]) => {
      const events = await prisma.traceabilityEvent.findMany({
        where: {
          batchId: {
            in: batchIds as string[],
          },
        },
        orderBy: { timestamp: 'asc' },
      });

      // Group events by batch ID
      const eventsByBatch = new Map<string, TraceabilityEvent[]>();
      batchIds.forEach((id) => eventsByBatch.set(id, []));

      events.forEach((event) => {
        const existing = eventsByBatch.get(event.batchId) || [];
        existing.push(event);
        eventsByBatch.set(event.batchId, existing);
      });

      return batchIds.map((id) => eventsByBatch.get(id) || []);
    },
    { cache: true, maxBatchSize: 50 }
  );
}

/**
 * Load event count per batch
 */
export function createEventCountByBatchLoader(
  prisma: PrismaClient
): DataLoader<string, number> {
  return new DataLoader<string, number>(
    async (batchIds: readonly string[]) => {
      const counts = await prisma.traceabilityEvent.groupBy({
        by: ['batchId'],
        where: {
          batchId: {
            in: batchIds as string[],
          },
        },
        _count: true,
      });

      const countMap = new Map<string, number>();
      counts.forEach((item) => {
        countMap.set(item.batchId, item._count);
      });

      return batchIds.map((id) => countMap.get(id) || 0);
    },
    { cache: true, maxBatchSize: 100 }
  );
}

/**
 * Load latest event per batch
 */
export function createLatestEventByBatchLoader(
  prisma: PrismaClient
): DataLoader<string, TraceabilityEvent | null> {
  return new DataLoader<string, TraceabilityEvent | null>(
    async (batchIds: readonly string[]) => {
      // Get latest event for each batch using raw query for DISTINCT ON
      const latestEvents = await prisma.$queryRaw<Array<{ batchId: string; id: string }>>`
        SELECT DISTINCT ON ("batchId") "batchId", "id"
        FROM "traceability_events"
        WHERE "batchId" = ANY(${batchIds as string[]}::text[])
        ORDER BY "batchId", "timestamp" DESC
      `;

      if (latestEvents.length === 0) {
        return batchIds.map(() => null);
      }

      // Fetch full event data
      const eventIds = latestEvents.map((e) => e.id);
      const events = await prisma.traceabilityEvent.findMany({
        where: { id: { in: eventIds } },
      });

      const eventMap = new Map<string, TraceabilityEvent>();
      events.forEach((event) => {
        eventMap.set(event.batchId, event);
      });

      return batchIds.map((id) => eventMap.get(id) || null);
    },
    { cache: true, maxBatchSize: 50 }
  );
}

export type EventLoaderType = ReturnType<typeof createEventLoader>;
export type EventsByBatchLoaderType = ReturnType<typeof createEventsByBatchLoader>;
export type EventCountByBatchLoaderType = ReturnType<typeof createEventCountByBatchLoader>;
export type LatestEventByBatchLoaderType = ReturnType<typeof createLatestEventByBatchLoader>;
