import { NotFoundError } from '@/shared/errors/NotFoundError';
import { logger } from '@/shared/utils/logger';
export class RegisterEventUseCase {
    batchRepository;
    eventRepository;
    blockchainService;
    ipfsService;
    constructor(batchRepository, eventRepository, blockchainService, ipfsService) {
        this.batchRepository = batchRepository;
        this.eventRepository = eventRepository;
        this.blockchainService = blockchainService;
        this.ipfsService = ipfsService;
    }
    async execute(dto) {
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
        let ipfsHashes = [];
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
            }
            catch (error) {
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
//# sourceMappingURL=RegisterEventUseCase.js.map