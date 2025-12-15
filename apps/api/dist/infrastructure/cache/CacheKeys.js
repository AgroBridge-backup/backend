export const CacheTTL = {
    BATCH: 300,
    PRODUCER: 600,
    EVENT: 120,
    USER: 300,
    LIST: 60,
    STATS: 180,
    HEALTH: 30,
};
export const CachePrefix = {
    BATCH: 'batch',
    PRODUCER: 'producer',
    EVENT: 'event',
    USER: 'user',
    STATS: 'stats',
    LIST: 'list',
    HEALTH: 'health',
};
export class CacheKeys {
    static batch(batchId) {
        return `${CachePrefix.BATCH}:${batchId}`;
    }
    static batchByNumber(batchNumber) {
        return `${CachePrefix.BATCH}:number:${batchNumber}`;
    }
    static batchHistory(batchId) {
        return `${CachePrefix.BATCH}:${batchId}:history`;
    }
    static batchList(options) {
        const parts = [CachePrefix.BATCH, CachePrefix.LIST];
        if (options.producerId) {
            parts.push(`producer:${options.producerId}`);
        }
        if (options.status) {
            parts.push(`status:${options.status}`);
        }
        if (options.page) {
            parts.push(`page:${options.page}`);
        }
        if (options.limit) {
            parts.push(`limit:${options.limit}`);
        }
        return parts.join(':');
    }
    static batchPattern(batchId) {
        if (batchId) {
            return `${CachePrefix.BATCH}:${batchId}*`;
        }
        return `${CachePrefix.BATCH}:*`;
    }
    static producer(producerId) {
        return `${CachePrefix.PRODUCER}:${producerId}`;
    }
    static producerByRfc(rfc) {
        return `${CachePrefix.PRODUCER}:rfc:${rfc}`;
    }
    static producerByUserId(userId) {
        return `${CachePrefix.PRODUCER}:user:${userId}`;
    }
    static producerList(options) {
        const parts = [CachePrefix.PRODUCER, CachePrefix.LIST];
        if (options.isWhitelisted !== undefined) {
            parts.push(`whitelisted:${options.isWhitelisted}`);
        }
        if (options.state) {
            parts.push(`state:${options.state}`);
        }
        if (options.page) {
            parts.push(`page:${options.page}`);
        }
        if (options.limit) {
            parts.push(`limit:${options.limit}`);
        }
        return parts.join(':');
    }
    static producerPattern(producerId) {
        if (producerId) {
            return `${CachePrefix.PRODUCER}:${producerId}*`;
        }
        return `${CachePrefix.PRODUCER}:*`;
    }
    static event(eventId) {
        return `${CachePrefix.EVENT}:${eventId}`;
    }
    static eventsByBatch(batchId) {
        return `${CachePrefix.EVENT}:batch:${batchId}`;
    }
    static eventPattern(eventId) {
        if (eventId) {
            return `${CachePrefix.EVENT}:${eventId}*`;
        }
        return `${CachePrefix.EVENT}:*`;
    }
    static user(userId) {
        return `${CachePrefix.USER}:${userId}`;
    }
    static userByEmail(email) {
        return `${CachePrefix.USER}:email:${email.toLowerCase()}`;
    }
    static userPattern(userId) {
        if (userId) {
            return `${CachePrefix.USER}:${userId}*`;
        }
        return `${CachePrefix.USER}:*`;
    }
    static batchStats(producerId) {
        if (producerId) {
            return `${CachePrefix.STATS}:batches:producer:${producerId}`;
        }
        return `${CachePrefix.STATS}:batches:global`;
    }
    static producerStats() {
        return `${CachePrefix.STATS}:producers`;
    }
    static eventStats(batchId) {
        if (batchId) {
            return `${CachePrefix.STATS}:events:batch:${batchId}`;
        }
        return `${CachePrefix.STATS}:events:global`;
    }
    static health() {
        return `${CachePrefix.HEALTH}:status`;
    }
}
export default CacheKeys;
