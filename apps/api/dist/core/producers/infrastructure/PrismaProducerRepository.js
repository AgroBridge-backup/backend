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
        const page = criteria.page ? parseInt(criteria.page.toString(), 10) : 1;
        const limit = criteria.limit ? parseInt(criteria.limit.toString(), 10) : 10;
        const { isWhitelisted, state } = criteria;
        const where = {};
        if (isWhitelisted !== undefined) {
            where.isWhitelisted = typeof isWhitelisted === 'string' ? isWhitelisted === 'true' : isWhitelisted;
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
            twoFactorEnabled: prismaProducer.user.twoFactorEnabled,
            twoFactorSecret: prismaProducer.user.twoFactorSecret,
            backupCodes: prismaProducer.user.backupCodes,
            twoFactorEnabledAt: prismaProducer.user.twoFactorEnabledAt,
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
            latitude: prismaProducer.latitude ? prismaProducer.latitude.toNumber() : 0,
            longitude: prismaProducer.longitude ? prismaProducer.longitude.toNumber() : 0,
            user: user,
        };
    }
}
