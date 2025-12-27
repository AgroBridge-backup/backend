/**
 * @file Notification System Type Definitions
 * @description Comprehensive TypeScript interfaces for the enterprise notification system
 *
 * These types ensure type safety across all notification services:
 * - FCM (Firebase Cloud Messaging)
 * - APNs (Apple Push Notification service)
 * - Email (SendGrid)
 * - SMS/WhatsApp (Twilio)
 * - Queue (Bull)
 */

import type {
  NotificationType,
  NotificationChannel,
  NotificationStatus,
  NotificationPriority,
  Platform,
  DeliveryStatus,
} from "@prisma/client";

// Re-export Prisma types for convenience
export type {
  NotificationType,
  NotificationChannel,
  NotificationStatus,
  NotificationPriority,
  Platform,
  DeliveryStatus,
};

// ════════════════════════════════════════════════════════════════════════════════
// COMMON TYPES
// ════════════════════════════════════════════════════════════════════════════════

/**
 * Generic notification data payload
 * Used for deep linking and custom data in push notifications
 */
export interface NotificationData {
  /** Deep link path for navigation, e.g., "/batches/123" */
  deepLink?: string;
  /** Related entity ID (batch, order, certificate, etc.) */
  entityId?: string;
  /** Entity type for routing */
  entityType?: string;
  /** Any additional custom data */
  [key: string]: string | number | boolean | undefined;
}

/**
 * Base send result interface
 */
export interface BaseSendResult {
  /** Whether the send operation was successful */
  success: boolean;
  /** Provider's message/transaction ID */
  messageId?: string;
  /** Error message if failed */
  error?: string;
  /** Error code from provider */
  errorCode?: string;
  /** Time taken to send in milliseconds */
  latency?: number;
}

// ════════════════════════════════════════════════════════════════════════════════
// FCM (FIREBASE CLOUD MESSAGING) TYPES
// ════════════════════════════════════════════════════════════════════════════════

/**
 * FCM notification payload
 */
export interface FCMNotificationPayload {
  /** Notification title (max 255 chars) */
  title: string;
  /** Notification body (max 4096 chars) */
  body: string;
  /** Image URL for rich notifications */
  imageUrl?: string;
  /** Custom data payload for deep linking */
  data?: NotificationData;
  /** Notification type for channel routing */
  type?: string;
  /** Time to live in milliseconds (default: 24 hours) */
  ttl?: number;
  /** Badge count for iOS */
  badge?: number;
  /** Whether to use silent notification */
  silent?: boolean;
}

/**
 * FCM single send result
 */
export interface FCMSendResult extends BaseSendResult {
  /** Whether the device token is invalid and should be removed */
  invalidToken?: boolean;
  /** Whether the operation should be retried */
  shouldRetry?: boolean;
}

/**
 * FCM batch send result
 */
export interface FCMBatchResult {
  /** Number of successful sends */
  successCount: number;
  /** Number of failed sends */
  failureCount: number;
  /** List of invalid tokens that should be removed */
  invalidTokens: string[];
  /** Average latency across all batches */
  avgLatency: number;
  /** Individual results for each token */
  results: Array<{
    success: boolean;
    messageId?: string;
    error?: string;
  }>;
}

// ════════════════════════════════════════════════════════════════════════════════
// APNs (APPLE PUSH NOTIFICATION SERVICE) TYPES
// ════════════════════════════════════════════════════════════════════════════════

/**
 * APNs notification payload
 */
export interface APNsNotificationPayload {
  /** Notification title */
  title: string;
  /** Notification body */
  body: string;
  /** Badge count on app icon */
  badge?: number;
  /** Sound to play (default, or custom sound file name) */
  sound?: string;
  /** Category for action buttons */
  category?: string;
  /** Thread ID for grouping notifications */
  threadId?: string;
  /** Custom data payload */
  data?: NotificationData;
  /** Priority: 5 = background, 10 = immediate */
  priority?: 5 | 10;
  /** Time to live in seconds */
  ttl?: number;
  /** Whether to wake app in background */
  contentAvailable?: boolean;
  /** Whether notification can be modified by extension */
  mutableContent?: boolean;
}

/**
 * APNs single send result
 */
export interface APNsSendResult extends BaseSendResult {
  /** Whether the device token is invalid and should be removed */
  invalidToken?: boolean;
}

/**
 * APNs batch send result
 */
export interface APNsBatchResult {
  /** Number of successful sends */
  successCount: number;
  /** Number of failed sends */
  failureCount: number;
  /** List of invalid tokens that should be removed */
  invalidTokens: string[];
  /** Average latency across all sends */
  avgLatency: number;
}

// ════════════════════════════════════════════════════════════════════════════════
// EMAIL (SENDGRID) TYPES
// ════════════════════════════════════════════════════════════════════════════════

/**
 * Email send options
 */
