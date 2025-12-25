/**
 * Traceability 2.0 - Blockchain Quality Certificates
 * Domain Service for Certificate Issuance and Management
 */

import { createHash } from 'crypto';
import { PrismaClient } from '@prisma/client';
import { IQualityCertificateRepository } from '../repositories/IQualityCertificateRepository.js';
import { IVerificationStageRepository } from '../repositories/IVerificationStageRepository.js';
import {
  QualityCertificate,
  CreateCertificateInput,
  CertificateGrade,
  CertificatePayload,
  REQUIRED_STAGES_BY_GRADE,
} from '../entities/QualityCertificate.js';
import { StageStatus, STAGE_ORDER } from '../entities/VerificationStage.js';
import { BlockchainService } from './BlockchainService.js';
import { AppError } from '../../shared/errors/AppError.js';
import logger from '../../shared/utils/logger.js';
import { instrumentAsync, addBreadcrumb, captureException, setContext } from '../../infrastructure/monitoring/sentry.js';

export interface IssueCertificateInput {
  batchId: string;
  grade: CertificateGrade;
  certifyingBody: string;
  validityDays: number;
  issuedBy: string;
}

export interface IssueCertificateResult {
  certificate: QualityCertificate;
  payload: CertificatePayload;
  hash: string;
  blockchainTxId: string | null;
}

export class QualityCertificateService {
  private static readonly VERSION = '1.0.0';

  constructor(
    private prisma: PrismaClient,
    private certificateRepository: IQualityCertificateRepository,
    private stageRepository: IVerificationStageRepository,
    private blockchainService?: BlockchainService
  ) {}

  /**
   * Issue a new quality certificate
   */
  async issueCertificate(input: IssueCertificateInput): Promise<IssueCertificateResult> {
    const { batchId, grade, certifyingBody, validityDays, issuedBy } = input;

    addBreadcrumb('Issuing certificate', 'certificate', { batchId, grade });
    setContext('certificate', { batchId, grade, certifyingBody, issuedBy });

    return instrumentAsync('issueCertificate', 'certificate.issue', async () => {
      // 1. Validate batch exists
      const batch = await this.prisma.batch.findUnique({
      where: { id: batchId },
      include: { producer: { select: { latitude: true, longitude: true } } },
    });

    if (!batch) {
      throw new AppError('Batch not found', 404);
    }

    // 2. Validate required stages are approved
    await this.validateRequiredStages(batchId, grade);

    // 3. Build certificate payload
    const payload = await this.buildCertificatePayload(batchId, grade, certifyingBody, issuedBy);

    // 4. Compute hash
    const payloadJson = JSON.stringify(payload);
    const hash = this.computeHash(payloadJson);

    // 5. Store on blockchain
    let blockchainTxId: string | null = null;
    if (this.blockchainService) {
      try {
        const blockchainResult = await this.blockchainService.registerEventOnChain({
          eventType: 'CERTIFICATE_ISSUED',
          batchId,
          latitude: batch.producer?.latitude ? Number(batch.producer.latitude) : 0,
          longitude: batch.producer?.longitude ? Number(batch.producer.longitude) : 0,
          ipfsHash: hash,
        });
        blockchainTxId = blockchainResult.txHash;

        logger.info('Certificate stored on blockchain', {
          batchId,
          grade,
          txHash: blockchainTxId,
        });
      } catch (error: any) {
        logger.error('Failed to store certificate on blockchain', {
          batchId,
          error: error.message,
        });
        // Continue without blockchain - can retry later
      }
    }

    // 6. Create certificate record
    const validFrom = new Date();
    const validTo = new Date();
    validTo.setDate(validTo.getDate() + validityDays);

    const certificate = await this.certificateRepository.create({
      batchId,
      grade,
      certifyingBody,
      validFrom,
      validTo,
      issuedBy,
      hashOnChain: hash,
      payloadSnapshot: payloadJson,
    });

    logger.info('Quality certificate issued', {
      certificateId: certificate.id,
      batchId,
      grade,
      hash,
    });

    return {
      certificate,
      payload,
      hash,
      blockchainTxId,
    };
    });
  }

  /**
   * Get certificate details
   */
  async getCertificate(certificateId: string): Promise<QualityCertificate | null> {
    return this.certificateRepository.findById(certificateId);
  }

  /**
   * Get all certificates for a batch
   */
  async getBatchCertificates(batchId: string): Promise<QualityCertificate[]> {
    return this.certificateRepository.findByBatchId(batchId);
  }

  /**
   * Get valid (non-expired) certificates for a batch
   */
  async getValidCertificates(batchId: string): Promise<QualityCertificate[]> {
    return this.certificateRepository.findValidCertificates(batchId);
  }

