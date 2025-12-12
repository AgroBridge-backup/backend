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
    async revoke(tokenId) {
        return this.prisma.refreshToken.update({
            where: { id: tokenId },
            data: { isRevoked: true },
        });
    }
}
//# sourceMappingURL=PrismaRefreshTokenRepository.js.map