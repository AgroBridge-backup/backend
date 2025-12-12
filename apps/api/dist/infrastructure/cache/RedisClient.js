import Redis from 'ioredis';
import logger from '../../shared/utils/logger.js';
export class RedisClient {
    client;
    constructor() {
        this.client = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
        this.client.on('error', (err) => logger.error({ message: 'Redis Client Error', meta: { error: err } }));
        this.client.on('connect', () => logger.info('Redis client connected'));
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
            logger.error({ message: 'Redis Rate Limit Error', meta: { error } });
            // Fail open: allow request if redis fails
            return true;
        }
    }
}
export const redisClient = new RedisClient();
