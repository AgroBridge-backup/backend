import { PrismaClient } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';
import logger from '../../shared/utils/logger.js';
import { notificationQueue } from './queue/NotificationQueue.js';
const prisma = new PrismaClient();
export class NotificationOrchestrator {
    static instance = null;
    constructor() {
    }
    static getInstance() {
        if (!NotificationOrchestrator.instance) {
            NotificationOrchestrator.instance = new NotificationOrchestrator();
        }
        return NotificationOrchestrator.instance;
    }
    async sendNotification(input) {
        try {
            const validation = this.validateInput(input);
            if (!validation.valid) {
                return {
                    success: false,
                    error: validation.error,
                };
            }
            const user = await prisma.user.findUnique({
                where: { id: input.userId },
                select: { id: true, isActive: true },
            });
            if (!user) {
                return {
                    success: false,
                    error: 'User not found',
                };
            }
            if (!user.isActive) {
                return {
                    success: false,
                    error: 'User account is inactive',
                };
            }
            const channels = await this.determineChannels(input.userId, input.channels);
            if (channels.length === 0) {
                logger.warn('[NotificationOrchestrator] User has disabled all notification channels', {
                    userId: input.userId,
                    requestedChannels: input.channels,
                });
                return {
                    success: false,
                    error: 'User has disabled all requested notification channels',
                };
            }
            const notification = await this.createNotification({
                ...input,
                channels,
            });
            await notificationQueue.enqueue({
                notificationId: notification.id,
                userId: input.userId,
                type: input.type,
                title: input.title,
                body: input.body,
                data: input.data,
                channels,
                priority: input.priority || 'NORMAL',
            });
            logger.info('[NotificationOrchestrator] Notification queued', {
                notificationId: notification.id,
                userId: input.userId,
                type: input.type,
                channels,
                priority: input.priority,
            });
            return {
                success: true,
                notificationId: notification.id,
            };
        }
        catch (error) {
            const err = error;
            logger.error('[NotificationOrchestrator] Failed to send notification', {
                error: err.message,
                userId: input.userId,
                type: input.type,
            });
            return {
                success: false,
                error: err.message,
            };
        }
    }
    async sendToUsers(userIds, input) {
        const results = await Promise.all(userIds.map((userId) => this.sendNotification({ ...input, userId })));
        const successCount = results.filter((r) => r.success).length;
        logger.info('[NotificationOrchestrator] Batch notification sent', {
            totalUsers: userIds.length,
            successCount,
            failureCount: userIds.length - successCount,
            type: input.type,
        });
        return results;
    }
    async sendBatchCreatedNotification(userId, details) {
        return await this.sendNotification({
            userId,
            type: 'BATCH_CREATED',
            title: 'Lote Registrado',
            body: `Tu lote ${details.batchId} ha sido registrado exitosamente en la blockchain`,
            data: {
                batchId: details.batchId,
                deepLink: `/batches/${details.batchId}`,
                variety: details.variety,
                origin: details.origin,
            },
            channels: ['PUSH', 'EMAIL'],
            priority: 'NORMAL',
        });
    }
    async sendBatchStatusNotification(userId, batchId, newStatus) {
        const statusMessages = {
            IN_TRANSIT: 'Tu lote está en tránsito',
            ARRIVED: 'Tu lote ha llegado a destino',
            DELIVERED: 'Tu lote ha sido entregado',
            REJECTED: 'Tu lote ha sido rechazado',
        };
        return await this.sendNotification({
            userId,
            type: 'BATCH_STATUS_CHANGED',
            title: `Actualización de Lote ${batchId}`,
            body: statusMessages[newStatus] || `Estado actualizado: ${newStatus}`,
            data: {
                batchId,
                status: newStatus,
                deepLink: `/batches/${batchId}`,
            },
            channels: ['PUSH', 'EMAIL'],
            priority: 'NORMAL',
        });
    }
    async sendCertificateReadyNotification(userId, details) {
        return await this.sendNotification({
            userId,
            type: 'CERTIFICATE_READY',
            title: 'Certificado Blockchain Listo',
            body: `Tu certificado para el lote ${details.batchId} está disponible para descargar`,
            data: {
                batchId: details.batchId,
                certificateUrl: details.certificateUrl,
                blockchainHash: details.blockchainHash,
                deepLink: `/certificates/${details.batchId}`,
            },
            channels: ['PUSH', 'EMAIL'],
            priority: 'HIGH',
        });
    }
    async sendSensorAlertNotification(userId, details) {
        return await this.sendNotification({
            userId,
            type: 'SENSOR_ALERT',
            title: `Alerta: ${details.sensorType}`,
            body: `${details.sensorType} excedió el umbral (${details.currentValue}${details.unit} > ${details.threshold}${details.unit})`,
            data: {
                sensorType: details.sensorType,
                currentValue: details.currentValue.toString(),
                threshold: details.threshold.toString(),
                unit: details.unit,
                location: details.location,
                batchId: details.batchId,
                deepLink: '/sensors',
            },
            channels: ['PUSH', 'SMS', 'EMAIL'],
            priority: 'CRITICAL',
        });
    }
    async sendOrderStatusNotification(userId, details) {
        const statusMessages = {
            CONFIRMED: 'Tu orden ha sido confirmada',
            SHIPPED: 'Tu orden ha sido enviada',
            DELIVERED: 'Tu orden ha sido entregada',
            CANCELLED: 'Tu orden ha sido cancelada',
        };
        return await this.sendNotification({
            userId,
            type: `ORDER_${details.status}`,
            title: `Orden #${details.orderId}`,
            body: statusMessages[details.status] || `Estado: ${details.status}`,
            data: {
                orderId: details.orderId,
                status: details.status,
                total: details.total?.toString(),
                trackingUrl: details.trackingUrl,
                deepLink: `/orders/${details.orderId}`,
            },
            channels: ['PUSH', 'EMAIL'],
            priority: 'NORMAL',
        });
    }
    async sendPaymentReceivedNotification(userId, orderId, amount, currency = 'MXN') {
        const formattedAmount = new Intl.NumberFormat('es-MX', {
            style: 'currency',
            currency,
        }).format(amount);
        return await this.sendNotification({
            userId,
            type: 'PAYMENT_RECEIVED',
            title: 'Pago Recibido',
            body: `Hemos recibido tu pago de ${formattedAmount} para la orden #${orderId}`,
            data: {
                orderId,
                amount: amount.toString(),
                currency,
                deepLink: `/orders/${orderId}`,
            },
            channels: ['PUSH', 'EMAIL'],
            priority: 'HIGH',
        });
    }
    async sendProducerWhitelistedNotification(userId, producerName) {
        return await this.sendNotification({
            userId,
            type: 'PRODUCER_WHITELISTED',
            title: 'Cuenta Verificada',
            body: `¡Felicidades! ${producerName} ha sido verificado y puede comenzar a registrar lotes`,
            data: {
                deepLink: '/dashboard',
            },
            channels: ['PUSH', 'EMAIL'],
            priority: 'HIGH',
        });
    }
    async sendSystemAnnouncement(title, body, data) {
        try {
            const users = await prisma.user.findMany({
                where: { isActive: true },
                select: { id: true },
            });
            const results = await this.sendToUsers(users.map((u) => u.id), {
                type: 'SYSTEM_ANNOUNCEMENT',
                title,
                body,
                data,
                channels: ['PUSH', 'EMAIL'],
                priority: 'NORMAL',
            });
            const successCount = results.filter((r) => r.success).length;
            return {
                success: true,
                sentCount: successCount,
            };
        }
        catch (error) {
            const err = error;
            logger.error('[NotificationOrchestrator] System announcement failed', {
                error: err.message,
            });
            return { success: false, sentCount: 0 };
        }
    }
    async sendWelcomeNotification(userId, userName) {
        return await this.sendNotification({
            userId,
            type: 'WELCOME',
            title: `Bienvenido a AgroBridge, ${userName}!`,
            body: 'Gracias por unirte a nuestra plataforma de trazabilidad agrícola. Comienza registrando tu primer lote.',
            data: {
                deepLink: '/dashboard',
            },
            channels: ['PUSH', 'EMAIL'],
            priority: 'NORMAL',
        });
    }
    async getNotification(id) {
        return await prisma.notification.findUnique({
            where: { id },
            include: {
                deliveryLogs: true,
            },
        });
    }
    async getUserNotifications(userId, options) {
        return await prisma.notification.findMany({
            where: {
                userId,
                ...(options?.unreadOnly ? { readAt: null } : {}),
                ...(options?.type ? { type: options.type } : {}),
                ...(options?.status ? { status: options.status } : {}),
            },
            orderBy: { createdAt: 'desc' },
            skip: options?.offset || 0,
            take: options?.limit || 50,
        });
    }
    async getUnreadCount(userId) {
        return await prisma.notification.count({
            where: {
                userId,
                readAt: null,
                status: { in: ['SENT', 'DELIVERED'] },
            },
        });
    }
    async markAsRead(notificationId) {
        await prisma.notification.update({
            where: { id: notificationId },
            data: { readAt: new Date() },
        });
    }
    async markAllAsRead(userId) {
        await prisma.notification.updateMany({
            where: {
                userId,
                readAt: null,
            },
            data: { readAt: new Date() },
        });
    }
    async markAsClicked(notificationId) {
        await prisma.notification.update({
            where: { id: notificationId },
            data: {
                clickedAt: new Date(),
                status: 'CLICKED',
            },
        });
    }
    async deleteNotification(notificationId) {
        await prisma.notification.delete({
            where: { id: notificationId },
        });
    }
    async getStats(userId) {
        const where = userId ? { userId } : {};
        const [total, pending, sent, delivered, failed, read] = await Promise.all([
            prisma.notification.count({ where }),
            prisma.notification.count({ where: { ...where, status: 'PENDING' } }),
            prisma.notification.count({ where: { ...where, status: 'SENT' } }),
            prisma.notification.count({ where: { ...where, status: 'DELIVERED' } }),
            prisma.notification.count({ where: { ...where, status: 'FAILED' } }),
            prisma.notification.count({ where: { ...where, readAt: { not: null } } }),
        ]);
        return {
            total,
            pending,
            sent,
            delivered,
            failed,
            read,
            deliveryRate: total > 0 ? ((delivered + read) / total) * 100 : 0,
            readRate: delivered > 0 ? (read / delivered) * 100 : 0,
        };
    }
    validateInput(input) {
        if (!input.userId || input.userId.trim() === '') {
            return { valid: false, error: 'userId is required' };
        }
        if (!input.type) {
            return { valid: false, error: 'type is required' };
        }
        if (!input.title || input.title.trim() === '') {
            return { valid: false, error: 'title is required' };
        }
        if (input.title.length > 255) {
            return { valid: false, error: 'title must be less than 255 characters' };
        }
        if (!input.body || input.body.trim() === '') {
            return { valid: false, error: 'body is required' };
        }
        if (input.body.length > 5000) {
            return { valid: false, error: 'body must be less than 5000 characters' };
        }
        if (!input.channels || input.channels.length === 0) {
            return { valid: false, error: 'At least one channel is required' };
        }
        return { valid: true };
    }
    async determineChannels(userId, requestedChannels) {
        try {
            const preferences = await prisma.notificationPreference.findUnique({
                where: { userId },
            });
            if (!preferences) {
                return requestedChannels;
            }
            const allowedChannels = requestedChannels.filter((channel) => {
                switch (channel) {
                    case 'PUSH':
                        return preferences.pushEnabled !== false;
                    case 'EMAIL':
                        return preferences.emailEnabled !== false;
                    case 'SMS':
                        return preferences.smsEnabled !== false;
                    case 'WHATSAPP':
                        return preferences.whatsappEnabled !== false;
                    case 'IN_APP':
                        return true;
                    default:
                        return true;
                }
            });
            return allowedChannels;
        }
        catch (error) {
            const err = error;
            logger.error('[NotificationOrchestrator] Failed to determine channels', {
                error: err.message,
                userId,
            });
            return requestedChannels;
        }
    }
    async createNotification(input) {
        const notification = await prisma.notification.create({
            data: {
                id: uuidv4(),
                userId: input.userId,
                type: input.type,
                title: input.title,
                body: input.body,
                data: input.data || {},
                imageUrl: input.imageUrl,
                channels: input.channels,
                priority: input.priority || 'NORMAL',
                status: 'PENDING',
                expiresAt: input.expiresAt,
            },
        });
        return notification;
    }
}
export const notificationOrchestrator = NotificationOrchestrator.getInstance();
export default notificationOrchestrator;
