# Notifications Module

Multi-channel notification system with push, email, SMS, and WhatsApp delivery. Enterprise-grade orchestration with user preferences, queue-based delivery, and comprehensive analytics.

---

## Quick Reference

| Aspect | Details |
|--------|---------|
| **Orchestrator** | `NotificationOrchestrator` |
| **Location** | `src/infrastructure/notifications/NotificationOrchestrator.ts` |
| **Queue** | `src/infrastructure/notifications/queue/NotificationQueue.ts` |
| **Services** | `FCMService`, `EmailService`, `SMSService` |
| **Routes** | `src/presentation/routes/notifications.routes.ts` |

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    Notification System                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │              NotificationOrchestrator                      │  │
│  │  • Validate requests                                       │  │
│  │  • Check user preferences                                  │  │
│  │  • Determine optimal channels                              │  │
│  │  • Create notification record                              │  │
│  │  • Queue for delivery                                      │  │
│  └───────────────────────────────────────────────────────────┘  │
│                              │                                   │
│                              ▼                                   │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                  NotificationQueue                         │  │
│  │  • Priority-based ordering                                 │  │
│  │  • Retry logic                                             │  │
│  │  • Batch processing                                        │  │
│  └───────────────────────────────────────────────────────────┘  │
│                              │                                   │
│          ┌───────────────────┼───────────────────┐              │
│          ▼                   ▼                   ▼              │
│  ┌───────────┐       ┌───────────┐       ┌───────────┐         │
│  │ FCMService│       │EmailService│       │SMSService │         │
│  │ (Push)    │       │(SendGrid)  │       │ (Twilio)  │         │
│  └───────────┘       └───────────┘       └───────────┘         │
│                              │                                   │
│                              ▼                                   │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                   DeliveryLogging                          │  │
│  │  • Track delivery status                                   │  │
│  │  • Record errors                                           │  │
│  │  • Analytics                                               │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Notification Types

| Type | Channels | Priority | Description |
|------|----------|----------|-------------|
| `BATCH_CREATED` | PUSH, EMAIL | NORMAL | Batch registered on blockchain |
| `BATCH_STATUS_CHANGED` | PUSH, EMAIL | NORMAL | Batch status update |
| `CERTIFICATE_READY` | PUSH, EMAIL | HIGH | Certificate available |
| `SENSOR_ALERT` | PUSH, SMS, EMAIL | CRITICAL | Temperature/humidity breach |
| `PAYMENT_RECEIVED` | PUSH, EMAIL | HIGH | Payment confirmation |
| `ORDER_CONFIRMED` | PUSH, EMAIL | NORMAL | Order confirmation |
| `PRODUCER_WHITELISTED` | PUSH, EMAIL | HIGH | Account verified |
| `WELCOME` | PUSH, EMAIL | NORMAL | New user welcome |
| `SYSTEM_ANNOUNCEMENT` | PUSH, EMAIL | NORMAL | Platform announcements |

---

## Notification Channels

| Channel | Provider | Use Case |
|---------|----------|----------|
| `PUSH` | Firebase FCM | Real-time mobile alerts |
| `EMAIL` | SendGrid | Formal communications |
| `SMS` | Twilio | Critical alerts |
| `WHATSAPP` | WhatsApp Business API | Collections, support |
| `IN_APP` | Database | Always stored |

---

## API Endpoints

### List User Notifications

```http
GET /api/v1/notifications?limit=50&offset=0&unreadOnly=true
Authorization: Bearer <token>
```

**Response:**
```json
{
  "notifications": [
    {
      "id": "notif-uuid",
      "type": "CERTIFICATE_READY",
      "title": "Certificado Blockchain Listo",
      "body": "Tu certificado para el lote B-2024-001 está disponible",
      "data": {
        "batchId": "batch-uuid",
        "certificateUrl": "https://...",
        "deepLink": "/certificates/batch-uuid"
      },
      "channels": ["PUSH", "EMAIL"],
      "priority": "HIGH",
      "status": "DELIVERED",
      "readAt": null,
      "clickedAt": null,
      "createdAt": "2024-12-25T10:30:00Z"
    }
  ],
  "pagination": {
    "total": 45,
    "limit": 50,
    "offset": 0
  }
}
```

### Get Unread Count

```http
GET /api/v1/notifications/unread-count
Authorization: Bearer <token>
```

