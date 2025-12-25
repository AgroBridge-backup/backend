# Payment Processing Module

Subscription billing, payment methods, and usage tracking via Stripe integration.

---

## Quick Reference

| Aspect | Details |
|--------|---------|
| **Service** | `PaymentService` |
| **Location** | `src/infrastructure/payment/PaymentService.ts` |
| **Provider** | `src/infrastructure/payment/providers/StripeProvider.ts` |
| **Webhooks** | `src/infrastructure/payment/webhooks/StripeWebhookHandler.ts` |
| **Routes** | `src/presentation/routes/payment.routes.ts` |

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    Payment System Architecture                   │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                      PaymentService                        │  │
│  │  High-level business logic                                 │  │
│  │  • Subscription lifecycle                                  │  │
│  │  • Usage tracking                                          │  │
│  │  • Tier management                                         │  │
│  └───────────────────────────────────────────────────────────┘  │
│                              │                                   │
│                              ▼                                   │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                     StripeProvider                         │  │
│  │  Low-level Stripe API wrapper                              │  │
│  │  • Error handling                                          │  │
│  │  • Retry logic                                             │  │
│  │  • API abstraction                                         │  │
│  └───────────────────────────────────────────────────────────┘  │
│                              │                                   │
│                              ▼                                   │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                      Stripe API                            │  │
│  │  • Customers                                               │  │
│  │  • Subscriptions                                           │  │
│  │  • Payment Methods                                         │  │
│  │  • Invoices                                                │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                   StripeWebhookHandler                     │  │
│  │  Async event processing                                    │  │
│  │  • payment_intent.succeeded                                │  │
│  │  • invoice.paid                                            │  │
│  │  • customer.subscription.updated                           │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Subscription Tiers

| Tier | Monthly | Yearly | Batches | API Calls | Storage |
|------|---------|--------|---------|-----------|---------|
| FREE | $0 | $0 | 10 | 100 | 100 MB |
| BASIC | $19 | $190 | 100 | 1,000 | 1 GB |
| PREMIUM | $49 | $490 | 1,000 | 10,000 | 10 GB |
| ENTERPRISE | $500 | $5,000 | Unlimited | Unlimited | Unlimited |

### Tier Configuration

```typescript
const TIER_CONFIGS: Record<SubscriptionTier, TierConfig> = {
  FREE: {
    tier: SubscriptionTier.FREE,
    name: 'Free',
    priceMonthly: 0,
    priceYearly: 0,
    batchesLimit: 10,
    apiCallsLimit: 100,
    storageLimitMb: 100,
  },
  BASIC: {
    tier: SubscriptionTier.BASIC,
    name: 'Basic',
    priceMonthly: 1900,  // $19 in cents
    priceYearly: 19000,  // $190 in cents
    batchesLimit: 100,
    apiCallsLimit: 1000,
    storageLimitMb: 1024,
    stripePriceIdMonthly: process.env.STRIPE_BASIC_MONTHLY_PRICE_ID,
    stripePriceIdYearly: process.env.STRIPE_BASIC_YEARLY_PRICE_ID,
  },
  // ... PREMIUM, ENTERPRISE
};
```

---

## API Endpoints

### Get Subscription

```http
GET /api/v1/payments/subscription
Authorization: Bearer <token>
```

**Response:**
```json
{
  "id": "sub-uuid",
  "userId": "user-uuid",
  "tier": "PREMIUM",
  "status": "ACTIVE",
  "currentPeriodStart": "2024-12-01T00:00:00Z",
  "currentPeriodEnd": "2025-01-01T00:00:00Z",
  "cancelAtPeriodEnd": false,
  "batchesUsed": 45,
  "batchesLimit": 1000,
  "apiCallsUsed": 2340,
  "apiCallsLimit": 10000,
  "storageUsedMb": 256,
  "storageLimitMb": 10240
}
```

### Create Subscription

```http
POST /api/v1/payments/subscription
Authorization: Bearer <token>
Content-Type: application/json

{
  "tier": "PREMIUM",
  "paymentMethodId": "pm_1234567890",
  "billingCycle": "monthly"
}
```

### Update Subscription

```http
PUT /api/v1/payments/subscription
Authorization: Bearer <token>
Content-Type: application/json

{
  "tier": "ENTERPRISE",
  "billingCycle": "yearly"
}
```

### Cancel Subscription

```http
DELETE /api/v1/payments/subscription
Authorization: Bearer <token>
Content-Type: application/json

{
  "immediately": false
}
```

### Resume Subscription

```http
POST /api/v1/payments/subscription/resume
Authorization: Bearer <token>
```

### List Payment Methods

