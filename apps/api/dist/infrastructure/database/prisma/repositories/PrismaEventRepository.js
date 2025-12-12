export class PrismaEventRepository {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async create(data) {
        const savedEvent = await this.prisma.event.create({
            data: data,
        });
        return this.toDomain(savedEvent);
    }
    async findById(id) {
        const event = await this.prisma.event.findUnique({
            where: { id },
        });
        if (!event)
            return null;
        return this.toDomain(event);
    }
    async findByBatchId(batchId) {
        const events = await this.prisma.event.findMany({
            where: { batchId },
            orderBy: { timestamp: 'asc' },
        });
        return events.map(this.toDomain);
    }
    async save(event) {
        const savedEvent = await this.prisma.event.upsert({
            where: { id: event.id || 'new-event' }, // Use a dummy ID for new events
            update: {
                batchId: event.batchId,
                eventType: event.eventType,
                timestamp: event.timestamp,
                latitude: event.latitude,
                longitude: event.longitude,
                locationName: event.locationName,
                temperature: event.temperature,
                humidity: event.humidity,
                notes: event.notes,
                ipfsHash: event.ipfsHash,
                photos: event.photos,
                blockchainTxHash: event.blockchainTxHash,
                blockchainEventId: event.blockchainEventId,
                signedByBiometric: event.signedByBiometric,
                signatureHash: event.signatureHash,
                createdById: event.createdById,
            },
            create: {
                batchId: event.batchId,
                eventType: event.eventType,
                timestamp: event.timestamp,
                latitude: event.latitude,
                longitude: event.longitude,
                locationName: event.locationName,
                temperature: event.temperature,
                humidity: event.humidity,
                notes: event.notes,
                ipfsHash: event.ipfsHash,
                photos: event.photos,
                blockchainTxHash: event.blockchainTxHash,
                blockchainEventId: event.blockchainEventId,
                signedByBiometric: event.signedByBiometric,
                signatureHash: event.signatureHash,
                createdById: event.createdById,
            },
        });
        return this.toDomain(savedEvent);
    }
    async delete(id) {
        await this.prisma.event.delete({
            where: { id },
        });
    }
    async update(id, data) {
        const updateData = {};
        if (data.locationName !== undefined)
            updateData.locationName = data.locationName;
        if (data.latitude !== undefined)
            updateData.latitude = data.latitude;
        if (data.longitude !== undefined)
            updateData.longitude = data.longitude;
        if (data.temperature !== undefined)
            updateData.temperature = data.temperature;
        if (data.humidity !== undefined)
            updateData.humidity = data.humidity;
        if (data.notes !== undefined)
            updateData.notes = data.notes;
        const updatedEvent = await this.prisma.event.update({
            where: { id },
            data: updateData,
        });
        return this.toDomain(updatedEvent);
    }
    async findMany(filters, pagination) {
        const page = pagination?.page || 1;
        const limit = pagination?.limit || 20;
        const where = {};
        if (filters?.eventType)
            where.eventType = filters.eventType;
        if (filters?.batchId)
            where.batchId = filters.batchId;
        if (filters?.createdById)
            where.createdById = filters.createdById;
        const [total, events] = await Promise.all([
            this.prisma.event.count({ where }),
            this.prisma.event.findMany({
                where,
                skip: (page - 1) * limit,
                take: limit,
                orderBy: { timestamp: 'desc' },
            }),
        ]);
        return {
            events: events.map(this.toDomain),
            total,
        };
    }
    async findByBatchIdPaginated(batchId, pagination) {
        const page = pagination?.page || 1;
        const limit = pagination?.limit || 20;
        const [total, events] = await Promise.all([
            this.prisma.event.count({ where: { batchId } }),
            this.prisma.event.findMany({
                where: { batchId },
                skip: (page - 1) * limit,
                take: limit,
                orderBy: { timestamp: 'desc' },
            }),
        ]);
        return {
            events: events.map(this.toDomain),
            total,
        };
    }
    toDomain(prismaEvent) {
        return {
            id: prismaEvent.id,
            batchId: prismaEvent.batchId,
            eventType: prismaEvent.eventType,
            timestamp: prismaEvent.timestamp,
            latitude: prismaEvent.latitude,
            longitude: prismaEvent.longitude,
            locationName: prismaEvent.locationName,
            temperature: prismaEvent.temperature,
            humidity: prismaEvent.humidity,
            notes: prismaEvent.notes,
            ipfsHash: prismaEvent.ipfsHash,
            photos: prismaEvent.photos,
            blockchainTxHash: prismaEvent.blockchainTxHash,
            blockchainEventId: prismaEvent.blockchainEventId,
            signedByBiometric: prismaEvent.signedByBiometric,
            signatureHash: prismaEvent.signatureHash,
            createdById: prismaEvent.createdById,
            createdAt: prismaEvent.createdAt,
            updatedAt: prismaEvent.updatedAt,
        };
    }
}
