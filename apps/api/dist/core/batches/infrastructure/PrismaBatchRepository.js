import { prisma } from '../../../infrastructure/database/prisma/client.js';
export class PrismaBatchRepository {
    async findById(id) {
        const batch = await prisma.batch.findUnique({
            where: { id },
        });
        return batch;
    }
    async create(data) {
        const newBatch = await prisma.batch.create({
            data: data, // Using 'as any' to bridge domain and prisma types
        });
        return newBatch;
    }
    async update(id, data) {
        const updatedBatch = await prisma.batch.update({
            where: { id },
            data: data, // Using 'as any' to bridge domain and prisma types
        });
        return updatedBatch;
    }
    async countByProducer(producerId) {
        const count = await prisma.batch.count({
            where: { producerId },
        });
        return count;
    }
    async delete(id) {
        await prisma.batch.delete({
            where: { id },
        });
    }
    async findMany(filters, pagination) {
        const page = pagination?.page || 1;
        const limit = pagination?.limit || 20;
        const where = {};
        if (filters?.status)
            where.status = filters.status;
        if (filters?.producerId)
            where.producerId = filters.producerId;
        const [total, batches] = await Promise.all([
            prisma.batch.count({ where }),
            prisma.batch.findMany({
                where,
                skip: (page - 1) * limit,
                take: limit,
                orderBy: { createdAt: 'desc' },
            }),
        ]);
        return {
            batches: batches,
            total,
        };
    }
    async findByProducerId(producerId, filters, pagination) {
        const page = pagination?.page || 1;
        const limit = pagination?.limit || 20;
        const where = { producerId };
        if (filters?.status)
            where.status = filters.status;
        if (filters?.variety)
            where.variety = filters.variety;
        const [total, batches] = await Promise.all([
            prisma.batch.count({ where }),
            prisma.batch.findMany({
                where,
                skip: (page - 1) * limit,
                take: limit,
                orderBy: { harvestDate: 'desc' },
            }),
        ]);
        return {
            batches: batches,
            total,
        };
    }
    async findByBatchNumber(batchNumber) {
        const batch = await prisma.batch.findFirst({
            where: {
                id: { contains: batchNumber }, // Searching by ID as batchNumber doesn't exist in schema
            },
        });
        return batch;
    }
    async countByProducerAndStatus(producerId, statuses) {
        const count = await prisma.batch.count({
            where: {
                producerId,
                status: { in: statuses },
            },
        });
        return count;
    }
    async updateStatus(id, status) {
        const updatedBatch = await prisma.batch.update({
            where: { id },
            data: { status: status },
        });
        return updatedBatch;
    }
}
