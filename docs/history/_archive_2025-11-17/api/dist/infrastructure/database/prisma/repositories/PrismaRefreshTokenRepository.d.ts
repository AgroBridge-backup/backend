import { PrismaClient, RefreshToken } from '@prisma/client';
import { IRefreshTokenRepository } from '@/domain/repositories/IRefreshTokenRepository';
export declare class PrismaRefreshTokenRepository implements IRefreshTokenRepository {
    private readonly prisma;
    constructor(prisma: PrismaClient);
    create(userId: string, token: string, expiresAt: Date): Promise<RefreshToken>;
    findByToken(token: string): Promise<RefreshToken | null>;
    revoke(tokenId: string): Promise<RefreshToken>;
}
//# sourceMappingURL=PrismaRefreshTokenRepository.d.ts.map