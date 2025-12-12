import { BatchStatus } from '@prisma/client';
export interface Batch {
    id: string;
    batchNumber: string;
    producerId: string;
    cropType: string;
    variety: string;
    quantity: number;
    harvestDate: Date;
    parcelName: string;
    latitude: number;
    longitude: number;
    status: BatchStatus;
    qrCode?: string | null;
    nftTokenId?: string | null;
    blockchainTxHash?: string | null;
    createdAt: Date;
    updatedAt: Date;
}
//# sourceMappingURL=Batch.d.ts.map