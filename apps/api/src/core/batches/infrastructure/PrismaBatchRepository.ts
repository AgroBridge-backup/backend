import * as Prisma from '@prisma/client';
import { IBatchRepository } from '../../../domain/repositories/IBatchRepository.js';
import { Batch } from '../../../domain/entities/Batch.js';
import { prisma } from '../../../infrastructure/database/prisma/client.js';

export class PrismaBatchRepository implements IBatchRepository {
  
  async findById(id: string): Promise<Batch | null> {
    const batch = await prisma.batch.findUnique({
      where: { id },
    });
    return batch as Batch | null;
  }

  async create(data: Partial<Batch>): Promise<Batch> {
    const newBatch = await prisma.batch.create({
      data: data as any, // Using 'as any' to bridge domain and prisma types
    });
    return newBatch as Batch;
  }

  async update(id: string, data: Partial<Batch>): Promise<Batch> {
    const updatedBatch = await prisma.batch.update({
      where: { id },
      data: data as any, // Using 'as any' to bridge domain and prisma types
    });
    return updatedBatch as Batch;
  }

  async countByProducer(producerId: string): Promise<number> {
    const count = await prisma.batch.count({
      where: { producerId },
    });
    return count;
  }
}
