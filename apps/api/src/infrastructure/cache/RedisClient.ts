import { Redis } from 'ioredis';
import logger from '../../shared/utils/logger.js';

/**
 * In-memory rate limit entry
 */
interface RateLimitEntry {
  count: number;
  expiresAt: number;
}

/**
 * In-memory rate limit store (fallback when Redis unavailable)
 */
class InMemoryRateLimiter {
  private store: Map<string, RateLimitEntry> = new Map();
  private cleanupInterval: NodeJS.Timeout | null = null;
  private readonly MAX_ENTRIES = 10000; // Prevent memory bloat

  constructor() {
    // Cleanup expired entries every 60 seconds
    this.cleanupInterval = setInterval(() => this.cleanup(), 60000);
  }

  check(key: string, limit: number, windowSeconds: number): boolean {
    const now = Date.now();
    const entry = this.store.get(key);

    if (!entry || entry.expiresAt < now) {
      // New entry or expired
      this.store.set(key, {
        count: 1,
        expiresAt: now + windowSeconds * 1000,
      });
      return true;
    }

    // Increment existing entry
    entry.count++;
    return entry.count <= limit;
  }

  private cleanup(): void {
    const now = Date.now();
    let cleaned = 0;

    for (const [key, entry] of this.store.entries()) {
      if (entry.expiresAt < now) {
        this.store.delete(key);
        cleaned++;
      }
    }

    // If still over limit, remove oldest entries
    if (this.store.size > this.MAX_ENTRIES) {
      const entriesToRemove = this.store.size - this.MAX_ENTRIES;
      const iterator = this.store.keys();
      for (let i = 0; i < entriesToRemove; i++) {
        const key = iterator.next().value;
        if (key) this.store.delete(key);
      }
    }

    if (cleaned > 0) {
      logger.debug('[InMemoryRateLimiter] Cleaned expired entries', { count: cleaned });
    }
  }

  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    this.store.clear();
  }
}

export class RedisClient {
  public client: Redis;
  private inMemoryFallback: InMemoryRateLimiter;
  private redisAvailable: boolean = true;

  constructor() {
    this.client = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
    this.inMemoryFallback = new InMemoryRateLimiter();

    this.client.on('error', (err: Error) => {
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

  async blacklistToken(jti: string, exp: number): Promise<void> {
    const now = Math.floor(Date.now() / 1000);
    const ttl = exp - now;
    if (ttl > 0) {
      await this.client.set(jti, 'blacklisted', 'EX', ttl);
    }
  }

  async isBlacklisted(jti: string): Promise<boolean> {
    const result = await this.client.get(jti);
    return result !== null;
  }

  /**
   * Check rate limit with in-memory fallback
   * SECURITY: Fails closed (blocks requests) when both Redis and memory checks fail
   */
  async checkRateLimit(key: string, limit: number, windowSeconds: number): Promise<boolean> {
    try {
      const current = await this.client.incr(key);
      if (current === 1) {
        await this.client.expire(key, windowSeconds);
      }
      return current <= limit;
    } catch (error) {
      logger.warn({
        message: 'Redis rate limit unavailable, using in-memory fallback',
        meta: { key, error: error instanceof Error ? error.message : 'Unknown' },
      });

      // Use in-memory fallback instead of failing open
      try {
        return this.inMemoryFallback.check(key, limit, windowSeconds);
      } catch (fallbackError) {
        logger.error({
          message: 'Both Redis and in-memory rate limit failed - blocking request',
          meta: { key },
        });
        // SECURITY: Fail closed - block the request when both methods fail
        return false;
      }
    }
  }

  /**
   * Check if Redis is currently available
   */
  isAvailable(): boolean {
    return this.redisAvailable;
  }
}

export const redisClient = new RedisClient();