import { Redis } from 'ioredis';
import logger from '../../shared/utils/logger.js';
class InMemoryRateLimiter {
    store = new Map();
    cleanupInterval = null;
    MAX_ENTRIES = 10000;
    constructor() {
        this.cleanupInterval = setInterval(() => this.cleanup(), 60000);
    }
    check(key, limit, windowSeconds) {
        const now = Date.now();
        const entry = this.store.get(key);
        if (!entry || entry.expiresAt < now) {
            this.store.set(key, {
                count: 1,
                expiresAt: now + windowSeconds * 1000,
            });
            return true;
        }
        entry.count++;
        return entry.count <= limit;
    }
    cleanup() {
        const now = Date.now();
        let cleaned = 0;
        for (const [key, entry] of this.store.entries()) {
            if (entry.expiresAt < now) {
                this.store.delete(key);
                cleaned++;
            }
        }
        if (this.store.size > this.MAX_ENTRIES) {
            const entriesToRemove = this.store.size - this.MAX_ENTRIES;
            const iterator = this.store.keys();
            for (let i = 0; i < entriesToRemove; i++) {
                const key = iterator.next().value;
                if (key)
                    this.store.delete(key);
            }
        }
        if (cleaned > 0) {
            logger.debug('[InMemoryRateLimiter] Cleaned expired entries', { count: cleaned });
        }
    }
    destroy() {
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
            this.cleanupInterval = null;
        }
        this.store.clear();
    }
}
export class RedisClient {
    client;
    inMemoryFallback;
    redisAvailable = true;
    constructor() {
        this.client = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
        this.inMemoryFallback = new InMemoryRateLimiter();
        this.client.on('error', (err) => {
            logger.error({ message: 'Redis Client Error', meta: { error: err } });
            this.redisAvailable = false;
        });
        this.client.on('connect', () => {
            logger.info('Redis client connected');
            this.redisAvailable = true;
        });
        this.client.on('ready', () => {
            this.redisAvailable = true;
        });
        this.client.on('close', () => {
            this.redisAvailable = false;
            logger.warn('Redis connection closed, using in-memory fallback');
        });
    }
    async blacklistToken(jti, exp) {
        const now = Math.floor(Date.now() / 1000);
        const ttl = exp - now;
        if (ttl > 0) {
            await this.client.set(jti, 'blacklisted', 'EX', ttl);
        }
    }
    async isBlacklisted(jti) {
        const result = await this.client.get(jti);
        return result !== null;
    }
    async checkRateLimit(key, limit, windowSeconds) {
        try {
            const current = await this.client.incr(key);
            if (current === 1) {
                await this.client.expire(key, windowSeconds);
            }
            return current <= limit;
        }
        catch (error) {
            logger.warn({
                message: 'Redis rate limit unavailable, using in-memory fallback',
                meta: { key, error: error instanceof Error ? error.message : 'Unknown' },
            });
            try {
                return this.inMemoryFallback.check(key, limit, windowSeconds);
            }
            catch (fallbackError) {
                logger.error({
                    message: 'Both Redis and in-memory rate limit failed - blocking request',
                    meta: { key },
                });
                return false;
            }
        }
    }
    isAvailable() {
        return this.redisAvailable;
    }
}
export const redisClient = new RedisClient();
