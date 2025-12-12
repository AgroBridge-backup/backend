import Redis from 'ioredis';
import { env } from '@/infrastructure/config/env';

/**
 * A singleton Redis client class to manage connection and operations.
 * This ensures only one connection is established and reused throughout the application.
 */
class RedisClient {
  private static instance: RedisClient;
  public readonly client: Redis;

  /**
   * The constructor is private to prevent direct instantiation.
   * Use getInstance() instead.
   */
  private constructor() {
    this.client = new Redis(env.redisUrl, {
      maxRetriesPerRequest: 3,
      lazyConnect: true, // Connects only when a command is issued
    });

    this.client.on('error', (err) => console.error('Redis Client Error', err));
    this.client.on('connect', () => console.log('Redis client connected'));
  }

  /**
   * Gets the singleton instance of the RedisClient.
   * @returns The singleton RedisClient instance.
   */
  public static getInstance(): RedisClient {
    if (!RedisClient.instance) {
      RedisClient.instance = new RedisClient();
    }
    return RedisClient.instance;
  }

  /**
   * Checks if a JWT ID (jti) is in the blacklist.
   * @param jti The JWT ID to check.
   * @returns A promise that resolves to true if the token is blacklisted, false otherwise.
   */
  public async isBlacklisted(jti: string): Promise<boolean> {
    const result = await this.client.get(`blacklist:${jti}`);
    return result !== null;
  }

  /**
   * Adds a JWT ID (jti) to the blacklist with an expiration time.
   * The expiration should match the token's original expiration to auto-clean the list.
   * @param jti The JWT ID to blacklist.
   * @param exp The original expiration timestamp of the token (in seconds).
   */
  public async blacklistToken(jti: string, exp: number): Promise<void> {
    const now = Math.floor(Date.now() / 1000);
    const ttl = exp - now; // Time-to-live in seconds

    if (ttl > 0) {
      await this.client.set(`blacklist:${jti}`, 'true', 'EX', ttl);
    }
  }

  /**
   * A placeholder for a rate-limiting check.
   * In a real implementation, this would involve more complex logic (e.g., token bucket).
   * @param key The key to check rate limit for (e.g., user ID or IP address).
   * @returns A promise that resolves to true if the request is allowed, false otherwise.
   */
  public async checkRateLimit(key: string): Promise<boolean> {
    // This is a simplified example. A real implementation would be more robust.
    const limit = 100; // 100 requests
    const window = 60; // per 60 seconds
    const current = await this.client.incr(key);
    if (current === 1) {
      await this.client.expire(key, window);
    }
    return current <= limit;
  }

  /**
   * Gracefully disconnects from the Redis server.
   * Useful for teardown in tests or application shutdown.
   */
  public async quit(): Promise<void> {
    await this.client.quit();
  }
}

// Export a singleton instance for use across the application
export const redisClient = RedisClient.getInstance();