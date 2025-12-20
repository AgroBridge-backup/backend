/**
 * @file Notification System Module Index
 * @description Central export point for the notification system
 *
 * This module provides enterprise-grade multi-channel notification delivery:
 * - Push Notifications (FCM for Android, APNs for iOS)
 * - Email (SendGrid)
 * - SMS/WhatsApp (Twilio)
 * - In-App notifications
 *
 * Architecture:
 * - NotificationOrchestrator: Main entry point for sending notifications
 * - NotificationQueue: Async job processing with Bull + Redis
 * - Individual Services: FCM, APNs, Email, SMS providers
 * - MetricsCollector: Monitoring and alerting
 *
 * Usage:
 * ```typescript
 * import { notificationOrchestrator } from './infrastructure/notifications';
 *
 * await notificationOrchestrator.sendNotification({
 *   userId: 'user-123',
 *   type: 'BATCH_CREATED',
 *   title: 'New Batch Created',
 *   body: 'Your batch has been created successfully',
 *   channels: ['PUSH', 'EMAIL'],
 * });
 * ```
 *
 * @author AgroBridge Engineering Team
 */

// ════════════════════════════════════════════════════════════════════════════════
// MAIN ORCHESTRATOR
// ════════════════════════════════════════════════════════════════════════════════
export {
  NotificationOrchestrator,
  notificationOrchestrator,
} from './NotificationOrchestrator.js';

// ════════════════════════════════════════════════════════════════════════════════
// QUEUE
// ════════════════════════════════════════════════════════════════════════════════
export { NotificationQueue, notificationQueue } from './queue/NotificationQueue.js';

// ════════════════════════════════════════════════════════════════════════════════
// SERVICES
// ════════════════════════════════════════════════════════════════════════════════
export { FCMService, fcmService } from './services/FCMService.js';
export { APNsService, apnsService } from './services/APNsService.js';
export { EmailService, emailService } from './services/EmailService.js';
export { SMSService, smsService } from './services/SMSService.js';
export {
  ResilientEmailService,
  resilientEmailService,
  type EmailServiceHealth,
} from './services/ResilientEmailService.js';

// ════════════════════════════════════════════════════════════════════════════════
// PROVIDERS
// ════════════════════════════════════════════════════════════════════════════════
export { SESProvider, sesProvider, type SESHealth } from './providers/SESProvider.js';

// ════════════════════════════════════════════════════════════════════════════════
// MONITORING
// ════════════════════════════════════════════════════════════════════════════════
export { MetricsCollector, metricsCollector } from './monitoring/MetricsCollector.js';
export { BullBoardSetup, bullBoardSetup } from './monitoring/BullBoardSetup.js';

// ════════════════════════════════════════════════════════════════════════════════
// TYPES
// ════════════════════════════════════════════════════════════════════════════════
export type {
  // FCM Types
  FCMNotificationPayload,
  FCMSendResult,
  FCMBatchResult,

  // APNs Types
  APNsNotificationPayload,
  APNsSendResult,
  APNsBatchResult,

  // Email Types
  EmailOptions,
  EmailSendResult,
  EmailAttachment,
  BatchCreatedEmailData,
  CertificateEmailData,
  SensorAlertEmailData,
  OrderConfirmationEmailData,

  // SMS Types
  SMSSendResult,
  SMSBatchResult,
  SensorAlertDetails,
  OrderNotificationDetails,

  // Queue Types
  NotificationJobData,
  QueueStats,

  // Orchestrator Types
  SendNotificationInput,
  SendNotificationResult,
  NotificationStats,
  GetNotificationsOptions,

  // Monitoring Types
  NotificationMetrics,
  ChannelMetrics,
  ErrorMetrics,
  HealthStatus,

  // Prisma Types (re-exported)
  NotificationType,
  NotificationChannel,
  NotificationStatus,
  NotificationPriority,
  Platform,
  DeliveryStatus,
} from './types/index.js';
