/**
 * @file Enhanced Redis Cache Service for domain entity caching
 * @description Provides a comprehensive caching layer for batches, producers, and events
 *
 * Features:
 * - Type-safe get/set operations with generics
 * - Configurable TTL per entity type
 * - Pattern-based cache invalidation
 * - Health check integration
 * - Cache warming support
 * - Metrics collection
 *
 * @author AgroBridge Engineering Team
 */

import { Redis } from 'ioredis';
import logger from '../../shared/utils/logger.js';
import { CacheTTL, CacheKeys, CachePrefix } from './CacheKeys.js';

/**
 * Cache operation result with metadata
 */
export interface CacheResult<T> {
  hit: boolean;
  data: T | null;
  ttl?: number;
}

/**
 * Cache statistics for monitoring
 */
export interface CacheStats {
  hits: number;
  misses: number;
  errors: number;
  keys: number;
  memoryUsage: string;
  uptime: number;
}

/**
 * Cache health status
 */
export interface CacheHealth {
  status: 'healthy' | 'degraded' | 'unhealthy';
  connected: boolean;
  latencyMs: number;
  errorMessage?: string;
}

/**
 * Enhanced Redis Cache Service
 *
 * Provides a type-safe caching layer for AgroBridge domain entities with
 * automatic TTL management, pattern-based invalidation, and health monitoring.
 *
 * @example
 * ```typescript
 * // Cache a batch
 * await redisCacheService.set(CacheKeys.batch(batchId), batch, CacheTTL.BATCH);
 *
 * // Get from cache with type safety
 * const result = await redisCacheService.get<Batch>(CacheKeys.batch(batchId));
 * if (result.hit) {
 *   return result.data;
 * }
 *
 * // Invalidate on mutation
 * await redisCacheService.invalidatePattern(CacheKeys.batchPattern(batchId));
 * ```
 */
export class RedisCacheService {
  private client: Redis;
  private isConnected: boolean = false;
  private stats: { hits: number; misses: number; errors: number } = {
    hits: 0,
    misses: 0,
    errors: 0,
  };

