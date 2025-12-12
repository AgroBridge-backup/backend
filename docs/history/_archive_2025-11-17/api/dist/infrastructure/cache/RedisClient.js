import Redis from 'ioredis';
import { logger } from '@/shared/utils/logger';
import { AppError } from '@/shared/errors/AppError';
export class RedisClient {
    static instance;
    client;
    // Constructor now accepts a URL string or an options object
    constructor(connection) {
        // @ts-ignore - Bypassing a defective type definition in @types/ioredis
        this.client = new Redis(connection);
        this.client.on('connect', () => logger.info('Redis connected'));
        this.client.on('error', (err) => logger.error('Redis connection error', { error: err }));
    }
    // getInstance is updated to reflect the new connection type
    static getInstance(connection) {
        if (!RedisClient.instance) {
            if (!connection) {
                throw new AppError('Redis connection options or URL must be provided for the first instantiation', 500);
            }
            RedisClient.instance = new RedisClient(connection);
        }
        return RedisClient.instance;
    }
    async get(key) {
        const data = await this.client.get(key);
        return data ? JSON.parse(data) : null;
    }
    async set(key, value) {
        await this.client.set(key, JSON.stringify(value));
    }
    async setex(key, ttl, value) {
        await this.client.setex(key, ttl, JSON.stringify(value));
    }
    async del(key) {
        await this.client.del(key);
    }
    async incr(key) {
        return this.client.incr(key);
    }
    async expire(key, ttl) {
        await this.client.expire(key, ttl);
    }
    async ping() {
        return this.client.ping();
    }
    async cacheWrapper(key, ttl, fetchFn) {
        const cachedData = await this.get(key);
        if (cachedData) {
            logger.info('Cache hit', { key });
            return cachedData;
        }
        logger.info('Cache miss', { key });
        const freshData = await fetchFn();
        await this.setex(key, ttl, freshData);
        return freshData;
    }
    async checkRateLimit(identifier, limit, window) {
        const key = `rate-limit:${identifier}`;
        const current = await this.client.incr(key);
        if (current === 1) {
            await this.client.expire(key, window);
        }
        return current <= limit;
    }
    async blacklistToken(jti, expiresAt) {
        const key = `blacklist:${jti}`;
        const ttl = Math.ceil((expiresAt * 1000 - Date.now()) / 1000);
        if (ttl > 0) {
            await this.setex(key, ttl, 'blacklisted');
        }
    }
    async isBlacklisted(jti) {
        const key = `blacklist:${jti}`;
        const result = await this.client.get(key);
        return result !== null;
    }
}
// Corrected singleton initialization: prioritize REDIS_URL
const redisConnection = process.env.REDIS_URL || {
    host: process.env.REDIS_HOST || '127.0.0.1',
    port: process.env.REDIS_PORT ? parseInt(process.env.REDIS_PORT, 10) : 6379,
    password: process.env.REDIS_PASSWORD,
    maxRetriesPerRequest: 3,
};
export const redisClient = RedisClient.getInstance(redisConnection);
//# sourceMappingURL=RedisClient.js.map