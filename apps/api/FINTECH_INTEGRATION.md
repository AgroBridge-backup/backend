# AgroBridge FinTech Module Integration

## Overview

The FinTech modules provide comprehensive financial services for farmers including:
- **WhatsApp Bot** - Conversational interface for advance requests and payments
- **Collections** - Automated payment reminders and late fee management
- **Credit Scoring** - Rule-based alternative credit assessment
- **Repayments** - Payment processing with Stripe/OpenPay webhooks

## API Endpoints

### Health Check
```
GET /api/v1/fintech/health
```
Returns consolidated status of all FinTech modules.

---

### WhatsApp Bot (`/api/v1/webhook/whatsapp`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/webhook/whatsapp` | Meta webhook verification |
| POST | `/webhook/whatsapp` | Receive messages from users |
| GET | `/webhook/whatsapp/health` | Bot health and stats |
| POST | `/webhook/whatsapp/test` | Send test message (admin) |

**Environment Variables:**
```bash
META_WHATSAPP_TOKEN=your_token
META_WHATSAPP_PHONE_ID=your_phone_id
META_VERIFY_TOKEN=your_verify_token_min_20_chars
```

---

### Collections (`/api/v1/collections`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Module health check |
| POST | `/run` | Manually trigger collection run |
| GET | `/targets` | Get current collection targets |
| GET | `/late-fee/:advanceId` | Calculate late fee |
| POST | `/trigger/:advanceId` | Trigger collection for advance |
| GET | `/rules` | Get collection rules config |

**Collection Stages:**
1. FRIENDLY_REMINDER (-3 days)
2. FINAL_NOTICE (due day)
3. OVERDUE_1 (1 day)
4. OVERDUE_3 (3 days)
5. LATE_FEE_WARNING (7 days)
6. ACCOUNT_REVIEW (14 days)
7. COLLECTIONS_HANDOFF (30 days)

**Late Fee Configuration:**
- 5% per week
- Maximum 20%
- No grace period

**Environment Variables:**
```bash
COLLECTIONS_ENABLED=true
COLLECTIONS_CRON_SCHEDULE=0 8 * * *
COLLECTIONS_TIMEZONE=America/Mexico_City
LATE_FEE_RATE_PER_WEEK=0.05
LATE_FEE_MAX_PERCENTAGE=0.20
```

---

### Credit Scoring (`/api/v1/credit`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Module health check |
| GET | `/score/:userId` | Get/calculate credit score |
| GET | `/eligibility/:userId` | Check advance eligibility |
| POST | `/calculate/:userId` | Force score recalculation |
| GET | `/factors` | Get scoring factors docs |

**Scoring Weights:**
| Factor | Weight | Max Score |
|--------|--------|-----------|
| Repayment History | 40% | 400 |
| Transaction Frequency | 20% | 200 |
| Profile Completeness | 15% | 150 |
| Request Pattern | 15% | 150 |
| External Signals | 10% | 100 |

**Approval Thresholds:**
- Score >= 700: Auto-approve up to $10,000
- Score >= 500: Auto-approve up to $5,000
- Score >= 300: Manual review
- Score < 300: Auto-reject

---

### Repayments (`/api/v1/repayments`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Module health check |
| POST | `/:advanceId` | Record a payment |
| GET | `/:advanceId/balance` | Get balance breakdown |
| GET | `/:advanceId/schedule` | Get payment schedule |
| GET | `/:advanceId/history` | Get payment history |
| PATCH | `/:advanceId/extend` | Extend due date (admin) |
| GET | `/aging-report` | AR aging report (admin) |
| POST | `/webhook/stripe` | Stripe webhook handler |
| POST | `/webhook/mercadopago` | MercadoPago webhook |

**Payment Methods:**
- STRIPE
- OPENPAY
- BANK_TRANSFER
- SPEI
- CRYPTO
- CASH

**Environment Variables:**
```bash
STRIPE_SECRET_KEY=sk_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

---

## Architecture

```
src/modules/
├── whatsapp-bot/
│   ├── handlers/
│   │   ├── message.handler.ts    # Message processing
│   │   └── session.manager.ts    # Session state
│   ├── templates/
│   │   └── messages.ts           # Bilingual templates
│   ├── types/
│   │   └── index.ts              # TypeScript types
│   ├── whatsapp.service.ts       # Meta API client
│   ├── whatsapp.routes.ts        # Express routes
│   └── index.ts                  # Module exports
│
├── collections/
│   ├── routes/
│   │   └── index.ts              # Express routes
│   ├── services/
│   │   └── collection.service.ts # Business logic
│   ├── jobs/
│   │   └── collections.cron.ts   # Daily cron job
│   └── types/
│       └── index.ts              # TypeScript types
│
├── credit-scoring/
│   ├── routes/
│   │   └── index.ts              # Express routes
│   ├── simple-scoring.service.ts # Scoring algorithm
│   └── types/
│       └── index.ts              # TypeScript types
│
└── repayments/
    ├── routes/
    │   └── index.ts              # Express routes
    ├── services/
    │   └── repayment.service.ts  # Payment processing
    └── types/
        └── index.ts              # TypeScript types
```

## Database Models

The following Prisma models support the FinTech modules:

- **AdvanceContract** - Farmer advance agreements
- **AdvanceTransaction** - Payment transactions
- **AdvanceStatusHistory** - Status change audit
- **CreditScore** - Producer credit scores
- **CreditScoreHistory** - Score change history
- **LiquidityPool** - Investment pools
- **PoolTransaction** - Pool capital movements
- **NotificationPreference** - User contact preferences
- **NotificationDeliveryLog** - Message delivery tracking

## Integration Date

Integrated: 2025-12-20

## Support

For issues or questions, contact the development team.
