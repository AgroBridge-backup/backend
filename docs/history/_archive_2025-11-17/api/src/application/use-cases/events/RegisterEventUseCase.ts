import { IBatchRepository } from '@/domain/repositories/IBatchRepository';
import { IEventRepository } from '@/domain/repositories/IEventRepository';
import { BlockchainService } from '@/domain/services/BlockchainService';
import { IIPFSService } from '@/domain/services/IIPFSService';
import { NotFoundError } from '@/shared/errors/NotFoundError';
import { logger } from '@/shared/utils/logger';
import { EventType } from '@prisma/client';

interface RegisterEventDTO {
  batchId: string;
  eventType: EventType;
  latitude: number;
  longitude: number;
  locationName?: string;
  temperature?: number;
  humidity?: number;
  notes?: string;
  photos?: Buffer[]; // Binary data
  signedByBiometric?: boolean;
  signatureHash?: string;
  userId: string;
}

interface RegisterEventResult {
  eventId: string;
  blockchainTxHash: string;
  ipfsHash?: string;
  createdAt: Date;
}

export class RegisterEventUseCase {
  constructor(
    private batchRepository: IBatchRepository,
    private eventRepository: IEventRepository,
    private blockchainService: BlockchainService,
    private ipfsService: IIPFSService
  ) {}
  
  async execute(dto: RegisterEventDTO): Promise<RegisterEventResult> {
    // 1. Validate batch exists
    const batch = await this.batchRepository.findById(dto.batchId);
    if (!batch) {
      throw new NotFoundError(`Batch ${dto.batchId} not found`);
    }
    
    logger.info('Registering new event', {
      batchId: dto.batchId,
      eventType: dto.eventType,
      userId: dto.userId,
    });
    
    // 2. Upload photos to IPFS (if provided)
    let ipfsHashes: string[] = [];
    if (dto.photos && dto.photos.length > 0) {
      try {
        const filesToUpload = dto.photos.map((photo, index) => ({
          buffer: photo,
          filename: `event-${dto.batchId}-${Date.now()}-${index}.jpg`,
        }));
        ipfsHashes = await this.ipfsService.uploadFiles(filesToUpload);
        logger.info('Photos uploaded to IPFS', {
          hashes: ipfsHashes,
          photoCount: dto.photos.length,
        });
      } catch (error: any) {
        logger.error('Failed to upload photos to IPFS', {
          error: error.message,
        });
        // Continue without photos (non-blocking)
      }
    }
    
    // For simplicity, we'll just use the first hash in the blockchain event
    const primaryIpfsHash = ipfsHashes.length > 0 ? ipfsHashes[0] : 'QmDefault';

    // 3. Register event on blockchain
    const blockchainResult = await this.blockchainService.registerEventOnChain({
      eventType: dto.eventType,
      batchId: batch.batchNumber,
      latitude: dto.latitude,
      longitude: dto.longitude,
      ipfsHash: primaryIpfsHash,
    });
    
    // 4. Save event to database
    const event = await this.eventRepository.create({
      batchId: dto.batchId,
      eventType: dto.eventType,
      timestamp: new Date(),
      latitude: dto.latitude,
      longitude: dto.longitude,
      locationName: dto.locationName,
      temperature: dto.temperature,
      humidity: dto.humidity,
      notes: dto.notes,
      ipfsHash: primaryIpfsHash,
      photos: ipfsHashes,
      blockchainTxHash: blockchainResult.txHash,
      blockchainEventId: blockchainResult.eventId,
      signedByBiometric: dto.signedByBiometric || false,
      signatureHash: dto.signatureHash,
      createdById: dto.userId,
    });
    
    logger.info('Event registered successfully', {
      eventId: event.id,
      batchId: dto.batchId,
      blockchainTxHash: blockchainResult.txHash,
    });
    
    return {
      eventId: event.id,
      blockchainTxHash: blockchainResult.txHash,
      ipfsHash: primaryIpfsHash,
      createdAt: event.createdAt,
    };
  }
}
