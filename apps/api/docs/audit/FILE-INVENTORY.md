# AgroBridge Backend - File Inventory

**Generated:** December 25, 2025

---

## Summary

| Metric | Value |
|--------|-------|
| **Total TypeScript Files** | 413 |
| **Total Lines of Code** | ~96,639 |
| **API Route Files** | 35 |
| **API Endpoints** | 261 |
| **Test Files** | 48 |
| **Documentation Files** | 71 |

---

## Files by Architectural Layer

| Layer | Files | Description |
|-------|-------|-------------|
| **Domain** | 66 | Business entities, services, repository interfaces |
| **Application** | 98 | Use cases, DTOs, business logic orchestration |
| **Infrastructure** | 135 | Database, cache, blockchain, notifications, monitoring |
| **Presentation** | 51 | Routes, validators, middlewares |
| **Core** | 4 | Shared core modules (batches, producers) |
| **Shared** | 19 | Common utilities, errors, interfaces |
| **Config** | 1 | Environment configuration |
| **Types** | 3 | TypeScript type definitions |
| **Other** | 36 | Modules (fintech, whatsapp), workers |

---

## Directory Structure

```
apps/api/src/
├── application/                  # Use cases and DTOs (98 files)
│   ├── dtos/                     # Data transfer objects
│   ├── use-cases/                # Application business logic
│   │   ├── auth/                 # Authentication (12 use cases)
│   │   ├── batches/              # Batch management (4 use cases)
│   │   ├── certificates/         # Quality certificates (5 use cases)
│   │   ├── events/               # Traceability events (3 use cases)
│   │   ├── export-companies/     # B2B management
│   │   ├── export-company-dashboard/ # Admin portal (13 use cases)
│   │   ├── farmer-invitations/   # Invitation system
│   │   ├── field-inspections/    # Organic inspections (10 use cases)
│   │   ├── invoicing/            # Invoice management
│   │   ├── organic-certificates/ # Organic certification (8 use cases)
│   │   ├── organic-fields/       # Field management
│   │   ├── producers/            # Producer management (4 use cases)
│   │   ├── public-verify/        # Public verification
│   │   ├── referrals/            # Referral program
│   │   ├── temperature/          # Temperature monitoring
│   │   ├── transit/              # Real-time transit (5 use cases)
│   │   └── verification-stages/  # Stage verification (4 use cases)
│   └── shared/                   # Shared application components
│
├── core/                         # Core domain modules (4 files)
│   ├── batches/                  # Batch core logic
│   └── producers/                # Producer core logic
│
├── domain/                       # Domain layer (66 files)
│   ├── entities/                 # Domain entities (Batch, Producer, etc.)
│   ├── repositories/             # Repository interfaces
│   ├── services/                 # Domain services
│   │   ├── BlockchainService.ts
│   │   ├── OrganicCertificateService.ts
│   │   ├── QualityCertificateService.ts
│   │   ├── SatelliteAnalysisService.ts
│   │   ├── TransitTrackingService.ts
│   │   └── VerificationStageService.ts
│   └── value-objects/            # Value objects (GPSCoordinates, etc.)
│
├── infrastructure/               # Infrastructure layer (135 files)
│   ├── auth/                     # OAuth, 2FA services
│   ├── blockchain/               # Ethers.js blockchain integration
│   ├── cache/                    # Redis caching
│   ├── config/                   # Environment config
│   ├── database/                 # Prisma repositories
│   │   └── prisma/
│   │       ├── schema.prisma     # Database schema (50+ models)
│   │       ├── migrations/       # Database migrations
│   │       └── repositories/     # Prisma implementations
│   ├── graphql/                  # GraphQL API
│   ├── http/                     # Express middleware
│   │   └── middleware/
│   │       ├── admin-auth.middleware.ts
│   │       ├── apiVersioning.middleware.ts
│   │       ├── audit.middleware.ts
│   │       ├── cors.middleware.ts
│   │       ├── error-tracking.middleware.ts
│   │       ├── performance.middleware.ts
│   │       ├── rate-limiter.middleware.ts
│   │       ├── security.middleware.ts
│   │       └── upload.middleware.ts
│   ├── ipfs/                     # IPFS/Pinata integration
│   ├── logging/                  # Winston logging
│   ├── monitoring/               # Sentry APM
│   ├── notifications/            # Multi-channel notifications
│   │   ├── providers/            # FCM, APNs, SES, Twilio
│   │   ├── services/             # Notification services
│   │   └── workers/              # Background workers
│   ├── pdf/                      # PDF generation (PDFKit)
│   ├── queue/                    # Bull queue service
│   ├── reports/                  # Excel/CSV report generation
│   ├── services/                 # External service integrations
│   ├── storage/                  # S3 storage, image optimization
│   └── websocket/                # Socket.IO real-time
│
├── modules/                      # Feature modules
│   ├── collections/              # Payment collections
│   ├── credit-scoring/           # Credit assessment
│   ├── repayments/               # Repayment tracking
│   └── whatsapp-bot/             # WhatsApp integration
│
├── presentation/                 # Presentation layer (51 files)
│   ├── middlewares/              # Route middlewares
│   │   ├── auth.middleware.ts
│   │   ├── context.middleware.ts
│   │   ├── errorHandler.middleware.ts
│   │   ├── rateLimiter.middleware.ts
│   │   └── validator.middleware.ts
│   ├── routes/                   # API routes (35 files)
│   │   ├── v2/                   # API v2 routes
│   │   └── *.routes.ts           # v1 routes
│   └── validation/               # Zod validation schemas
│
├── shared/                       # Shared utilities (19 files)
│   ├── errors/                   # Custom error classes
│   ├── interfaces/               # Shared interfaces
│   ├── types/                    # Shared types
│   └── utils/                    # Utilities (logger, jwt)
│
├── types/                        # TypeScript declarations (3 files)
│   └── express/                  # Express type extensions
│
├── app.ts                        # Express application setup
├── server.ts                     # Server entry point
└── config/                       # Configuration (1 file)
    └── env.ts                    # Environment validation
```

