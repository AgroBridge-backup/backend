import { webSocketServer } from './WebSocketServer.js';
import logger from '../../shared/utils/logger.js';
export function emitBatchStatusUpdate(batchId, status, updatedBy) {
    if (!webSocketServer.isRunning()) {
        logger.debug('[WebSocketEmitter] Server not running, skipping batch update');
        return;
    }
    const event = {
        batchId,
        status,
        updatedAt: new Date(),
        updatedBy,
    };
    webSocketServer.emitBatchUpdate(batchId, event);
}
export function emitBatchCreated(batch) {
    if (!webSocketServer.isRunning())
        return;
    webSocketServer.emitToAdmins('batch:created', {
        ...batch,
        createdAt: new Date(),
    });
    webSocketServer.emitProducerUpdate(batch.producerId, {
        action: 'batch_created',
        details: {
            batchId: batch.id,
            variety: batch.variety,
        },
    });
}
export function emitBatchVerified(batchId, verifiedBy, blockchainHash) {
    if (!webSocketServer.isRunning())
        return;
    webSocketServer.emitBatchUpdate(batchId, {
        batchId,
        status: 'VERIFIED',
        updatedAt: new Date(),
        updatedBy: verifiedBy,
    });
    webSocketServer.emitToAdmins('batch:verified', {
        batchId,
        verifiedBy,
        blockchainHash,
        timestamp: new Date(),
    });
}
export function emitTraceabilityEventCreated(event) {
    if (!webSocketServer.isRunning())
        return;
    const wsEvent = {
        eventId: event.id,
        batchId: event.batchId,
        eventType: event.eventType,
        timestamp: event.timestamp,
        locationName: event.locationName,
        isVerified: event.isVerified,
    };
    webSocketServer.emitEventCreated(wsEvent);
}
export function emitEventVerified(eventId, batchId, verifiedBy, blockchainTxHash) {
    if (!webSocketServer.isRunning())
        return;
    webSocketServer.emitBatchUpdate(batchId, {
        batchId,
        status: 'EVENT_VERIFIED',
        updatedAt: new Date(),
        updatedBy: verifiedBy,
    });
    webSocketServer.emitToAdmins('event:verified', {
        eventId,
        batchId,
        verifiedBy,
        blockchainTxHash,
        timestamp: new Date(),
    });
}
export function emitProducerWhitelisted(producerId, producerName, whitelistedBy) {
    if (!webSocketServer.isRunning())
        return;
    webSocketServer.emitProducerUpdate(producerId, {
        action: 'whitelisted',
        details: {
            producerName,
            whitelistedBy,
            timestamp: new Date(),
        },
    });
}
export function emitProducerSuspended(producerId, reason, suspendedBy) {
    if (!webSocketServer.isRunning())
        return;
    webSocketServer.emitProducerUpdate(producerId, {
        action: 'suspended',
        details: {
            reason,
            suspendedBy,
            timestamp: new Date(),
        },
    });
}
export function emitNotificationToUser(userId, notification) {
    if (!webSocketServer.isRunning())
        return;
    const wsNotification = {
        ...notification,
        createdAt: new Date(),
    };
    webSocketServer.emitNotification(userId, wsNotification);
}
export function emitUnreadCountUpdate(userId, unreadCount) {
    if (!webSocketServer.isRunning())
        return;
    webSocketServer.emitToUser(userId, 'notifications:unreadCount', {
        count: unreadCount,
        timestamp: new Date(),
    });
}
export function emitSubscriptionUpdated(userId, subscription) {
    if (!webSocketServer.isRunning())
        return;
    webSocketServer.emitToUser(userId, 'subscription:updated', {
        ...subscription,
        timestamp: new Date(),
    });
}
export function emitPaymentReceived(userId, payment) {
    if (!webSocketServer.isRunning())
        return;
    webSocketServer.emitToUser(userId, 'payment:received', {
        ...payment,
        timestamp: new Date(),
    });
}
export function emitPaymentFailed(userId, error) {
    if (!webSocketServer.isRunning())
        return;
    webSocketServer.emitToUser(userId, 'payment:failed', {
        ...error,
        timestamp: new Date(),
    });
}
export function emitReportReady(userId, report) {
    if (!webSocketServer.isRunning())
        return;
    webSocketServer.emitToUser(userId, 'report:ready', {
        ...report,
        timestamp: new Date(),
    });
}
export function emitReportFailed(userId, report) {
    if (!webSocketServer.isRunning())
        return;
    webSocketServer.emitToUser(userId, 'report:failed', {
        ...report,
        timestamp: new Date(),
    });
}
export function emitSystemAnnouncement(message, data) {
    if (!webSocketServer.isRunning())
        return;
    webSocketServer.emitSystemAnnouncement(message, data);
}
export function emitMaintenanceMode(enabled, message, estimatedEndTime) {
    if (!webSocketServer.isRunning())
        return;
    webSocketServer.emitSystemAnnouncement(enabled ? 'Sistema en mantenimiento' : 'Mantenimiento completado', {
        maintenanceMode: enabled,
        message,
        estimatedEndTime,
    });
}
export function emitAdminAlert(type, message, details) {
    if (!webSocketServer.isRunning())
        return;
    webSocketServer.emitToAdmins('admin:alert', {
        type,
        message,
        details,
        timestamp: new Date(),
    });
}
export function emitUsageThresholdAlert(userId, resourceType, currentUsage, limit, percentUsed) {
    if (!webSocketServer.isRunning())
        return;
    webSocketServer.emitToUser(userId, 'usage:threshold', {
        resourceType,
        currentUsage,
        limit,
        percentUsed,
        timestamp: new Date(),
    });
    if (percentUsed >= 90) {
        emitAdminAlert('warning', `User approaching ${resourceType} limit`, {
            userId,
            resourceType,
            percentUsed,
        });
    }
}
