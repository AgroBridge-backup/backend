/**
 * Advanced Rate Limiter with Redis Backend
 * Multi-tier rate limiting for different endpoint categories
 */

import rateLimit, { RateLimitRequestHandler, Options } from 'express-rate-limit';
import { Request, Response, NextFunction } from 'express';
import { Redis } from 'ioredis';
import { logger } from '../logging/logger.js';

// Redis client for rate limiting
let redisClient: Redis | null = null;

/**
 * Initialize Redis client for rate limiting
 */
export function initRateLimitRedis(redis: Redis): void {
  redisClient = redis;
  logger.info('Rate limiter Redis client initialized');
}

/**
 * Rate limit tiers configuration
 */
export const RateLimitTiers = {
  // Authentication endpoints - strict limits
  AUTH: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // 5 attempts per window
    message: 'Too many authentication attempts. Please try again in 15 minutes.',
    standardHeaders: true,
    legacyHeaders: false,
  },

  // General API endpoints - moderate limits
  API: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // 100 requests per window
    message: 'Too many requests. Please slow down.',
    standardHeaders: true,
    legacyHeaders: false,
  },

  // High-frequency endpoints (health checks, etc.)
  HIGH_FREQUENCY: {
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 300, // 300 requests per minute
    message: 'Rate limit exceeded.',
    standardHeaders: true,
    legacyHeaders: false,
  },

  // Sensitive operations (password reset, 2FA)
  SENSITIVE: {
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 3, // 3 attempts per hour
    message: 'Too many sensitive operation attempts. Please try again later.',
    standardHeaders: true,
    legacyHeaders: false,
  },

  // File uploads
  UPLOAD: {
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 20, // 20 uploads per hour
    message: 'Upload limit exceeded. Please try again later.',
    standardHeaders: true,
    legacyHeaders: false,
  },

  // Reports and exports
  EXPORT: {
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 10, // 10 exports per hour
    message: 'Export limit exceeded. Please try again later.',
    standardHeaders: true,
    legacyHeaders: false,
  },

  // Webhooks - allow more for integrations
  WEBHOOK: {
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 50, // 50 webhook deliveries per minute
    message: 'Webhook rate limit exceeded.',
    standardHeaders: true,
    legacyHeaders: false,
  },

  // GraphQL - moderate limits
  GRAPHQL: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 200, // 200 queries per window
    message: 'GraphQL rate limit exceeded.',
    standardHeaders: true,
    legacyHeaders: false,
  },
} as const;

/**
 * Redis-based store for rate limiting
 */
class RedisRateLimitStore {
  private prefix: string;
  private windowMs: number;

  constructor(prefix: string, windowMs: number) {
    this.prefix = prefix;
    this.windowMs = windowMs;
  }

  private getKey(key: string): string {
    return `ratelimit:${this.prefix}:${key}`;
  }

  async increment(key: string): Promise<{ totalHits: number; resetTime: Date }> {
    if (!redisClient) {
      throw new Error('Redis client not initialized');
    }

    const redisKey = this.getKey(key);
    const now = Date.now();
    const windowStart = now - this.windowMs;

    try {
      // Remove old entries outside the window
      await redisClient.zremrangebyscore(redisKey, 0, windowStart);

      // Add current request
      await redisClient.zadd(redisKey, now.toString(), `${now}-${Math.random()}`);

      // Get count of requests in window
      const count = await redisClient.zcard(redisKey);

      // Set expiry on the key
      await redisClient.pexpire(redisKey, this.windowMs);

      // Calculate reset time
      const oldestEntry = await redisClient.zrange(redisKey, 0, 0, 'WITHSCORES');
      const resetTime = oldestEntry.length > 1
        ? new Date(parseInt(oldestEntry[1]) + this.windowMs)
        : new Date(now + this.windowMs);

      return { totalHits: count, resetTime };
    } catch (error) {
      logger.error('Rate limit Redis error', { error, key });
      // Fallback: allow request on Redis error
      return { totalHits: 0, resetTime: new Date(now + this.windowMs) };
    }
  }

  async decrement(key: string): Promise<void> {
    if (!redisClient) return;

    const redisKey = this.getKey(key);
    try {
      // Remove the most recent entry
      const entries = await redisClient.zrange(redisKey, -1, -1);
      if (entries.length > 0) {
        await redisClient.zrem(redisKey, entries[0]);
      }
    } catch (error) {
      logger.error('Rate limit decrement error', { error, key });
    }
  }

  async resetKey(key: string): Promise<void> {
    if (!redisClient) return;

    const redisKey = this.getKey(key);
    try {
      await redisClient.del(redisKey);
    } catch (error) {
      logger.error('Rate limit reset error', { error, key });
    }
  }
}

/**
 * Create rate limiter with custom options
 */
