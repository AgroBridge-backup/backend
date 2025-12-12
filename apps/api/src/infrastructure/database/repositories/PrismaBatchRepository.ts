import { IBatchRepository } from '../../domain/repositories/IBatchRepository.js';
import { Batch } from '../../domain/entities/Batch.js';
import * as Prisma from '@prisma/client';

export class PrismaBatchRepository implements IBatchRepository {
  constructor(private prisma: Prisma.PrismaClient) {}
  
  async findById(id: string): Promise<Batch | null> {
    const batch = await this.prisma.batch.findUnique({
      where: { id },
    });
    if (!batch) return null;
    
    return {
        ...batch,
        weightKg: batch.weightKg.toNumber(),
        // Map other decimal fields if any
    } as unknown as Batch;
  }

  async create(data: Partial<Batch>): Promise<Batch> {
    // Explicitly map domain types to Prisma input types
    const prismaData: Prisma.Prisma.BatchCreateInput = {
      batchNumber: data.batchNumber!,
      producer: { connect: { id: data.producerId! } },
      cropType: data.cropType!,
      variety: data.variety!,
      status: data.status || 'PLANTED',
      quantity: data.quantity!,
      harvestDate: data.harvestDate!,
      parcelName: data.parcelName!,
      latitude: data.latitude!,
      longitude: data.longitude!,
      origin: data.origin!,
      weightKg: data.quantity!, // Using quantity as weight for simplicity in this migration
      blockchainHash: data.blockchainHash || '',
      qrCode: data.qrCode,
      nftTokenId: data.nftTokenId,
    };

    const newBatch = await this.prisma.batch.create({
      data: prismaData,
    });
    
    return {
        ...newBatch,
        weightKg: newBatch.weightKg.toNumber()
    } as unknown as Batch;
  }

  async update(id: string, data: Partial<Batch>): Promise<Batch> {
    const updatedBatch = await this.prisma.batch.update({
      where: { id },
      data: data as any,
    });
    return {
        ...updatedBatch,
        weightKg: updatedBatch.weightKg.toNumber()
    } as unknown as Batch;
  }

  async countByProducer(producerId: string): Promise<number> {
    const count = await this.prisma.batch.count({
      where: { producerId },
    });
    return count;
  }
}