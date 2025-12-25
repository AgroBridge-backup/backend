import { PrismaClient } from '@prisma/client';
import { whatsAppService } from '../whatsapp.service.js';
import { messages, } from '../templates/messages.js';
import { logger } from '../../../infrastructure/logging/logger.js';
const prisma = new PrismaClient();
const config = {
    baseUrl: process.env.APP_BASE_URL || 'https://api.agrobridge.io',
    verifyBaseUrl: process.env.VERIFY_BASE_URL || 'https://verify.agrobridge.io',
    appDeepLinkUrl: process.env.APP_DEEPLINK_URL || 'agrobridge://app',
};
export class BlockchainNotificationService {
    generateBatchVerifyUrl(batchId) {
        return `${config.verifyBaseUrl}/batch/${batchId}`;
    }
    generateCertificateVerifyUrl(certificateId) {
        return `${config.verifyBaseUrl}/certificate/${certificateId}`;
    }
    generateEventVerifyUrl(eventId) {
        return `${config.verifyBaseUrl}/event/${eventId}`;
    }
    generateInvoiceVerifyUrl(uuid) {
        return `${config.verifyBaseUrl}/invoice/${uuid}`;
    }
    generateReferralVerifyUrl(referralId) {
        return `${config.verifyBaseUrl}/referral/${referralId}`;
    }
    generateBatchDetailsUrl(batchId) {
        return `${config.baseUrl}/api/v1/batches/${batchId}`;
    }
    async sendBatchVerifiedNotification(batchId, phoneNumber, language = 'es') {
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
            const data = {
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
        }
        catch (error) {
            logger.error('Failed to send batch verified notification', { error, batchId });
            return null;
        }
    }
    async sendCertificateIssuedNotification(certificateId, phoneNumber, pdfUrl, language = 'es') {
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
            const data = {
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
        }
        catch (error) {
            logger.error('Failed to send certificate notification', { error, certificateId });
            return null;
        }
    }
    async sendInvoiceWithBlockchainNotification(invoiceData, phoneNumber, language = 'es') {
        try {
            const data = {
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
        }
        catch (error) {
            logger.error('Failed to send invoice notification', { error, folio: invoiceData.folio });
            return null;
        }
    }
    async sendExportReadyNotification(batchId, destination, docCount, downloadUrl, phoneNumber, language = 'es') {
        try {
            const data = {
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
        }
        catch (error) {
            logger.error('Failed to send export notification', { error, batchId });
            return null;
        }
    }
    async sendQualityInspectionNotification(eventId, batchId, grade, score, inspectorName, reportUrl, phoneNumber, language = 'es') {
        try {
            const data = {
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
        }
        catch (error) {
            logger.error('Failed to send quality inspection notification', { error, eventId });
            return null;
        }
    }
    async sendReferralSuccessNotification(referralId, referredName, reward, phoneNumber, language = 'es') {
        try {
            const data = {
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
        }
        catch (error) {
            logger.error('Failed to send referral success notification', { error, referralId });
            return null;
        }
    }
    async sendReferralActivatedNotification(referredName, totalActive, leaderboardRank, phoneNumber, language = 'es') {
        try {
            const data = {
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
        }
        catch (error) {
            logger.error('Failed to send referral activated notification', { error });
            return null;
        }
    }
    async getUserPhoneNumber(userId) {
        const preference = await prisma.notificationPreference.findUnique({
            where: { userId },
        });
        if (preference?.phoneNumber && preference.whatsappEnabled) {
            return preference.phoneNumber;
        }
        return null;
    }
    async getProducerPhoneNumber(producerId) {
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
    async getUserLanguage(userId) {
        return 'es';
    }
    async notifyProducerBatchVerified(batchId) {
        const batch = await prisma.batch.findUnique({
            where: { id: batchId },
            select: { producerId: true },
        });
        if (!batch)
            return null;
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
export const blockchainNotificationService = new BlockchainNotificationService();
