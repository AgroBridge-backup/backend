import { PrismaClient } from '@prisma/client';

/**
 * Singleton PrismaClient instance
 * Prevents connection pool exhaustion and ensures transaction consistency
 */
let prismaInstance: PrismaClient | null = null;

export function getPrismaClient(): PrismaClient {
  if (!prismaInstance) {
    prismaInstance = new PrismaClient({
      log: process.env.NODE_ENV === 'development'
        ? ['query', 'error', 'warn']
        : ['error'],
    });
  }
  return prismaInstance;
}

/**
 * Graceful shutdown - disconnect Prisma
 */
export async function disconnectPrisma(): Promise<void> {
  if (prismaInstance) {
    await prismaInstance.$disconnect();
    prismaInstance = null;
  }
}

// Export singleton instance for backwards compatibility
export const prisma = getPrismaClient();
