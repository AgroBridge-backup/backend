/**
 * @file Notification API Routes
 * @description REST API endpoints for notification management
 *
 * Endpoints:
 * - POST   /devices             - Register device token for push notifications
 * - DELETE /devices/:token      - Unregister device token
 * - GET    /                    - Get user notifications
 * - GET    /unread-count        - Get unread notification count
 * - GET    /:id                 - Get notification by ID
 * - PUT    /:id/read            - Mark notification as read
 * - PUT    /:id/clicked         - Mark notification as clicked
 * - PUT    /read-all            - Mark all notifications as read
 * - DELETE /:id                 - Delete notification
 * - GET    /stats               - Get notification statistics
 * - POST   /test                - Send test notification (admin only)
 * - GET    /preferences         - Get user notification preferences
 * - PUT    /preferences         - Update user notification preferences
 *
 * @author AgroBridge Engineering Team
 */

import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { PrismaClient, Platform, NotificationChannel, UserRole } from '@prisma/client';
import { authenticate } from '../middlewares/auth.middleware.js';
import { validateRequest } from '../middlewares/validator.middleware.js';
import { notificationOrchestrator } from '../../infrastructure/notifications/NotificationOrchestrator.js';
import { notificationQueue } from '../../infrastructure/notifications/queue/NotificationQueue.js';
import logger from '../../shared/utils/logger.js';

// Type alias for authenticated requests (uses global Express.Request augmentation)
type AuthenticatedRequest = Request;

const prisma = new PrismaClient();

