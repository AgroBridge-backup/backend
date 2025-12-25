# Architecture Guide

This document explains how the codebase is organized and why.

---

## The Big Picture

```
┌─────────────────────────────────────────────────────────────────┐
│                     Presentation Layer                          │
│              (Routes, Controllers, Middleware)                  │
│                  Handles HTTP requests                          │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                     Application Layer                           │
│                        (Use Cases)                              │
│              Orchestrates business operations                   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                       Domain Layer                              │
│              (Entities, Services, Repositories)                 │
│                  Core business logic                            │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                   Infrastructure Layer                          │
│          (Database, Cache, Email, Blockchain, etc.)             │
│                  External integrations                          │
└─────────────────────────────────────────────────────────────────┘
```

**The rule:** Dependencies point downward. The domain layer knows nothing about HTTP or databases.

---

## Why This Architecture?

| Problem | How Clean Architecture Solves It |
|---------|----------------------------------|
| "Tests need a database" | Business logic is testable in isolation |
| "Changing databases is scary" | Database is just an implementation detail |
| "Where does this code go?" | Clear boundaries between layers |
| "Everything depends on everything" | Dependencies only flow one direction |

---

## Layer by Layer

### Domain Layer (`src/domain/`)

The heart of the application. Contains business rules that would exist even without computers.

```
src/domain/
├── entities/         # Business objects with identity
├── services/         # Business logic
├── repositories/     # Data access interfaces (not implementations!)
└── value-objects/    # Immutable values (Email, Password, etc.)
```

**Example Entity:**
```typescript
// src/domain/entities/OrganicCertificate.ts
export class OrganicCertificate {
  constructor(
    public readonly id: string,
    public readonly farmerId: string,
    public readonly cropType: CropType,
    public status: CertificateStatus,
  ) {}

  approve(reviewerId: string): void {
    if (this.status !== 'PENDING_REVIEW') {
      throw new Error('Can only approve pending certificates');
    }
    this.status = 'APPROVED';
  }
}
```

**Key point:** The entity doesn't know how it's stored or retrieved. It just knows business rules.

---

### Application Layer (`src/application/`)

Coordinates the domain to accomplish user goals. One use case per user action.

```
src/application/
├── use-cases/
│   ├── auth/                 # Login, Register, Refresh
│   ├── batches/              # Create, Update, Track
│   ├── organic-certificates/ # Generate, Approve, Revoke
│   └── producers/            # CRUD operations
└── interfaces/               # Port definitions
```

**Example Use Case:**
```typescript
// src/application/use-cases/organic-certificates/ApproveCertificateUseCase.ts
export class ApproveCertificateUseCase {
  constructor(
    private certificateRepository: ICertificateRepository,
    private notificationService: INotificationService,
  ) {}

  async execute(input: { certificateId: string; reviewerId: string }) {
    const certificate = await this.certificateRepository.findById(input.certificateId);
    if (!certificate) throw new Error('Certificate not found');

    certificate.approve(input.reviewerId);

    await this.certificateRepository.save(certificate);
    await this.notificationService.notifyApproval(certificate);

    return { certificate };
  }
}
```

**Key point:** Use cases depend on interfaces, not concrete implementations.

---

### Infrastructure Layer (`src/infrastructure/`)

Implements interfaces defined in domain/application layers with real technology.

```
src/infrastructure/
├── database/
│   └── prisma/
│       ├── repositories/    # Prisma implementations of domain repositories
│       └── schema.prisma    # Database schema
├── cache/                   # Redis caching
├── blockchain/              # Ethereum/Polygon integration
├── notifications/           # Push, Email, SMS, WhatsApp
├── storage/                 # S3, IPFS
└── monitoring/              # Sentry, logging
```

**Example Repository Implementation:**
```typescript
// src/infrastructure/database/prisma/repositories/PrismaCertificateRepository.ts
export class PrismaCertificateRepository implements ICertificateRepository {
  constructor(private prisma: PrismaClient) {}

  async findById(id: string): Promise<OrganicCertificate | null> {
    const data = await this.prisma.organicCertificate.findUnique({ where: { id } });
    return data ? this.toDomain(data) : null;
  }

  async save(certificate: OrganicCertificate): Promise<void> {
    await this.prisma.organicCertificate.upsert({
      where: { id: certificate.id },
      update: this.toPersistence(certificate),
      create: this.toPersistence(certificate),
    });
  }
}
```

---

### Presentation Layer (`src/presentation/`)

HTTP interface. Translates web requests into use case calls.

