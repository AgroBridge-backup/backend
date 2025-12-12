import { IBatchRepository } from '@/domain/repositories/IBatchRepository';
import { IProducerRepository } from '@/domain/repositories/IProducerRepository';
import { BlockchainService } from '@/domain/services/BlockchainService';
import { IIPFSService } from '@/domain/services/IIPFSService';
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
export declare class CreateBatchUseCase {
    private batchRepository;
    private producerRepository;
    private blockchainService;
    private ipfsService;
    constructor(batchRepository: IBatchRepository, producerRepository: IProducerRepository, blockchainService: BlockchainService, ipfsService: IIPFSService);
    execute(dto: CreateBatchDTO): Promise<CreateBatchResult>;
    private mintNFTAsync;
}
export {};
//# sourceMappingURL=CreateBatchUseCase.d.ts.map