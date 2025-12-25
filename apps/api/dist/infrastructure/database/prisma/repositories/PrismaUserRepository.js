export class PrismaUserRepository {
    prisma;
    constructor(prismaClient) {
        this.prisma = prismaClient;
    }
    async findById(id) {
        const user = await this.prisma.user.findUnique({
            where: { id },
        });
        return user;
    }
    async findByEmail(email, include) {
        const user = await this.prisma.user.findUnique({
            where: { email },
            include: {
                producer: include?.producer,
            },
        });
        if (!user)
            return null;
        const domainUser = {
            id: user.id,
            email: user.email,
            passwordHash: user.passwordHash,
            role: user.role,
            isActive: user.isActive,
            createdAt: user.createdAt,
            updatedAt: user.updatedAt,
            walletAddress: user.walletAddress,
            twoFactorEnabled: user.twoFactorEnabled,
            twoFactorSecret: user.twoFactorSecret,
            backupCodes: user.backupCodes,
            twoFactorEnabledAt: user.twoFactorEnabledAt,
        };
        if (user.producer) {
            domainUser.producer = {
                id: user.producer.id,
                businessName: user.producer.businessName,
                rfc: user.producer.rfc,
            };
        }
        return domainUser;
    }
    async create(input) {
        const user = await this.prisma.user.create({
            data: {
                id: input.id,
                email: input.email,
                passwordHash: input.passwordHash,
                firstName: input.firstName,
                lastName: input.lastName,
                role: input.role,
                isActive: input.isActive,
                createdAt: input.createdAt,
                updatedAt: input.updatedAt,
            },
        });
        return {
            id: user.id,
            email: user.email,
            passwordHash: user.passwordHash,
            role: user.role,
            isActive: user.isActive,
            createdAt: user.createdAt,
            updatedAt: user.updatedAt,
            walletAddress: user.walletAddress,
            twoFactorEnabled: user.twoFactorEnabled,
            twoFactorSecret: user.twoFactorSecret,
            backupCodes: user.backupCodes,
            twoFactorEnabledAt: user.twoFactorEnabledAt,
        };
    }
}
