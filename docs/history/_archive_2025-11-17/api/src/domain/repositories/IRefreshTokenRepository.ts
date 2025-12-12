import { RefreshToken } from '@prisma/client';

export interface IRefreshTokenRepository {
  create(userId: string, token: string, expiresAt: Date): Promise<RefreshToken>;
  findByToken(token: string): Promise<RefreshToken | null>;
  revoke(tokenId: string): Promise<RefreshToken>;
}
