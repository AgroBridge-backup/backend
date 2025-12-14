/**
 * @file Cache Invalidation Service
 * @description Provides intelligent cache invalidation strategies for domain entities
 *
 * Features:
 * - Cascade invalidation (when a producer is updated, invalidate their batches too)
 * - Batch invalidation for bulk operations
 * - Scheduled invalidation for time-sensitive data
 * - Event-driven invalidation hooks
 *
 * @author AgroBridge Engineering Team
 */

import logger from '../../shared/utils/logger.js';
import { redisCacheService, RedisCacheService } from './RedisCacheService.js';
import { CacheKeys } from './CacheKeys.js';

/**
 * Invalidation event types for tracking
 */
export type InvalidationEvent =
  | 'BATCH_CREATED'
  | 'BATCH_UPDATED'
  | 'BATCH_DELETED'
  | 'BATCH_STATUS_CHANGED'
  | 'PRODUCER_CREATED'
  | 'PRODUCER_UPDATED'
  | 'PRODUCER_DELETED'
  | 'PRODUCER_WHITELISTED'
  | 'EVENT_CREATED'
  | 'EVENT_UPDATED'
  | 'EVENT_VERIFIED'
  | 'USER_UPDATED'
  | 'CERTIFICATION_ADDED'
  | 'CERTIFICATION_REMOVED';

/**
 * Invalidation context passed to handlers
 */
export interface InvalidationContext {
  event: InvalidationEvent;
  entityId: string;
  relatedIds?: {
    batchId?: string;
    producerId?: string;
    userId?: string;
  };
  metadata?: Record<string, unknown>;
}

/**
 * Cache Invalidation Service
 *
 * Provides smart cache invalidation with support for:
 * - Cascade invalidation across related entities
 * - Bulk invalidation for batch operations
 * - Event-driven invalidation triggers
 */
export class CacheInvalidationService {
  constructor(private cacheService: RedisCacheService = redisCacheService) {}

  // ═══════════════════════════════════════════════════════════════════════════════
  // EVENT-DRIVEN INVALIDATION
  // ═══════════════════════════════════════════════════════════════════════════════

