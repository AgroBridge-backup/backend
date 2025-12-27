/**
 * @file WebSocket Event Emitter
 * @description Utility functions to emit WebSocket events from anywhere in the app
 *
 * This provides a clean interface for services to emit real-time updates
 * without directly depending on the WebSocket server implementation.
 *
 * @author AgroBridge Engineering Team
 */

import {
  webSocketServer,
  BatchUpdateEvent,
  EventCreatedEvent,
  NotificationEvent,
} from "./WebSocketServer.js";
import logger from "../../shared/utils/logger.js";

// ═══════════════════════════════════════════════════════════════════════════════
// BATCH EVENTS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Emit batch status update
 */
export function emitBatchStatusUpdate(
  batchId: string,
  status: string,
  updatedBy?: string,
): void {
  if (!webSocketServer.isRunning()) {
    logger.debug(
      "[WebSocketEmitter] Server not running, skipping batch update",
    );
    return;
  }

  const event: BatchUpdateEvent = {
    batchId,
    status,
    updatedAt: new Date(),
    updatedBy,
  };

  webSocketServer.emitBatchUpdate(batchId, event);
}

/**
 * Emit batch created event
 */
export function emitBatchCreated(batch: {
  id: string;
  variety: string;
  origin: string;
  weightKg: number;
  producerId: string;
  producerName: string;
}): void {
  if (!webSocketServer.isRunning()) return;

  webSocketServer.emitToAdmins("batch:created", {
    ...batch,
    createdAt: new Date(),
  });

  webSocketServer.emitProducerUpdate(batch.producerId, {
    action: "batch_created",
    details: {
      batchId: batch.id,
      variety: batch.variety,
    },
  });
}

/**
 * Emit batch verification event
 */
