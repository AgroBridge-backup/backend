import * as Prisma from '@prisma/client';

export interface IRefreshTokenRepository {
  create(userId: string, token: string, expiresAt: Date): Promise<Prisma.RefreshToken>;
  findByToken(token: string): Promise<Prisma.RefreshToken | null>;
  revoke(tokenId: string): Promise<Prisma.RefreshToken>;
}
