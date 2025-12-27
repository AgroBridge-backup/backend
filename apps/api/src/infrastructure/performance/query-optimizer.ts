/**
 * Query Optimizer
 * N+1 detection, query analysis, and performance optimization
 */

import { PrismaClient, Prisma } from '@prisma/client';
import { Redis } from 'ioredis';
import { logger } from '../logging/logger.js';

// Clients
let prisma: PrismaClient | null = null;
let redis: Redis | null = null;

/**
 * Initialize query optimizer
 */
export function initQueryOptimizer(prismaClient: PrismaClient, redisClient?: Redis): void {
  prisma = prismaClient;
  redis = redisClient || null;
  logger.info('Query optimizer initialized');
}

/**
 * Query metrics
 */
interface QueryMetrics {
  query: string;
  duration: number;
  timestamp: Date;
  rowCount?: number;
  cached: boolean;
}

/**
 * N+1 detection state
 */
interface N1DetectionState {
  queries: Map<string, number>;
  threshold: number;
  windowMs: number;
  lastReset: number;
}

// Global state for N+1 detection
const n1State: N1DetectionState = {
  queries: new Map(),
  threshold: 5, // Alert if same pattern appears 5+ times (reduced from 10 for earlier detection)
  windowMs: 1000, // Within 1 second
  lastReset: Date.now(),
};

/**
 * Track query for N+1 detection
 */
export function trackQuery(pattern: string): void {
  const now = Date.now();

  // Reset window if expired
  if (now - n1State.lastReset > n1State.windowMs) {
    n1State.queries.clear();
    n1State.lastReset = now;
  }

  // Increment query count
  const count = (n1State.queries.get(pattern) || 0) + 1;
  n1State.queries.set(pattern, count);

  // Alert if threshold exceeded
  if (count === n1State.threshold) {
    logger.warn('Potential N+1 query detected', {
      pattern,
      count,
      windowMs: n1State.windowMs,
    });
  }
}

/**
 * Query cache key generator
 */
export function generateCacheKey(
  model: string,
  operation: string,
  params: Record<string, unknown>
): string {
  const paramHash = JSON.stringify(params);
  return `query:${model}:${operation}:${Buffer.from(paramHash).toString('base64').substring(0, 32)}`;
}

/**
 * Cached query wrapper
 */
export async function cachedQuery<T>(
  cacheKey: string,
  queryFn: () => Promise<T>,
  ttlSeconds: number = 60
): Promise<T> {
  if (redis) {
    try {
      // Check cache
      const cached = await redis.get(cacheKey);
      if (cached) {
        logger.debug('Cache hit', { cacheKey });
        return JSON.parse(cached);
      }
    } catch (error) {
      logger.error('Cache read error', { error, cacheKey });
    }
  }

  // Execute query
  const result = await queryFn();

  // Store in cache
  if (redis && result !== null && result !== undefined) {
    try {
      await redis.setex(cacheKey, ttlSeconds, JSON.stringify(result));
      logger.debug('Cache set', { cacheKey, ttlSeconds });
    } catch (error) {
      logger.error('Cache write error', { error, cacheKey });
    }
  }

  return result;
}

/**
 * Invalidate cache by pattern
 */
export async function invalidateCache(pattern: string): Promise<number> {
  if (!redis) return 0;

  try {
    const keys = await redis.keys(pattern);
    if (keys.length > 0) {
      await redis.del(...keys);
      logger.debug('Cache invalidated', { pattern, count: keys.length });
    }
    return keys.length;
  } catch (error) {
    logger.error('Cache invalidation error', { error, pattern });
    return 0;
  }
}

/**
 * Optimized pagination
 */
export interface PaginationOptions {
  page: number;
  limit: number;
  cursor?: string;
}

export interface PaginatedResult<T> {
  data: T[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
    nextCursor?: string;
  };
}

/**
 * Create optimized pagination query
 */
export function createPaginationQuery<T>(
  options: PaginationOptions
): { skip: number; take: number } {
  const { page, limit } = options;
  return {
    skip: (page - 1) * limit,
    take: limit,
  };
}

/**
 * Create cursor-based pagination query
 */
export function createCursorPaginationQuery<T>(
  cursor: string | undefined,
  limit: number
): { cursor?: { id: string }; skip?: number; take: number } {
  if (cursor) {
    return {
      cursor: { id: cursor },
      skip: 1, // Skip the cursor item
      take: limit,
    };
  }
  return { take: limit };
}

/**
 * Build paginated result
 */
