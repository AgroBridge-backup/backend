import { NotFoundError } from '../../../shared/errors/NotFoundError.js';
import { AppError } from '../../../shared/errors/AppError.js';
import * as Prisma from '@prisma/client';
export class UpdateBatchStatusUseCase {
    batchRepository;
    eventRepository;
    constructor(batchRepository, eventRepository) {
        this.batchRepository = batchRepository;
        this.eventRepository = eventRepository;
    }
    async execute(dto) {
        // Check batch exists
        const batch = await this.batchRepository.findById(dto.batchId);
        if (!batch) {
            throw new NotFoundError(`Batch with ID ${dto.batchId} not found.`);
        }
        // Validate status transition
        const validTransitions = {
            REGISTERED: ['IN_TRANSIT', 'REJECTED'],
            IN_TRANSIT: ['ARRIVED', 'REJECTED'],
            ARRIVED: ['DELIVERED', 'REJECTED'],
            DELIVERED: [],
            REJECTED: [],
        };
        const allowedStatuses = validTransitions[batch.status] || [];
        if (!allowedStatuses.includes(dto.newStatus)) {
            throw new AppError(`Invalid status transition from ${batch.status} to ${dto.newStatus}. Allowed: ${allowedStatuses.join(', ')}`, 400);
        }
        // Update batch status
        const updatedBatch = await this.batchRepository.updateStatus(dto.batchId, dto.newStatus);
        // Create automatic event recording the status change
        const eventTypeMap = {
            IN_TRANSIT: Prisma.EventType.TRANSPORT_START,
            ARRIVED: Prisma.EventType.TRANSPORT_ARRIVAL,
            DELIVERED: Prisma.EventType.DELIVERY,
            REJECTED: Prisma.EventType.QUALITY_INSPECTION,
        };
        const eventType = eventTypeMap[dto.newStatus] || Prisma.EventType.PROCESSING;
        await this.eventRepository.create({
            batchId: dto.batchId,
            eventType,
            timestamp: new Date(),
            latitude: updatedBatch.latitude,
            longitude: updatedBatch.longitude,
            locationName: updatedBatch.origin,
            notes: dto.reason || `Status changed to ${dto.newStatus}`,
            createdById: dto.userId,
            temperature: null,
            humidity: null,
            ipfsHash: null,
            photos: [],
            blockchainTxHash: null,
            blockchainEventId: null,
            signedByBiometric: false,
            signatureHash: null,
        });
        return updatedBatch;
    }
}