---

## Route Files (35 files, 261 endpoints)

| Route File | Endpoints | Description |
|------------|-----------|-------------|
| `auth.routes.ts` | 21 | Authentication, 2FA, OAuth |
| `notifications.routes.ts` | 18 | Notification management |
| `export-company-dashboard.routes.ts` | 17 | Admin dashboard |
| `payment.routes.ts` | 16 | Payment processing |
| `cold-chain.routes.ts` | 15 | Cold chain monitoring |
| `field-inspections.routes.ts` | 12 | Field inspections |
| `transit.routes.ts` | 10 | Transit tracking |
| `upload.routes.ts` | 9 | File uploads |
| `organic-fields.routes.ts` | 8 | Organic field management |
| `quality-metrics.routes.ts` | 8 | Quality metrics |
| `organic-certificates.routes.ts` | 8 | Organic certificates |
| `temperature.routes.ts` | 8 | Temperature monitoring |
| `cash-flow-bridge.routes.ts` | 8 | FinTech bridge |
| `export-companies.routes.ts` | 7 | Export companies |
| `v2/analytics.routes.ts` | 7 | Analytics API v2 |
| `referrals.routes.ts` | 7 | Referral program |
| `farmer-invitations.routes.ts` | 6 | Farmer invitations |
| `satellite-analysis.routes.ts` | 6 | Satellite analysis |
| `public.routes.ts` | 6 | Public routes |
| `docs.routes.ts` | 6 | API documentation |
| `health.routes.ts` | 6 | Health checks |
| `report.routes.ts` | 6 | Reports |
| `certificates.routes.ts` | 5 | Quality certificates |
| `api-keys.routes.ts` | 5 | API key management |
| `batches.routes.ts` | 4 | Batch management |
| `producers.routes.ts` | 4 | Producer management |
| `v2/batches.routes.ts` | 4 | Batches API v2 |
| `v2/events.routes.ts` | 4 | Events API v2 |
| `v2/producers.routes.ts` | 4 | Producers API v2 |
| `verification-stages.routes.ts` | 4 | Verification stages |
| `invoicing.routes.ts` | 4 | Invoicing |
| `public-verify.routes.ts` | 3 | Public verification |
| `events.routes.ts` | 2 | Traceability events |
| `v2/index.ts` | 2 | V2 router |
| `index.ts` | 1 | Main router |

---

## Database Models (50+ models)

### Core Models
- `User` - User accounts with 2FA, OAuth
- `Producer` - Farmer/producer profiles
- `Batch` - Agricultural batches
- `TraceabilityEvent` - Supply chain events
- `Certification` - Producer certifications

### Organic Certification
- `ExportCompany` - B2B export companies
- `OrganicField` - Certified organic fields
- `FieldInspection` - Field inspection records
- `OrganicCertificate` - Organic certificates
- `SatelliteAnalysis` - NDVI satellite analysis

### Traceability 2.0
- `VerificationStage` - Verification stages
- `QualityCertificate` - Quality certificates
- `TransitSession` - Transit tracking sessions
- `TemperatureReading` - Cold chain readings
- `NfcSeal` - NFC seal records

### Notifications
- `Notification` - Notification records
- `DeviceToken` - Push notification tokens
- `NotificationTemplate` - Message templates
- `NotificationDeliveryLog` - Delivery logs

### FinTech
- `Order` - Order management
- `CreditScore` - Credit assessments
- `AdvanceContract` - Advance contracts
- `Invoice` - Invoicing
- `Referral` - Referral program

---

## Import Frequency (Most Used Modules)

| Module | Import Count | Purpose |
|--------|--------------|---------|
| `@prisma/client` | 100+ | Database ORM |
| `express` | 50+ | Web framework |
| `zod` | 40+ | Validation |
| `../shared/errors/*` | 35+ | Error handling |
| `../infrastructure/cache/RedisClient` | 25+ | Caching |
| `winston` | 20+ | Logging |
| `@sentry/node` | 15+ | Monitoring |
| `ethers` | 10+ | Blockchain |

---

## External Dependencies

### Production (67 packages)

| Category | Packages |
|----------|----------|
| **Core** | express, typescript, prisma, ioredis |
| **Security** | helmet, cors, hpp, bcryptjs, jsonwebtoken |
| **Blockchain** | ethers, @openzeppelin/contracts |
| **AWS** | @aws-sdk/client-s3, @aws-sdk/client-ses |
| **Notifications** | firebase-admin, @parse/node-apn, twilio, @sendgrid/mail |
| **Observability** | @sentry/node, winston, morgan |
| **API** | graphql, graphql-yoga, swagger-jsdoc, swagger-ui-express |
| **Utilities** | zod, uuid, date-fns, sharp, pdfkit, qrcode |

### Dev Dependencies (41 packages)

| Category | Packages |
|----------|----------|
| **Testing** | vitest, supertest, @faker-js/faker |
| **Types** | @types/* packages |
| **Linting** | eslint, prettier, @typescript-eslint/* |
| **Build** | tsc-alias, tsx, nodemon |
| **Blockchain** | hardhat, typechain |

---

*Generated by Claude Code Audit - December 25, 2025*
