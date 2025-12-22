# Backend Features: Invoicing, Referrals, WhatsApp & Blockchain

## Implementation Summary

This document describes the implementation of four major modules integrated into the AgroBridge backend:

1. **Invoicing Module** - Invoice management with blockchain verification
2. **Referrals Module** - Referral program with leaderboard
3. **WhatsApp Bot Services** - Business notifications via Meta Cloud API
4. **Blockchain Contracts Integration** - Invoice and referral verification on-chain

---

## 1. Invoicing Module

### Domain Entity
**File:** `src/domain/entities/Invoice.ts`

```typescript
export enum InvoiceStatus {
  DRAFT = 'DRAFT',
  PENDING = 'PENDING',
  BLOCKCHAIN_PENDING = 'BLOCKCHAIN_PENDING',
  VERIFIED = 'VERIFIED',
  PAID = 'PAID',
  CANCELLED = 'CANCELLED',
  OVERDUE = 'OVERDUE',
}
```

### Repository Interface
**File:** `src/domain/repositories/IInvoiceRepository.ts`

Methods:
- `create(invoice)` - Create new invoice
- `findById(id)` - Get invoice by ID
- `findByUuid(uuid)` - Get invoice by UUID
- `findByUuidWithDetails(uuid)` - Get invoice with producer details
- `listByProducerId(producerId, filters)` - List invoices for producer
- `updateStatus(id, status)` - Update invoice status
- `updateBlockchainInfo(id, info)` - Update blockchain verification data

### Use Cases
**Directory:** `src/application/use-cases/invoicing/`

| Use Case | Description |
|----------|-------------|
| `CreateInvoiceUseCase` | Creates invoice with line items, calculates totals |
| `GetInvoiceUseCase` | Retrieves invoice by ID with authorization check |
| `ListProducerInvoicesUseCase` | Lists invoices with status/date filters |
| `MarkInvoicePaidUseCase` | Marks invoice as paid (idempotent) |

### API Endpoints
**File:** `src/presentation/routes/invoicing.routes.ts`

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/v1/invoices` | PRODUCER, ADMIN | Create invoice |
| GET | `/api/v1/invoices/producer/me` | Any | List my invoices |
| GET | `/api/v1/invoices/:id` | Any | Get invoice details |
| POST | `/api/v1/invoices/:id/mark-paid` | PRODUCER, ADMIN | Mark as paid |

---

## 2. Referrals Module

### Domain Entity
**File:** `src/domain/entities/Referral.ts`

```typescript
export enum ReferralStatus {
  PENDING = 'PENDING',
  ACTIVE = 'ACTIVE',
  COMPLETED = 'COMPLETED',
  EXPIRED = 'EXPIRED',
  REJECTED = 'REJECTED',
}

export enum ReferralRewardType {
  SIGNUP_BONUS = 'SIGNUP_BONUS',
  TRANSACTION_BONUS = 'TRANSACTION_BONUS',
  MILESTONE_BONUS = 'MILESTONE_BONUS',
}
```

### Repository Interface
**File:** `src/domain/repositories/IReferralRepository.ts`

Methods:
- `create(referral)` - Create new referral
- `findById(id)` - Get referral by ID
- `findByCode(code)` - Find referral by code
- `listByReferrer(referrerId)` - List referrals by referrer
- `getOrCreateUserReferralCode(userId)` - Get/create user's referral code
- `updateStatus(id, status)` - Update referral status
- `updateActivityScore(id, score)` - Update activity score
- `markRewarded(id, txHash)` - Mark referral as rewarded
- `getLeaderboard(monthYear, limit)` - Get monthly leaderboard

### Use Cases
**Directory:** `src/application/use-cases/referrals/`

| Use Case | Description |
|----------|-------------|
| `RegisterReferralUseCase` | Registers new referral with fraud detection |
| `GetReferralStatsUseCase` | Gets referrer's stats and code |
| `MarkReferralRewardedUseCase` | Admin marks referral as rewarded |

### API Endpoints
**File:** `src/presentation/routes/referrals.routes.ts`

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/v1/referrals` | None | Register referral |
| GET | `/api/v1/referrals/me` | Any | List my referrals |
| GET | `/api/v1/referrals/me/stats` | Any | Get my stats |
| GET | `/api/v1/referrals/me/code` | Any | Get/create my code |
| POST | `/api/v1/referrals/:id/reward` | ADMIN | Mark as rewarded |
| GET | `/api/v1/referrals/leaderboard` | None | Current month leaderboard |
| GET | `/api/v1/referrals/leaderboard/:monthYear` | None | Historical leaderboard |

---

## 3. WhatsApp Bot Services

### Service Interfaces
**File:** `src/domain/services/IWhatsAppService.ts`

```typescript
export interface IWhatsAppService {
  sendText(phoneNumber: string, message: string): Promise<MessageResult>;
  sendTemplate(phoneNumber: string, templateName: string, params: TemplateParams): Promise<MessageResult>;
  sendMedia(phoneNumber: string, mediaUrl: string, caption?: string): Promise<MessageResult>;
  sendLocation(phoneNumber: string, latitude: number, longitude: number, name?: string): Promise<MessageResult>;
  markAsRead(messageId: string): Promise<void>;
  isHealthy(): Promise<boolean>;
}
```

