/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * AGROBRIDGE - BLOCKCHAIN NOTIFICATION SERVICE
 * Phase 1: Revenue Sprint - WhatsApp Notifications with Blockchain Verification
 *
 * Sends WhatsApp notifications with blockchain verification links to farmers
 * and buyers, enabling trust verification without requiring app login.
 *
 * @module whatsapp-bot/services/blockchain-notification
 * @version 1.0.0
 * ═══════════════════════════════════════════════════════════════════════════════
 */

import { PrismaClient } from '@prisma/client';
import { whatsAppService } from '../whatsapp.service.js';
import {
  messages,
  BatchVerifiedData,
  CertificateIssuedData,
  InvoiceBlockchainData,
  ExportReadyData,
  QualityInspectionData,
  ReferralSuccessData,
  ReferralActivatedData,
} from '../templates/messages.js';
import { logger } from '../../../infrastructure/logging/logger.js';

const prisma = new PrismaClient();

// ═══════════════════════════════════════════════════════════════════════════════
// CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════════

const config = {
  baseUrl: process.env.APP_BASE_URL || 'https://api.agrobridge.io',
  verifyBaseUrl: process.env.VERIFY_BASE_URL || 'https://verify.agrobridge.io',
  appDeepLinkUrl: process.env.APP_DEEPLINK_URL || 'agrobridge://app',
};

// ═══════════════════════════════════════════════════════════════════════════════
// SERVICE CLASS
// ═══════════════════════════════════════════════════════════════════════════════

export class BlockchainNotificationService {

  /**
   * Generate verification URL for a batch
   */
  generateBatchVerifyUrl(batchId: string): string {
    return `${config.verifyBaseUrl}/batch/${batchId}`;
  }

  /**
   * Generate verification URL for a certificate
   */
  generateCertificateVerifyUrl(certificateId: string): string {
    return `${config.verifyBaseUrl}/certificate/${certificateId}`;
  }

  /**
   * Generate verification URL for an event
   */
  generateEventVerifyUrl(eventId: string): string {
    return `${config.verifyBaseUrl}/event/${eventId}`;
  }

  /**
   * Generate verification URL for an invoice
   */
  generateInvoiceVerifyUrl(uuid: string): string {
    return `${config.verifyBaseUrl}/invoice/${uuid}`;
  }

  /**
   * Generate verification URL for a referral
   */
  generateReferralVerifyUrl(referralId: string): string {
    return `${config.verifyBaseUrl}/referral/${referralId}`;
  }

