import * as Prisma from '@prisma/client';

export interface Batch {
  id: string;
  batchNumber: string;
  producerId: string;
  cropType: string;
  variety: Prisma.Variety;
  status: Prisma.BatchStatus;
  quantity: number;
  harvestDate: Date;
  parcelName: string;
  latitude: number;
  longitude: number;
  qrCode: string | null;
  nftTokenId: string | null;
  blockchainHash: string; // Changed from blockchainTxHash
  origin: string; // Added missing property
  createdAt: Date;
  updatedAt: Date;
}