export interface EmailOptions {
  /** Recipient email address */
  to: string;
  /** Email subject */
  subject: string;
  /** HTML content */
  html: string;
  /** Plain text content (auto-generated if not provided) */
  text?: string;
  /** Reply-to email address */
  replyTo?: string;
  /** File attachments */
  attachments?: EmailAttachment[];
  /** Categories for analytics */
  categories?: string[];
  /** Custom arguments for webhook tracking */
  customArgs?: Record<string, string>;
  /** Send at specific time (Unix timestamp) */
  sendAt?: number;
}

/**
 * Email attachment
 */
export interface EmailAttachment {
  /** Base64 encoded content */
  content: string;
  /** File name */
  filename: string;
  /** MIME type */
  type: string;
  /** Disposition: attachment or inline */
  disposition: "attachment" | "inline";
  /** Content ID for inline images */
  contentId?: string;
}

/**
 * Email send result
 */
export interface EmailSendResult extends BaseSendResult {
  /** HTTP status code from provider */
  statusCode?: number;
  /** Email provider used (ses, sendgrid) */
  provider?: "ses" | "sendgrid";
  /** Number of retry attempts (for resilient service) */
  attempt?: number;
}

/**
 * Templated email options
 */
export interface TemplatedEmailOptions {
  /** Template name (e.g., "batch-created") */
  templateName: string;
  /** Recipient email address */
  to: string;
  /** Template variables */
  data: Record<string, unknown>;
  /** Additional options */
  options?: Partial<EmailOptions>;
}

// ════════════════════════════════════════════════════════════════════════════════
// SMS/WHATSAPP (TWILIO) TYPES
// ════════════════════════════════════════════════════════════════════════════════

/**
 * SMS send result
 */
export interface SMSSendResult extends BaseSendResult {
  /** Twilio message status */
  status?: string;
  /** Price of the message */
  price?: string;
  /** Price unit (USD, etc.) */
  priceUnit?: string;
}

/**
 * SMS batch send result
 */
export interface SMSBatchResult {
  /** Number of successful sends */
  successCount: number;
  /** Number of failed sends */
  failureCount: number;
  /** Average latency across all sends */
  avgLatency: number;
  /** Individual results */
  results: SMSSendResult[];
}

// ════════════════════════════════════════════════════════════════════════════════
// NOTIFICATION QUEUE TYPES
// ════════════════════════════════════════════════════════════════════════════════

/**
 * Notification job data for Bull queue
 */
export interface NotificationJobData {
  /** Notification database ID */
  notificationId: string;
  /** Target user ID */
  userId: string;
  /** Notification type */
  type: NotificationType;
  /** Notification title */
  title: string;
  /** Notification body */
  body: string;
  /** Custom data payload */
  data?: NotificationData;
  /** Delivery channels */
  channels: NotificationChannel[];
  /** Priority level */
  priority: NotificationPriority;
  /** Retry attempt number */
  attempt?: number;
}

/**
 * Queue statistics
 */
export interface QueueStats {
  /** Jobs waiting to be processed */
  waiting: number;
  /** Jobs currently being processed */
  active: number;
  /** Successfully completed jobs */
  completed: number;
  /** Failed jobs after all retries */
  failed: number;
  /** Jobs scheduled for future */
  delayed: number;
  /** Jobs that were paused */
  paused?: number;
}

// ════════════════════════════════════════════════════════════════════════════════
// NOTIFICATION ORCHESTRATOR TYPES
// ════════════════════════════════════════════════════════════════════════════════

/**
 * Input for sending a notification
 */
export interface SendNotificationInput {
  /** Target user ID */
  userId: string;
  /** Notification type */
  type: NotificationType;
  /** Notification title */
  title: string;
  /** Notification body */
  body: string;
  /** Custom data payload */
  data?: NotificationData;
  /** Image URL for rich notifications */
  imageUrl?: string;
  /** Delivery channels (will be filtered by user preferences) */
  channels: NotificationChannel[];
  /** Priority level */
  priority?: NotificationPriority;
  /** Expiration time */
  expiresAt?: Date;
}

/**
 * Result of sending a notification
 */
export interface SendNotificationResult {
  /** Whether the notification was queued successfully */
  success: boolean;
  /** Notification database ID */
  notificationId?: string;
  /** Error message if failed */
  error?: string;
}

/**
 * Options for getting user notifications
 */
export interface GetNotificationsOptions {
  /** Maximum number of notifications to return */
  limit?: number;
  /** Number of notifications to skip (for pagination) */
  offset?: number;
  /** Only return unread notifications */
  unreadOnly?: boolean;
  /** Filter by notification type */
  type?: NotificationType;
  /** Filter by status */
  status?: NotificationStatus;
}

// ════════════════════════════════════════════════════════════════════════════════
// MONITORING & METRICS TYPES
// ════════════════════════════════════════════════════════════════════════════════

/**
 * Notification system metrics
 */
