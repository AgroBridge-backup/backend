-- CreateEnum
CREATE TYPE "BerryEventType" AS ENUM ('BATCH_CREATED', 'HARVESTED', 'QUALITY_INSPECTED', 'PRECOOLED', 'PACKED', 'LABELED', 'COLD_STORAGE_ENTERED', 'CERTIFICATION_REQUESTED', 'CERTIFICATION_APPROVED', 'CERTIFICATION_REJECTED', 'SHIPMENT_PREPARED', 'LOADED_FOR_TRANSPORT', 'IN_TRANSIT', 'TEMPERATURE_ALERT', 'DELIVERED', 'RECEIVED_BY_IMPORTER', 'QUALITY_CLAIM_FILED', 'BATCH_RECALLED');

-- CreateEnum
CREATE TYPE "CertificationType" AS ENUM ('GLOBALGAP', 'PRIMUS_GFS', 'USDA_ORGANIC', 'EU_ORGANIC', 'MEXICO_ORGANIC', 'FAIR_TRADE', 'RAINFOREST_ALLIANCE', 'GRASP', 'SMETA', 'HACCP', 'FSMA', 'CUSTOM');

-- CreateEnum
CREATE TYPE "CertificationStatus" AS ENUM ('PENDING', 'IN_REVIEW', 'APPROVED', 'REJECTED', 'EXPIRED', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "InspectionType" AS ENUM ('HARVEST', 'POST_COOLING', 'PRE_SHIPMENT', 'ARRIVAL', 'RANDOM_AUDIT');

-- CreateEnum
CREATE TYPE "BerryType" AS ENUM ('STRAWBERRY', 'BLUEBERRY', 'RASPBERRY', 'BLACKBERRY');

-- CreateEnum
CREATE TYPE "PackagingType" AS ENUM ('CLAMSHELL_250G', 'CLAMSHELL_500G', 'BULK_PALLET', 'CARDBOARD_BOX', 'PLASTIC_TRAY');

-- CreateEnum
CREATE TYPE "BatchStatus" AS ENUM ('CREATED', 'IN_FIELD', 'HARVESTED', 'IN_COOLING', 'PACKED', 'CERTIFIED', 'IN_STORAGE', 'READY_TO_SHIP', 'IN_TRANSIT', 'DELIVERED', 'COMPLETED', 'RECALLED', 'REJECTED');

-- CreateEnum
CREATE TYPE "TenantType" AS ENUM ('PRODUCER', 'CERTIFIER', 'PACKER', 'SHIPPER', 'IMPORTER', 'RETAILER');

-- CreateEnum
CREATE TYPE "SubscriptionTier" AS ENUM ('FREE', 'PRO', 'ENTERPRISE');

-- CreateTable
CREATE TABLE "BerryBatch" (
    "id" TEXT NOT NULL,
    "batchNumber" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "berryType" "BerryType" NOT NULL,
    "variety" TEXT,
    "harvestDate" TIMESTAMP(3) NOT NULL,
    "harvestLocation" JSONB NOT NULL,
    "farmBlockId" TEXT,
    "estimatedYield" DOUBLE PRECISION,
    "brixIndex" DOUBLE PRECISION,
    "phLevel" DOUBLE PRECISION,
    "firmness" DOUBLE PRECISION,
    "colorGrade" TEXT,
    "freshnessPrediction" DOUBLE PRECISION,
    "shelfLifeDays" INTEGER,
    "defectRate" DOUBLE PRECISION,
    "precoolingTemp" DOUBLE PRECISION,
    "targetStorageTemp" DOUBLE PRECISION,
    "maxTempDeviation" DOUBLE PRECISION,
    "packagingType" "PackagingType" NOT NULL,
    "packagingDate" TIMESTAMP(3),
    "clamshellsCount" INTEGER,
    "palletsCount" INTEGER,
    "totalWeightKg" DOUBLE PRECISION NOT NULL,
    "blockchainTxHash" TEXT,
    "ipfsDocumentHash" TEXT,
    "currentStatus" "BatchStatus" NOT NULL DEFAULT 'CREATED',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BerryBatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BerryBatchEvent" (
    "id" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "eventType" "BerryEventType" NOT NULL,
    "eventData" JSONB NOT NULL,
    "metadata" JSONB NOT NULL,
    "blockchainTxHash" TEXT,
    "ipfsHash" TEXT,
    "sequenceNumber" INTEGER NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BerryBatchEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BerryBatchCertification" (
    "id" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "certificationType" "CertificationType" NOT NULL,
    "certifierOrgId" TEXT NOT NULL,
    "certifierName" TEXT NOT NULL,
    "certificationNumber" TEXT NOT NULL,
    "issuedDate" TIMESTAMP(3) NOT NULL,
    "expiryDate" TIMESTAMP(3),
    "status" "CertificationStatus" NOT NULL DEFAULT 'PENDING',
    "documentUrl" TEXT,
    "ipfsHash" TEXT,
    "blockchainTxHash" TEXT,
    "inspectionDate" TIMESTAMP(3),
    "inspectorName" TEXT,
    "inspectionNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BerryBatchCertification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QualityInspection" (
    "id" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "inspectionType" "InspectionType" NOT NULL,
    "inspectorId" TEXT NOT NULL,
    "inspectionDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sampleSize" INTEGER NOT NULL,
    "brixReading" DOUBLE PRECISION,
    "phReading" DOUBLE PRECISION,
    "firmnessReading" DOUBLE PRECISION,
    "defectCount" INTEGER NOT NULL DEFAULT 0,
    "defectTypes" JSONB,
    "defectPercentage" DOUBLE PRECISION,
    "aiDefectDetection" BOOLEAN NOT NULL DEFAULT false,
    "aiConfidenceScore" DOUBLE PRECISION,
    "aiImageUrls" TEXT[],
    "passed" BOOLEAN NOT NULL,
    "grade" TEXT,
    "notes" TEXT,
    "blockchainTxHash" TEXT,
    "ipfsHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QualityInspection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Tenant" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "TenantType" NOT NULL,
    "subscriptionTier" "SubscriptionTier" NOT NULL DEFAULT 'FREE',
    "contactEmail" TEXT NOT NULL,
    "contactPhone" TEXT,
    "address" JSONB,
    "settings" JSONB,
    "webhookUrl" TEXT,
    "apiKey" TEXT,
    "maxBatchesPerMonth" INTEGER NOT NULL DEFAULT 100,
    "maxUsers" INTEGER NOT NULL DEFAULT 5,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Tenant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Shipment" (
    "id" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,

    CONSTRAINT "Shipment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BerryBatch_batchNumber_key" ON "BerryBatch"("batchNumber");

-- CreateIndex
CREATE INDEX "BerryBatch_tenantId_idx" ON "BerryBatch"("tenantId");

-- CreateIndex
CREATE INDEX "BerryBatch_batchNumber_idx" ON "BerryBatch"("batchNumber");

-- CreateIndex
CREATE INDEX "BerryBatch_currentStatus_idx" ON "BerryBatch"("currentStatus");

-- CreateIndex
CREATE INDEX "BerryBatch_harvestDate_idx" ON "BerryBatch"("harvestDate");

-- CreateIndex
CREATE INDEX "BerryBatchEvent_batchId_idx" ON "BerryBatchEvent"("batchId");

-- CreateIndex
CREATE INDEX "BerryBatchEvent_eventType_idx" ON "BerryBatchEvent"("eventType");

-- CreateIndex
CREATE UNIQUE INDEX "BerryBatchEvent_batchId_sequenceNumber_key" ON "BerryBatchEvent"("batchId", "sequenceNumber");

-- CreateIndex
CREATE INDEX "BerryBatchCertification_batchId_idx" ON "BerryBatchCertification"("batchId");

-- CreateIndex
CREATE INDEX "BerryBatchCertification_certificationType_idx" ON "BerryBatchCertification"("certificationType");

-- CreateIndex
CREATE INDEX "BerryBatchCertification_status_idx" ON "BerryBatchCertification"("status");

-- CreateIndex
CREATE INDEX "QualityInspection_batchId_idx" ON "QualityInspection"("batchId");

-- CreateIndex
CREATE INDEX "QualityInspection_inspectionDate_idx" ON "QualityInspection"("inspectionDate");

-- CreateIndex
CREATE UNIQUE INDEX "Tenant_apiKey_key" ON "Tenant"("apiKey");

-- CreateIndex
CREATE INDEX "Shipment_batchId_idx" ON "Shipment"("batchId");

-- AddForeignKey
ALTER TABLE "BerryBatch" ADD CONSTRAINT "BerryBatch_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BerryBatchEvent" ADD CONSTRAINT "BerryBatchEvent_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "BerryBatch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BerryBatchCertification" ADD CONSTRAINT "BerryBatchCertification_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "BerryBatch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QualityInspection" ADD CONSTRAINT "QualityInspection_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "BerryBatch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Shipment" ADD CONSTRAINT "Shipment_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "BerryBatch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
