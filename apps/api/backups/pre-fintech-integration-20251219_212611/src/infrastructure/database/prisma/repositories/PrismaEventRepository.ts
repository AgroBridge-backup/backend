import * as Prisma from '@prisma/client';
import { IEventRepository } from '../../../../domain/repositories/IEventRepository.js';
import { TraceabilityEvent } from '../../../../domain/value-objects/TraceabilityEvent.js';

export class PrismaEventRepository implements IEventRepository {
  constructor(private readonly prisma: Prisma.PrismaClient) {}

  async create(data: Partial<TraceabilityEvent>): Promise<TraceabilityEvent> {
    const savedEvent = await this.prisma.traceabilityEvent.create({
      data: data as any,
    });
    return this.toDomain(savedEvent);
  }

  async findById(id: string): Promise<TraceabilityEvent | null> {
    const event = await this.prisma.traceabilityEvent.findUnique({
      where: { id },
    });
    if (!event) return null;
    return this.toDomain(event);
  }

  async findByBatchId(batchId: string): Promise<TraceabilityEvent[]> {
    const events = await this.prisma.traceabilityEvent.findMany({
      where: { batchId },
      orderBy: { timestamp: 'asc' },
    });
    return events.map(this.toDomain);
  }

  async save(event: TraceabilityEvent): Promise<TraceabilityEvent> {
    const savedEvent = await this.prisma.traceabilityEvent.upsert({
      where: { id: event.id || 'new-event' }, // Use a dummy ID for new events
      update: {
        batchId: event.batchId,
        eventType: event.eventType,
        timestamp: event.timestamp,
        latitude: event.latitude,
        longitude: event.longitude,
        locationName: event.locationName,
        temperature: event.temperature,
        humidity: event.humidity,
        notes: event.notes,
        ipfsHash: event.ipfsHash,
        photos: event.photos,
        blockchainTxHash: event.blockchainTxHash,
        blockchainEventId: event.blockchainEventId,
        signedByBiometric: event.signedByBiometric,
        signatureHash: event.signatureHash,
        createdById: event.createdById,
      },
      create: {
        batchId: event.batchId,
        eventType: event.eventType,
        timestamp: event.timestamp,
        latitude: event.latitude,
        longitude: event.longitude,
        locationName: event.locationName,
        temperature: event.temperature,
        humidity: event.humidity,
        notes: event.notes,
        ipfsHash: event.ipfsHash,
        photos: event.photos,
        blockchainTxHash: event.blockchainTxHash,
        blockchainEventId: event.blockchainEventId,
        signedByBiometric: event.signedByBiometric,
        signatureHash: event.signatureHash,
        createdById: event.createdById,
      },
    });
    return this.toDomain(savedEvent);
  }

  private toDomain(prismaEvent: any): TraceabilityEvent {
    return {
      id: prismaEvent.id,
      batchId: prismaEvent.batchId,
      eventType: prismaEvent.eventType,
      timestamp: prismaEvent.timestamp,
      latitude: prismaEvent.latitude,
      longitude: prismaEvent.longitude,
      locationName: prismaEvent.locationName,
      temperature: prismaEvent.temperature,
      humidity: prismaEvent.humidity,
      notes: prismaEvent.notes,
      ipfsHash: prismaEvent.ipfsHash,
      photos: prismaEvent.photos,
      blockchainTxHash: prismaEvent.blockchainTxHash,
      blockchainEventId: prismaEvent.blockchainEventId,
      signedByBiometric: prismaEvent.signedByBiometric,
      signatureHash: prismaEvent.signatureHash,
      createdById: prismaEvent.createdById,
      createdAt: prismaEvent.createdAt,
      updatedAt: prismaEvent.updatedAt,
    };
  }
}