  /**
   * Verify certificate hash against stored payload
   */
  async verifyCertificate(certificateId: string): Promise<{
    isValid: boolean;
    certificate: QualityCertificate | null;
    computedHash: string | null;
    storedHash: string | null;
    isExpired: boolean;
  }> {
    addBreadcrumb('Verifying certificate', 'certificate', { certificateId });

    return instrumentAsync('verifyCertificate', 'certificate.verify', async () => {
      const certificate = await this.certificateRepository.findById(certificateId);

    if (!certificate) {
      return {
        isValid: false,
        certificate: null,
        computedHash: null,
        storedHash: null,
        isExpired: false,
      };
    }

    const now = new Date();
    const isExpired = certificate.validTo < now;

    if (!certificate.payloadSnapshot) {
      return {
        isValid: false,
        certificate,
        computedHash: null,
        storedHash: certificate.hashOnChain,
        isExpired,
      };
    }

    const computedHash = this.computeHash(certificate.payloadSnapshot);
    const isValid = computedHash === certificate.hashOnChain && !isExpired;

    return {
      isValid,
      certificate,
      computedHash,
      storedHash: certificate.hashOnChain,
      isExpired,
    };
    });
  }

  /**
   * Check if a batch can receive a certificate of a specific grade
   */
  async canIssueCertificate(batchId: string, grade: CertificateGrade): Promise<{
    canIssue: boolean;
    missingStages: string[];
    message: string;
  }> {
    const requiredStages = REQUIRED_STAGES_BY_GRADE[grade];
    const stages = await this.stageRepository.findByBatchId(batchId);

    const approvedStageTypes = stages
      .filter(s => s.status === StageStatus.APPROVED)
      .map(s => s.stageType);

    const missingStages = requiredStages.filter(
      required => !approvedStageTypes.includes(required as any)
    );

    if (missingStages.length > 0) {
      return {
        canIssue: false,
        missingStages,
        message: `Missing required stages: ${missingStages.join(', ')}`,
      };
    }

    return {
      canIssue: true,
      missingStages: [],
      message: 'All requirements met for certificate issuance',
    };
  }

  /**
   * Validate that required stages are approved for a grade
   */
  private async validateRequiredStages(batchId: string, grade: CertificateGrade): Promise<void> {
    const { canIssue, missingStages } = await this.canIssueCertificate(batchId, grade);

    if (!canIssue) {
      throw new AppError(
        `Cannot issue ${grade} certificate. Missing approved stages: ${missingStages.join(', ')}`,
        400
      );
    }
  }

  /**
   * Build the certificate payload for hashing
   */
  private async buildCertificatePayload(
    batchId: string,
    grade: CertificateGrade,
    certifyingBody: string,
    issuedBy: string
  ): Promise<CertificatePayload> {
    // Get batch details
    const batch = await this.prisma.batch.findUnique({
      where: { id: batchId },
    });

    if (!batch) {
      throw new AppError('Batch not found', 404);
    }

    // Get verification stages
    const stages = await this.stageRepository.findByBatchId(batchId);

    // Get NFC seals with latest verification (if available)
    const nfcSeals = await this.prisma.nfcSeal.findMany({
      where: { batchId },
      include: {
        verifications: {
          orderBy: { verifiedAt: 'desc' },
          take: 1,
        },
      },
    });

    // Get temperature readings summary (if available)
    const tempReadings = await this.prisma.temperatureReading.findMany({
      where: { batchId },
    });

    let temperatureSummary = undefined;
    if (tempReadings.length > 0) {
      const values = tempReadings.map(t => Number(t.value));
      temperatureSummary = {
        count: tempReadings.length,
        minValue: Math.min(...values),
        maxValue: Math.max(...values),
        avgValue: values.reduce((a, b) => a + b, 0) / values.length,
        outOfRangeCount: tempReadings.filter(t => t.isOutOfRange).length,
      };
    }

    const now = new Date();
    const certificateId = `CERT-${batchId.slice(0, 8)}-${now.getTime()}`;

    return {
      certificateId,
      batchId,
      batchCode: batchId, // Use batchId as code
      grade,
      certifyingBody,
      validFrom: now.toISOString(),
      validTo: new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000).toISOString(), // 1 year
      issuedAt: now.toISOString(),
      issuedBy,
      batch: {
        producerId: batch.producerId,
        cropType: batch.variety, // Use variety as crop type
        variety: batch.variety,
        quantity: batch.weightKg ? Number(batch.weightKg) : null,
        harvestDate: batch.harvestDate?.toISOString() ?? null,
        origin: batch.origin,
      },
      stages: stages.map(s => ({
        stageType: s.stageType,
        status: s.status,
        actorId: s.actorId,
        timestamp: s.timestamp.toISOString(),
        location: s.location,
      })),
      nfcSeals: nfcSeals.length > 0 ? nfcSeals.filter(seal => seal.sealNumber).map(seal => ({
        uid: seal.sealNumber!, // sealNumber is guaranteed by filter
        status: seal.status as string,
        lastVerifiedAt: seal.verifications[0]?.verifiedAt?.toISOString() ?? null,
      })) : undefined,
      temperatureSummary,
      version: QualityCertificateService.VERSION,
      generatedAt: now.toISOString(),
    };
  }

  /**
   * Compute SHA-256 hash of the payload
   */
  private computeHash(payload: string): string {
    return createHash('sha256').update(payload).digest('hex');
  }
}
