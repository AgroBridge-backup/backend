import { Prisma } from '@prisma/client';
import { logger } from '../logging/logger.js';
let prisma = null;
let redis = null;
export function initQueryOptimizer(prismaClient, redisClient) {
    prisma = prismaClient;
    redis = redisClient || null;
    logger.info('Query optimizer initialized');
}
const n1State = {
    queries: new Map(),
    threshold: 5,
    windowMs: 1000,
    lastReset: Date.now(),
};
export function trackQuery(pattern) {
    const now = Date.now();
    if (now - n1State.lastReset > n1State.windowMs) {
        n1State.queries.clear();
        n1State.lastReset = now;
    }
    const count = (n1State.queries.get(pattern) || 0) + 1;
    n1State.queries.set(pattern, count);
    if (count === n1State.threshold) {
        logger.warn('Potential N+1 query detected', {
            pattern,
            count,
            windowMs: n1State.windowMs,
        });
    }
}
export function generateCacheKey(model, operation, params) {
    const paramHash = JSON.stringify(params);
    return `query:${model}:${operation}:${Buffer.from(paramHash).toString('base64').substring(0, 32)}`;
}
export async function cachedQuery(cacheKey, queryFn, ttlSeconds = 60) {
    if (redis) {
        try {
            const cached = await redis.get(cacheKey);
            if (cached) {
                logger.debug('Cache hit', { cacheKey });
                return JSON.parse(cached);
            }
        }
        catch (error) {
            logger.error('Cache read error', { error, cacheKey });
        }
    }
    const result = await queryFn();
    if (redis && result !== null && result !== undefined) {
        try {
            await redis.setex(cacheKey, ttlSeconds, JSON.stringify(result));
            logger.debug('Cache set', { cacheKey, ttlSeconds });
        }
        catch (error) {
            logger.error('Cache write error', { error, cacheKey });
        }
    }
    return result;
}
export async function invalidateCache(pattern) {
    if (!redis)
        return 0;
    try {
        const keys = await redis.keys(pattern);
        if (keys.length > 0) {
            await redis.del(...keys);
            logger.debug('Cache invalidated', { pattern, count: keys.length });
        }
        return keys.length;
    }
    catch (error) {
        logger.error('Cache invalidation error', { error, pattern });
        return 0;
    }
}
export function createPaginationQuery(options) {
    const { page, limit } = options;
    return {
        skip: (page - 1) * limit,
        take: limit,
    };
}
export function createCursorPaginationQuery(cursor, limit) {
    if (cursor) {
        return {
            cursor: { id: cursor },
            skip: 1,
            take: limit,
        };
    }
    return { take: limit };
}
export function buildPaginatedResult(data, total, options) {
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
export function parseFieldSelection(fields, allowedFields) {
    if (!fields)
        return undefined;
    const requested = fields.split(',').map((f) => f.trim());
    const selection = {};
    for (const field of requested) {
        if (allowedFields.includes(field)) {
            selection[field] = true;
        }
    }
    selection.id = true;
    return Object.keys(selection).length > 1 ? selection : undefined;
}
export function analyzeQueryComplexity(query) {
    const warnings = [];
    let complexity = 1;
    const countIncludes = (obj, depth = 0) => {
        if (depth > 3) {
            warnings.push('Include depth exceeds 3 levels');
            return depth;
        }
        let maxDepth = depth;
        if (obj.include && typeof obj.include === 'object') {
            for (const value of Object.values(obj.include)) {
                if (typeof value === 'object' && value !== null) {
                    const childDepth = countIncludes(value, depth + 1);
                    maxDepth = Math.max(maxDepth, childDepth);
                }
            }
        }
        return maxDepth;
    };
    const includeDepth = countIncludes(query);
    complexity += includeDepth * 2;
    if (query.take && query.take > 100) {
        warnings.push('Large result set requested (>100 items)');
        complexity += Math.floor(query.take / 100);
    }
    if (!query.take && !query.first && !query.last) {
        warnings.push('No pagination specified - may return large result set');
        complexity += 5;
    }
    if (query.where && typeof query.where === 'object') {
        const whereKeys = Object.keys(query.where);
        if (whereKeys.length > 5) {
            warnings.push('Complex where clause with many conditions');
            complexity += whereKeys.length;
        }
        if (query.where.OR) {
            warnings.push('OR conditions may result in full table scan');
            complexity += 3;
        }
    }
    return { complexity, warnings };
}
export async function batchQueries(queries, batchSize = 10) {
    const results = [];
    for (let i = 0; i < queries.length; i += batchSize) {
        const batch = queries.slice(i, i + batchSize);
        const batchResults = await Promise.all(batch.map((q) => q()));
        results.push(...batchResults);
    }
    return results;
}
export async function timedQuery(name, queryFn) {
    const start = performance.now();
    const result = await queryFn();
    const duration = performance.now() - start;
    if (duration > 1000) {
        logger.warn('Slow query detected', { name, duration: `${duration.toFixed(2)}ms` });
    }
    else {
        logger.debug('Query executed', { name, duration: `${duration.toFixed(2)}ms` });
    }
    return { result, duration };
}
export async function optimizedCount(model, where = {}) {
    if (!prisma) {
        throw new Error('Prisma client not initialized');
    }
    const cacheKey = generateCacheKey(model, 'count', where);
    const prismaClient = prisma;
    return cachedQuery(cacheKey, async () => {
        const result = await prismaClient.$queryRawUnsafe(`SELECT COUNT(*) as count FROM "${model}" WHERE 1=1`);
        return Number(result[0].count);
    }, 30);
}
export async function preloadRelations(items, relationLoader) {
    if (items.length === 0)
        return items;
    const ids = items.map((item) => item.id);
    const relations = await relationLoader(ids);
    return items.map((item) => ({
        ...item,
        _relations: relations.get(item.id),
    }));
}
export class QueryBatcher {
    batch = [];
    batchPromise = null;
    loader;
    maxBatchSize;
    batchScheduleMs;
    constructor(loader, options = {}) {
        this.loader = loader;
        this.maxBatchSize = options.maxBatchSize || 100;
        this.batchScheduleMs = options.batchScheduleMs || 10;
    }
    async load(key) {
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
    async loadMany(keys) {
        const results = new Map();
        await Promise.all(keys.map(async (key) => {
            const value = await this.load(key);
            if (value !== undefined) {
                results.set(key, value);
            }
        }));
        return results;
    }
}
export function queryOptimizerMiddleware() {
    return Prisma.defineExtension({
        name: 'query-optimizer',
        query: {
            $allModels: {
                async $allOperations({ operation, model, args, query }) {
                    const start = performance.now();
                    const pattern = `${model}.${operation}`;
                    trackQuery(pattern);
                    const { complexity, warnings } = analyzeQueryComplexity(args);
                    if (warnings.length > 0) {
                        logger.debug('Query complexity warnings', { model, operation, warnings, complexity });
                    }
                    const result = await query(args);
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
