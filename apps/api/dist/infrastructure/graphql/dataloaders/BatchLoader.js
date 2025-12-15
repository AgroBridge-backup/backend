import DataLoader from 'dataloader';
export function createBatchLoader(prisma) {
    return new DataLoader(async (ids) => {
        const batches = await prisma.batch.findMany({
            where: {
                id: {
                    in: ids,
                },
            },
        });
        const batchMap = new Map();
        batches.forEach((batch) => {
            batchMap.set(batch.id, batch);
        });
        return ids.map((id) => batchMap.get(id) || null);
    }, {
        cache: true,
        maxBatchSize: 100,
    });
}
export function createBatchLoaderWithFields(prisma, select) {
    return new DataLoader(async (ids) => {
        const batches = await prisma.batch.findMany({
            where: {
                id: {
                    in: ids,
                },
            },
            select: {
                id: true,
                ...select,
            },
        });
        const batchMap = new Map();
        batches.forEach((batch) => {
            batchMap.set(batch.id, batch);
        });
        return ids.map((id) => batchMap.get(id) || null);
    }, { cache: true, maxBatchSize: 100 });
}
export function createBatchesByProducerLoader(prisma) {
    return new DataLoader(async (producerIds) => {
        const batches = await prisma.batch.findMany({
            where: {
                producerId: {
                    in: producerIds,
                },
            },
            orderBy: { createdAt: 'desc' },
        });
        const batchesByProducer = new Map();
        producerIds.forEach((id) => batchesByProducer.set(id, []));
        batches.forEach((batch) => {
            const existing = batchesByProducer.get(batch.producerId) || [];
            existing.push(batch);
            batchesByProducer.set(batch.producerId, existing);
        });
        return producerIds.map((id) => batchesByProducer.get(id) || []);
    }, { cache: true, maxBatchSize: 50 });
}
