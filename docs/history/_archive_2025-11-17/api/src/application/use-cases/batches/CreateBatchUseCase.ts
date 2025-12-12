import { IBatchRepository } from '@/domain/repositories/IBatchRepository';
import { IProducerRepository } from '@/domain/repositories/IProducerRepository';
import { BlockchainService } from '@/domain/services/BlockchainService';
import { IIPFSService } from '@/domain/services/IIPFSService';
import { NotFoundError } from '@/shared/errors/NotFoundError';
import { AppError } from '@/shared/errors/AppError';
import { logger } from '@/shared/utils/logger';
import { BatchStatus } from '@prisma/client';
import QRCode from 'qrcode';

interface CreateBatchDTO {
  producerId: string;
  cropType: string;
  variety: string;
  quantity: number;
  harvestDate: Date;
  parcelName: string;
  latitude: number;
  longitude: number;
  userId: string;
}

interface CreateBatchResult {
  batchId: string;
  batchNumber: string;
  qrCode: string;
  nftTokenId?: string;
  blockchainTxHash?: string;
}

export class CreateBatchUseCase {
  constructor(
    private batchRepository: IBatchRepository,
    private producerRepository: IProducerRepository,
    private blockchainService: BlockchainService,
    private ipfsService: IIPFSService
  ) {}
  
  async execute(dto: CreateBatchDTO): Promise<CreateBatchResult> {
    // 1. Validate producer exists and is whitelisted
    const producer = await this.producerRepository.findById(dto.producerId);
    if (!producer) {
      throw new NotFoundError(`Producer ${dto.producerId} not found`);
    }
    
    if (!producer.isWhitelisted) {
      throw new AppError('Producer is not whitelisted', 403);
    }
    
    // 2. Generate batch number (format: CRP-YYYY-MUN-XXX)
    const year = new Date().getFullYear();
    const municipalityCode = producer.municipality.substring(0, 3).toUpperCase();
    const count = await this.batchRepository.countByProducer(dto.producerId);
    const batchNumber = `${dto.cropType.substring(0, 3).toUpperCase()}-${year}-${municipalityCode}-${String(count + 1).padStart(3, '0')}`;
    
    logger.info('Creating new batch', {
      batchNumber,
      producerId: dto.producerId,
      cropType: dto.cropType,
    });
    
    // 3. Create batch in database (immediately for fast response)
    const batch = await this.batchRepository.create({
      batchNumber,
      producerId: dto.producerId,
      cropType: dto.cropType,
      variety: dto.variety,
      quantity: dto.quantity,
      harvestDate: dto.harvestDate,
      parcelName: dto.parcelName,
      latitude: dto.latitude,
      longitude: dto.longitude,
      status: BatchStatus.REGISTERED,
    });
    
    // 4. Generate QR code
    const qrCodeData = JSON.stringify({
      batchNumber,
      producerId: dto.producerId,
      verifyUrl: `https://agrobridge.io/verify/${batchNumber}`,
    });
    
    const qrCodeBase64 = await QRCode.toDataURL(qrCodeData, {
      errorCorrectionLevel: 'H',
      width: 512,
    });
    
    await this.batchRepository.update(batch.id, {
      qrCode: qrCodeBase64,
    });
    
    // 5. Mint NFT on blockchain (async, non-blocking)
    // In production, use a queue (Bull) for this
    this.mintNFTAsync(batch.id, batchNumber, producer.user.walletAddress!, {
      batchNumber,
      cropType: dto.cropType,
      variety: dto.variety,
      quantity: dto.quantity,
      harvestDate: dto.harvestDate.toISOString(),
      producer: {
        businessName: producer.businessName,
        municipality: producer.municipality,
      },
    }).catch(error => {
      logger.error('Failed to mint NFT (async)', {
        error: error.message,
        batchId: batch.id,
      });
    });
    
    logger.info('Batch created successfully', {
      batchId: batch.id,
      batchNumber,
    });
    
    return {
      batchId: batch.id,
      batchNumber,
      qrCode: qrCodeBase64,
    };
  }
  
  private async mintNFTAsync(
    batchId: string,
    batchNumber: string,
    producerAddress: string,
    metadata: any
  ): Promise<void> {
    try {
      // Upload metadata to IPFS
      const metadataHash = await this.ipfsService.uploadJSON(metadata, `batch-${batchNumber}-metadata.json`);
      
      // Mint NFT on blockchain
      const result = await this.blockchainService.mintBatchNFT({
        producerAddress,
        batchNumber,
        ipfsMetadataHash: metadataHash,
      });
      
      // Update batch with NFT info
      await this.batchRepository.update(batchId, {
        nftTokenId: result.tokenId,
        blockchainTxHash: result.txHash,
      });
      
      logger.info('NFT minted successfully', {
        batchId,
        tokenId: result.tokenId,
        txHash: result.txHash,
      });
    } catch (error: any) {
      logger.error('Failed to mint NFT', {
        error: error.message,
        batchId,
      });
      throw error;
    }
  }
}