export function createRateLimiter(
  tier: keyof typeof RateLimitTiers,
  customOptions: Partial<Options> = {}
): RateLimitRequestHandler {
  const tierConfig = RateLimitTiers[tier];
  const prefix = tier.toLowerCase();

  const store = redisClient
    ? new RedisRateLimitStore(prefix, tierConfig.windowMs)
    : undefined;

  const options: Partial<Options> = {
    ...tierConfig,
    ...customOptions,
    keyGenerator: (req: Request): string => {
      // Use user ID if authenticated, otherwise IP
      const userId = req.user?.id || req.user?.userId;
      const ip = req.ip || req.socket.remoteAddress || 'unknown';
      return userId ? `user:${userId}` : `ip:${ip}`;
    },
    skip: (req: Request): boolean => {
      // Skip rate limiting for internal health checks
      if (req.path === '/health' && req.headers['x-internal-check'] === 'true') {
        return true;
      }
      return false;
    },
    handler: (req: Request, res: Response, next: NextFunction, options: Options): void => {
      logger.warn('Rate limit exceeded', {
        ip: req.ip,
        path: req.path,
        method: req.method,
        userId: req.user?.id || req.user?.userId,
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

  // Use custom store only if Redis is available
  if (store) {
    options.store = {
      increment: async (key: string) => store.increment(key),
      decrement: async (key: string) => store.decrement(key),
      resetKey: async (key: string) => store.resetKey(key),
    } as Options['store'];
  }

  return rateLimit(options);
}

/**
 * IP-based rate limiter for unauthenticated requests
 */
export function ipRateLimiter(
  windowMs: number,
  maxRequests: number,
  message: string
): RateLimitRequestHandler {
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
    keyGenerator: (req: Request): string => {
      return req.ip || req.socket.remoteAddress || 'unknown';
    },
    standardHeaders: true,
    legacyHeaders: false,
  });
}

/**
 * User-based rate limiter for authenticated requests
 */
export function userRateLimiter(
  windowMs: number,
  maxRequests: number,
  message: string
): RateLimitRequestHandler {
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
    keyGenerator: (req: Request): string => {
      const userId = req.user?.id || req.user?.userId;
      return userId ? `user:${userId}` : req.ip || 'unknown';
    },
    standardHeaders: true,
    legacyHeaders: false,
  });
}

/**
 * Dynamic rate limiter based on user subscription tier
 */
export function dynamicRateLimiter(): (req: Request, res: Response, next: NextFunction) => void {
  const limiters: Record<string, RateLimitRequestHandler> = {
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

  return (req: Request, res: Response, next: NextFunction): void => {
    const tier = req.user?.subscriptionTier || 'free';
    const limiter = limiters[tier] || limiters.free;
    limiter(req, res, next);
  };
}

/**
 * Sliding window rate limiter
 */
export async function slidingWindowRateLimiter(
  key: string,
  windowMs: number,
  maxRequests: number
): Promise<{ allowed: boolean; remaining: number; resetTime: Date }> {
  if (!redisClient) {
    return { allowed: true, remaining: maxRequests, resetTime: new Date() };
  }

  const now = Date.now();
  const windowStart = now - windowMs;
  const redisKey = `sliding:${key}`;

  try {
    // Remove old entries
    await redisClient.zremrangebyscore(redisKey, 0, windowStart);

    // Count current entries
    const count = await redisClient.zcard(redisKey);

    if (count >= maxRequests) {
      // Get oldest entry to calculate reset time
      const oldest = await redisClient.zrange(redisKey, 0, 0, 'WITHSCORES');
      const resetTime = oldest.length > 1
        ? new Date(parseInt(oldest[1]) + windowMs)
        : new Date(now + windowMs);

      return { allowed: false, remaining: 0, resetTime };
    }

    // Add new entry
    await redisClient.zadd(redisKey, now.toString(), `${now}-${Math.random()}`);
    await redisClient.pexpire(redisKey, windowMs);

    return {
      allowed: true,
      remaining: maxRequests - count - 1,
      resetTime: new Date(now + windowMs),
    };
  } catch (error) {
    logger.error('Sliding window rate limiter error', { error, key });
    return { allowed: true, remaining: maxRequests, resetTime: new Date() };
  }
}

/**
 * Burst rate limiter (token bucket algorithm)
 */
export async function burstRateLimiter(
  key: string,
  bucketSize: number,
  refillRate: number, // tokens per second
): Promise<{ allowed: boolean; tokens: number }> {
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
    `, 1, redisKey, bucketSize, refillRate, Date.now()) as [number, number];

    return { allowed: result[0] === 1, tokens: result[1] };
  } catch (error) {
    logger.error('Burst rate limiter error', { error, key });
    return { allowed: true, tokens: bucketSize };
  }
}

/**
 * Pre-configured rate limiters for common endpoints
 */
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

/**
 * Middleware to add rate limit headers to response
 */
export function rateLimitHeaders(
  remaining: number,
  limit: number,
  resetTime: Date
): Record<string, string> {
  return {
    'X-RateLimit-Limit': limit.toString(),
    'X-RateLimit-Remaining': remaining.toString(),
    'X-RateLimit-Reset': Math.ceil(resetTime.getTime() / 1000).toString(),
    'Retry-After': Math.ceil((resetTime.getTime() - Date.now()) / 1000).toString(),
  };
}

export default rateLimiters;
