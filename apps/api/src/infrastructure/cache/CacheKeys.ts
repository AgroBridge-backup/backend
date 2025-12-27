/**
 * @file Centralized cache key management for Redis caching
 * @description Provides type-safe cache key generation for all cacheable entities
 *
 * Key patterns follow the convention: {entity}:{id} or {entity}:list:{scope}
 * TTL values are in seconds.
 *
 * @author AgroBridge Engineering Team
 */

/**
 * Cache TTL values in seconds for different entity types
 */
export const CacheTTL = {
  /** Batch data - moderate TTL as batches update frequently */
  BATCH: 300, // 5 minutes

  /** Producer data - longer TTL as producers rarely change */
  PRODUCER: 600, // 10 minutes

  /** Event data - short TTL as events are time-sensitive */
  EVENT: 120, // 2 minutes

  /** User data - moderate TTL */
  USER: 300, // 5 minutes

  /** List queries - shorter TTL to reflect new data */
  LIST: 60, // 1 minute

  /** Statistics and aggregations */
  STATS: 180, // 3 minutes

  /** Health check data */
  HEALTH: 30, // 30 seconds
} as const;

/**
 * Cache key prefixes for different entity types
 */
export const CachePrefix = {
  BATCH: "batch",
  PRODUCER: "producer",
  EVENT: "event",
  USER: "user",
  STATS: "stats",
  LIST: "list",
  HEALTH: "health",
} as const;

/**
 * Centralized cache key generator
 * Provides type-safe methods for generating consistent cache keys
 */
export class CacheKeys {
  // ═══════════════════════════════════════════════════════════════════════════════
  // BATCH KEYS
  // ═══════════════════════════════════════════════════════════════════════════════

  /**
   * Generate cache key for a single batch by ID
   * @param batchId - The batch UUID
   * @returns Cache key string
   */
  static batch(batchId: string): string {
    return `${CachePrefix.BATCH}:${batchId}`;
  }

  /**
   * Generate cache key for batch by batch number
   * @param batchNumber - The batch number (e.g., "BATCH-001")
   * @returns Cache key string
   */
  static batchByNumber(batchNumber: string): string {
    return `${CachePrefix.BATCH}:number:${batchNumber}`;
  }

  /**
   * Generate cache key for batch history (events)
   * @param batchId - The batch UUID
   * @returns Cache key string
   */
  static batchHistory(batchId: string): string {
    return `${CachePrefix.BATCH}:${batchId}:history`;
  }

  /**
   * Generate cache key for batches list with pagination/filters
   * @param producerId - Optional producer filter
   * @param status - Optional status filter
   * @param page - Page number
   * @param limit - Items per page
   * @returns Cache key string
   */
  static batchList(options: {
    producerId?: string;
    status?: string;
    page?: number;
    limit?: number;
  }): string {
    const parts: string[] = [CachePrefix.BATCH, CachePrefix.LIST];

    if (options.producerId) {
      parts.push(`producer:${options.producerId}`);
    }
    if (options.status) {
      parts.push(`status:${options.status}`);
    }
    if (options.page) {
      parts.push(`page:${options.page}`);
    }
    if (options.limit) {
      parts.push(`limit:${options.limit}`);
    }

    return parts.join(":");
  }