  /**
   * Handle invalidation based on a domain event
   * This is the main entry point for event-driven cache invalidation
   *
   * @param context - Invalidation context with event type and entity info
   */
  async onEvent(context: InvalidationContext): Promise<void> {
    logger.debug({
      message: 'Cache invalidation triggered',
      meta: { event: context.event, entityId: context.entityId },
    });

    switch (context.event) {
      // Batch events
      case 'BATCH_CREATED':
      case 'BATCH_UPDATED':
      case 'BATCH_DELETED':
      case 'BATCH_STATUS_CHANGED':
        await this.invalidateBatchCascade(
          context.entityId,
          context.relatedIds?.producerId
        );
        break;

      // Producer events
      case 'PRODUCER_CREATED':
      case 'PRODUCER_UPDATED':
      case 'PRODUCER_DELETED':
      case 'PRODUCER_WHITELISTED':
        await this.invalidateProducerCascade(
          context.entityId,
          context.relatedIds?.userId
        );
        break;

      // Event (traceability) events
      case 'EVENT_CREATED':
      case 'EVENT_UPDATED':
      case 'EVENT_VERIFIED':
        await this.invalidateEventCascade(
          context.entityId,
          context.relatedIds?.batchId
        );
        break;

      // User events
      case 'USER_UPDATED':
        await this.invalidateUserCascade(context.entityId);
        break;

      // Certification events
      case 'CERTIFICATION_ADDED':
      case 'CERTIFICATION_REMOVED':
        if (context.relatedIds?.producerId) {
          await this.invalidateProducerCascade(context.relatedIds.producerId);
        }
        break;
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // CASCADE INVALIDATION STRATEGIES
  // ═══════════════════════════════════════════════════════════════════════════════

  /**
   * Invalidate batch cache with cascade to related caches
   *
   * Invalidates:
   * - Specific batch cache
   * - Batch by number mapping
   * - Batch history cache
   * - Batch list caches
   * - Batch statistics
   *
   * @param batchId - The batch ID to invalidate
   * @param producerId - Optional producer ID for cascade to producer lists
   */
  async invalidateBatchCascade(
    batchId: string,
    producerId?: string
  ): Promise<void> {
    const promises: Promise<unknown>[] = [];

    // Invalidate specific batch
    promises.push(this.cacheService.del(CacheKeys.batch(batchId)));

    // Invalidate batch history
    promises.push(this.cacheService.del(CacheKeys.batchHistory(batchId)));

    // Invalidate all batch list caches
    promises.push(this.cacheService.invalidatePattern('batch:list:*'));

    // Invalidate batch statistics
    promises.push(this.cacheService.invalidatePattern('stats:batches:*'));

    // If producer ID is known, invalidate producer-specific batch lists
    if (producerId) {
      promises.push(
        this.cacheService.invalidatePattern(
          `batch:list:producer:${producerId}*`
        )
      );
    }

    await Promise.all(promises);

    logger.debug({
      message: 'Batch cache cascade invalidated',
      meta: { batchId, producerId },
    });
  }

  /**
   * Invalidate producer cache with cascade to related caches
   *
   * Invalidates:
   * - Specific producer cache
   * - Producer by RFC mapping
   * - Producer by user ID mapping
   * - Producer list caches
   * - Producer statistics
   * - All batches for this producer
   *
   * @param producerId - The producer ID to invalidate
   * @param userId - Optional user ID for cascade
   */
  async invalidateProducerCascade(
    producerId: string,
    userId?: string
  ): Promise<void> {
    const promises: Promise<unknown>[] = [];

    // Invalidate specific producer
    promises.push(this.cacheService.del(CacheKeys.producer(producerId)));

    // Invalidate producer by user mapping
    if (userId) {
      promises.push(this.cacheService.del(CacheKeys.producerByUserId(userId)));
    }

    // Invalidate all producer list caches
    promises.push(this.cacheService.invalidatePattern('producer:list:*'));

    // Invalidate producer statistics
    promises.push(this.cacheService.invalidatePattern('stats:producers*'));

    // Invalidate batch lists for this producer
    promises.push(
      this.cacheService.invalidatePattern(
        `batch:list:producer:${producerId}*`
      )
    );

    await Promise.all(promises);

    logger.debug({
      message: 'Producer cache cascade invalidated',
      meta: { producerId, userId },
    });
  }

  /**
   * Invalidate event cache with cascade to related caches
   *
   * Invalidates:
   * - Specific event cache
   * - Events by batch list
   * - Batch history cache
   * - Event statistics
   *
   * @param eventId - The event ID to invalidate
   * @param batchId - Optional batch ID for cascade
   */
  async invalidateEventCascade(eventId: string, batchId?: string): Promise<void> {
    const promises: Promise<unknown>[] = [];

    // Invalidate specific event
    promises.push(this.cacheService.del(CacheKeys.event(eventId)));

    // If batch ID is known, invalidate batch-related event caches
    if (batchId) {
      promises.push(this.cacheService.del(CacheKeys.eventsByBatch(batchId)));
      promises.push(this.cacheService.del(CacheKeys.batchHistory(batchId)));
    }

    // Invalidate event statistics
    promises.push(this.cacheService.invalidatePattern('stats:events:*'));

    await Promise.all(promises);

    logger.debug({
      message: 'Event cache cascade invalidated',
      meta: { eventId, batchId },
    });
  }

  /**
   * Invalidate user cache with cascade to related caches
   *
   * Invalidates:
   * - Specific user cache
   * - User by email mapping
   * - User-related notification preferences
   *
   * @param userId - The user ID to invalidate
   */
  async invalidateUserCascade(userId: string): Promise<void> {
    const promises: Promise<unknown>[] = [];

    // Invalidate specific user
    promises.push(this.cacheService.del(CacheKeys.user(userId)));

    // Invalidate user pattern (catches email mappings)
    promises.push(this.cacheService.invalidatePattern(`user:${userId}*`));

    // Invalidate producer if user is a producer
    promises.push(this.cacheService.del(CacheKeys.producerByUserId(userId)));

    await Promise.all(promises);

    logger.debug({
      message: 'User cache cascade invalidated',
      meta: { userId },
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // BULK OPERATIONS
  // ═══════════════════════════════════════════════════════════════════════════════

  /**
   * Invalidate multiple batches efficiently
   * @param batchIds - Array of batch IDs to invalidate
   */
  async invalidateBatches(batchIds: string[]): Promise<void> {
    if (batchIds.length === 0) return;

    const keys = batchIds.flatMap((id) => [
      CacheKeys.batch(id),
      CacheKeys.batchHistory(id),
    ]);

    await this.cacheService.delMultiple(keys);

    // Also invalidate list caches
    await this.cacheService.invalidatePattern('batch:list:*');
    await this.cacheService.invalidatePattern('stats:batches:*');

    logger.debug({
      message: 'Bulk batch cache invalidation completed',
      meta: { count: batchIds.length },
    });
  }

  /**
   * Invalidate multiple producers efficiently
   * @param producerIds - Array of producer IDs to invalidate
   */
  async invalidateProducers(producerIds: string[]): Promise<void> {
    if (producerIds.length === 0) return;

    const keys = producerIds.map((id) => CacheKeys.producer(id));

    await this.cacheService.delMultiple(keys);

    // Also invalidate list caches
    await this.cacheService.invalidatePattern('producer:list:*');
    await this.cacheService.invalidatePattern('stats:producers*');

    logger.debug({
      message: 'Bulk producer cache invalidation completed',
      meta: { count: producerIds.length },
    });
  }

  /**
   * Invalidate multiple events efficiently
   * @param eventIds - Array of event IDs to invalidate
   */
  async invalidateEvents(eventIds: string[]): Promise<void> {
    if (eventIds.length === 0) return;

    const keys = eventIds.map((id) => CacheKeys.event(id));

    await this.cacheService.delMultiple(keys);

    // Also invalidate event-related caches
    await this.cacheService.invalidatePattern('stats:events:*');

    logger.debug({
      message: 'Bulk event cache invalidation completed',
      meta: { count: eventIds.length },
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // CACHE WARMING
  // ═══════════════════════════════════════════════════════════════════════════════

  /**
   * Warm cache for frequently accessed data
   * Call this on server startup or after cache flush
   *
   * @param options - Warming options
   */
  async warmCache(options?: {
    producers?: boolean;
    batches?: boolean;
    stats?: boolean;
  }): Promise<void> {
    const opts = {
      producers: true,
      batches: true,
      stats: true,
      ...options,
    };

    logger.info({ message: 'Starting cache warming...' });

    // Note: Actual warming requires access to repositories
    // This method is designed to be called from the application layer
    // where repositories are available

    const tasks: Promise<void>[] = [];

    if (opts.stats) {
      // Pre-warm health check
      await this.cacheService.set(CacheKeys.health(), { status: 'warming' }, 30);
    }

    await Promise.all(tasks);

    logger.info({ message: 'Cache warming completed' });
  }
}

/**
 * Singleton instance of the Cache Invalidation Service
 */
export const cacheInvalidationService = new CacheInvalidationService();

export default cacheInvalidationService;
