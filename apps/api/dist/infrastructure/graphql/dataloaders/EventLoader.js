import DataLoader from 'dataloader';
export function createEventLoader(prisma) {
    return new DataLoader(async (ids) => {
        const events = await prisma.traceabilityEvent.findMany({
            where: {
                id: {
                    in: ids,
                },
            },
        });
        const eventMap = new Map();
        events.forEach((event) => {
            eventMap.set(event.id, event);
        });
        return ids.map((id) => eventMap.get(id) || null);
    }, { cache: true, maxBatchSize: 100 });
}
export function createEventsByBatchLoader(prisma) {
    return new DataLoader(async (batchIds) => {
        const events = await prisma.traceabilityEvent.findMany({
            where: {
                batchId: {
                    in: batchIds,
                },
            },
            orderBy: { timestamp: 'asc' },
        });
        const eventsByBatch = new Map();
        batchIds.forEach((id) => eventsByBatch.set(id, []));
        events.forEach((event) => {
            const existing = eventsByBatch.get(event.batchId) || [];
            existing.push(event);
            eventsByBatch.set(event.batchId, existing);
        });
        return batchIds.map((id) => eventsByBatch.get(id) || []);
    }, { cache: true, maxBatchSize: 50 });
}
export function createEventCountByBatchLoader(prisma) {
    return new DataLoader(async (batchIds) => {
        const counts = await prisma.traceabilityEvent.groupBy({
            by: ['batchId'],
            where: {
                batchId: {
                    in: batchIds,
                },
            },
            _count: true,
        });
        const countMap = new Map();
        counts.forEach((item) => {
            countMap.set(item.batchId, item._count);
        });
        return batchIds.map((id) => countMap.get(id) || 0);
    }, { cache: true, maxBatchSize: 100 });
}
export function createLatestEventByBatchLoader(prisma) {
    return new DataLoader(async (batchIds) => {
        const latestEvents = await prisma.$queryRaw `
        SELECT DISTINCT ON ("batchId") "batchId", "id"
        FROM "traceability_events"
        WHERE "batchId" = ANY(${batchIds}::text[])
        ORDER BY "batchId", "timestamp" DESC
      `;
        if (latestEvents.length === 0) {
            return batchIds.map(() => null);
        }
        const eventIds = latestEvents.map((e) => e.id);
        const events = await prisma.traceabilityEvent.findMany({
            where: { id: { in: eventIds } },
        });
        const eventMap = new Map();
        events.forEach((event) => {
            eventMap.set(event.batchId, event);
        });
        return batchIds.map((id) => eventMap.get(id) || null);
    }, { cache: true, maxBatchSize: 50 });
}