export interface NotificationMetrics {
  /** Timestamp of metrics collection */
  timestamp: Date;
  /** Time period for metrics (e.g., "1h", "24h") */
  period: string;
  /** Total notifications sent */
  totalSent: number;
  /** Successfully delivered notifications */
  totalDelivered: number;
  /** Failed notifications */
  totalFailed: number;
  /** Delivery rate as percentage */
  deliveryRate: number;
  /** Average latency in milliseconds */
  avgLatency: number;
  /** Current queue depth */
  queueDepth: number;
  /** Queue statistics */
  queueStats: QueueStats;
  /** Metrics per channel */
  channelMetrics: ChannelMetrics[];
  /** Error breakdown */
  errorMetrics: ErrorMetrics[];
}

/**
 * Per-channel metrics
 */
export interface ChannelMetrics {
  /** Channel name */
  channel: NotificationChannel;
  /** Total sent via this channel */
  total: number;
  /** Successfully delivered */
  delivered: number;
  /** Delivery rate percentage */
  deliveryRate: number;
  /** Average latency in milliseconds */
  avgLatency?: number;
}

/**
 * Error metrics
 */
export interface ErrorMetrics {
  /** Error type/category */
  errorType: string;
  /** Number of occurrences */
  count: number;
  /** Percentage of total errors */
  percentage?: number;
}

/**
 * System health status
 */
export interface HealthStatus {
  /** Overall health status */
  healthy: boolean;
  /** Current delivery rate */
  deliveryRate: number;
  /** Current queue depth */
  queueDepth: number;
  /** Timestamp of health check */
  timestamp: Date;
  /** Individual service statuses */
  services?: {
    fcm: boolean;
    apns: boolean;
    email: boolean;
    sms: boolean;
    redis: boolean;
    database: boolean;
  };
}

// ════════════════════════════════════════════════════════════════════════════════
// USER PREFERENCES TYPES
// ════════════════════════════════════════════════════════════════════════════════

/**
 * User notification preferences
 */
export interface UserNotificationPreferences {
  /** Push notifications enabled */
  pushEnabled: boolean;
  /** Email notifications enabled */
  emailEnabled: boolean;
  /** SMS notifications enabled */
  smsEnabled: boolean;
  /** WhatsApp notifications enabled */
  whatsappEnabled: boolean;
  /** Type-specific preferences */
  typePreferences: Record<NotificationType, boolean>;
  /** Quiet hours settings */
  quietHours?: {
    enabled: boolean;
    start: string; // HH:MM
    end: string; // HH:MM
    timezone: string;
  };
}

// ════════════════════════════════════════════════════════════════════════════════
// BATCH NOTIFICATION TYPES (DOMAIN-SPECIFIC)
// ════════════════════════════════════════════════════════════════════════════════

/**
 * Batch details for notification
 */
export interface BatchNotificationDetails {
  batchId: string;
  variety?: string;
  origin?: string;
  weightKg?: number;
  harvestDate?: Date;
  producerName?: string;
  status?: string;
}

/**
 * Certificate notification details
 */
export interface CertificateNotificationDetails {
  batchId: string;
  certificateUrl?: string;
  blockchainHash?: string;
  issuedAt?: Date;
}

/**
 * Sensor alert notification details
 */
export interface SensorAlertDetails {
  sensorType: string;
  currentValue: number;
  threshold: number;
  unit: string;
  location?: string;
  batchId?: string;
}

/**
 * Order notification details
 */
export interface OrderNotificationDetails {
  orderId: string;
  status: string;
  total?: number;
  currency?: string;
  items?: number;
  trackingUrl?: string;
}

// ════════════════════════════════════════════════════════════════════════════════
// EMAIL TEMPLATE DATA TYPES
// ════════════════════════════════════════════════════════════════════════════════

/**
 * Batch created email template data
 */
export interface BatchCreatedEmailData {
  batchId: string;
  batchNumber: string;
  variety?: string;
  producerName?: string;
  harvestDate?: Date;
  origin?: string;
}

/**
 * Certificate email template data
 */
export interface CertificateEmailData {
  batchId: string;
  batchNumber?: string;
  variety?: string;
  producerName?: string;
  certificateUrl?: string;
  blockchainHash?: string;
  issuedAt?: Date;
}

/**
 * Sensor alert email template data
 */
export interface SensorAlertEmailData {
  sensorType: string;
  currentValue: number;
  threshold: number;
  unit: string;
  location?: string;
  batchId?: string;
  timestamp?: Date;
}

/**
 * Order confirmation email template data
 */
export interface OrderConfirmationEmailData {
  orderId: string;
  status: string;
  total?: number;
  currency?: string;
  items?: number;
  trackingUrl?: string;
  buyerName?: string;
}

// ════════════════════════════════════════════════════════════════════════════════
// STATISTICS TYPES
// ════════════════════════════════════════════════════════════════════════════════

/**
 * Notification statistics for a user
 */
export interface NotificationStats {
  /** Total notifications */
  total: number;
  /** Read notifications */
  read: number;
  /** Unread notifications */
  unread: number;
  /** By type breakdown */
  byType?: Record<string, number>;
  /** By channel breakdown */
  byChannel?: Record<string, number>;
}
