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
            data: data,
        });
        return newBatch;
    }
    async update(id, data) {
        const updatedBatch = await prisma.batch.update({
            where: { id },
            data: data,
        });
        return updatedBatch;
    }
    async countByProducer(producerId) {
        const count = await prisma.batch.count({
            where: { producerId },
        });
        return count;
    }
}
