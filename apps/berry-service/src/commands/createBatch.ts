import { PrismaClient } from '@prisma/client';
import { BerryEvent } from '../models/BerryEvent';
import { v4 as uuidv4 } from 'uuid';

// En una app real, PrismaClient sería un singleton inyectado.
const prisma = new PrismaClient();

export async function createBatch(batchData: any): Promise<any> {
  const event = {
    id: uuidv4(),
    batchId: batchData.batchId,
    eventType: 'BATCH_CREATED',
    eventData: batchData,
    sequenceNumber: 1,
  };

  // Se utiliza el nombre de modelo correcto 'berryBatchEvent' de Prisma.
  const createdEvent = await prisma.berryBatchEvent.create({
    data: {
      id: event.id,
      batchId: event.batchId,
      eventType: event.eventType,
      eventData: event.eventData,
      sequenceNumber: event.sequenceNumber,
    },
  });

  return createdEvent;
}
