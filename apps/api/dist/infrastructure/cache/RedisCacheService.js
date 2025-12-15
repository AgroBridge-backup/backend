import { Redis } from 'ioredis';
import logger from '../../shared/utils/logger.js';
import { CacheTTL, CacheKeys, CachePrefix } from './CacheKeys.js';
export class RedisCacheService {
    client;
    isConnected = false;
    stats = {
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
    setupEventHandlers() {
        this.client.on('connect', () => {
            logger.info({ message: 'Redis cache service connecting...' });
        });
        this.client.on('ready', () => {
            this.isConnected = true;
            logger.info({ message: 'Redis cache service connected and ready' });
        });
        this.client.on('error', (err) => {
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
    async get(key) {
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
                data: JSON.parse(data),
                ttl: ttl > 0 ? ttl : undefined,
            };
        }
        catch (error) {
            this.stats.errors++;
            logger.error({
                message: 'Cache get error',
                meta: { key, error: error.message },
            });
            return { hit: false, data: null };
        }
    }
    async set(key, value, ttlSeconds = CacheTTL.BATCH) {
        try {
            const serialized = JSON.stringify(value);
            await this.client.setex(key, ttlSeconds, serialized);
            return true;
        }
        catch (error) {
            this.stats.errors++;
            logger.error({
                message: 'Cache set error',
                meta: { key, error: error.message },
            });
            return false;
        }
    }
    async del(key) {
        try {
            await this.client.del(key);
            return true;
        }
        catch (error) {
            this.stats.errors++;
            logger.error({
                message: 'Cache delete error',
                meta: { key, error: error.message },
            });
            return false;
        }
    }
    async delMultiple(keys) {
        if (keys.length === 0)
            return true;
        try {
            await this.client.del(...keys);
            return true;
        }
        catch (error) {
            this.stats.errors++;
            logger.error({
                message: 'Cache delete multiple error',
                meta: { keyCount: keys.length, error: error.message },
            });
            return false;
        }
    }
    async exists(key) {
        try {
            const result = await this.client.exists(key);
            return result === 1;
        }
        catch (error) {
            this.stats.errors++;
            return false;
        }
    }
    async getTTL(key) {
        try {
            return await this.client.ttl(key);
        }
        catch (error) {
            this.stats.errors++;
            return -2;
        }
    }
    async invalidatePattern(pattern) {
        try {
            const keys = [];
            let cursor = '0';
            do {
                const [nextCursor, foundKeys] = await this.client.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
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
        }
        catch (error) {
            this.stats.errors++;
            logger.error({
                message: 'Cache invalidation error',
                meta: { pattern, error: error.message },
            });
            return 0;
        }
    }
    async invalidateBatch(batchId) {
        await this.invalidatePattern(CacheKeys.batchPattern(batchId));
        await this.invalidatePattern(`${CachePrefix.BATCH}:${CachePrefix.LIST}:*`);
        await this.invalidatePattern(`${CachePrefix.STATS}:batches:*`);
    }
    async invalidateProducer(producerId) {
        await this.invalidatePattern(CacheKeys.producerPattern(producerId));
        await this.invalidatePattern(`${CachePrefix.PRODUCER}:${CachePrefix.LIST}:*`);
        await this.invalidatePattern(`${CachePrefix.STATS}:producers*`);
    }
    async invalidateEvent(eventId, batchId) {
        await this.invalidatePattern(CacheKeys.eventPattern(eventId));
        if (batchId) {
            await this.del(CacheKeys.eventsByBatch(batchId));
            await this.del(CacheKeys.batchHistory(batchId));
        }
        await this.invalidatePattern(`${CachePrefix.STATS}:events:*`);
    }
    async invalidateUser(userId) {
        await this.invalidatePattern(CacheKeys.userPattern(userId));
    }
    async flushAll() {
        try {
            await this.client.flushdb();
            logger.warn({ message: 'All cache entries flushed' });
        }
        catch (error) {
            this.stats.errors++;
            logger.error({
                message: 'Cache flush error',
                meta: { error: error.message },
            });
        }
    }
    async getOrSet(key, factory, ttlSeconds = CacheTTL.BATCH) {
        const cached = await this.get(key);
        if (cached.hit) {
            return cached.data;
        }
        const data = await factory();
        if (data !== null) {
            await this.set(key, data, ttlSeconds);
        }
        return data;
    }
    async healthCheck() {
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
        }
        catch (error) {
            return {
                status: 'unhealthy',
                connected: false,
                latencyMs: Date.now() - startTime,
                errorMessage: error.message,
            };
        }
    }
    async getStats() {
        try {
            const info = await this.client.info('memory');
            const dbSize = await this.client.dbsize();
            const serverInfo = await this.client.info('server');
            const memoryMatch = info.match(/used_memory_human:(\S+)/);
            const memoryUsage = memoryMatch ? memoryMatch[1] : 'unknown';
            const uptimeMatch = serverInfo.match(/uptime_in_seconds:(\d+)/);
            const uptime = uptimeMatch ? parseInt(uptimeMatch[1], 10) : 0;
            return {
                ...this.stats,
                keys: dbSize,
                memoryUsage,
                uptime,
            };
        }
        catch (error) {
            return {
                ...this.stats,
                keys: 0,
                memoryUsage: 'unknown',
                uptime: 0,
            };
        }
    }
    resetStats() {
        this.stats = { hits: 0, misses: 0, errors: 0 };
    }
    isReady() {
        return this.isConnected && this.client.status === 'ready';
    }
    getClient() {
        return this.client;
    }
    async disconnect() {
        try {
            await this.client.quit();
            this.isConnected = false;
            logger.info({ message: 'Redis cache service disconnected' });
        }
        catch (error) {
            logger.error({
                message: 'Error disconnecting Redis cache service',
                meta: { error: error.message },
            });
        }
    }
}
export const redisCacheService = new RedisCacheService();
export default redisCacheService;
