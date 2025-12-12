export class PrismaRefreshTokenRepository {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async create(userId, token, expiresAt) {
        return this.prisma.refreshToken.create({
            data: {
                userId,
                token,
                expiresAt,
            },
        });
    }
    async findByToken(token) {
        return this.prisma.refreshToken.findUnique({
            where: { token },
        });
    }
    async revoke(id) {
        return this.prisma.refreshToken.update({
            where: { id },
            data: { isRevoked: true },
        });
    }
}
