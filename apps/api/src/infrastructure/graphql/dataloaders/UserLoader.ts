/**
 * @file User DataLoader
 * @description DataLoader for batching and caching user queries
 *
 * @author AgroBridge Engineering Team
 */

import DataLoader from 'dataloader';
import { PrismaClient, User } from '@prisma/client';

/**
 * User type without passwordHash
 */
export type SafeUser = Omit<User, 'passwordHash' | 'twoFactorSecret' | 'backupCodes'>;

/**
 * Create user loader (excludes sensitive fields)
 */
export function createUserLoader(
  prisma: PrismaClient
): DataLoader<string, SafeUser | null> {
  return new DataLoader<string, SafeUser | null>(
    async (ids: readonly string[]) => {
      const users = await prisma.user.findMany({
        where: {
          id: {
            in: ids as string[],
          },
        },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          role: true,
          isActive: true,
          walletAddress: true,
          lastLoginAt: true,
          twoFactorEnabled: true,
          twoFactorEnabledAt: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      const userMap = new Map<string, SafeUser>();
      users.forEach((user) => {
        userMap.set(user.id, user as SafeUser);
      });

      return ids.map((id) => userMap.get(id) || null);
    },
    { cache: true, maxBatchSize: 100 }
  );
}

/**
 * Create user loader by email
 */
export function createUserByEmailLoader(
  prisma: PrismaClient
): DataLoader<string, SafeUser | null> {
  return new DataLoader<string, SafeUser | null>(
    async (emails: readonly string[]) => {
      const users = await prisma.user.findMany({
        where: {
          email: {
            in: emails as string[],
          },
        },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          role: true,
          isActive: true,
          walletAddress: true,
          lastLoginAt: true,
          twoFactorEnabled: true,
          twoFactorEnabledAt: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      const userMap = new Map<string, SafeUser>();
      users.forEach((user) => {
        userMap.set(user.email, user as SafeUser);
      });

      return emails.map((email) => userMap.get(email) || null);
    },
    { cache: true, maxBatchSize: 100 }
  );
}

export type UserLoaderType = ReturnType<typeof createUserLoader>;
