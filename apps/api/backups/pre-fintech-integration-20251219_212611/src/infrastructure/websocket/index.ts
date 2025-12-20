/**
 * @file WebSocket Module Index
 * @description Export WebSocket server and event emitters
 *
 * @author AgroBridge Engineering Team
 */

export { WebSocketServer, webSocketServer } from './WebSocketServer.js';
export type { AuthenticatedSocket, WebSocketMetrics, BatchUpdateEvent, EventCreatedEvent, NotificationEvent } from './WebSocketServer.js';

export {
  // Batch events
  emitBatchStatusUpdate,
  emitBatchCreated,
  emitBatchVerified,
  // Traceability events
  emitTraceabilityEventCreated,
  emitEventVerified,
  // Producer events
  emitProducerWhitelisted,
  emitProducerSuspended,
  // Notification events
  emitNotificationToUser,
  emitUnreadCountUpdate,
  // Payment events
  emitSubscriptionUpdated,
  emitPaymentReceived,
  emitPaymentFailed,
  // Report events
  emitReportReady,
  emitReportFailed,
  // System events
  emitSystemAnnouncement,
  emitMaintenanceMode,
  // Admin events
  emitAdminAlert,
  emitUsageThresholdAlert,
} from './WebSocketEventEmitter.js';