  constructor() {
    this.client = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379', 10),
      password: process.env.REDIS_PASSWORD || undefined,
      db: parseInt(process.env.REDIS_DB || '0', 10),
      retryStrategy: (times) => {
        const delay = Math.min(times * 50, 2000);
        logger.warn({
          message: `Redis connection retry attempt ${times}`,
          meta: { delay },
        });
        return delay;
      },
      maxRetriesPerRequest: 3,
      enableReadyCheck: true,
      lazyConnect: false,
    });

    this.setupEventHandlers();
  }

  /**
   * Setup Redis client event handlers
   */
  private setupEventHandlers(): void {
    this.client.on('connect', () => {
      logger.info({ message: 'Redis cache service connecting...' });
    });

    this.client.on('ready', () => {
      this.isConnected = true;
      logger.info({ message: 'Redis cache service connected and ready' });
    });

    this.client.on('error', (err: Error) => {
      this.stats.errors++;
      logger.error({
        message: 'Redis cache service error',
        meta: { error: err.message },
      });
    });

    this.client.on('close', () => {
      this.isConnected = false;
      logger.warn({ message: 'Redis cache service connection closed' });
    });

    this.client.on('reconnecting', () => {
      logger.info({ message: 'Redis cache service reconnecting...' });
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // CORE CACHE OPERATIONS
  // ═══════════════════════════════════════════════════════════════════════════════

  /**
   * Get a value from cache with type safety
   * @param key - Cache key
   * @returns Cache result with hit/miss status and data
   */
  async get<T>(key: string): Promise<CacheResult<T>> {
    try {
      const data = await this.client.get(key);

      if (data === null) {
        this.stats.misses++;
        return { hit: false, data: null };
      }

      this.stats.hits++;
      const ttl = await this.client.ttl(key);

      return {
        hit: true,
        data: JSON.parse(data) as T,
        ttl: ttl > 0 ? ttl : undefined,
      };
    } catch (error) {
      this.stats.errors++;
      logger.error({
        message: 'Cache get error',
        meta: { key, error: (error as Error).message },
      });
      return { hit: false, data: null };
    }
  }

  /**
   * Set a value in cache with TTL
   * @param key - Cache key
   * @param value - Value to cache (will be JSON serialized)
   * @param ttlSeconds - Time to live in seconds (default: 300)
   */
  async set<T>(
    key: string,
    value: T,
    ttlSeconds: number = CacheTTL.BATCH
  ): Promise<boolean> {
    try {
      const serialized = JSON.stringify(value);
      await this.client.setex(key, ttlSeconds, serialized);
      return true;
    } catch (error) {
      this.stats.errors++;
      logger.error({
        message: 'Cache set error',
        meta: { key, error: (error as Error).message },
      });
      return false;
    }
  }

  /**
   * Delete a specific key from cache
   * @param key - Cache key to delete
   */
  async del(key: string): Promise<boolean> {
    try {
      await this.client.del(key);
      return true;
    } catch (error) {
      this.stats.errors++;
      logger.error({
        message: 'Cache delete error',
        meta: { key, error: (error as Error).message },
      });
      return false;
    }
  }

  /**
   * Delete multiple keys from cache
   * @param keys - Array of cache keys to delete
   */
  async delMultiple(keys: string[]): Promise<boolean> {
    if (keys.length === 0) return true;

    try {
      await this.client.del(...keys);
      return true;
    } catch (error) {
      this.stats.errors++;
      logger.error({
        message: 'Cache delete multiple error',
        meta: { keyCount: keys.length, error: (error as Error).message },
      });
      return false;
    }
  }

  /**
   * Check if a key exists in cache
   * @param key - Cache key
   */
  async exists(key: string): Promise<boolean> {
    try {
      const result = await this.client.exists(key);
      return result === 1;
    } catch (error) {
      this.stats.errors++;
      return false;
    }
  }

  /**
   * Get remaining TTL for a key
   * @param key - Cache key
   * @returns TTL in seconds, -1 if no TTL, -2 if key doesn't exist
   */
  async getTTL(key: string): Promise<number> {
    try {
      return await this.client.ttl(key);
    } catch (error) {
      this.stats.errors++;
      return -2;
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // CACHE INVALIDATION
  // ═══════════════════════════════════════════════════════════════════════════════

  /**
   * Invalidate cache entries matching a pattern
   * Uses SCAN for non-blocking iteration on large datasets
   *
   * @param pattern - Redis glob pattern (e.g., "batch:*", "producer:123*")
   * @returns Number of keys deleted
   */
  async invalidatePattern(pattern: string): Promise<number> {
    try {
      const keys: string[] = [];
      let cursor = '0';

      // Use SCAN for non-blocking iteration
      do {
        const [nextCursor, foundKeys] = await this.client.scan(
          cursor,
          'MATCH',
          pattern,
          'COUNT',
          100
        );
        cursor = nextCursor;
        keys.push(...foundKeys);
      } while (cursor !== '0');

      if (keys.length > 0) {
        await this.client.del(...keys);
        logger.debug({
          message: 'Cache invalidation completed',
          meta: { pattern, keysDeleted: keys.length },
        });
      }

      return keys.length;
    } catch (error) {
      this.stats.errors++;
      logger.error({
        message: 'Cache invalidation error',
        meta: { pattern, error: (error as Error).message },
      });
      return 0;
    }
  }

  /**
   * Invalidate all batch-related cache entries
   * @param batchId - Optional specific batch ID
   */
  async invalidateBatch(batchId?: string): Promise<void> {
    await this.invalidatePattern(CacheKeys.batchPattern(batchId));
    // Also invalidate batch list caches
    await this.invalidatePattern(`${CachePrefix.BATCH}:${CachePrefix.LIST}:*`);
    // Invalidate related stats
    await this.invalidatePattern(`${CachePrefix.STATS}:batches:*`);
  }

  /**
   * Invalidate all producer-related cache entries
   * @param producerId - Optional specific producer ID
   */
  async invalidateProducer(producerId?: string): Promise<void> {
    await this.invalidatePattern(CacheKeys.producerPattern(producerId));
    // Also invalidate producer list caches
    await this.invalidatePattern(
      `${CachePrefix.PRODUCER}:${CachePrefix.LIST}:*`
    );
    // Invalidate related stats
    await this.invalidatePattern(`${CachePrefix.STATS}:producers*`);
  }

  /**
   * Invalidate all event-related cache entries
   * @param eventId - Optional specific event ID
   * @param batchId - Optional batch ID to invalidate batch events
   */
  async invalidateEvent(eventId?: string, batchId?: string): Promise<void> {
    await this.invalidatePattern(CacheKeys.eventPattern(eventId));
    if (batchId) {
      await this.del(CacheKeys.eventsByBatch(batchId));
      await this.del(CacheKeys.batchHistory(batchId));
    }
    // Invalidate related stats
    await this.invalidatePattern(`${CachePrefix.STATS}:events:*`);
  }

  /**
   * Invalidate user-related cache entries
   * @param userId - Optional specific user ID
   */
  async invalidateUser(userId?: string): Promise<void> {
    await this.invalidatePattern(CacheKeys.userPattern(userId));
  }

  /**
   * Clear all cache entries (use with caution!)
   */
  async flushAll(): Promise<void> {
    try {
      await this.client.flushdb();
      logger.warn({ message: 'All cache entries flushed' });
    } catch (error) {
      this.stats.errors++;
      logger.error({
        message: 'Cache flush error',
        meta: { error: (error as Error).message },
      });
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // CACHE-ASIDE PATTERN HELPERS
  // ═══════════════════════════════════════════════════════════════════════════════

  /**
   * Get or set cache with a factory function (Cache-Aside pattern)
   *
   * @param key - Cache key
   * @param factory - Async function to fetch data if cache miss
   * @param ttlSeconds - TTL in seconds
   * @returns Cached or freshly fetched data
   *
   * @example
   * ```typescript
   * const batch = await cacheService.getOrSet(
   *   CacheKeys.batch(batchId),
   *   () => batchRepository.findById(batchId),
   *   CacheTTL.BATCH
   * );
   * ```
   */
  async getOrSet<T>(
    key: string,
    factory: () => Promise<T | null>,
    ttlSeconds: number = CacheTTL.BATCH
  ): Promise<T | null> {
    // Try cache first
    const cached = await this.get<T>(key);
    if (cached.hit) {
      return cached.data;
    }

    // Cache miss - fetch from source
    const data = await factory();

    // Cache the result if not null
    if (data !== null) {
      await this.set(key, data, ttlSeconds);
    }

    return data;
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // HEALTH & MONITORING
  // ═══════════════════════════════════════════════════════════════════════════════

  /**
   * Perform a health check on the Redis connection
   * @returns Health status with latency measurement
   */
  async healthCheck(): Promise<CacheHealth> {
    const startTime = Date.now();

    try {
      const pong = await this.client.ping();
      const latencyMs = Date.now() - startTime;

      if (pong === 'PONG') {
        return {
          status: latencyMs < 100 ? 'healthy' : 'degraded',
          connected: true,
          latencyMs,
        };
      }

      return {
        status: 'unhealthy',
        connected: false,
        latencyMs,
        errorMessage: 'Unexpected PING response',
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        connected: false,
        latencyMs: Date.now() - startTime,
        errorMessage: (error as Error).message,
      };
    }
  }

  /**
   * Get cache statistics
   * @returns Cache hit/miss statistics and Redis info
   */
  async getStats(): Promise<CacheStats> {
    try {
      const info = await this.client.info('memory');
      const dbSize = await this.client.dbsize();
      const serverInfo = await this.client.info('server');

      // Parse memory usage from INFO response
      const memoryMatch = info.match(/used_memory_human:(\S+)/);
      const memoryUsage = memoryMatch ? memoryMatch[1] : 'unknown';

      // Parse uptime from server info
      const uptimeMatch = serverInfo.match(/uptime_in_seconds:(\d+)/);
      const uptime = uptimeMatch ? parseInt(uptimeMatch[1], 10) : 0;

      return {
        ...this.stats,
        keys: dbSize,
        memoryUsage,
        uptime,
      };
    } catch (error) {
      return {
        ...this.stats,
        keys: 0,
        memoryUsage: 'unknown',
        uptime: 0,
      };
    }
  }

  /**
   * Reset internal statistics
   */
  resetStats(): void {
    this.stats = { hits: 0, misses: 0, errors: 0 };
  }

  /**
   * Check if Redis is connected
   */
  isReady(): boolean {
    return this.isConnected && this.client.status === 'ready';
  }

  /**
   * Get the underlying Redis client for advanced operations
   * Use with caution - prefer the wrapper methods
   */
  getClient(): Redis {
    return this.client;
  }

  /**
   * Gracefully close the Redis connection
   */
  async disconnect(): Promise<void> {
    try {
      await this.client.quit();
      this.isConnected = false;
      logger.info({ message: 'Redis cache service disconnected' });
    } catch (error) {
      logger.error({
        message: 'Error disconnecting Redis cache service',
        meta: { error: (error as Error).message },
      });
    }
  }
}

/**
 * Singleton instance of the Redis Cache Service
 */
export const redisCacheService = new RedisCacheService();

export default redisCacheService;