**Response:**
```json
{
  "count": 5
}
```

### Mark as Read

```http
POST /api/v1/notifications/:id/read
Authorization: Bearer <token>
```

### Mark All as Read

```http
POST /api/v1/notifications/read-all
Authorization: Bearer <token>
```

### Mark as Clicked

```http
POST /api/v1/notifications/:id/clicked
Authorization: Bearer <token>
```

### Delete Notification

```http
DELETE /api/v1/notifications/:id
Authorization: Bearer <token>
```

### Register Device Token

```http
POST /api/v1/notifications/devices
Authorization: Bearer <token>
Content-Type: application/json

{
  "token": "fcm-device-token",
  "platform": "ios",
  "deviceId": "device-uuid"
}
```

### Update Preferences

```http
PUT /api/v1/notifications/preferences
Authorization: Bearer <token>
Content-Type: application/json

{
  "pushEnabled": true,
  "emailEnabled": true,
  "smsEnabled": false,
  "whatsappEnabled": true,
  "phoneNumber": "+521234567890"
}
```

### Get Notification Statistics (Admin)

```http
GET /api/v1/admin/notifications/stats
Authorization: Bearer <admin-token>
```

**Response:**
```json
{
  "total": 12456,
  "pending": 23,
  "sent": 11890,
  "delivered": 11234,
  "failed": 543,
  "read": 8765,
  "deliveryRate": 94.5,
  "readRate": 78.0
}
```

---

## Convenience Methods

The orchestrator provides pre-built methods for common notifications:

```typescript
// Batch created
await notificationOrchestrator.sendBatchCreatedNotification(userId, {
  batchId: 'batch-123',
  variety: 'Hass Avocado',
  origin: 'Uruapan, Michoacan'
});

// Certificate ready
await notificationOrchestrator.sendCertificateReadyNotification(userId, {
  batchId: 'batch-123',
  certificateUrl: 'https://...',
  blockchainHash: '0x...'
});

// Sensor alert (critical - includes SMS)
await notificationOrchestrator.sendSensorAlertNotification(userId, {
  sensorType: 'Temperature',
  currentValue: 12.5,
  threshold: 8,
  unit: '°C',
  location: 'Container A-123',
  batchId: 'batch-123'
});

// Payment received
await notificationOrchestrator.sendPaymentReceivedNotification(
  userId,
  'order-123',
  15000,
  'MXN'
);

// Welcome notification
await notificationOrchestrator.sendWelcomeNotification(userId, 'Juan Garcia');

// System announcement (all users)
await notificationOrchestrator.sendSystemAnnouncement(
  'Platform Update',
  'New features available...',
  { deepLink: '/changelog' }
);
```

---

## Priority Levels

| Priority | Retry Attempts | Retry Delay | SMS Fallback |
|----------|----------------|-------------|--------------|
| `CRITICAL` | 5 | Exponential | Yes |
| `HIGH` | 3 | 5 minutes | No |
| `NORMAL` | 2 | 15 minutes | No |
| `LOW` | 1 | 1 hour | No |

---

## User Preferences

```typescript
interface NotificationPreference {
  userId: string;
  pushEnabled: boolean;     // Default: true
  emailEnabled: boolean;    // Default: true
  smsEnabled: boolean;      // Default: false
  whatsappEnabled: boolean; // Default: false
  phoneNumber?: string;
  quietHoursStart?: string; // "22:00"
  quietHoursEnd?: string;   // "08:00"
  timezone?: string;        // "America/Mexico_City"
}
```

### Channel Filtering

```typescript
// From NotificationOrchestrator.determineChannels()
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
```

---

## Database Schema

