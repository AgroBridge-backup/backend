import { Router } from 'express';
import { z } from 'zod';
import { PrismaClient, UserRole } from '@prisma/client';
import { authenticate } from '../middlewares/auth.middleware.js';
import { validateRequest } from '../middlewares/validator.middleware.js';
import { notificationOrchestrator } from '../../infrastructure/notifications/NotificationOrchestrator.js';
import { notificationQueue } from '../../infrastructure/notifications/queue/NotificationQueue.js';
import logger from '../../shared/utils/logger.js';
const prisma = new PrismaClient();
export function createNotificationsRouter() {
    const router = Router();
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
    router.post('/devices', authenticate(), validateRequest(registerDeviceSchema), async (req, res, next) => {
        try {
            const { token, platform, deviceInfo } = req.body;
            const userId = req.user.userId;
            const device = await prisma.deviceToken.upsert({
                where: { token },
                update: {
                    userId,
                    active: true,
                    lastUsedAt: new Date(),
                    deviceInfo: deviceInfo || undefined,
                },
                create: {
                    userId,
                    token,
                    platform: platform,
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
        }
        catch (error) {
            next(error);
        }
    });
    router.delete('/devices/:token', authenticate(), async (req, res, next) => {
        try {
            const { token } = req.params;
            const userId = req.user.userId;
            await prisma.deviceToken.updateMany({
                where: { token, userId },
                data: { active: false },
            });
            res.status(200).json({ success: true });
        }
        catch (error) {
            next(error);
        }
    });
    router.get('/', authenticate(), async (req, res, next) => {
        try {
            const userId = req.user.userId;
            const limit = Math.min(parseInt(req.query.limit) || 50, 100);
            const offset = parseInt(req.query.offset) || 0;
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
        }
        catch (error) {
            next(error);
        }
    });
    router.get('/unread-count', authenticate(), async (req, res, next) => {
        try {
            const userId = req.user.userId;
            const count = await notificationOrchestrator.getUnreadCount(userId);
            res.status(200).json({ count });
        }
        catch (error) {
            next(error);
        }
    });
    router.get('/stats', authenticate(), async (req, res, next) => {
        try {
            const userId = req.user.userId;
            const stats = await notificationOrchestrator.getStats(userId);
            res.status(200).json(stats);
        }
        catch (error) {
            next(error);
        }
    });
    router.get('/preferences', authenticate(), async (req, res, next) => {
        try {
            const userId = req.user.userId;
            let preferences = await prisma.notificationPreference.findUnique({
                where: { userId },
            });
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
        }
        catch (error) {
            next(error);
        }
    });
    router.put('/preferences', authenticate(), validateRequest(updatePreferencesSchema), async (req, res, next) => {
        try {
            const userId = req.user.userId;
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
        }
        catch (error) {
            next(error);
        }
    });
    router.get('/:id', authenticate(), async (req, res, next) => {
        try {
            const { id } = req.params;
            const userId = req.user.userId;
            const notification = await notificationOrchestrator.getNotification(id);
            if (!notification) {
                return res.status(404).json({ error: 'Notification not found' });
            }
            if (notification.userId !== userId) {
                return res.status(403).json({ error: 'Access denied' });
            }
            res.status(200).json(notification);
        }
        catch (error) {
            next(error);
        }
    });
    router.put('/:id/read', authenticate(), async (req, res, next) => {
        try {
            const { id } = req.params;
            const userId = req.user.userId;
            const notification = await notificationOrchestrator.getNotification(id);
            if (!notification) {
                return res.status(404).json({ error: 'Notification not found' });
            }
            if (notification.userId !== userId) {
                return res.status(403).json({ error: 'Access denied' });
            }
            await notificationOrchestrator.markAsRead(id);
            res.status(200).json({ success: true });
        }
        catch (error) {
            next(error);
        }
    });
    router.put('/:id/clicked', authenticate(), async (req, res, next) => {
        try {
            const { id } = req.params;
            const userId = req.user.userId;
            const notification = await notificationOrchestrator.getNotification(id);
            if (!notification) {
                return res.status(404).json({ error: 'Notification not found' });
            }
            if (notification.userId !== userId) {
                return res.status(403).json({ error: 'Access denied' });
            }
            await notificationOrchestrator.markAsClicked(id);
            res.status(200).json({ success: true });
        }
        catch (error) {
            next(error);
        }
    });
    router.put('/read-all', authenticate(), async (req, res, next) => {
        try {
            const userId = req.user.userId;
            await notificationOrchestrator.markAllAsRead(userId);
            res.status(200).json({ success: true });
        }
        catch (error) {
            next(error);
        }
    });
    router.delete('/:id', authenticate(), async (req, res, next) => {
        try {
            const { id } = req.params;
            const userId = req.user.userId;
            const notification = await notificationOrchestrator.getNotification(id);
            if (!notification) {
                return res.status(404).json({ error: 'Notification not found' });
            }
            if (notification.userId !== userId) {
                return res.status(403).json({ error: 'Access denied' });
            }
            await notificationOrchestrator.deleteNotification(id);
            res.status(200).json({ success: true });
        }
        catch (error) {
            next(error);
        }
    });
    router.post('/test', authenticate([UserRole.ADMIN]), validateRequest(sendNotificationSchema), async (req, res, next) => {
        try {
            const { userId, type, title, body, data, channels, priority } = req.body;
            const result = await notificationOrchestrator.sendNotification({
                userId,
                type: type,
                title,
                body,
                data,
                channels: channels,
                priority: priority,
            });
            res.status(result.success ? 200 : 400).json(result);
        }
        catch (error) {
            next(error);
        }
    });
    router.get('/queue/stats', authenticate([UserRole.ADMIN]), async (req, res, next) => {
        try {
            const stats = await notificationQueue.getStats();
            res.status(200).json(stats);
        }
        catch (error) {
            next(error);
        }
    });
    router.post('/queue/pause', authenticate([UserRole.ADMIN]), async (req, res, next) => {
        try {
            await notificationQueue.pause();
            res.status(200).json({ success: true, message: 'Queue paused' });
        }
        catch (error) {
            next(error);
        }
    });
    router.post('/queue/resume', authenticate([UserRole.ADMIN]), async (req, res, next) => {
        try {
            await notificationQueue.resume();
            res.status(200).json({ success: true, message: 'Queue resumed' });
        }
        catch (error) {
            next(error);
        }
    });
    router.post('/queue/clean', authenticate([UserRole.ADMIN]), async (req, res, next) => {
        try {
            const hours = parseInt(req.body.hours) || 24;
            await notificationQueue.clean(hours);
            res.status(200).json({
                success: true,
                message: `Cleaned jobs older than ${hours} hours`,
            });
        }
        catch (error) {
            next(error);
        }
    });
    router.post('/broadcast', authenticate([UserRole.ADMIN]), async (req, res, next) => {
        try {
            const { title, body, data } = req.body;
            if (!title || !body) {
                return res.status(400).json({ error: 'title and body are required' });
            }
            const result = await notificationOrchestrator.sendSystemAnnouncement(title, body, data);
            res.status(200).json(result);
        }
        catch (error) {
            next(error);
        }
    });
    return router;
}
export default createNotificationsRouter;
