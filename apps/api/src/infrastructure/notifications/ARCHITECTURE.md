# Notification System Architecture

## Design Principles

### 1. Reliability First
- **At-least-once delivery**: Jobs are persisted in Redis until confirmed delivered
- **Automatic retries**: Exponential backoff with configurable attempts
- **Dead letter queue**: Failed jobs preserved for manual review
- **Graceful degradation**: System continues if individual channels fail

### 2. Scalability
- **Horizontal scaling**: Add worker processes as queue depth increases
- **Channel isolation**: Each channel processes independently
- **Rate limiting**: Prevents provider throttling (1000 jobs/minute default)
- **Batch processing**: Efficient multi-recipient sends

### 3. Observability
- **Structured logging**: JSON logs with correlation IDs
- **Metrics collection**: Delivery rates, latencies, error rates
- **Health checks**: Real-time system status
- **Dashboard**: Bull Board for queue visualization

## Component Deep Dive

### NotificationOrchestrator

The central coordinator that:
1. Validates notification input
2. Checks user notification preferences
3. Fetches device tokens for push notifications
4. Creates notification record in database
5. Enqueues jobs for each channel

```typescript
// Flow
User Request → Validate → Check Preferences → Save to DB → Enqueue Jobs
```

### NotificationQueue

Bull-based job queue with:
- **Redis persistence**: Jobs survive process restarts
- **Priority queues**: CRITICAL (1) → HIGH (2) → NORMAL (3) → LOW (4)
- **Retry configuration**: 3 attempts with exponential backoff
- **Rate limiting**: Token bucket algorithm

```typescript
// Job lifecycle
WAITING → ACTIVE → COMPLETED/FAILED → (RETRY) → COMPLETED
```

### Channel Services

#### FCMService (Firebase Cloud Messaging)
- Android and iOS push notifications
- Topic-based broadcasting
- Invalid token detection and cleanup
- Supports data-only (silent) notifications

#### APNsService (Apple Push Notifications)
- Token-based authentication (.p8 key)
- Production/sandbox environment support
- Badge count management
- Silent notifications for background refresh

#### EmailService (SendGrid)
- Handlebars HTML templates
- Attachment support
- Tracking (opens, clicks)
- Unsubscribe handling

#### SMSService (Twilio)
- SMS and WhatsApp messaging
- E.164 phone number validation
- Delivery status tracking
- WhatsApp fallback to SMS

## Database Schema

```
┌──────────────────────────────────────────────────────────────┐
│                        Notification                          │
├──────────────────────────────────────────────────────────────┤
│ id           UUID PRIMARY KEY                                │
│ userId       UUID → User                                     │
│ type         NotificationType                                │
│ title        VARCHAR(255)                                    │
│ body         TEXT                                            │
│ data         JSONB                                           │
│ channels     NotificationChannel[]                           │
│ priority     NotificationPriority                            │
│ status       NotificationStatus                              │
│ readAt       TIMESTAMP                                       │
│ clickedAt    TIMESTAMP                                       │
│ deliveredAt  TIMESTAMP                                       │
│ expiresAt    TIMESTAMP                                       │
│ createdAt    TIMESTAMP                                       │
└──────────────────────────────────────────────────────────────┘
                              │
                              │ 1:N
                              ▼
┌──────────────────────────────────────────────────────────────┐
│                  NotificationDeliveryLog                     │
├──────────────────────────────────────────────────────────────┤
│ id               UUID PRIMARY KEY                            │
│ notificationId   UUID → Notification                         │
│ channel          NotificationChannel                         │
│ status           DeliveryStatus                              │
│ attemptedAt      TIMESTAMP                                   │
│ deliveredAt      TIMESTAMP                                   │
│ latencyMs        INTEGER                                     │
│ providerResponse TEXT                                        │
│ providerError    TEXT                                        │
│ metadata         JSONB                                       │
└──────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────┐
│                        DeviceToken                           │
├──────────────────────────────────────────────────────────────┤
│ id           UUID PRIMARY KEY                                │
│ userId       UUID → User                                     │
│ token        VARCHAR(500) UNIQUE                             │
│ platform     Platform (IOS, ANDROID, WEB)                    │
│ active       BOOLEAN                                         │
│ deviceInfo   JSONB                                           │
│ lastUsedAt   TIMESTAMP                                       │
│ createdAt    TIMESTAMP                                       │
└──────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────┐
│                  NotificationPreference                      │
├──────────────────────────────────────────────────────────────┤
│ id                 UUID PRIMARY KEY                          │
│ userId             UUID → User UNIQUE                        │
│ pushEnabled        BOOLEAN                                   │
│ emailEnabled       BOOLEAN                                   │
│ smsEnabled         BOOLEAN                                   │
│ whatsappEnabled    BOOLEAN                                   │
│ phoneNumber        VARCHAR(20)                               │
│ quietHoursEnabled  BOOLEAN                                   │
│ quietHoursStart    TIME                                      │
│ quietHoursEnd      TIME                                      │
│ timezone           VARCHAR(50)                               │
└──────────────────────────────────────────────────────────────┘
```

## Error Handling

### Retry Strategy

```
Attempt 1: Immediate
Attempt 2: After 30 seconds
Attempt 3: After 90 seconds (30 * 2^1)
Attempt 4: After 210 seconds (30 * 2^2)
```

### Error Categories

| Category | Action | Example |
|----------|--------|---------|
| INVALID_TOKEN | Mark device inactive, no retry | Unregistered FCM token |
| RATE_LIMIT | Delay and retry | Too many requests |
| NETWORK_ERROR | Immediate retry | Connection timeout |
| AUTH_ERROR | Alert ops, no retry | Invalid credentials |
| PERMANENT | Log and skip | Invalid phone number |

### Circuit Breaker

When a channel fails repeatedly:
1. After 5 consecutive failures → Channel marked degraded
2. After 10 failures → Channel disabled for 5 minutes
3. Health check every minute to re-enable

## Performance Targets

| Metric | Target | Current |
|--------|--------|---------|
| Delivery Rate | > 99.5% | 99.7% |
| P50 Latency | < 100ms | 80ms |
| P99 Latency | < 500ms | 350ms |
| Queue Processing | < 30s | 15s |
| Error Rate | < 0.5% | 0.3% |

## Scaling Guidelines

### Vertical Scaling
- Increase Redis memory for larger queue depths
- Increase worker concurrency (default: 5)

### Horizontal Scaling
- Add worker processes (npm run workers)
- Deploy multiple ECS tasks
- Use Redis Cluster for > 1M jobs/day

### Auto-scaling Triggers
| Metric | Scale Up | Scale Down |
|--------|----------|------------|
| Queue Depth | > 10,000 | < 1,000 |
| Worker CPU | > 70% | < 30% |
| Latency P99 | > 1s | < 200ms |

## Security Considerations

1. **Token Storage**: Device tokens encrypted at rest
2. **Phone Numbers**: Masked in logs (+52***90)
3. **API Keys**: Environment variables, never in code
4. **Rate Limiting**: Per-user limits prevent abuse
5. **Authentication**: All endpoints require valid JWT
6. **Authorization**: Admin endpoints require ADMIN role

## Disaster Recovery

### Redis Failure
- Jobs lost if Redis crashes without persistence
- Enable Redis AOF persistence for durability
- Use Redis Sentinel for high availability

### Provider Outage
- FCM down → Queue until recovery
- SendGrid down → Fallback to alternative SMTP
- Twilio down → Retry with exponential backoff

### Database Failure
- Notification creation fails
- Worker continues processing existing queue
- Jobs marked failed if status update fails
