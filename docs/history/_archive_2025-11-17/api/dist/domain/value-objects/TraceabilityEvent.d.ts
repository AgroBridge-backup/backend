import { EventType } from '@prisma/client';
export interface TraceabilityEvent {
    id: string;
    batchId: string;
    eventType: EventType;
    timestamp: Date;
    latitude: number;
    longitude: number;
    locationName?: string | null;
    temperature?: number | null;
    humidity?: number | null;
    notes?: string | null;
    ipfsHash?: string | null;
    photos: string[];
    blockchainTxHash?: string | null;
    blockchainEventId?: string | null;
    isVerified: boolean;
    verifiedBy?: string | null;
    verifiedAt?: Date | null;
    signedByBiometric: boolean;
    signatureHash?: string | null;
    createdById: string;
    createdAt: Date;
    updatedAt: Date;
}
//# sourceMappingURL=TraceabilityEvent.d.ts.map