/**
 * @file Cache Module Index
 * @description Central export point for the Redis caching infrastructure
 *
 * This module provides enterprise-grade caching capabilities:
 * - Type-safe cache operations with generics
 * - TTL management per entity type
 * - Pattern-based cache invalidation
 * - Cache-aside pattern helpers
 * - Health monitoring and statistics
 *
 * @example
 * ```typescript
 * import {
 *   redisCacheService,
 *   CacheKeys,
 *   CacheTTL,
 *   cacheInvalidationService,
 * } from './infrastructure/cache';
 *
 * // Get or set with factory function
 * const batch = await redisCacheService.getOrSet(
 *   CacheKeys.batch(batchId),
 *   () => batchRepository.findById(batchId),
 *   CacheTTL.BATCH
 * );
 *
 * // Invalidate on mutation
 * await cacheInvalidationService.onEvent({
 *   event: 'BATCH_UPDATED',
 *   entityId: batchId,
 *   relatedIds: { producerId },
 * });
 * ```
 *
 * @author AgroBridge Engineering Team
 */

// ════════════════════════════════════════════════════════════════════════════════
// CACHE KEYS
// ════════════════════════════════════════════════════════════════════════════════
export { CacheKeys, CacheTTL, CachePrefix } from "./CacheKeys.js";

// ════════════════════════════════════════════════════════════════════════════════
// REDIS CACHE SERVICE
// ════════════════════════════════════════════════════════════════════════════════
export {
  RedisCacheService,
  redisCacheService,
  type CacheResult,
  type CacheStats,
  type CacheHealth,
} from "./RedisCacheService.js";

// ════════════════════════════════════════════════════════════════════════════════
// CACHE INVALIDATION SERVICE
// ════════════════════════════════════════════════════════════════════════════════
export {
  CacheInvalidationService,
  cacheInvalidationService,
  type InvalidationEvent,
  type InvalidationContext,
} from "./CacheInvalidationService.js";

// ════════════════════════════════════════════════════════════════════════════════
// LEGACY REDIS CLIENT (for backwards compatibility)
// ════════════════════════════════════════════════════════════════════════════════
export { RedisClient, redisClient } from "./RedisClient.js";
