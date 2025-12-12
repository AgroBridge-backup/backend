import * as Prisma from '@prisma/client';

export interface TraceabilityEvent {
  id: string;
  batchId: string;
  eventType: Prisma.EventType;
  timestamp: Date;
  latitude: number;
  longitude: number;
  locationName: string | null;
  temperature: number | null;
  humidity: number | null;
  notes: string | null;
  ipfsHash: string | null;
  photos: string[]; // Array of IPFS hashes for photos
  blockchainTxHash: string | null;
  blockchainEventId: string | null;
  signedByBiometric: boolean;
  signatureHash: string | null;
  createdById: string;
  createdAt: Date;
  updatedAt: Date;
}