```http
GET /api/v1/payments/methods
Authorization: Bearer <token>
```

**Response:**
```json
{
  "paymentMethods": [
    {
      "id": "pm_1234567890",
      "brand": "visa",
      "last4": "4242",
      "expMonth": 12,
      "expYear": 2025,
      "isDefault": true
    }
  ]
}
```

### Add Payment Method

```http
POST /api/v1/payments/methods
Authorization: Bearer <token>
Content-Type: application/json

{
  "paymentMethodId": "pm_1234567890",
  "setAsDefault": true
}
```

### Remove Payment Method

```http
DELETE /api/v1/payments/methods/:paymentMethodId
Authorization: Bearer <token>
```

### Set Default Payment Method

```http
PUT /api/v1/payments/methods/:paymentMethodId/default
Authorization: Bearer <token>
```

### List Invoices

```http
GET /api/v1/payments/invoices?limit=10
Authorization: Bearer <token>
```

**Response:**
```json
{
  "invoices": [
    {
      "id": "in_1234567890",
      "number": "INV-2024-001",
      "status": "paid",
      "amount": 4900,
      "currency": "usd",
      "pdfUrl": "https://...",
      "createdAt": "2024-12-01T00:00:00Z",
      "paidAt": "2024-12-01T00:05:00Z"
    }
  ]
}
```

### Create One-Time Payment

```http
POST /api/v1/payments/one-time
Authorization: Bearer <token>
Content-Type: application/json

{
  "amount": 5000,
  "currency": "usd",
  "description": "Additional certificate bundle",
  "paymentMethodId": "pm_1234567890"
}
```

**Response:**
```json
{
  "clientSecret": "pi_xxx_secret_xxx",
  "paymentIntentId": "pi_1234567890"
}
```

### Check Usage

```http
GET /api/v1/payments/usage
Authorization: Bearer <token>
```

**Response:**
```json
{
  "batches": {
    "allowed": true,
    "used": 45,
    "limit": 1000,
    "remaining": 955
  },
  "apiCalls": {
    "allowed": true,
    "used": 2340,
    "limit": 10000,
    "remaining": 7660
  },
  "storage": {
    "allowed": true,
    "used": 256,
    "limit": 10240,
    "remaining": 9984
  }
}
```

### Create Billing Portal Session

```http
POST /api/v1/payments/portal
Authorization: Bearer <token>
Content-Type: application/json

{
  "returnUrl": "https://app.agrobridge.io/settings/billing"
}
```

**Response:**
```json
{
  "url": "https://billing.stripe.com/session/xxx"
}
```

---

## Subscription Status Lifecycle

```
┌──────────────────────────────────────────────────────────────┐
│                  Subscription Lifecycle                       │
├──────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌──────────┐                                                │
│  │ TRIALING │ ──────▶ (trial ends)                          │
│  └──────────┘             │                                  │
│                           ▼                                  │
│              ┌──────────────────┐                           │
│              │     ACTIVE       │ ◀──────────────┐          │
│              └────────┬─────────┘                │          │
│                       │                          │          │
│         ┌─────────────┼─────────────┐           │          │
│         ▼             ▼             ▼           │          │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐      │          │
│  │ PAST_DUE │  │ PAUSED   │  │ CANCELED │      │          │
│  └────┬─────┘  └────┬─────┘  └──────────┘      │          │
│       │             │                           │          │
│       │  (payment)  │  (resume)                │          │
│       └─────────────┴───────────────────────────┘          │
│                                                              │
│  Terminal States:                                            │
│  • INCOMPLETE_EXPIRED                                        │
│  • UNPAID (after retries exhausted)                         │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

---

## Webhook Events

### Handled Events

| Event | Action |
|-------|--------|
| `payment_intent.succeeded` | Log payment, update status |
| `payment_intent.payment_failed` | Mark payment failed, notify user |
| `invoice.paid` | Update subscription period |
| `invoice.payment_failed` | Notify user, start dunning |
| `customer.subscription.created` | Create local subscription record |
| `customer.subscription.updated` | Sync status, tier, period |
| `customer.subscription.deleted` | Mark canceled, downgrade to FREE |

### Webhook Handler

```typescript
// POST /webhooks/stripe
app.post('/webhooks/stripe', async (req, res) => {
  const sig = req.headers['stripe-signature'];

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  await webhookHandler.handle(event);
  res.json({ received: true });
});
```

---

## Usage Tracking

### Enforcement Points

```typescript
// Before creating a batch
const usage = await paymentService.checkUsage(userId, 'batches', 1);
if (!usage.allowed) {
  throw new UsageLimitExceededError('batches', usage.limit, usage.used);
}

