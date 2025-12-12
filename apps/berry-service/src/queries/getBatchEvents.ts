import { PrismaClient } from '@prisma/client';

// En una app real, PrismaClient sería un singleton inyectado.
const prisma = new PrismaClient();

export async function getBatchEvents(batchId: string) {
  // Se utiliza el nombre de modelo correcto 'berryBatchEvent' de Prisma.
  return prisma.berryBatchEvent.findMany({
    where: { batchId },
    orderBy: {
      sequenceNumber: 'asc',
    },
  });
}