```prisma
model Notification {
  id          String              @id @default(uuid())
  userId      String
  user        User                @relation(fields: [userId])
  type        NotificationType
  title       String
  body        String              @db.Text
  data        Json?
  imageUrl    String?
  channels    NotificationChannel[]
  priority    NotificationPriority @default(NORMAL)
  status      NotificationStatus   @default(PENDING)
  expiresAt   DateTime?

  // Engagement tracking
  readAt      DateTime?
  clickedAt   DateTime?

  // Relations
  deliveryLogs NotificationDeliveryLog[]

  createdAt   DateTime            @default(now())
  updatedAt   DateTime            @updatedAt
}

model NotificationDeliveryLog {
  id              String           @id @default(uuid())
  notificationId  String
  notification    Notification     @relation(fields: [notificationId])
  channel         NotificationChannel
  status          String           // SENT, DELIVERED, FAILED, BOUNCED
  providerMessageId String?
  error           String?
  attemptNumber   Int              @default(1)
  sentAt          DateTime         @default(now())
}

model NotificationPreference {
  id              String   @id @default(uuid())
  userId          String   @unique
  user            User     @relation(fields: [userId])
  pushEnabled     Boolean  @default(true)
  emailEnabled    Boolean  @default(true)
  smsEnabled      Boolean  @default(false)
  whatsappEnabled Boolean  @default(false)
  phoneNumber     String?
  quietHoursStart String?
  quietHoursEnd   String?
  timezone        String?  @default("America/Mexico_City")

  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
}

model DeviceToken {
  id          String   @id @default(uuid())
  userId      String
  user        User     @relation(fields: [userId])
  token       String   @unique
  platform    String   // ios, android, web
  deviceId    String?
  isActive    Boolean  @default(true)
  lastUsedAt  DateTime @default(now())

  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}
```

---

## Service Implementations

### FCM Service (Push)

```typescript
class FCMService {
  async send(notification: NotificationPayload): Promise<string | null> {
    const message = {
      token: deviceToken,
      notification: {
        title: notification.title,
        body: notification.body,
        imageUrl: notification.imageUrl,
      },
      data: notification.data,
      android: {
        priority: 'high',
        notification: { channelId: 'agrobridge_default' }
      },
      apns: {
        payload: { aps: { sound: 'default' } }
      }
    };

    const response = await admin.messaging().send(message);
    return response; // Message ID
  }
}
```

### Email Service (SendGrid)

```typescript
class EmailService {
  async send(notification: NotificationPayload, recipientEmail: string): Promise<boolean> {
    const msg = {
      to: recipientEmail,
      from: { email: 'noreply@agrobridge.io', name: 'AgroBridge' },
      subject: notification.title,
      templateId: getTemplateId(notification.type),
      dynamicTemplateData: {
        title: notification.title,
        body: notification.body,
        ...notification.data,
        year: new Date().getFullYear(),
      }
    };

    await sgMail.send(msg);
    return true;
  }
}
```

### SMS Service (Twilio)

```typescript
class SMSService {
  async send(notification: NotificationPayload, phoneNumber: string): Promise<string | null> {
    // Only send for critical notifications
    if (notification.priority !== 'CRITICAL') {
      return null;
    }

    const message = await twilioClient.messages.create({
      body: `${notification.title}: ${notification.body}`,
      from: process.env.TWILIO_PHONE_NUMBER,
      to: phoneNumber,
    });

    return message.sid;
  }
}
```

---

## Configuration

```bash
# Firebase (Push)
FIREBASE_SERVICE_ACCOUNT={"type":"service_account",...}

# SendGrid (Email)
SENDGRID_API_KEY=SG.xxx
SENDGRID_FROM_EMAIL=noreply@agrobridge.io
SENDGRID_FROM_NAME=AgroBridge

# Twilio (SMS)
TWILIO_ACCOUNT_SID=AC...
TWILIO_AUTH_TOKEN=xxx
TWILIO_PHONE_NUMBER=+1234567890

# WhatsApp Business
WHATSAPP_API_URL=https://graph.facebook.com/v17.0
WHATSAPP_PHONE_NUMBER_ID=xxx
WHATSAPP_ACCESS_TOKEN=xxx
```

---

## Performance

| Metric | Target |
|--------|--------|
| Queue throughput | 1000/min |
| Push delivery | < 2s |
| Email delivery | < 10s |
| SMS delivery | < 5s |

### Queue Configuration

```typescript
const QUEUE_CONFIG = {
  concurrency: 10,
  maxRetries: 3,
  backoffMs: 5000,
  batchSize: 100,
};
```

---

## Error Handling

| Error | Action |
|-------|--------|
| Invalid device token | Remove token, continue |
| Email bounce | Mark email invalid |
| SMS failed | Retry with exponential backoff |
| Rate limited | Queue with delay |

---

## Related Documentation

- [Collections Service](./PAYMENT-PROCESSING.md)
- [API Documentation](../API-ENDPOINTS.md#notifications)
- [Environment Variables](../ENVIRONMENT.md#notifications)
