# AgroBridge Notification System

Enterprise-grade multi-channel notification delivery system for the AgroBridge agricultural blockchain platform.

## Overview

This notification system provides:
- **Multi-channel delivery**: Push (FCM/APNs), Email (SendGrid), SMS/WhatsApp (Twilio)
- **Async processing**: Bull Queue with Redis for reliable job processing
- **99.7% delivery rate target** with automatic retries
- **< 200ms latency** for critical notifications
- **Scalable to 10M+ users**

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         API Layer                                    │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │              NotificationOrchestrator                        │   │
│  │  - Validates input                                           │   │
│  │  - Checks user preferences                                   │   │
│  │  - Routes to appropriate channels                            │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                              │                                       │
│                              ▼                                       │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │              NotificationQueue (Bull + Redis)                │   │
│  │  - Job persistence                                           │   │
│  │  - Retry logic (exponential backoff)                         │   │
│  │  - Rate limiting                                             │   │
│  │  - Priority handling                                         │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                              │                                       │
│              ┌───────────────┼───────────────┐                      │
│              ▼               ▼               ▼                      │
│  ┌─────────────────┐ ┌─────────────┐ ┌─────────────┐               │
│  │   FCMService    │ │ EmailService│ │ SMSService  │               │
│  │   APNsService   │ │ (SendGrid)  │ │  (Twilio)   │               │
│  └─────────────────┘ └─────────────┘ └─────────────┘               │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

## Quick Start

### 1. Configure Environment Variables

```env
# Firebase Cloud Messaging
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
FIREBASE_CLIENT_EMAIL=firebase-adminsdk@your-project.iam.gserviceaccount.com

# Apple Push Notifications
APNS_KEY_ID=ABC123DEF4
APNS_TEAM_ID=TEAM123456
APNS_KEY_PATH=/path/to/AuthKey.p8
APNS_BUNDLE_ID=com.agrobridge.app

# SendGrid Email
SENDGRID_API_KEY=SG.xxxxxxxxxxxxxxxxxxxx
SENDGRID_FROM_EMAIL=notifications@agrobridge.io
SENDGRID_FROM_NAME=AgroBridge

# Twilio SMS/WhatsApp
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=your-auth-token
TWILIO_PHONE_NUMBER=+15551234567
TWILIO_WHATSAPP_NUMBER=+15551234567

# Redis (for Bull Queue)
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=your-password
```

### 2. Send a Notification

```typescript
import { notificationOrchestrator } from './infrastructure/notifications';

// Send multi-channel notification
await notificationOrchestrator.sendNotification({
  userId: 'user-123',
  type: 'BATCH_CREATED',
  title: 'New Batch Created',
  body: 'Your batch AB-2024-001 has been registered on blockchain',
  data: { batchId: 'batch-123', batchNumber: 'AB-2024-001' },
  channels: ['PUSH', 'EMAIL'],
  priority: 'NORMAL',
});

// Send convenience methods
await notificationOrchestrator.sendBatchCreatedNotification(userId, batchId, variety);
await notificationOrchestrator.sendSensorAlertNotification(userId, alertDetails);
await notificationOrchestrator.sendOrderStatusNotification(userId, orderId, status);
```

### 3. Start the Worker

```bash
# Development
npm run workers

# Production
npm run workers:prod
```

## API Endpoints

### Device Management
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/notifications/devices` | Register device token |
| DELETE | `/api/v1/notifications/devices/:token` | Unregister device |

### Notifications
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/notifications` | Get user notifications |
| GET | `/api/v1/notifications/unread-count` | Get unread count |
| GET | `/api/v1/notifications/:id` | Get notification by ID |
| PUT | `/api/v1/notifications/:id/read` | Mark as read |
| PUT | `/api/v1/notifications/:id/clicked` | Mark as clicked |
| PUT | `/api/v1/notifications/read-all` | Mark all as read |
| DELETE | `/api/v1/notifications/:id` | Delete notification |

### Preferences
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/notifications/preferences` | Get preferences |
| PUT | `/api/v1/notifications/preferences` | Update preferences |

### Admin (requires ADMIN role)
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/notifications/test` | Send test notification |
| GET | `/api/v1/notifications/queue/stats` | Queue statistics |
| POST | `/api/v1/notifications/queue/pause` | Pause queue |
| POST | `/api/v1/notifications/queue/resume` | Resume queue |
| POST | `/api/v1/notifications/broadcast` | Send to all users |

## Notification Types

```typescript
type NotificationType =
  | 'BATCH_CREATED'      // New batch registered
  | 'CERTIFICATE_READY'  // Blockchain certificate available
  | 'SENSOR_ALERT'       // Sensor threshold exceeded
  | 'ORDER_STATUS'       // Order status change
  | 'PAYMENT_RECEIVED'   // Payment confirmation
  | 'PRODUCER_WHITELISTED' // Producer approved
  | 'SYSTEM_ANNOUNCEMENT'  // System-wide message
  | 'CUSTOM';            // Custom notification
```

## Priority Levels

| Priority | Use Case | Retry Behavior |
|----------|----------|----------------|
| CRITICAL | Sensor alerts, security | Immediate, 5 retries |
| HIGH | Orders, payments | 3 retries, 30s delay |
| NORMAL | Updates, confirmations | 3 retries, 60s delay |
| LOW | Marketing, announcements | 2 retries, 120s delay |

## Monitoring

### Bull Board Dashboard

Access at: `http://localhost:3000/admin/queues`

Features:
- Real-time queue visualization
- Job inspection and debugging
- Manual retry/removal
- Performance metrics

### Metrics Collection

```typescript
import { metricsCollector } from './infrastructure/notifications';

// Collect metrics for last hour
const metrics = await metricsCollector.collectMetrics(1);
console.log(metrics.deliveryRate); // e.g., 99.7%
console.log(metrics.avgLatency);   // e.g., 150ms

// Health check
const health = await metricsCollector.checkHealth();
console.log(health.healthy); // true/false
```

## Testing

```bash
# Run unit tests
npm run test:unit

# Run notification tests only
npm run test:notifications

# Run with coverage
npm run test:coverage
```

## Troubleshooting

### Common Issues

1. **FCM not sending**: Check Firebase credentials and project ID
2. **Email bouncing**: Verify SendGrid domain authentication
3. **SMS failing**: Check Twilio balance and phone number format
4. **Queue stuck**: Check Redis connection and restart worker

### Debug Logging

Set `LOG_LEVEL=debug` to see detailed notification flow:

```
[NotificationOrchestrator] Sending notification { userId, type, channels }
[NotificationQueue] Job enqueued { jobId, channel, priority }
[FCMService] Push sent { deviceToken, messageId, latency }
```

## Cost Optimization

| Channel | Cost | When to Use |
|---------|------|-------------|
| Push (FCM/APNs) | Free | Default for mobile users |
| Email (SendGrid) | ~$0.0006/email | Important updates |
| WhatsApp | ~$0.005/msg | Critical alerts (4x cheaper than SMS) |
| SMS | ~$0.02/msg | OTP, fallback only |

**Best Practice**: Use Push > WhatsApp > Email > SMS priority for cost savings.
