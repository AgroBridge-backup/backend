import { Router } from 'express';
import { batchesV2Router } from './batches.routes.js';
import { producersV2Router } from './producers.routes.js';
import { eventsV2Router } from './events.routes.js';
import { analyticsV2Router } from './analytics.routes.js';
import { ResponseFormatter } from '../../../infrastructure/http/ResponseFormatter.js';
const router = Router();
router.use('/batches', batchesV2Router);
router.use('/producers', producersV2Router);
router.use('/events', eventsV2Router);
router.use('/analytics', analyticsV2Router);
router.get('/', (_req, res) => {
    res.json(ResponseFormatter.success({
        version: '2.0.0',
        status: 'stable',
        description: 'AgroBridge API v2 with enhanced query capabilities',
        features: [
            {
                name: 'Field Selection',
                description: 'Select specific fields to reduce response size',
                example: '?fields=id,productName,producer.businessName',
            },
            {
                name: 'Advanced Filtering',
                description: 'Filter results with operators (eq, ne, gt, gte, lt, lte, in, like)',
                example: '?filter[status]=harvested&filter[weightKg][gte]=100',
            },
            {
                name: 'Sorting',
                description: 'Sort by one or more fields (- prefix for descending)',
                example: '?sort=-createdAt,productName',
            },
            {
                name: 'Pagination',
                description: 'Paginate results with page and limit',
                example: '?page=1&limit=20',
            },
            {
                name: 'Search',
                description: 'Full-text search across multiple fields',
                example: '?search=organic',
            },
            {
                name: 'Includes',
                description: 'Include related resources',
                example: '?include=producer,events',
            },
        ],
        endpoints: {
            batches: {
                list: 'GET /api/v2/batches',
                get: 'GET /api/v2/batches/:id',
                events: 'GET /api/v2/batches/:id/events',
                timeline: 'GET /api/v2/batches/:id/timeline',
            },
            producers: {
                list: 'GET /api/v2/producers',
                get: 'GET /api/v2/producers/:id',
                batches: 'GET /api/v2/producers/:id/batches',
                stats: 'GET /api/v2/producers/:id/stats',
            },
            events: {
                list: 'GET /api/v2/events',
                get: 'GET /api/v2/events/:id',
                distribution: 'GET /api/v2/events/types/distribution',
                recent: 'GET /api/v2/events/recent/list',
            },
            analytics: {
                dashboard: 'GET /api/v2/analytics/dashboard',
                batchStats: 'GET /api/v2/analytics/batches/stats',
                batchTimeline: 'GET /api/v2/analytics/batches/timeline',
                producerStats: 'GET /api/v2/analytics/producers/stats',
                topProducers: 'GET /api/v2/analytics/producers/top',
                eventDistribution: 'GET /api/v2/analytics/events/distribution',
                overview: 'GET /api/v2/analytics/overview',
            },
        },
        responseFormat: {
            success: {
                success: true,
                data: '...',
                meta: '{ page, limit, total, totalPages, hasNextPage, hasPreviousPage }',
                links: '{ self, first, prev, next, last }',
            },
            error: {
                success: false,
                error: {
                    code: 'ERROR_CODE',
                    message: 'Human readable message',
                    details: '...',
                    timestamp: 'ISO date',
                },
            },
        },
        limits: {
            maxPageSize: 100,
            defaultPageSize: 20,
            maxDepth: 2,
            rateLimiting: 'See X-RateLimit-* headers',
        },
        documentation: '/docs/api/v2',
        graphql: '/graphql',
    }));
});
router.get('/health', (_req, res) => {
    res.json(ResponseFormatter.success({
        status: 'healthy',
        version: '2.0.0',
        timestamp: new Date().toISOString(),
    }));
});
export { router as v2Router };
export default router;
export function createV2Router(_prisma, _redis) {
    return router;
}