```
src/presentation/
├── routes/          # Express route definitions
├── middlewares/     # Auth, rate limiting, validation
└── validators/      # Request validation schemas
```

**Example Route:**
```typescript
// src/presentation/routes/organic-certificates.routes.ts
router.post('/:id/approve',
  authenticate(['EXPORT_COMPANY_ADMIN', 'ADMIN']),
  async (req: Request, res: Response) => {
    const result = await approveCertificateUseCase.execute({
      certificateId: req.params.id,
      reviewerId: req.user.id,
    });
    res.json({ success: true, data: result.certificate });
  }
);
```

---

## How Data Flows

### Example: Approving a Certificate

```
1. HTTP Request
   POST /api/v1/organic-certificates/123/approve
   Authorization: Bearer <token>

2. Presentation Layer
   - auth.middleware validates token
   - Route handler calls use case

3. Application Layer
   - ApproveCertificateUseCase.execute()
   - Calls repository to get certificate
   - Calls domain method: certificate.approve()
   - Saves via repository
   - Triggers notification

4. Domain Layer
   - OrganicCertificate.approve() validates business rules
   - Returns updated entity

5. Infrastructure Layer
   - PrismaCertificateRepository saves to PostgreSQL
   - NotificationService sends push/email

6. Response
   { success: true, data: { ... } }
```

---

## Key Design Patterns

### Repository Pattern

Abstracts data access behind interfaces.

```typescript
// Domain defines WHAT it needs
interface ICertificateRepository {
  findById(id: string): Promise<OrganicCertificate | null>;
  save(certificate: OrganicCertificate): Promise<void>;
}

// Infrastructure defines HOW
class PrismaCertificateRepository implements ICertificateRepository { ... }
```

### Dependency Injection

Dependencies are passed in, not created internally.

```typescript
// In app.ts - wire up dependencies
const certificateRepo = new PrismaCertificateRepository(prisma);
const notificationService = new NotificationService(fcm, sendgrid);
const approveUseCase = new ApproveCertificateUseCase(certificateRepo, notificationService);

// Use case doesn't know about Prisma or FCM
```

### Use Case Pattern

Each user action is a separate class with a single `execute` method.

```typescript
class ApproveCertificateUseCase {
  execute(input: ApproveInput): Promise<ApproveOutput>;
}
```

---

## Technology Stack

| Layer | Technology |
|-------|------------|
| Runtime | Node.js 20, TypeScript 5.3 |
| HTTP | Express 4.x |
| Database | PostgreSQL 15, Prisma ORM |
| Cache | Redis 7.x |
| Queue | Bull (Redis-based) |
| Blockchain | ethers.js (Polygon) |
| Notifications | FCM, APNs, SendGrid, Twilio |
| Monitoring | Sentry, Winston |

---

## Adding New Features

### New API Endpoint

1. Create route in `src/presentation/routes/`
2. Add validation schema if needed
3. Call existing use case or create new one

### New Use Case

1. Create use case in `src/application/use-cases/`
2. Define interfaces for dependencies
3. Implement interfaces in `src/infrastructure/`
4. Wire up in dependency injection

### New Entity

1. Create entity in `src/domain/entities/`
2. Create repository interface in `src/domain/repositories/`
3. Implement repository in `src/infrastructure/database/prisma/repositories/`
4. Update Prisma schema and run migration

---

## Module Structure

Feature modules live in `src/modules/` and follow the same layered structure:

```
src/modules/credit-scoring/
├── domain/
│   ├── CreditScore.ts
│   └── ICreditScoreRepository.ts
├── application/
│   ├── CalculateCreditScoreUseCase.ts
│   └── GetCreditHistoryUseCase.ts
├── infrastructure/
│   └── PrismaCreditScoreRepository.ts
└── presentation/
    └── credit-scoring.routes.ts
```

---

## Testing Strategy

| Layer | Test Type | What to Test |
|-------|-----------|--------------|
| Domain | Unit | Business rules in isolation |
| Application | Unit | Use case logic with mocked dependencies |
| Infrastructure | Integration | Database operations, external APIs |
| Presentation | E2E | Full request/response cycles |

```bash
npm run test:unit         # Domain + Application
npm run test:integration  # Infrastructure
npm run test:e2e          # Full API tests
```

---

## Further Reading

- [Onboarding Guide](./docs/ONBOARDING.md) - Getting started
- [API Documentation](./API-DOCUMENTATION.md) - Endpoint reference
- [Deployment Guide](./DEPLOYMENT.md) - Production deployment