export function emitBatchVerified(
  batchId: string,
  verifiedBy: string,
  blockchainHash: string,
): void {
  if (!webSocketServer.isRunning()) return;

  webSocketServer.emitBatchUpdate(batchId, {
    batchId,
    status: "VERIFIED",
    updatedAt: new Date(),
    updatedBy: verifiedBy,
  });

  webSocketServer.emitToAdmins("batch:verified", {
    batchId,
    verifiedBy,
    blockchainHash,
    timestamp: new Date(),
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// TRACEABILITY EVENT EVENTS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Emit traceability event created
 */
export function emitTraceabilityEventCreated(event: {
  id: string;
  batchId: string;
  eventType: string;
  timestamp: Date;
  locationName?: string;
  latitude?: number;
  longitude?: number;
  temperature?: number;
  humidity?: number;
  isVerified: boolean;
  createdBy: string;
}): void {
  if (!webSocketServer.isRunning()) return;

  const wsEvent: EventCreatedEvent = {
    eventId: event.id,
    batchId: event.batchId,
    eventType: event.eventType,
    timestamp: event.timestamp,
    locationName: event.locationName,
    isVerified: event.isVerified,
  };

  webSocketServer.emitEventCreated(wsEvent);
}

/**
 * Emit event verification
 */
export function emitEventVerified(
  eventId: string,
  batchId: string,
  verifiedBy: string,
  blockchainTxHash: string,
): void {
  if (!webSocketServer.isRunning()) return;

  webSocketServer.emitBatchUpdate(batchId, {
    batchId,
    status: "EVENT_VERIFIED",
    updatedAt: new Date(),
    updatedBy: verifiedBy,
  });

  webSocketServer.emitToAdmins("event:verified", {
    eventId,
    batchId,
    verifiedBy,
    blockchainTxHash,
    timestamp: new Date(),
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// PRODUCER EVENTS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Emit producer whitelisted
 */
export function emitProducerWhitelisted(
  producerId: string,
  producerName: string,
  whitelistedBy: string,
): void {
  if (!webSocketServer.isRunning()) return;

  webSocketServer.emitProducerUpdate(producerId, {
    action: "whitelisted",
    details: {
      producerName,
      whitelistedBy,
      timestamp: new Date(),
    },
  });
}

/**
 * Emit producer suspended
 */
export function emitProducerSuspended(
  producerId: string,
  reason: string,
  suspendedBy: string,
): void {
  if (!webSocketServer.isRunning()) return;

  webSocketServer.emitProducerUpdate(producerId, {
    action: "suspended",
    details: {
      reason,
      suspendedBy,
      timestamp: new Date(),
    },
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// NOTIFICATION EVENTS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Emit notification to user
 */
export function emitNotificationToUser(
  userId: string,
  notification: {
    id: string;
    type: string;
    title: string;
    body: string;
    data?: Record<string, unknown>;
  },
): void {
  if (!webSocketServer.isRunning()) return;

  const wsNotification: NotificationEvent = {
    ...notification,
    createdAt: new Date(),
  };

  webSocketServer.emitNotification(userId, wsNotification);
}

/**
 * Emit unread count update
 */
export function emitUnreadCountUpdate(
  userId: string,
  unreadCount: number,
): void {
  if (!webSocketServer.isRunning()) return;

  webSocketServer.emitToUser(userId, "notifications:unreadCount", {
    count: unreadCount,
    timestamp: new Date(),
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// PAYMENT EVENTS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Emit subscription updated
 */
export function emitSubscriptionUpdated(
  userId: string,
  subscription: {
    tier: string;
    status: string;
    currentPeriodEnd?: Date;
  },
): void {
  if (!webSocketServer.isRunning()) return;

  webSocketServer.emitToUser(userId, "subscription:updated", {
    ...subscription,
    timestamp: new Date(),
  });
}

/**
 * Emit payment received
 */
export function emitPaymentReceived(
  userId: string,
  payment: {
    amount: number;
    currency: string;
    status: string;
  },
): void {
  if (!webSocketServer.isRunning()) return;

  webSocketServer.emitToUser(userId, "payment:received", {
    ...payment,
    timestamp: new Date(),
  });
}

/**
 * Emit payment failed
 */
export function emitPaymentFailed(
  userId: string,
  error: {
    code: string;
    message: string;
  },
): void {
  if (!webSocketServer.isRunning()) return;

  webSocketServer.emitToUser(userId, "payment:failed", {
    ...error,
    timestamp: new Date(),
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// REPORT EVENTS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Emit report ready
 */
export function emitReportReady(
  userId: string,
  report: {
    id: string;
    name: string;
    type: string;
    format: string;
    downloadUrl?: string;
  },
): void {
  if (!webSocketServer.isRunning()) return;

  webSocketServer.emitToUser(userId, "report:ready", {
    ...report,
    timestamp: new Date(),
  });
}

/**
 * Emit report failed
 */
export function emitReportFailed(
  userId: string,
  report: {
    id: string;
    name: string;
    error: string;
  },
): void {
  if (!webSocketServer.isRunning()) return;

  webSocketServer.emitToUser(userId, "report:failed", {
    ...report,
    timestamp: new Date(),
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// SYSTEM EVENTS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Emit system announcement
 */
export function emitSystemAnnouncement(
  message: string,
  data?: Record<string, unknown>,
): void {
  if (!webSocketServer.isRunning()) return;

  webSocketServer.emitSystemAnnouncement(message, data);
}

/**
 * Emit maintenance mode notification
 */
export function emitMaintenanceMode(
  enabled: boolean,
  message?: string,
  estimatedEndTime?: Date,
): void {
  if (!webSocketServer.isRunning()) return;

  webSocketServer.emitSystemAnnouncement(
    enabled ? "Sistema en mantenimiento" : "Mantenimiento completado",
    {
      maintenanceMode: enabled,
      message,
      estimatedEndTime,
    },
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// ADMIN EVENTS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Emit admin alert
 */
export function emitAdminAlert(
  type: "info" | "warning" | "error" | "critical",
  message: string,
  details?: Record<string, unknown>,
): void {
  if (!webSocketServer.isRunning()) return;

  webSocketServer.emitToAdmins("admin:alert", {
    type,
    message,
    details,
    timestamp: new Date(),
  });
}

/**
 * Emit usage threshold alert
 */
export function emitUsageThresholdAlert(
  userId: string,
  resourceType: "batches" | "apiCalls" | "storage",
  currentUsage: number,
  limit: number,
  percentUsed: number,
): void {
  if (!webSocketServer.isRunning()) return;

  // Notify user
  webSocketServer.emitToUser(userId, "usage:threshold", {
    resourceType,
    currentUsage,
    limit,
    percentUsed,
    timestamp: new Date(),
  });

  // Notify admins if critical
  if (percentUsed >= 90) {
    emitAdminAlert("warning", `User approaching ${resourceType} limit`, {
      userId,
      resourceType,
      percentUsed,
    });
  }
}