export function createNotificationsRouter() {
  const router = Router();

  // ════════════════════════════════════════════════════════════════════════════════
  // VALIDATION SCHEMAS
  // ════════════════════════════════════════════════════════════════════════════════

  const registerDeviceSchema = z.object({
    body: z.object({
      token: z.string().min(1, 'Device token is required'),
      platform: z.enum(['IOS', 'ANDROID', 'WEB']),
      deviceInfo: z.record(z.unknown()).optional(),
    }),
  });

  const sendNotificationSchema = z.object({
    body: z.object({
      userId: z.string().uuid('Invalid user ID'),
      type: z.string(),
      title: z.string().min(1).max(255),
      body: z.string().min(1).max(5000),
      data: z.record(z.unknown()).optional(),
      channels: z.array(z.enum(['PUSH', 'EMAIL', 'SMS', 'WHATSAPP', 'IN_APP'])).min(1),
      priority: z.enum(['CRITICAL', 'HIGH', 'NORMAL', 'LOW']).optional(),
    }),
  });

  const updatePreferencesSchema = z.object({
    body: z.object({
      pushEnabled: z.boolean().optional(),
      emailEnabled: z.boolean().optional(),
      smsEnabled: z.boolean().optional(),
      whatsappEnabled: z.boolean().optional(),
      phoneNumber: z.string().regex(/^\+[1-9]\d{7,14}$/, 'Invalid phone number format').optional(),
      quietHoursEnabled: z.boolean().optional(),
      quietHoursStart: z.string().regex(/^\d{2}:\d{2}$/, 'Invalid time format (HH:MM)').optional(),
      quietHoursEnd: z.string().regex(/^\d{2}:\d{2}$/, 'Invalid time format (HH:MM)').optional(),
      timezone: z.string().optional(),
    }),
  });

  // ════════════════════════════════════════════════════════════════════════════════
  // DEVICE TOKEN ROUTES
  // ════════════════════════════════════════════════════════════════════════════════

  /**
   * POST /notifications/devices
   * Register device token for push notifications
   */
  router.post(
    '/devices',
    authenticate(),
    validateRequest(registerDeviceSchema),
    async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      try {
        const { token, platform, deviceInfo } = req.body;
        const userId = req.user!.userId;

        // Upsert device token (create or update if exists)
        const device = await prisma.deviceToken.upsert({
          where: { token },
          update: {
            userId, // Update ownership if token was from another user
            active: true,
            lastUsedAt: new Date(),
            deviceInfo: deviceInfo || undefined,
          },
          create: {
            userId,
            token,
            platform: platform as Platform,
            deviceInfo: deviceInfo || undefined,
            active: true,
          },
        });

        logger.info('[NotificationsRoute] Device registered', {
          userId,
          deviceId: device.id,
          platform,
        });

        res.status(200).json({
          success: true,
          deviceId: device.id,
        });
      } catch (error) {
        next(error);
      }
    }
  );

  /**
   * DELETE /notifications/devices/:token
   * Unregister device token
   */
  router.delete(
    '/devices/:token',
    authenticate(),
    async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      try {
        const { token } = req.params;
        const userId = req.user!.userId;

        // Deactivate token (don't delete for audit trail)
        await prisma.deviceToken.updateMany({
          where: { token, userId },
          data: { active: false },
        });

        res.status(200).json({ success: true });
      } catch (error) {
        next(error);
      }
    }
  );

  // ════════════════════════════════════════════════════════════════════════════════
  // NOTIFICATION ROUTES
  // ════════════════════════════════════════════════════════════════════════════════

  /**
   * GET /notifications
   * Get user notifications with pagination
   */
  router.get(
    '/',
    authenticate(),
    async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      try {
        const userId = req.user!.userId;
        const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
        const offset = parseInt(req.query.offset as string) || 0;
        const unreadOnly = req.query.unreadOnly === 'true';

        const notifications = await notificationOrchestrator.getUserNotifications(userId, {
          limit,
          offset,
          unreadOnly,
        });

        const unreadCount = await notificationOrchestrator.getUnreadCount(userId);

        res.status(200).json({
          notifications,
          unreadCount,
          pagination: {
            limit,
            offset,
            hasMore: notifications.length === limit,
          },
        });
      } catch (error) {
        next(error);
      }
    }
  );

  /**
   * GET /notifications/unread-count
   * Get unread notification count
   */
  router.get(
    '/unread-count',
    authenticate(),
    async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      try {
        const userId = req.user!.userId;
        const count = await notificationOrchestrator.getUnreadCount(userId);

        res.status(200).json({ count });
      } catch (error) {
        next(error);
      }
    }
  );

  /**
   * GET /notifications/stats
   * Get notification statistics for user
   */
  router.get(
    '/stats',
    authenticate(),
    async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      try {
        const userId = req.user!.userId;
        const stats = await notificationOrchestrator.getStats(userId);

        res.status(200).json(stats);
      } catch (error) {
        next(error);
      }
    }
  );

  /**
   * GET /notifications/preferences
   * Get user notification preferences
   */
  router.get(
    '/preferences',
    authenticate(),
    async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      try {
        const userId = req.user!.userId;

        let preferences = await prisma.notificationPreference.findUnique({
          where: { userId },
        });

        // Create default preferences if not exists
        if (!preferences) {
          preferences = await prisma.notificationPreference.create({
            data: {
              userId,
              pushEnabled: true,
              emailEnabled: true,
              smsEnabled: false,
              whatsappEnabled: false,
            },
          });
        }

        res.status(200).json(preferences);
      } catch (error) {
        next(error);
      }
    }
  );

  /**
   * PUT /notifications/preferences
   * Update user notification preferences
   */
  router.put(
    '/preferences',
    authenticate(),
    validateRequest(updatePreferencesSchema),
    async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      try {
        const userId = req.user!.userId;

        const preferences = await prisma.notificationPreference.upsert({
          where: { userId },
          update: req.body,
          create: {
            userId,
            ...req.body,
          },
        });

        logger.info('[NotificationsRoute] Preferences updated', {
          userId,
          changes: Object.keys(req.body),
        });

        res.status(200).json(preferences);
      } catch (error) {
        next(error);
      }
    }
  );

  /**
   * GET /notifications/:id
   * Get notification by ID
   */
  router.get(
    '/:id',
    authenticate(),
    async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      try {
        const { id } = req.params;
        const userId = req.user!.userId;

        const notification = await notificationOrchestrator.getNotification(id);

        if (!notification) {
          return res.status(404).json({ error: 'Notification not found' });
        }

        // Check ownership
        if (notification.userId !== userId) {
          return res.status(403).json({ error: 'Access denied' });
        }

        res.status(200).json(notification);
      } catch (error) {
        next(error);
      }
    }
  );

  /**
   * PUT /notifications/:id/read
   * Mark notification as read
   */
  router.put(
    '/:id/read',
    authenticate(),
    async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      try {
        const { id } = req.params;
        const userId = req.user!.userId;

        const notification = await notificationOrchestrator.getNotification(id);

        if (!notification) {
          return res.status(404).json({ error: 'Notification not found' });
        }

        if (notification.userId !== userId) {
          return res.status(403).json({ error: 'Access denied' });
        }

        await notificationOrchestrator.markAsRead(id);

        res.status(200).json({ success: true });
      } catch (error) {
        next(error);
      }
    }
  );

  /**
   * PUT /notifications/:id/clicked
   * Mark notification as clicked
   */
  router.put(
    '/:id/clicked',
    authenticate(),
    async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      try {
        const { id } = req.params;
        const userId = req.user!.userId;

        const notification = await notificationOrchestrator.getNotification(id);

        if (!notification) {
          return res.status(404).json({ error: 'Notification not found' });
        }

        if (notification.userId !== userId) {
          return res.status(403).json({ error: 'Access denied' });
        }

        await notificationOrchestrator.markAsClicked(id);

        res.status(200).json({ success: true });
      } catch (error) {
        next(error);
      }
    }
  );

  /**
   * PUT /notifications/read-all
   * Mark all notifications as read
   */
  router.put(
    '/read-all',
    authenticate(),
    async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      try {
        const userId = req.user!.userId;
        await notificationOrchestrator.markAllAsRead(userId);

        res.status(200).json({ success: true });
      } catch (error) {
        next(error);
      }
    }
  );

  /**
   * DELETE /notifications/:id
   * Delete notification
   */
  router.delete(
    '/:id',
    authenticate(),
    async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      try {
        const { id } = req.params;
        const userId = req.user!.userId;

        const notification = await notificationOrchestrator.getNotification(id);

        if (!notification) {
          return res.status(404).json({ error: 'Notification not found' });
        }

        if (notification.userId !== userId) {
          return res.status(403).json({ error: 'Access denied' });
        }

        await notificationOrchestrator.deleteNotification(id);

        res.status(200).json({ success: true });
      } catch (error) {
        next(error);
      }
    }
  );

  // ════════════════════════════════════════════════════════════════════════════════
  // ADMIN ROUTES
  // ════════════════════════════════════════════════════════════════════════════════

  /**
   * POST /notifications/test
   * Send test notification (admin only)
   */
  router.post(
    '/test',
    authenticate([UserRole.ADMIN]),
    validateRequest(sendNotificationSchema),
    async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      try {
        const { userId, type, title, body, data, channels, priority } = req.body;

        const result = await notificationOrchestrator.sendNotification({
          userId,
          type: type as any,
          title,
          body,
          data,
          channels: channels as NotificationChannel[],
          priority: priority as any,
        });

        res.status(result.success ? 200 : 400).json(result);
      } catch (error) {
        next(error);
      }
    }
  );

  /**
   * GET /notifications/queue/stats
   * Get queue statistics (admin only)
   */
  router.get(
    '/queue/stats',
    authenticate([UserRole.ADMIN]),
    async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      try {
        const stats = await notificationQueue.getStats();
        res.status(200).json(stats);
      } catch (error) {
        next(error);
      }
    }
  );

  /**
   * POST /notifications/queue/pause
   * Pause notification queue (admin only)
   */
  router.post(
    '/queue/pause',
    authenticate([UserRole.ADMIN]),
    async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      try {
        await notificationQueue.pause();
        res.status(200).json({ success: true, message: 'Queue paused' });
      } catch (error) {
        next(error);
      }
    }
  );

  /**
   * POST /notifications/queue/resume
   * Resume notification queue (admin only)
   */
  router.post(
    '/queue/resume',
    authenticate([UserRole.ADMIN]),
    async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      try {
        await notificationQueue.resume();
        res.status(200).json({ success: true, message: 'Queue resumed' });
      } catch (error) {
        next(error);
      }
    }
  );

  /**
   * POST /notifications/queue/clean
   * Clean old jobs from queue (admin only)
   */
  router.post(
    '/queue/clean',
    authenticate([UserRole.ADMIN]),
    async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      try {
        const hours = parseInt(req.body.hours as string) || 24;
        await notificationQueue.clean(hours);
        res.status(200).json({
          success: true,
          message: `Cleaned jobs older than ${hours} hours`,
        });
      } catch (error) {
        next(error);
      }
    }
  );

  /**
   * POST /notifications/broadcast
   * Send notification to all users (admin only)
   */
  router.post(
    '/broadcast',
    authenticate([UserRole.ADMIN]),
    async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      try {
        const { title, body, data } = req.body;

        if (!title || !body) {
          return res.status(400).json({ error: 'title and body are required' });
        }

        const result = await notificationOrchestrator.sendSystemAnnouncement(title, body, data);

        res.status(200).json(result);
      } catch (error) {
        next(error);
      }
    }
  );

  return router;
}

export default createNotificationsRouter;
