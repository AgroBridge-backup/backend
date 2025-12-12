import Redis, { RedisOptions } from 'ioredis';
export declare class RedisClient {
    private static instance;
    readonly client: Redis;
    private constructor();
    static getInstance(connection?: string | RedisOptions): RedisClient;
    get<T>(key: string): Promise<T | null>;
    set(key: string, value: any): Promise<void>;
    setex(key: string, ttl: number, value: any): Promise<void>;
    del(key: string): Promise<void>;
    incr(key: string): Promise<number>;
    expire(key: string, ttl: number): Promise<void>;
    ping(): Promise<string>;
    cacheWrapper<T>(key: string, ttl: number, fetchFn: () => Promise<T>): Promise<T>;
    checkRateLimit(identifier: string, limit: number, window: number): Promise<boolean>;
    blacklistToken(jti: string, expiresAt: number): Promise<void>;
    isBlacklisted(jti: string): Promise<boolean>;
}
export declare const redisClient: RedisClient;
//# sourceMappingURL=RedisClient.d.ts.map