  /**
   * Generate app deep link URL for batch details
   */
  generateBatchDetailsUrl(batchId: string): string {
    return `${config.baseUrl}/api/v1/batches/${batchId}`;
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // BATCH NOTIFICATIONS
  // ═══════════════════════════════════════════════════════════════════════════════

  /**
   * Send batch verified notification via WhatsApp
   */
  async sendBatchVerifiedNotification(
    batchId: string,
    phoneNumber: string,
    language: 'es' | 'en' = 'es'
  ): Promise<string | null> {
    try {
      const batch = await prisma.batch.findUnique({
        where: { id: batchId },
        include: {
          producer: {
            select: { businessName: true },
          },
        },
      });

      if (!batch) {
        logger.warn('Batch not found for notification', { batchId });
        return null;
      }

      const data: BatchVerifiedData = {
        batchId: batchId.substring(0, 8),
        product: batch.variety,
        quantity: Number(batch.weightKg),
        origin: batch.origin,
        detailsUrl: this.generateBatchDetailsUrl(batchId),
        blockchainUrl: this.generateBatchVerifyUrl(batchId),
      };

      const message = messages.batchVerified[language](data);
      const messageId = await whatsAppService.sendText(phoneNumber, message);

      logger.info('Batch verified notification sent', {
        batchId,
        phoneNumber: phoneNumber.substring(-4),
        messageId,
      });

      return messageId;
    } catch (error) {
      logger.error('Failed to send batch verified notification', { error, batchId });
      return null;
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // CERTIFICATE NOTIFICATIONS
  // ═══════════════════════════════════════════════════════════════════════════════

  /**
   * Send certificate issued notification via WhatsApp
   */
  async sendCertificateIssuedNotification(
    certificateId: string,
    phoneNumber: string,
    pdfUrl: string,
    language: 'es' | 'en' = 'es'
  ): Promise<string | null> {
    try {
      const certificate = await prisma.certification.findUnique({
        where: { id: certificateId },
        include: {
          producer: {
            include: {
              batches: {
                take: 1,
                orderBy: { createdAt: 'desc' },
              },
            },
          },
        },
      });

      if (!certificate) {
        logger.warn('Certificate not found for notification', { certificateId });
        return null;
      }

      const latestBatch = certificate.producer.batches[0];

      const data: CertificateIssuedData = {
        certType: certificate.type,
        batchId: latestBatch?.id?.substring(0, 8) || 'N/A',
        issuer: certificate.certifier,
        txHash: certificate.ipfsHash || 'pending',
        pdfUrl,
        blockchainUrl: this.generateCertificateVerifyUrl(certificateId),
      };

      const message = messages.certificateIssued[language](data);
      const messageId = await whatsAppService.sendText(phoneNumber, message);

      logger.info('Certificate issued notification sent', {
        certificateId,
        phoneNumber: phoneNumber.substring(-4),
        messageId,
      });

      return messageId;
    } catch (error) {
      logger.error('Failed to send certificate notification', { error, certificateId });
      return null;
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // INVOICE NOTIFICATIONS
  // ═══════════════════════════════════════════════════════════════════════════════

  /**
   * Send invoice with blockchain notification via WhatsApp
   */
  async sendInvoiceWithBlockchainNotification(
    invoiceData: {
      folio: string;
      uuid: string;
      total: number;
      blockchainHash: string;
      pdfUrl: string;
    },
    phoneNumber: string,
    language: 'es' | 'en' = 'es'
  ): Promise<string | null> {
    try {
      const data: InvoiceBlockchainData = {
        folio: invoiceData.folio,
        uuid: invoiceData.uuid,
        total: invoiceData.total,
        blockchainHash: invoiceData.blockchainHash,
        pdfUrl: invoiceData.pdfUrl,
        verifyUrl: this.generateInvoiceVerifyUrl(invoiceData.uuid),
      };

      const message = messages.invoiceWithBlockchain[language](data);
      const messageId = await whatsAppService.sendText(phoneNumber, message);

      logger.info('Invoice blockchain notification sent', {
        folio: invoiceData.folio,
        phoneNumber: phoneNumber.substring(-4),
        messageId,
      });

      return messageId;
    } catch (error) {
      logger.error('Failed to send invoice notification', { error, folio: invoiceData.folio });
      return null;
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // EXPORT NOTIFICATIONS
  // ═══════════════════════════════════════════════════════════════════════════════

  /**
   * Send export ready notification with blockchain verification
   */
  async sendExportReadyNotification(
    batchId: string,
    destination: string,
    docCount: number,
    downloadUrl: string,
    phoneNumber: string,
    language: 'es' | 'en' = 'es'
  ): Promise<string | null> {
    try {
      const data: ExportReadyData = {
        batchId: batchId.substring(0, 8),
        destination,
        docCount,
        downloadUrl,
        blockchainUrl: this.generateBatchVerifyUrl(batchId),
      };

      const message = messages.exportReadyBlockchain[language](data);
      const messageId = await whatsAppService.sendText(phoneNumber, message);

      logger.info('Export ready notification sent', {
        batchId,
        destination,
        phoneNumber: phoneNumber.substring(-4),
        messageId,
      });

      return messageId;
    } catch (error) {
      logger.error('Failed to send export notification', { error, batchId });
      return null;
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // QUALITY INSPECTION NOTIFICATIONS
  // ═══════════════════════════════════════════════════════════════════════════════

  /**
   * Send quality inspection complete notification
   */
  async sendQualityInspectionNotification(
    eventId: string,
    batchId: string,
    grade: string,
    score: number,
    inspectorName: string,
    reportUrl: string,
    phoneNumber: string,
    language: 'es' | 'en' = 'es'
  ): Promise<string | null> {
    try {
      const data: QualityInspectionData = {
        batchId: batchId.substring(0, 8),
        grade,
        score,
        inspectorName,
        reportUrl,
        blockchainUrl: this.generateEventVerifyUrl(eventId),
      };

      const message = messages.qualityInspectionComplete[language](data);
      const messageId = await whatsAppService.sendText(phoneNumber, message);

      logger.info('Quality inspection notification sent', {
        eventId,
        batchId,
        score,
        phoneNumber: phoneNumber.substring(-4),
        messageId,
      });

      return messageId;
    } catch (error) {
      logger.error('Failed to send quality inspection notification', { error, eventId });
      return null;
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // REFERRAL NOTIFICATIONS
  // ═══════════════════════════════════════════════════════════════════════════════

  /**
   * Send referral success notification with blockchain proof
   */
  async sendReferralSuccessNotification(
    referralId: string,
    referredName: string,
    reward: string,
    phoneNumber: string,
    language: 'es' | 'en' = 'es'
  ): Promise<string | null> {
    try {
      const data: ReferralSuccessData = {
        referredName,
        reward,
        blockchainProof: this.generateReferralVerifyUrl(referralId),
      };

      const message = messages.referralSuccessBlockchain[language](data);
      const messageId = await whatsAppService.sendText(phoneNumber, message);

      logger.info('Referral success notification sent', {
        referralId,
        phoneNumber: phoneNumber.substring(-4),
        messageId,
      });

      return messageId;
    } catch (error) {
      logger.error('Failed to send referral success notification', { error, referralId });
      return null;
    }
  }

  /**
   * Send referral activated notification (30 days active)
   */
  async sendReferralActivatedNotification(
    referredName: string,
    totalActive: number,
    leaderboardRank: number,
    phoneNumber: string,
    language: 'es' | 'en' = 'es'
  ): Promise<string | null> {
    try {
      const data: ReferralActivatedData = {
        referredName,
        totalActive,
        leaderboardRank,
      };

      const message = messages.referralActivated[language](data);
      const messageId = await whatsAppService.sendText(phoneNumber, message);

      logger.info('Referral activated notification sent', {
        totalActive,
        leaderboardRank,
        phoneNumber: phoneNumber.substring(-4),
        messageId,
      });

      return messageId;
    } catch (error) {
      logger.error('Failed to send referral activated notification', { error });
      return null;
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // UTILITY METHODS
  // ═══════════════════════════════════════════════════════════════════════════════

  /**
   * Get user's phone number from database
   */
  async getUserPhoneNumber(userId: string): Promise<string | null> {
    const preference = await prisma.notificationPreference.findUnique({
      where: { userId },
    });

    if (preference?.phoneNumber && preference.whatsappEnabled) {
      return preference.phoneNumber;
    }

    return null;
  }

  /**
   * Get producer's phone number from database
   */
  async getProducerPhoneNumber(producerId: string): Promise<string | null> {
    const producer = await prisma.producer.findUnique({
      where: { id: producerId },
      include: {
        user: {
          include: {
            notificationPreferences: true,
          },
        },
      },
    });

    const preference = producer?.user?.notificationPreferences;
    if (preference?.phoneNumber && preference.whatsappEnabled) {
      return preference.phoneNumber;
    }

    return null;
  }

  /**
   * Get user's preferred language
   */
  async getUserLanguage(userId: string): Promise<'es' | 'en'> {
    // Default to Spanish for Mexican farmers
    // In future, could be stored in user preferences
    return 'es';
  }

  /**
   * Send batch verified notification to producer (convenience method)
   */
  async notifyProducerBatchVerified(batchId: string): Promise<string | null> {
    const batch = await prisma.batch.findUnique({
      where: { id: batchId },
      select: { producerId: true },
    });

    if (!batch) return null;

    const phoneNumber = await this.getProducerPhoneNumber(batch.producerId);
    if (!phoneNumber) {
      logger.info('Producer has no WhatsApp number configured', {
        batchId,
        producerId: batch.producerId,
      });
      return null;
    }

    return this.sendBatchVerifiedNotification(batchId, phoneNumber);
  }
}

// Export singleton instance
export const blockchainNotificationService = new BlockchainNotificationService();