export function buildPaginatedResult<T extends { id: string }>(
  data: T[],
  total: number,
  options: PaginationOptions
): PaginatedResult<T> {
  const { page, limit } = options;
  const totalPages = Math.ceil(total / limit);

  return {
    data,
    meta: {
      page,
      limit,
      total,
      totalPages,
      hasNext: page < totalPages,
      hasPrev: page > 1,
      nextCursor: data.length > 0 ? data[data.length - 1].id : undefined,
    },
  };
}

/**
 * Field selection optimizer
 */
export function parseFieldSelection(
  fields: string | undefined,
  allowedFields: string[]
): Record<string, boolean> | undefined {
  if (!fields) return undefined;

  const requested = fields.split(',').map((f) => f.trim());
  const selection: Record<string, boolean> = {};

  for (const field of requested) {
    if (allowedFields.includes(field)) {
      selection[field] = true;
    }
  }

  // Always include id
  selection.id = true;

  return Object.keys(selection).length > 1 ? selection : undefined;
}

/**
 * Query complexity analyzer
 */
export function analyzeQueryComplexity(query: Record<string, unknown>): {
  complexity: number;
  warnings: string[];
} {
  const warnings: string[] = [];
  let complexity = 1;

  // Check for include depth
  const countIncludes = (obj: Record<string, unknown>, depth: number = 0): number => {
    if (depth > 3) {
      warnings.push('Include depth exceeds 3 levels');
      return depth;
    }

    let maxDepth = depth;
    if (obj.include && typeof obj.include === 'object') {
      for (const value of Object.values(obj.include as Record<string, unknown>)) {
        if (typeof value === 'object' && value !== null) {
          const childDepth = countIncludes(value as Record<string, unknown>, depth + 1);
          maxDepth = Math.max(maxDepth, childDepth);
        }
      }
    }
    return maxDepth;
  };

  const includeDepth = countIncludes(query);
  complexity += includeDepth * 2;

  // Check for large take values
  if (query.take && (query.take as number) > 100) {
    warnings.push('Large result set requested (>100 items)');
    complexity += Math.floor((query.take as number) / 100);
  }

  // Check for missing pagination
  if (!query.take && !query.first && !query.last) {
    warnings.push('No pagination specified - may return large result set');
    complexity += 5;
  }

  // Check for complex where clauses
  if (query.where && typeof query.where === 'object') {
    const whereKeys = Object.keys(query.where as object);
    if (whereKeys.length > 5) {
      warnings.push('Complex where clause with many conditions');
      complexity += whereKeys.length;
    }

    // Check for OR conditions
    if ((query.where as any).OR) {
      warnings.push('OR conditions may result in full table scan');
      complexity += 3;
    }
  }

  return { complexity, warnings };
}

/**
 * Batch query executor
 */
export async function batchQueries<T>(
  queries: Array<() => Promise<T>>,
  batchSize: number = 10
): Promise<T[]> {
  const results: T[] = [];

  for (let i = 0; i < queries.length; i += batchSize) {
    const batch = queries.slice(i, i + batchSize);
    const batchResults = await Promise.all(batch.map((q) => q()));
    results.push(...batchResults);
  }

  return results;
}

/**
 * Query timing wrapper
 */
export async function timedQuery<T>(
  name: string,
  queryFn: () => Promise<T>
): Promise<{ result: T; duration: number }> {
  const start = performance.now();
  const result = await queryFn();
  const duration = performance.now() - start;

  if (duration > 1000) {
    logger.warn('Slow query detected', { name, duration: `${duration.toFixed(2)}ms` });
  } else {
    logger.debug('Query executed', { name, duration: `${duration.toFixed(2)}ms` });
  }

  return { result, duration };
}

/**
 * Valid Prisma model names - whitelist for SQL injection prevention
 * SECURITY: Only allow known model names to prevent SQL injection
 */
const VALID_PRISMA_MODELS = new Set([
  'User',
  'Batch',
  'Producer',
  'Order',
  'Subscription',
  'Payment',
  'Invoice',
  'LiquidityPool',
  'PoolTransaction',
  'Investor',
  'AdvanceContract',
  'Repayment',
  'CreditScore',
  'QualityCertificate',
  'TransitSession',
  'BlockchainEvent',
  'AuditLog',
  'PublicTraceabilityLink',
  'QrScanEvent',
] as const);

/**
 * Optimized count query
 *
 * SECURITY: Uses Prisma ORM methods instead of raw SQL to prevent SQL injection.
 * The model name is validated against a whitelist before use.
 */