// After successful creation
await paymentService.incrementUsage(userId, 'batches', 1);
```

### Monthly Reset

```typescript
// Cron job: 00:00 UTC on 1st of each month
cron.schedule('0 0 1 * *', async () => {
  const count = await paymentService.resetMonthlyUsage();
  logger.info(`[Billing] Reset usage counters for ${count} subscriptions`);
});
```

---

## Database Schema

```prisma
model Subscription {
  id                    String             @id @default(uuid())
  userId                String             @unique
  user                  User               @relation(fields: [userId])
  stripeCustomerId      String             @unique
  stripeSubscriptionId  String?
  stripePriceId         String?
  tier                  SubscriptionTier   @default(FREE)
  status                SubscriptionStatus @default(ACTIVE)

  // Period
  currentPeriodStart    DateTime?
  currentPeriodEnd      DateTime?
  trialEnd              DateTime?

  // Cancellation
  cancelAtPeriodEnd     Boolean            @default(false)
  canceledAt            DateTime?

  // Usage
  batchesUsed           Int                @default(0)
  batchesLimit          Int                @default(10)
  apiCallsUsed          Int                @default(0)
  apiCallsLimit         Int                @default(100)
  storageUsedMb         Int                @default(0)
  storageLimitMb        Int                @default(100)

  // Relations
  payments              Payment[]

  createdAt             DateTime           @default(now())
  updatedAt             DateTime           @updatedAt
}

model Payment {
  id                    String       @id @default(uuid())
  subscriptionId        String
  subscription          Subscription @relation(fields: [subscriptionId])
  stripePaymentIntentId String       @unique
  amount                Int          // in cents
  currency              String       @default("usd")
  status                String
  description           String?

  createdAt             DateTime     @default(now())
  updatedAt             DateTime     @updatedAt
}
```

---

## Error Handling

| Error Class | HTTP Status | Stripe Code |
|-------------|-------------|-------------|
| `PaymentsUnavailableError` | 503 | N/A |
| `SubscriptionNotFoundError` | 404 | N/A |
| `PaymentMethodNotFoundError` | 404 | N/A |
| `CardDeclinedError` | 402 | `card_declined` |
| `InsufficientFundsError` | 402 | `insufficient_funds` |
| `InvalidCardError` | 400 | `invalid_card` |

### Stripe Error Mapping

```typescript
private mapStripeError(error: Stripe.StripeError): PaymentServiceError {
  switch (error.code) {
    case 'card_declined':
      return new PaymentServiceError('Card was declined', 'CARD_DECLINED', 402);
    case 'insufficient_funds':
      return new PaymentServiceError('Insufficient funds', 'INSUFFICIENT_FUNDS', 402);
    case 'invalid_card':
      return new PaymentServiceError('Invalid card', 'INVALID_CARD', 400);
    default:
      return new PaymentServiceError(error.message, 'PAYMENT_ERROR', 400);
  }
}
```

---

## Configuration

```bash
# Required
STRIPE_SECRET_KEY=sk_live_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx

# Price IDs (from Stripe Dashboard)
STRIPE_BASIC_MONTHLY_PRICE_ID=price_xxx
STRIPE_BASIC_YEARLY_PRICE_ID=price_xxx
STRIPE_PREMIUM_MONTHLY_PRICE_ID=price_xxx
STRIPE_PREMIUM_YEARLY_PRICE_ID=price_xxx
STRIPE_ENTERPRISE_MONTHLY_PRICE_ID=price_xxx
STRIPE_ENTERPRISE_YEARLY_PRICE_ID=price_xxx

# Optional
STRIPE_TEST_MODE=false
```

---

## Security

1. **Webhook Verification**: All webhooks verified with `stripe-signature`
2. **PCI Compliance**: Card data never touches our servers (Stripe Elements)
3. **Idempotency**: Idempotency keys used for payment creation
4. **Rate Limiting**: Payment endpoints rate-limited to 10/min

---

## Testing

### Stripe Test Cards

| Card Number | Scenario |
|-------------|----------|
| 4242424242424242 | Successful payment |
| 4000000000000002 | Card declined |
| 4000000000009995 | Insufficient funds |
| 4000002500003155 | Requires authentication |

### Webhook Testing

```bash
# Install Stripe CLI
stripe listen --forward-to localhost:4000/webhooks/stripe

# Trigger test events
stripe trigger payment_intent.succeeded
stripe trigger customer.subscription.updated
```

---

## Related Documentation

- [Export Company Dashboard](./EXPORT-COMPANY-DASHBOARD.md)
- [API Documentation](../API-ENDPOINTS.md#payments)
- [Environment Variables](../ENVIRONMENT.md#stripe)
