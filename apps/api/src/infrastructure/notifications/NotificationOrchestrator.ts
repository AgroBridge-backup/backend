/**
 * @file Notification Orchestrator
 * @description Central coordinator for all notification operations
 *
 * Responsibilities:
 * 1. Validate notification requests
 * 2. Determine optimal channels (push, email, SMS)
 * 3. Check user preferences
 * 4. Save to database
 * 5. Queue for async delivery
 * 6. Track metrics
 *
 * Design Philosophy (enterprise architecture):
 * "The orchestrator is the brain. Services are the hands.
 *  Keep business logic here, not in individual services."
 *
 * @author AgroBridge Engineering Team
 */

import { PrismaClient, NotificationChannel, NotificationType, NotificationPriority, NotificationStatus } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';
import logger from '../../shared/utils/logger.js';
import { notificationQueue } from './queue/NotificationQueue.js';
import type {
  SendNotificationInput,
  SendNotificationResult,
  GetNotificationsOptions,
  NotificationData,
  BatchNotificationDetails,
  CertificateNotificationDetails,
  SensorAlertDetails,
  OrderNotificationDetails,
} from './types/index.js';

// Prisma client for database operations
const prisma = new PrismaClient();

/**
 * Notification Orchestrator
 *
 * Central coordinator for all notification operations
 * Implements singleton pattern
 */
export class NotificationOrchestrator {
  private static instance: NotificationOrchestrator | null = null;

  private constructor() {
    // Private constructor for singleton
  }

  /**
   * Get singleton instance of NotificationOrchestrator
   */
  public static getInstance(): NotificationOrchestrator {
    if (!NotificationOrchestrator.instance) {
      NotificationOrchestrator.instance = new NotificationOrchestrator();
    }
    return NotificationOrchestrator.instance;
  }