  /**
   * Generate pattern for invalidating all batch-related cache entries
   * @param batchId - Optional batch ID for specific batch invalidation
   * @returns Cache pattern for Redis SCAN
   */
  static batchPattern(batchId?: string): string {
    if (batchId) {
      return `${CachePrefix.BATCH}:${batchId}*`;
    }
    return `${CachePrefix.BATCH}:*`;
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // PRODUCER KEYS
  // ═══════════════════════════════════════════════════════════════════════════════

  /**
   * Generate cache key for a single producer by ID
   * @param producerId - The producer UUID
   * @returns Cache key string
   */
  static producer(producerId: string): string {
    return `${CachePrefix.PRODUCER}:${producerId}`;
  }

  /**
   * Generate cache key for producer by RFC
   * @param rfc - The producer RFC identifier
   * @returns Cache key string
   */
  static producerByRfc(rfc: string): string {
    return `${CachePrefix.PRODUCER}:rfc:${rfc}`;
  }

  /**
   * Generate cache key for producer by user ID
   * @param userId - The user UUID
   * @returns Cache key string
   */
  static producerByUserId(userId: string): string {
    return `${CachePrefix.PRODUCER}:user:${userId}`;
  }

  /**
   * Generate cache key for producers list with filters
   * @param options - Filter options
   * @returns Cache key string
   */
  static producerList(options: {
    isWhitelisted?: boolean;
    state?: string;
    page?: number;
    limit?: number;
  }): string {
    const parts: string[] = [CachePrefix.PRODUCER, CachePrefix.LIST];

    if (options.isWhitelisted !== undefined) {
      parts.push(`whitelisted:${options.isWhitelisted}`);
    }
    if (options.state) {
      parts.push(`state:${options.state}`);
    }
    if (options.page) {
      parts.push(`page:${options.page}`);
    }
    if (options.limit) {
      parts.push(`limit:${options.limit}`);
    }

    return parts.join(":");
  }

  /**
   * Generate pattern for invalidating all producer-related cache entries
   * @param producerId - Optional producer ID for specific producer invalidation
   * @returns Cache pattern for Redis SCAN
   */
  static producerPattern(producerId?: string): string {
    if (producerId) {
      return `${CachePrefix.PRODUCER}:${producerId}*`;
    }
    return `${CachePrefix.PRODUCER}:*`;
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // EVENT KEYS
  // ═══════════════════════════════════════════════════════════════════════════════

  /**
   * Generate cache key for a single event by ID
   * @param eventId - The event UUID
   * @returns Cache key string
   */
  static event(eventId: string): string {
    return `${CachePrefix.EVENT}:${eventId}`;
  }

  /**
   * Generate cache key for events by batch ID
   * @param batchId - The batch UUID
   * @returns Cache key string
   */
  static eventsByBatch(batchId: string): string {
    return `${CachePrefix.EVENT}:batch:${batchId}`;
  }

  /**
   * Generate pattern for invalidating all event-related cache entries
   * @param eventId - Optional event ID for specific event invalidation
   * @returns Cache pattern for Redis SCAN
   */
  static eventPattern(eventId?: string): string {
    if (eventId) {
      return `${CachePrefix.EVENT}:${eventId}*`;
    }
    return `${CachePrefix.EVENT}:*`;
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // USER KEYS
  // ═══════════════════════════════════════════════════════════════════════════════

  /**
   * Generate cache key for a single user by ID
   * @param userId - The user UUID
   * @returns Cache key string
   */
  static user(userId: string): string {
    return `${CachePrefix.USER}:${userId}`;
  }

  /**
   * Generate cache key for user by email
   * @param email - The user email
   * @returns Cache key string
   */
  static userByEmail(email: string): string {
    return `${CachePrefix.USER}:email:${email.toLowerCase()}`;
  }

  /**
   * Generate pattern for invalidating all user-related cache entries
   * @param userId - Optional user ID for specific user invalidation
   * @returns Cache pattern for Redis SCAN
   */
  static userPattern(userId?: string): string {
    if (userId) {
      return `${CachePrefix.USER}:${userId}*`;
    }
    return `${CachePrefix.USER}:*`;
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // STATISTICS KEYS
  // ═══════════════════════════════════════════════════════════════════════════════

  /**
   * Generate cache key for batch statistics
   * @param producerId - Optional producer filter
   * @returns Cache key string
   */
  static batchStats(producerId?: string): string {
    if (producerId) {
      return `${CachePrefix.STATS}:batches:producer:${producerId}`;
    }
    return `${CachePrefix.STATS}:batches:global`;
  }

  /**
   * Generate cache key for producer statistics
   * @returns Cache key string
   */
  static producerStats(): string {
    return `${CachePrefix.STATS}:producers`;
  }

  /**
   * Generate cache key for event statistics
   * @param batchId - Optional batch filter
   * @returns Cache key string
   */
  static eventStats(batchId?: string): string {
    if (batchId) {
      return `${CachePrefix.STATS}:events:batch:${batchId}`;
    }
    return `${CachePrefix.STATS}:events:global`;
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // HEALTH KEYS
  // ═══════════════════════════════════════════════════════════════════════════════

  /**
   * Generate cache key for health check data
   * @returns Cache key string
   */
  static health(): string {
    return `${CachePrefix.HEALTH}:status`;
  }
}

export default CacheKeys;
