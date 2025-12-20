import * as Prisma from '@prisma/client';
import { IRefreshTokenRepository } from '../../../../domain/repositories/IRefreshTokenRepository.js';

export class PrismaRefreshTokenRepository implements IRefreshTokenRepository {
  constructor(private prisma: Prisma.PrismaClient) {}

  async create(userId: string, token: string, expiresAt: Date): Promise<Prisma.RefreshToken> {
    return this.prisma.refreshToken.create({
      data: {
        userId,
        token,
        expiresAt,
      },
    });
  }

  async findByToken(token: string): Promise<Prisma.RefreshToken | null> {
    return this.prisma.refreshToken.findUnique({
      where: { token },
    });
  }

  async revoke(id: string): Promise<Prisma.RefreshToken> {
    return this.prisma.refreshToken.update({
      where: { id },
      data: { isRevoked: true },
    });
  }
}
