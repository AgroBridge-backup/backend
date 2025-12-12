export class PrismaBatchRepository {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async findById(id) {
        const batch = await this.prisma.batch.findUnique({
            where: { id },
        });
        if (!batch)
            return null;
        return {
            ...batch,
            weightKg: batch.weightKg.toNumber(),
            // Map other decimal fields if any
        };
    }
    async create(data) {
        // Explicitly map domain types to Prisma input types
        const prismaData = {
            batchNumber: data.batchNumber,
            producer: { connect: { id: data.producerId } },
            cropType: data.cropType,
            variety: data.variety,
            status: data.status || 'PLANTED',
            quantity: data.quantity,
            harvestDate: data.harvestDate,
            parcelName: data.parcelName,
            latitude: data.latitude,
            longitude: data.longitude,
            origin: data.origin,
            weightKg: data.quantity, // Using quantity as weight for simplicity in this migration
            blockchainHash: data.blockchainHash || '',
            qrCode: data.qrCode,
            nftTokenId: data.nftTokenId,
        };
        const newBatch = await this.prisma.batch.create({
            data: prismaData,
        });
        return {
            ...newBatch,
            weightKg: newBatch.weightKg.toNumber()
        };
    }
    async update(id, data) {
        const updatedBatch = await this.prisma.batch.update({
            where: { id },
            data: data,
        });
        return {
            ...updatedBatch,
            weightKg: updatedBatch.weightKg.toNumber()
        };
    }
    async countByProducer(producerId) {
        const count = await this.prisma.batch.count({
            where: { producerId },
        });
        return count;
    }
}
