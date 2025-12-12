import { IBatchRepository } from '@/domain/repositories/IBatchRepository';
import { IEventRepository } from '@/domain/repositories/IEventRepository';
import { BlockchainService } from '@/domain/services/BlockchainService';
import { IIPFSService } from '@/domain/services/IIPFSService';
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
    photos?: Buffer[];
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
export declare class RegisterEventUseCase {
    private batchRepository;
    private eventRepository;
    private blockchainService;
    private ipfsService;
    constructor(batchRepository: IBatchRepository, eventRepository: IEventRepository, blockchainService: BlockchainService, ipfsService: IIPFSService);
    execute(dto: RegisterEventDTO): Promise<RegisterEventResult>;
}
export {};
//# sourceMappingURL=RegisterEventUseCase.d.ts.map