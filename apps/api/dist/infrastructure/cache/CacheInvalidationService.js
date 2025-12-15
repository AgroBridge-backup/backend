import logger from '../../shared/utils/logger.js';
import { redisCacheService } from './RedisCacheService.js';
import { CacheKeys } from './CacheKeys.js';
export class CacheInvalidationService {
    cacheService;
    constructor(cacheService = redisCacheService) {
        this.cacheService = cacheService;
    }
    async onEvent(context) {
        logger.debug({
            message: 'Cache invalidation triggered',
            meta: { event: context.event, entityId: context.entityId },
        });
        switch (context.event) {
            case 'BATCH_CREATED':
            case 'BATCH_UPDATED':
            case 'BATCH_DELETED':
            case 'BATCH_STATUS_CHANGED':
                await this.invalidateBatchCascade(context.entityId, context.relatedIds?.producerId);
                break;
            case 'PRODUCER_CREATED':
            case 'PRODUCER_UPDATED':
            case 'PRODUCER_DELETED':
            case 'PRODUCER_WHITELISTED':
                await this.invalidateProducerCascade(context.entityId, context.relatedIds?.userId);
                break;
            case 'EVENT_CREATED':
            case 'EVENT_UPDATED':
            case 'EVENT_VERIFIED':
                await this.invalidateEventCascade(context.entityId, context.relatedIds?.batchId);
                break;
            case 'USER_UPDATED':
                await this.invalidateUserCascade(context.entityId);
                break;
            case 'CERTIFICATION_ADDED':
            case 'CERTIFICATION_REMOVED':
                if (context.relatedIds?.producerId) {
                    await this.invalidateProducerCascade(context.relatedIds.producerId);
                }
                break;
        }
    }
    async invalidateBatchCascade(batchId, producerId) {
        const promises = [];
        promises.push(this.cacheService.del(CacheKeys.batch(batchId)));
        promises.push(this.cacheService.del(CacheKeys.batchHistory(batchId)));
        promises.push(this.cacheService.invalidatePattern('batch:list:*'));
        promises.push(this.cacheService.invalidatePattern('stats:batches:*'));
        if (producerId) {
            promises.push(this.cacheService.invalidatePattern(`batch:list:producer:${producerId}*`));
        }
        await Promise.all(promises);
        logger.debug({
            message: 'Batch cache cascade invalidated',
            meta: { batchId, producerId },
        });
    }
    async invalidateProducerCascade(producerId, userId) {
        const promises = [];
        promises.push(this.cacheService.del(CacheKeys.producer(producerId)));
        if (userId) {
            promises.push(this.cacheService.del(CacheKeys.producerByUserId(userId)));
        }
        promises.push(this.cacheService.invalidatePattern('producer:list:*'));
        promises.push(this.cacheService.invalidatePattern('stats:producers*'));
        promises.push(this.cacheService.invalidatePattern(`batch:list:producer:${producerId}*`));
        await Promise.all(promises);
        logger.debug({
            message: 'Producer cache cascade invalidated',
            meta: { producerId, userId },
        });
    }
    async invalidateEventCascade(eventId, batchId) {
        const promises = [];
        promises.push(this.cacheService.del(CacheKeys.event(eventId)));
        if (batchId) {
            promises.push(this.cacheService.del(CacheKeys.eventsByBatch(batchId)));
            promises.push(this.cacheService.del(CacheKeys.batchHistory(batchId)));
        }
        promises.push(this.cacheService.invalidatePattern('stats:events:*'));
        await Promise.all(promises);
        logger.debug({
            message: 'Event cache cascade invalidated',
            meta: { eventId, batchId },
        });
    }
    async invalidateUserCascade(userId) {
        const promises = [];
        promises.push(this.cacheService.del(CacheKeys.user(userId)));
        promises.push(this.cacheService.invalidatePattern(`user:${userId}*`));
        promises.push(this.cacheService.del(CacheKeys.producerByUserId(userId)));
        await Promise.all(promises);
        logger.debug({
            message: 'User cache cascade invalidated',
            meta: { userId },
        });
    }
    async invalidateBatches(batchIds) {
        if (batchIds.length === 0)
            return;
        const keys = batchIds.flatMap((id) => [
            CacheKeys.batch(id),
            CacheKeys.batchHistory(id),
        ]);
        await this.cacheService.delMultiple(keys);
        await this.cacheService.invalidatePattern('batch:list:*');
        await this.cacheService.invalidatePattern('stats:batches:*');
        logger.debug({
            message: 'Bulk batch cache invalidation completed',
            meta: { count: batchIds.length },
        });
    }
    async invalidateProducers(producerIds) {
        if (producerIds.length === 0)
            return;
        const keys = producerIds.map((id) => CacheKeys.producer(id));
        await this.cacheService.delMultiple(keys);
        await this.cacheService.invalidatePattern('producer:list:*');
        await this.cacheService.invalidatePattern('stats:producers*');
        logger.debug({
            message: 'Bulk producer cache invalidation completed',
            meta: { count: producerIds.length },
        });
    }
    async invalidateEvents(eventIds) {
        if (eventIds.length === 0)
            return;
        const keys = eventIds.map((id) => CacheKeys.event(id));
        await this.cacheService.delMultiple(keys);
        await this.cacheService.invalidatePattern('stats:events:*');
        logger.debug({
            message: 'Bulk event cache invalidation completed',
            meta: { count: eventIds.length },
        });
    }
    async warmCache(options) {
        const opts = {
            producers: true,
            batches: true,
            stats: true,
            ...options,
        };
        logger.info({ message: 'Starting cache warming...' });
        const tasks = [];
        if (opts.stats) {
            await this.cacheService.set(CacheKeys.health(), { status: 'warming' }, 30);
        }
        await Promise.all(tasks);
        logger.info({ message: 'Cache warming completed' });
    }
}
export const cacheInvalidationService = new CacheInvalidationService();
export default cacheInvalidationService;
