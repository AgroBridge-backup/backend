import rateLimit from 'express-rate-limit';
import { logger } from '../logging/logger.js';
let redisClient = null;
export function initRateLimitRedis(redis) {
    redisClient = redis;
    logger.info('Rate limiter Redis client initialized');
}
export const RateLimitTiers = {
    AUTH: {
        windowMs: 15 * 60 * 1000,
        max: 5,
        message: 'Too many authentication attempts. Please try again in 15 minutes.',
        standardHeaders: true,
        legacyHeaders: false,
    },
    API: {
        windowMs: 15 * 60 * 1000,
        max: 100,
        message: 'Too many requests. Please slow down.',
        standardHeaders: true,
        legacyHeaders: false,
    },
    HIGH_FREQUENCY: {
        windowMs: 1 * 60 * 1000,
        max: 300,
        message: 'Rate limit exceeded.',
        standardHeaders: true,
        legacyHeaders: false,
    },
    SENSITIVE: {
        windowMs: 60 * 60 * 1000,
        max: 3,
        message: 'Too many sensitive operation attempts. Please try again later.',
        standardHeaders: true,
        legacyHeaders: false,
    },
    UPLOAD: {
        windowMs: 60 * 60 * 1000,
        max: 20,
        message: 'Upload limit exceeded. Please try again later.',
        standardHeaders: true,
        legacyHeaders: false,
    },
    EXPORT: {
        windowMs: 60 * 60 * 1000,
        max: 10,
        message: 'Export limit exceeded. Please try again later.',
        standardHeaders: true,
        legacyHeaders: false,
    },
    WEBHOOK: {
        windowMs: 1 * 60 * 1000,
        max: 50,
        message: 'Webhook rate limit exceeded.',
        standardHeaders: true,
        legacyHeaders: false,
    },
    GRAPHQL: {
        windowMs: 15 * 60 * 1000,
        max: 200,
        message: 'GraphQL rate limit exceeded.',
        standardHeaders: true,
        legacyHeaders: false,
    },
};
class RedisRateLimitStore {
    prefix;
    windowMs;
    constructor(prefix, windowMs) {
        this.prefix = prefix;
        this.windowMs = windowMs;
    }
    getKey(key) {
        return `ratelimit:${this.prefix}:${key}`;
    }
    async increment(key) {
        if (!redisClient) {
            throw new Error('Redis client not initialized');
        }
        const redisKey = this.getKey(key);
        const now = Date.now();
        const windowStart = now - this.windowMs;
        try {
            await redisClient.zremrangebyscore(redisKey, 0, windowStart);
            await redisClient.zadd(redisKey, now.toString(), `${now}-${Math.random()}`);
            const count = await redisClient.zcard(redisKey);
            await redisClient.pexpire(redisKey, this.windowMs);
            const oldestEntry = await redisClient.zrange(redisKey, 0, 0, 'WITHSCORES');
            const resetTime = oldestEntry.length > 1
                ? new Date(parseInt(oldestEntry[1]) + this.windowMs)
                : new Date(now + this.windowMs);
            return { totalHits: count, resetTime };
        }
        catch (error) {
            logger.error('Rate limit Redis error', { error, key });
            return { totalHits: 0, resetTime: new Date(now + this.windowMs) };
        }
    }
    async decrement(key) {
        if (!redisClient)
            return;
        const redisKey = this.getKey(key);
        try {
            const entries = await redisClient.zrange(redisKey, -1, -1);
            if (entries.length > 0) {
                await redisClient.zrem(redisKey, entries[0]);
            }
        }
        catch (error) {
            logger.error('Rate limit decrement error', { error, key });
        }
    }
    async resetKey(key) {
        if (!redisClient)
            return;
        const redisKey = this.getKey(key);
        try {
            await redisClient.del(redisKey);
        }
        catch (error) {
            logger.error('Rate limit reset error', { error, key });
        }
    }
}
export function createRateLimiter(tier, customOptions = {}) {
    const tierConfig = RateLimitTiers[tier];
    const prefix = tier.toLowerCase();
    const store = redisClient
        ? new RedisRateLimitStore(prefix, tierConfig.windowMs)
        : undefined;
    const options = {
        ...tierConfig,
        ...customOptions,
        keyGenerator: (req) => {
            const userId = req.user?.id;
            const ip = req.ip || req.socket.remoteAddress || 'unknown';
            return userId ? `user:${userId}` : `ip:${ip}`;
        },
        skip: (req) => {
            if (req.path === '/health' && req.headers['x-internal-check'] === 'true') {
                return true;
            }
            return false;
        },
        handler: (req, res, next, options) => {
            logger.warn('Rate limit exceeded', {
                ip: req.ip,
                path: req.path,
                method: req.method,
                userId: req.user?.id,
                tier,
            });
            res.status(429).json({
                success: false,
                error: {
                    code: 'RATE_LIMIT_EXCEEDED',
                    message: tierConfig.message,
                    retryAfter: Math.ceil(tierConfig.windowMs / 1000),
                },
            });
        },
    };
    if (store) {
        options.store = {
            increment: async (key) => store.increment(key),
            decrement: async (key) => store.decrement(key),
            resetKey: async (key) => store.resetKey(key),
        };
    }
    return rateLimit(options);
}
export function ipRateLimiter(windowMs, maxRequests, message) {
    return rateLimit({
        windowMs,
        max: maxRequests,
        message: {
            success: false,
            error: {
                code: 'RATE_LIMIT_EXCEEDED',
                message,
            },
        },
        keyGenerator: (req) => {
            return req.ip || req.socket.remoteAddress || 'unknown';
        },
        standardHeaders: true,
        legacyHeaders: false,
    });
}
export function userRateLimiter(windowMs, maxRequests, message) {
    return rateLimit({
        windowMs,
        max: maxRequests,
        message: {
            success: false,
            error: {
                code: 'RATE_LIMIT_EXCEEDED',
                message,
            },
        },
        keyGenerator: (req) => {
            const userId = req.user?.id;
            return userId ? `user:${userId}` : req.ip || 'unknown';
        },
        standardHeaders: true,
        legacyHeaders: false,
    });
}
export function dynamicRateLimiter() {
    const limiters = {
        free: rateLimit({
            windowMs: 15 * 60 * 1000,
            max: 50,
            standardHeaders: true,
            legacyHeaders: false,
        }),
        basic: rateLimit({
            windowMs: 15 * 60 * 1000,
            max: 200,
            standardHeaders: true,
            legacyHeaders: false,
        }),
        pro: rateLimit({
            windowMs: 15 * 60 * 1000,
            max: 1000,
            standardHeaders: true,
            legacyHeaders: false,
        }),
        enterprise: rateLimit({
            windowMs: 15 * 60 * 1000,
            max: 10000,
            standardHeaders: true,
            legacyHeaders: false,
        }),
    };
    return (req, res, next) => {
        const tier = req.user?.subscriptionTier || 'free';
        const limiter = limiters[tier] || limiters.free;
        limiter(req, res, next);
    };
}
export async function slidingWindowRateLimiter(key, windowMs, maxRequests) {
    if (!redisClient) {
        return { allowed: true, remaining: maxRequests, resetTime: new Date() };
    }
    const now = Date.now();
    const windowStart = now - windowMs;
    const redisKey = `sliding:${key}`;
    try {
        await redisClient.zremrangebyscore(redisKey, 0, windowStart);
        const count = await redisClient.zcard(redisKey);
        if (count >= maxRequests) {
            const oldest = await redisClient.zrange(redisKey, 0, 0, 'WITHSCORES');
            const resetTime = oldest.length > 1
                ? new Date(parseInt(oldest[1]) + windowMs)
                : new Date(now + windowMs);
            return { allowed: false, remaining: 0, resetTime };
        }
        await redisClient.zadd(redisKey, now.toString(), `${now}-${Math.random()}`);
        await redisClient.pexpire(redisKey, windowMs);
        return {
            allowed: true,
            remaining: maxRequests - count - 1,
            resetTime: new Date(now + windowMs),
        };
    }
    catch (error) {
        logger.error('Sliding window rate limiter error', { error, key });
        return { allowed: true, remaining: maxRequests, resetTime: new Date() };
    }
}
export async function burstRateLimiter(key, bucketSize, refillRate) {
    if (!redisClient) {
        return { allowed: true, tokens: bucketSize };
    }
    const redisKey = `bucket:${key}`;
    try {
        const result = await redisClient.eval(`
      local key = KEYS[1]
      local bucketSize = tonumber(ARGV[1])
      local refillRate = tonumber(ARGV[2])
      local now = tonumber(ARGV[3])

      local data = redis.call('HMGET', key, 'tokens', 'lastRefill')
      local tokens = tonumber(data[1]) or bucketSize
      local lastRefill = tonumber(data[2]) or now

      -- Calculate refill
      local elapsed = (now - lastRefill) / 1000
      local newTokens = math.min(bucketSize, tokens + (elapsed * refillRate))

      if newTokens >= 1 then
        -- Consume a token
        newTokens = newTokens - 1
        redis.call('HMSET', key, 'tokens', newTokens, 'lastRefill', now)
        redis.call('EXPIRE', key, 3600)
        return {1, newTokens}
      else
        redis.call('HMSET', key, 'tokens', newTokens, 'lastRefill', now)
        redis.call('EXPIRE', key, 3600)
        return {0, newTokens}
      end
    `, 1, redisKey, bucketSize, refillRate, Date.now());
        return { allowed: result[0] === 1, tokens: result[1] };
    }
    catch (error) {
        logger.error('Burst rate limiter error', { error, key });
        return { allowed: true, tokens: bucketSize };
    }
}
export const rateLimiters = {
    auth: createRateLimiter('AUTH'),
    api: createRateLimiter('API'),
    highFrequency: createRateLimiter('HIGH_FREQUENCY'),
    sensitive: createRateLimiter('SENSITIVE'),
    upload: createRateLimiter('UPLOAD'),
    export: createRateLimiter('EXPORT'),
    webhook: createRateLimiter('WEBHOOK'),
    graphql: createRateLimiter('GRAPHQL'),
};
export function rateLimitHeaders(remaining, limit, resetTime) {
    return {
        'X-RateLimit-Limit': limit.toString(),
        'X-RateLimit-Remaining': remaining.toString(),
        'X-RateLimit-Reset': Math.ceil(resetTime.getTime() / 1000).toString(),
        'Retry-After': Math.ceil((resetTime.getTime() - Date.now()) / 1000).toString(),
    };
}
export default rateLimiters;