**File:** `src/domain/services/IWhatsAppNotificationService.ts`

Notification types:
- `sendInvoiceCreatedNotification` - New invoice alert
- `sendInvoiceDueReminder` - Payment due reminder
- `sendInvoiceOverdueNotification` - Overdue notice
- `sendReferralSuccessNotification` - Referral registered
- `sendReferralActivatedNotification` - Referral milestone reached

### Implementations
**File:** `src/infrastructure/external/WhatsAppProvider.ts`
- Meta WhatsApp Cloud API adapter
- Handles text, template, media, and location messages

**File:** `src/infrastructure/notifications/WhatsAppNotificationService.ts`
- Business notification templates (ES/EN)
- Bilingual message formatting

---

## 4. Blockchain Integration

### Invoice Blockchain Service
**Interface:** `src/domain/services/IInvoiceBlockchainService.ts`

```typescript
export interface IInvoiceBlockchainService {
  hashInvoice(data: InvoiceBlockchainData): string;
  registerInvoice(data: InvoiceBlockchainData): Promise<InvoiceRegistrationResult>;
  verifyInvoice(uuid: string, expectedHash: string): Promise<InvoiceVerificationResult>;
  isHealthy(): Promise<boolean>;
}
```

**Implementation:** `src/infrastructure/blockchain/EthersInvoiceBlockchainService.ts`

### Referral Blockchain Service
**Interface:** `src/domain/services/IReferralBlockchainService.ts`

```typescript
export interface IReferralBlockchainService {
  registerReferral(data: ReferralBlockchainData): Promise<ReferralRegistrationResult>;
  recordReferralReward(data: ReferralRewardData): Promise<ReferralRewardResult>;
  verifyReferral(referralId: string): Promise<ReferralVerificationResult>;
  isHealthy(): Promise<boolean>;
}
```

**Implementation:** `src/infrastructure/blockchain/EthersReferralBlockchainService.ts`

---

## 5. Public Verification Routes

**File:** `src/presentation/routes/public-verify.routes.ts`

No-auth endpoints for blockchain verification:

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/verify/invoice/:uuid` | Verify invoice authenticity |
| GET | `/verify/referral/:id` | Verify referral authenticity |

### Use Cases
**Directory:** `src/application/use-cases/public-verify/`

| Use Case | Description |
|----------|-------------|
| `VerifyInvoiceUseCase` | Returns invoice + blockchain verification status |
| `VerifyReferralUseCase` | Returns referral + blockchain verification status |

---

## Architecture

```
src/
├── domain/
│   ├── entities/
│   │   ├── Invoice.ts
│   │   └── Referral.ts
│   ├── repositories/
│   │   ├── IInvoiceRepository.ts
│   │   └── IReferralRepository.ts
│   └── services/
│       ├── IWhatsAppService.ts
│       ├── IWhatsAppNotificationService.ts
│       ├── IInvoiceBlockchainService.ts
│       └── IReferralBlockchainService.ts
├── application/
│   └── use-cases/
│       ├── invoicing/
│       ├── referrals/
│       └── public-verify/
├── infrastructure/
│   ├── database/prisma/repositories/
│   │   ├── PrismaInvoiceRepository.ts
│   │   └── PrismaReferralRepository.ts
│   ├── external/
│   │   └── WhatsAppProvider.ts
│   ├── notifications/
│   │   └── WhatsAppNotificationService.ts
│   └── blockchain/
│       ├── EthersInvoiceBlockchainService.ts
│       └── EthersReferralBlockchainService.ts
└── presentation/
    └── routes/
        ├── invoicing.routes.ts
        ├── referrals.routes.ts
        └── public-verify.routes.ts
```

---

## Environment Variables

```env
# WhatsApp (Meta Cloud API)
META_WHATSAPP_TOKEN=your_token
META_WHATSAPP_PHONE_NUMBER_ID=your_phone_id
META_WHATSAPP_BUSINESS_ACCOUNT_ID=your_account_id
META_WHATSAPP_VERIFY_TOKEN=your_verify_token

# Blockchain
BLOCKCHAIN_RPC_URL=https://polygon-mainnet.g.alchemy.com/v2/...
BLOCKCHAIN_CHAIN_ID=137
BLOCKCHAIN_PRIVATE_KEY=0x...
INVOICE_REGISTRY_CONTRACT=0x...
REFERRAL_PROGRAM_CONTRACT=0x...
BLOCKCHAIN_NETWORK_NAME=polygon

# App
APP_BASE_URL=https://agrobridge.io
```

---

## Testing

All modules pass `npm run type-check` with no errors.

```bash
npm run type-check
# > tsc --noEmit
# (no errors)
```

---

## Integration Date

**2025-12-21**

---

## Related Documentation

- [Prisma Schema](../../prisma/schema.prisma)
- [API Documentation](/api-docs)
- [WhatsApp Bot Integration](../../modules/whatsapp-bot/)
- [FinTech Modules](../../modules/)
