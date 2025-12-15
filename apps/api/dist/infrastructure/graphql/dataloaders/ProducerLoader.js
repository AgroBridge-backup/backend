import DataLoader from 'dataloader';
export function createProducerLoader(prisma) {
    return new DataLoader(async (ids) => {
        const producers = await prisma.producer.findMany({
            where: {
                id: {
                    in: ids,
                },
            },
        });
        const producerMap = new Map();
        producers.forEach((producer) => {
            producerMap.set(producer.id, producer);
        });
        return ids.map((id) => producerMap.get(id) || null);
    }, { cache: true, maxBatchSize: 100 });
}
export function createProducerByUserIdLoader(prisma) {
    return new DataLoader(async (userIds) => {
        const producers = await prisma.producer.findMany({
            where: {
                userId: {
                    in: userIds,
                },
            },
        });
        const producerMap = new Map();
        producers.forEach((producer) => {
            producerMap.set(producer.userId, producer);
        });
        return userIds.map((id) => producerMap.get(id) || null);
    }, { cache: true, maxBatchSize: 100 });
}
export function createProducerBatchCountLoader(prisma) {
    return new DataLoader(async (producerIds) => {
        const counts = await prisma.batch.groupBy({
            by: ['producerId'],
            where: {
                producerId: {
                    in: producerIds,
                },
            },
            _count: true,
        });
        const countMap = new Map();
        counts.forEach((item) => {
            countMap.set(item.producerId, item._count);
        });
        return producerIds.map((id) => countMap.get(id) || 0);
    }, { cache: true, maxBatchSize: 100 });
}
export function createProducerActiveBatchCountLoader(prisma) {
    return new DataLoader(async (producerIds) => {
        const counts = await prisma.batch.groupBy({
            by: ['producerId'],
            where: {
                producerId: {
                    in: producerIds,
                },
                status: {
                    in: ['REGISTERED', 'IN_TRANSIT', 'ARRIVED'],
                },
            },
            _count: true,
        });
        const countMap = new Map();
        counts.forEach((item) => {
            countMap.set(item.producerId, item._count);
        });
        return producerIds.map((id) => countMap.get(id) || 0);
    }, { cache: true, maxBatchSize: 100 });
}
