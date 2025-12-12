export class PrismaProducerRepository {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async findById(id) {
        const producer = await this.prisma.producer.findUnique({
            where: { id },
            include: { user: true },
        });
        if (!producer)
            return null;
        return this.toDomain(producer);
    }
    async find(criteria) {
        // FIX: Defensively parse pagination params to integers
        const page = criteria.page ? parseInt(criteria.page.toString(), 10) : 1;
        const limit = criteria.limit ? parseInt(criteria.limit.toString(), 10) : 10;
        const { isWhitelisted, state } = criteria;
        const where = {};
        if (isWhitelisted !== undefined) {
            where.isWhitelisted = isWhitelisted === true || isWhitelisted === 'true';
        }
        if (state) {
            where.state = {
                equals: state,
                mode: 'insensitive',
            };
        }
        try {
            const [total, producersData] = await Promise.all([
                this.prisma.producer.count({ where }),
                this.prisma.producer.findMany({
                    where,
                    skip: (page - 1) * limit,
                    take: limit,
                    orderBy: {
                        createdAt: 'desc',
                    },
                    include: {
                        user: true,
                    },
                }),
            ]);
            return {
                producers: producersData.map(this.toDomain),
                total,
            };
        }
        catch (error) {
            throw error;
        }
    }
    async save(producer) {
        const savedProducer = await this.prisma.producer.create({
            data: {
                id: producer.id,
                businessName: producer.businessName,
                rfc: producer.rfc,
                state: producer.state,
                municipality: producer.municipality,
                isWhitelisted: producer.isWhitelisted,
                userId: producer.userId,
                latitude: producer.latitude,
                longitude: producer.longitude,
            },
            include: { user: true },
        });
        return this.toDomain(savedProducer);
    }
    async update(id, data) {
        const updateData = {};
        if (data.businessName)
            updateData.businessName = data.businessName;
        if (data.rfc)
            updateData.rfc = data.rfc;
        if (data.state)
            updateData.state = data.state;
        if (data.municipality)
            updateData.municipality = data.municipality;
        if (data.latitude !== undefined)
            updateData.latitude = data.latitude;
        if (data.longitude !== undefined)
            updateData.longitude = data.longitude;
        const updatedProducer = await this.prisma.producer.update({
            where: { id },
            data: updateData,
            include: { user: true },
        });
        return this.toDomain(updatedProducer);
    }
    async delete(id) {
        await this.prisma.producer.delete({
            where: { id },
        });
    }
    async updateWhitelist(id, isWhitelisted, whitelistedBy) {
        const updatedProducer = await this.prisma.producer.update({
            where: { id },
            data: {
                isWhitelisted,
                whitelistedAt: isWhitelisted ? new Date() : null,
                whitelistedBy: isWhitelisted ? whitelistedBy : null,
            },
            include: { user: true },
        });
        return this.toDomain(updatedProducer);
    }
    async findByUserId(userId) {
        const producer = await this.prisma.producer.findUnique({
            where: { userId },
            include: { user: true },
        });
        if (!producer)
            return null;
        return this.toDomain(producer);
    }
    async searchProducers(searchQuery, filters) {
        const page = filters.page ? parseInt(filters.page.toString(), 10) : 1;
        const limit = filters.limit ? parseInt(filters.limit.toString(), 10) : 10;
        const where = {
            AND: [
                // Search in businessName, state, or municipality
                {
                    OR: [
                        { businessName: { contains: searchQuery, mode: 'insensitive' } },
                        { state: { contains: searchQuery, mode: 'insensitive' } },
                        { municipality: { contains: searchQuery, mode: 'insensitive' } },
                    ],
                },
                // Apply additional filters
                ...(filters.isWhitelisted !== undefined ? [{ isWhitelisted: filters.isWhitelisted }] : []),
                ...(filters.state ? [{ state: { equals: filters.state, mode: 'insensitive' } }] : []),
            ],
        };
        const [total, producersData] = await Promise.all([
            this.prisma.producer.count({ where }),
            this.prisma.producer.findMany({
                where,
                skip: (page - 1) * limit,
                take: limit,
                orderBy: { createdAt: 'desc' },
                include: { user: true },
            }),
        ]);
        return {
            producers: producersData.map(this.toDomain),
            total,
        };
    }
    async getStatsByProducerId(producerId) {
        const [producer, batchStats] = await Promise.all([
            this.prisma.producer.findUnique({
                where: { id: producerId },
                select: {
                    id: true,
                    businessName: true,
                    isWhitelisted: true,
                    createdAt: true,
                },
            }),
            this.prisma.batch.groupBy({
                by: ['status'],
                where: { producerId },
                _count: { id: true },
                _sum: { weightKg: true },
            }),
        ]);
        if (!producer)
            return null;
        const totalBatches = batchStats.reduce((sum, stat) => sum + stat._count.id, 0);
        const totalQuantityProduced = batchStats.reduce((sum, stat) => {
            const weight = stat._sum.weightKg;
            return sum + (weight ? parseFloat(weight.toString()) : 0);
        }, 0);
        const byStatus = {};
        batchStats.forEach(stat => {
            const weight = stat._sum.weightKg;
            byStatus[stat.status] = {
                count: stat._count.id,
                totalQuantity: weight ? parseFloat(weight.toString()) : 0,
            };
        });
        return {
            producer,
            statistics: {
                totalBatches,
                totalQuantityProduced,
                byStatus,
            },
        };
    }
    toDomain(prismaProducer) {
        const user = {
            id: prismaProducer.user.id,
            email: prismaProducer.user.email,
            passwordHash: prismaProducer.user.passwordHash,
            role: prismaProducer.user.role,
            isActive: prismaProducer.user.isActive,
            createdAt: prismaProducer.user.createdAt,
            updatedAt: prismaProducer.user.updatedAt,
            walletAddress: prismaProducer.user.walletAddress,
        };
        return {
            id: prismaProducer.id,
            userId: prismaProducer.userId,
            businessName: prismaProducer.businessName,
            rfc: prismaProducer.rfc,
            state: prismaProducer.state,
            municipality: prismaProducer.municipality,
            isWhitelisted: prismaProducer.isWhitelisted,
            whitelistedAt: prismaProducer.whitelistedAt,
            createdAt: prismaProducer.createdAt,
            updatedAt: prismaProducer.updatedAt,
            // FIX: Defensive mapping for potentially null decimal values
            latitude: prismaProducer.latitude ? prismaProducer.latitude.toNumber() : 0,
            longitude: prismaProducer.longitude ? prismaProducer.longitude.toNumber() : 0,
            user: user,
        };
    }
}