  /**
   * Send notification
   * Main entry point for all notifications
   *
   * @param input - Notification input
   * @returns Promise with send result
   */
  async sendNotification(input: SendNotificationInput): Promise<SendNotificationResult> {
    try {
      // Validate input
      const validation = this.validateInput(input);
      if (!validation.valid) {
        return {
          success: false,
          error: validation.error,
        };
      }

      // Check if user exists
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

      // Determine channels based on user preferences
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

      // Create notification record
      const notification = await this.createNotification({
        ...input,
        channels,
      });

      // Queue for async delivery
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
    } catch (error) {
      const err = error as Error;
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

  /**
   * Send notification to multiple users
   * Batch operation for announcements
   *
   * @param userIds - Array of user IDs
   * @param input - Notification input (without userId)
   * @returns Promise with results for each user
   */
  async sendToUsers(
    userIds: string[],
    input: Omit<SendNotificationInput, 'userId'>
  ): Promise<SendNotificationResult[]> {
    const results = await Promise.all(
      userIds.map((userId) =>
        this.sendNotification({ ...input, userId })
      )
    );

    const successCount = results.filter((r) => r.success).length;

    logger.info('[NotificationOrchestrator] Batch notification sent', {
      totalUsers: userIds.length,
      successCount,
      failureCount: userIds.length - successCount,
      type: input.type,
    });

    return results;
  }

  // ════════════════════════════════════════════════════════════════════════════════
  // CONVENIENCE METHODS - Pre-built notification types
  // ════════════════════════════════════════════════════════════════════════════════

  /**
   * Send batch created notification
   */
  async sendBatchCreatedNotification(
    userId: string,
    details: BatchNotificationDetails
  ): Promise<SendNotificationResult> {
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

  /**
   * Send batch status change notification
   */
  async sendBatchStatusNotification(
    userId: string,
    batchId: string,
    newStatus: string
  ): Promise<SendNotificationResult> {
    const statusMessages: Record<string, string> = {
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

  /**
   * Send certificate ready notification
   */
  async sendCertificateReadyNotification(
    userId: string,
    details: CertificateNotificationDetails
  ): Promise<SendNotificationResult> {
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

  /**
   * Send sensor alert notification
   * Critical alerts go via SMS too
   */
  async sendSensorAlertNotification(
    userId: string,
    details: SensorAlertDetails
  ): Promise<SendNotificationResult> {
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
      channels: ['PUSH', 'SMS', 'EMAIL'], // Critical: include SMS
      priority: 'CRITICAL',
    });
  }

  /**
   * Send order status notification
   */
  async sendOrderStatusNotification(
    userId: string,
    details: OrderNotificationDetails
  ): Promise<SendNotificationResult> {
    const statusMessages: Record<string, string> = {
      CONFIRMED: 'Tu orden ha sido confirmada',
      SHIPPED: 'Tu orden ha sido enviada',
      DELIVERED: 'Tu orden ha sido entregada',
      CANCELLED: 'Tu orden ha sido cancelada',
    };

    return await this.sendNotification({
      userId,
      type: `ORDER_${details.status}` as NotificationType,
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

  /**
   * Send payment received notification
   */
  async sendPaymentReceivedNotification(
    userId: string,
    orderId: string,
    amount: number,
    currency: string = 'MXN'
  ): Promise<SendNotificationResult> {
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

  /**
   * Send producer whitelisted notification
   */
  async sendProducerWhitelistedNotification(
    userId: string,
    producerName: string
  ): Promise<SendNotificationResult> {
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

  /**
   * Send system announcement to all users
   */
  async sendSystemAnnouncement(
    title: string,
    body: string,
    data?: NotificationData
  ): Promise<{ success: boolean; sentCount: number }> {
    try {
      // Get all active users
      const users = await prisma.user.findMany({
        where: { isActive: true },
        select: { id: true },
      });

      const results = await this.sendToUsers(
        users.map((u) => u.id),
        {
          type: 'SYSTEM_ANNOUNCEMENT',
          title,
          body,
          data,
          channels: ['PUSH', 'EMAIL'],
          priority: 'NORMAL',
        }
      );

      const successCount = results.filter((r) => r.success).length;

      return {
        success: true,
        sentCount: successCount,
      };
    } catch (error) {
      const err = error as Error;
      logger.error('[NotificationOrchestrator] System announcement failed', {
        error: err.message,
      });
      return { success: false, sentCount: 0 };
    }
  }

  /**
   * Send welcome notification to new user
   */
  async sendWelcomeNotification(
    userId: string,
    userName: string
  ): Promise<SendNotificationResult> {
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

  // ════════════════════════════════════════════════════════════════════════════════
  // QUERY METHODS
  // ════════════════════════════════════════════════════════════════════════════════

  /**
   * Get notification by ID
   */
  async getNotification(id: string) {
    return await prisma.notification.findUnique({
      where: { id },
      include: {
        deliveryLogs: true,
      },
    });
  }

  /**
   * Get user notifications
   */
  async getUserNotifications(userId: string, options?: GetNotificationsOptions) {
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

  /**
   * Get unread count for user
   */
  async getUnreadCount(userId: string): Promise<number> {
    return await prisma.notification.count({
      where: {
        userId,
        readAt: null,
        status: { in: ['SENT', 'DELIVERED'] },
      },
    });
  }

  /**
   * Mark notification as read
   */
  async markAsRead(notificationId: string): Promise<void> {
    await prisma.notification.update({
      where: { id: notificationId },
      data: { readAt: new Date() },
    });
  }

  /**
   * Mark all as read for user
   */
  async markAllAsRead(userId: string): Promise<void> {
    await prisma.notification.updateMany({
      where: {
        userId,
        readAt: null,
      },
      data: { readAt: new Date() },
    });
  }

  /**
   * Mark notification as clicked
   */
  async markAsClicked(notificationId: string): Promise<void> {
    await prisma.notification.update({
      where: { id: notificationId },
      data: {
        clickedAt: new Date(),
        status: 'CLICKED',
      },
    });
  }

  /**
   * Delete notification
   */
  async deleteNotification(notificationId: string): Promise<void> {
    await prisma.notification.delete({
      where: { id: notificationId },
    });
  }

  /**
   * Get notification statistics
   */
  async getStats(userId?: string) {
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

  // ════════════════════════════════════════════════════════════════════════════════
  // PRIVATE HELPER METHODS
  // ════════════════════════════════════════════════════════════════════════════════

  /**
   * Validate notification input
   */
  private validateInput(input: SendNotificationInput): { valid: boolean; error?: string } {
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

  /**
   * Determine which channels to use based on user preferences
   */
  private async determineChannels(
    userId: string,
    requestedChannels: NotificationChannel[]
  ): Promise<NotificationChannel[]> {
    try {
      // Get user preferences
      const preferences = await prisma.notificationPreference.findUnique({
        where: { userId },
      });

      // If no preferences, return all requested channels
      if (!preferences) {
        return requestedChannels;
      }

      // Filter channels based on user preferences
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
            return true; // Always allow in-app
          default:
            return true;
        }
      });

      return allowedChannels;
    } catch (error) {
      const err = error as Error;
      logger.error('[NotificationOrchestrator] Failed to determine channels', {
        error: err.message,
        userId,
      });

      // Fallback: return all requested channels
      return requestedChannels;
    }
  }

  /**
   * Create notification record in database
   */
  private async createNotification(
    input: SendNotificationInput & { channels: NotificationChannel[] }
  ) {
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

// Export singleton instance
export const notificationOrchestrator = NotificationOrchestrator.getInstance();
export default notificationOrchestrator;
