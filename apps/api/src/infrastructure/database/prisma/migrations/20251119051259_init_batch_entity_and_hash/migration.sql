-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'PRODUCER', 'CERTIFIER', 'BUYER');

-- CreateEnum
CREATE TYPE "BatchStatus" AS ENUM ('REGISTERED', 'IN_TRANSIT', 'ARRIVED', 'DELIVERED', 'REJECTED');

-- CreateEnum
CREATE TYPE "EventType" AS ENUM ('HARVEST', 'PROCESSING', 'QUALITY_INSPECTION', 'PACKAGING', 'TRANSPORT_START', 'TRANSPORT_ARRIVAL', 'CUSTOMS_CLEARANCE', 'DELIVERY');

-- CreateEnum
CREATE TYPE "CertificationType" AS ENUM ('GLOBALGAP', 'ORGANIC_USDA', 'ORGANIC_EU', 'RAINFOREST_ALLIANCE', 'FAIR_TRADE', 'SENASICA');

-- CreateEnum
CREATE TYPE "Variety" AS ENUM ('HASS', 'BERRIES');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "role" "UserRole" NOT NULL,
    "walletAddress" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "producers" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "businessName" TEXT NOT NULL,
    "rfc" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "municipality" TEXT NOT NULL,
    "address" TEXT,
    "latitude" DECIMAL(10,6) NOT NULL,
    "longitude" DECIMAL(10,6) NOT NULL,
    "totalHectares" DECIMAL(10,2),
    "cropTypes" TEXT[],
    "isWhitelisted" BOOLEAN NOT NULL DEFAULT false,
    "whitelistedAt" TIMESTAMP(3),
    "whitelistedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "producers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "certifications" (
    "id" TEXT NOT NULL,
    "producerId" TEXT NOT NULL,
    "type" "CertificationType" NOT NULL,
    "certifier" TEXT NOT NULL,
    "certificateNumber" TEXT NOT NULL,
    "ipfsHash" TEXT,
    "issuedAt" TIMESTAMP(3) NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "certifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "batches" (
    "id" TEXT NOT NULL,
    "producerId" TEXT NOT NULL,
    "variety" "Variety" NOT NULL,
    "origin" TEXT NOT NULL,
    "weightKg" DECIMAL(10,2) NOT NULL,
    "harvestDate" TIMESTAMP(3) NOT NULL,
    "blockchainHash" TEXT NOT NULL,
    "status" "BatchStatus" NOT NULL DEFAULT 'REGISTERED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "batches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "traceability_events" (
    "id" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "eventType" "EventType" NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "latitude" DECIMAL(10,6) NOT NULL,
    "longitude" DECIMAL(10,6) NOT NULL,
    "locationName" TEXT,
    "temperature" DECIMAL(5,2),
    "humidity" DECIMAL(5,2),
    "notes" TEXT,
    "ipfsHash" TEXT,
    "photos" TEXT[],
    "blockchainTxHash" TEXT,
    "blockchainEventId" TEXT,
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "verifiedBy" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "signedByBiometric" BOOLEAN NOT NULL DEFAULT false,
    "signatureHash" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "traceability_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refresh_tokens" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "isRevoked" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_walletAddress_key" ON "users"("walletAddress");

-- CreateIndex
CREATE INDEX "users_email_idx" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_walletAddress_idx" ON "users"("walletAddress");

-- CreateIndex
CREATE UNIQUE INDEX "producers_userId_key" ON "producers"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "producers_rfc_key" ON "producers"("rfc");

-- CreateIndex
CREATE INDEX "producers_rfc_idx" ON "producers"("rfc");

-- CreateIndex
CREATE INDEX "producers_isWhitelisted_idx" ON "producers"("isWhitelisted");

-- CreateIndex
CREATE INDEX "producers_state_municipality_idx" ON "producers"("state", "municipality");

-- CreateIndex
CREATE UNIQUE INDEX "certifications_certificateNumber_key" ON "certifications"("certificateNumber");

-- CreateIndex
CREATE INDEX "certifications_certificateNumber_idx" ON "certifications"("certificateNumber");

-- CreateIndex
CREATE INDEX "certifications_expiresAt_idx" ON "certifications"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "certifications_producerId_type_key" ON "certifications"("producerId", "type");

-- CreateIndex
CREATE INDEX "batches_producerId_idx" ON "batches"("producerId");

-- CreateIndex
CREATE INDEX "batches_status_idx" ON "batches"("status");

-- CreateIndex
CREATE INDEX "batches_harvestDate_idx" ON "batches"("harvestDate");

-- CreateIndex
CREATE UNIQUE INDEX "traceability_events_blockchainTxHash_key" ON "traceability_events"("blockchainTxHash");

-- CreateIndex
CREATE UNIQUE INDEX "traceability_events_blockchainEventId_key" ON "traceability_events"("blockchainEventId");

-- CreateIndex
CREATE INDEX "traceability_events_batchId_idx" ON "traceability_events"("batchId");

-- CreateIndex
CREATE INDEX "traceability_events_eventType_idx" ON "traceability_events"("eventType");

-- CreateIndex
CREATE INDEX "traceability_events_timestamp_idx" ON "traceability_events"("timestamp");

-- CreateIndex
CREATE INDEX "traceability_events_blockchainTxHash_idx" ON "traceability_events"("blockchainTxHash");

-- CreateIndex
CREATE UNIQUE INDEX "refresh_tokens_token_key" ON "refresh_tokens"("token");

-- CreateIndex
CREATE INDEX "refresh_tokens_userId_idx" ON "refresh_tokens"("userId");

-- CreateIndex
CREATE INDEX "refresh_tokens_token_idx" ON "refresh_tokens"("token");

-- AddForeignKey
ALTER TABLE "producers" ADD CONSTRAINT "producers_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "certifications" ADD CONSTRAINT "certifications_producerId_fkey" FOREIGN KEY ("producerId") REFERENCES "producers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "batches" ADD CONSTRAINT "batches_producerId_fkey" FOREIGN KEY ("producerId") REFERENCES "producers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "traceability_events" ADD CONSTRAINT "traceability_events_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "batches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "traceability_events" ADD CONSTRAINT "traceability_events_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
