import { PrismaClient } from '@prisma/client';
let prismaInstance = null;
export function getPrismaClient() {
    if (!prismaInstance) {
        prismaInstance = new PrismaClient({
            log: process.env.NODE_ENV === 'development'
                ? ['query', 'error', 'warn']
                : ['error'],
        });
    }
    return prismaInstance;
}
export async function disconnectPrisma() {
    if (prismaInstance) {
        await prismaInstance.$disconnect();
        prismaInstance = null;
    }
}
export const prisma = getPrismaClient();