export async function optimizedCount(
  model: string,
  where: Record<string, unknown> = {}
): Promise<number> {
  if (!prisma) {
    throw new Error('Prisma client not initialized');
  }

  // SECURITY: Validate model name against whitelist to prevent SQL injection
  if (!VALID_PRISMA_MODELS.has(model as any)) {
    logger.error('Invalid model name attempted in optimizedCount', { model });
    throw new Error(`Invalid model name: ${model}. Model must be one of the allowed Prisma models.`);
  }

  const cacheKey = generateCacheKey(model, 'count', where);
  const prismaClient = prisma; // Local variable for closure

  return cachedQuery(
    cacheKey,
    async () => {
      // SECURITY: Use Prisma ORM methods instead of raw SQL
      // This is SQL-injection-safe because Prisma handles parameterization internally
      const modelDelegate = (prismaClient as any)[model.charAt(0).toLowerCase() + model.slice(1)];

      if (!modelDelegate || typeof modelDelegate.count !== 'function') {
        // Fallback: model might use different casing
        throw new Error(`Model ${model} does not support count operation`);
      }

      return modelDelegate.count({ where });
    },
    30 // Cache for 30 seconds
  );
}

/**
 * Preload related entities (avoid N+1)
 */
export async function preloadRelations<T extends { id: string }>(
  items: T[],
  relationLoader: (ids: string[]) => Promise<Map<string, unknown>>
): Promise<T[]> {
  if (items.length === 0) return items;

  const ids = items.map((item) => item.id);
  const relations = await relationLoader(ids);

  return items.map((item) => ({
    ...item,
    _relations: relations.get(item.id),
  }));
}

/**
 * DataLoader-style batching
 */
export class QueryBatcher<K, V> {
  private batch: K[] = [];
  private batchPromise: Promise<Map<K, V>> | null = null;
  private loader: (keys: K[]) => Promise<Map<K, V>>;
  private maxBatchSize: number;
  private batchScheduleMs: number;

  constructor(
    loader: (keys: K[]) => Promise<Map<K, V>>,
    options: { maxBatchSize?: number; batchScheduleMs?: number } = {}
  ) {
    this.loader = loader;
    this.maxBatchSize = options.maxBatchSize || 100;
    this.batchScheduleMs = options.batchScheduleMs || 10;
  }

  async load(key: K): Promise<V | undefined> {
    this.batch.push(key);

    if (!this.batchPromise) {
      this.batchPromise = new Promise((resolve) => {
        setTimeout(async () => {
          const currentBatch = this.batch.splice(0, this.maxBatchSize);
          this.batchPromise = null;

          const results = await this.loader(currentBatch);
          resolve(results);
        }, this.batchScheduleMs);
      });
    }

    const results = await this.batchPromise;
    return results.get(key);
  }

  async loadMany(keys: K[]): Promise<Map<K, V>> {
    const results = new Map<K, V>();
    await Promise.all(
      keys.map(async (key) => {
        const value = await this.load(key);
        if (value !== undefined) {
          results.set(key, value);
        }
      })
    );
    return results;
  }
}

/**
 * Query optimizer middleware
 */
export function queryOptimizerMiddleware() {
  return Prisma.defineExtension({
    name: 'query-optimizer',
    query: {
      $allModels: {
        async $allOperations({ operation, model, args, query }) {
          const start = performance.now();

          // Track query pattern for N+1 detection
          const pattern = `${model}.${operation}`;
          trackQuery(pattern);

          // Analyze query complexity
          const { complexity, warnings } = analyzeQueryComplexity(args);
          if (warnings.length > 0) {
            logger.debug('Query complexity warnings', { model, operation, warnings, complexity });
          }

          // Execute query
          const result = await query(args);

          // Log slow queries
          const duration = performance.now() - start;
          if (duration > 500) {
            logger.warn('Slow query', {
              model,
              operation,
              duration: `${duration.toFixed(2)}ms`,
              args: JSON.stringify(args).substring(0, 200),
            });
          }

          return result;
        },
      },
    },
  });
}

export default {
  initQueryOptimizer,
  trackQuery,
  generateCacheKey,
  cachedQuery,
  invalidateCache,
  createPaginationQuery,
  createCursorPaginationQuery,
  buildPaginatedResult,
  parseFieldSelection,
  analyzeQueryComplexity,
  batchQueries,
  timedQuery,
  optimizedCount,
  preloadRelations,
  QueryBatcher,
  queryOptimizerMiddleware,
};
