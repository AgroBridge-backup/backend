# AgroBridge Backend - Architecture Review

**Generated:** December 25, 2025

---

## Architecture Overview

AgroBridge follows **Clean Architecture** (Domain-Driven Design) with four main layers:

```
┌─────────────────────────────────────────────────────────────┐
│                     Presentation Layer                       │
│  (REST API, Middleware, Routes, Validation)                 │
└────────────────────────┬────────────────────────────────────┘
                         │ depends on
┌────────────────────────▼────────────────────────────────────┐
│                    Application Layer                         │
│  (Use Cases, Business Logic Orchestration)                  │
└────────────────────────┬────────────────────────────────────┘
                         │ depends on
┌────────────────────────▼────────────────────────────────────┐
│                      Domain Layer                            │
│  (Entities, Services, Repository Interfaces)                │
└────────────────────────┬────────────────────────────────────┘
                         │ implemented by
┌────────────────────────▼────────────────────────────────────┐
│                  Infrastructure Layer                        │
│  (Prisma, Redis, AWS, Blockchain, External APIs)           │
└─────────────────────────────────────────────────────────────┘
```

---

## Dependency Rules

### Allowed Dependencies

| From | To | Example |
|------|-----|---------|
| Presentation | Application | Routes → Use Cases |
| Application | Domain | Use Cases → Services, Repositories |
| Infrastructure | Domain | Prisma Repos → Repository Interfaces |

### Forbidden Dependencies

| From | To | Why |
|------|-----|-----|
| Domain | Infrastructure | Domain must be framework-agnostic |
| Application | Infrastructure | Should use dependency injection |
| Circular | Any | Causes coupling, hard to test |

---

## Compliance Analysis

### VIOLATIONS FOUND

#### 1. Domain Layer Importing Infrastructure (6 files)

**Severity: CRITICAL**

| File | Import | Issue |
|------|--------|-------|
| `src/domain/services/BlockchainService.ts` | `from '../../infrastructure/monitoring/sentry.js'` | Sentry monitoring |
| `src/domain/services/TransitTrackingService.ts` | `from '../../infrastructure/monitoring/sentry.js'` | Sentry instrumentation |
| `src/domain/services/QualityCertificateService.ts` | `from '../../infrastructure/monitoring/sentry.js'` | Sentry context |
| `src/domain/services/SatelliteAnalysisService.ts` | `from '../../infrastructure/services/SentinelHubService.js'` | External service |
| `src/domain/services/SatelliteAnalysisService.ts` | `PrismaClient` | Database client |
| `src/domain/services/OrganicCertificateService.ts` | `from '../../infrastructure/pdf/PdfGenerator.js'` | PDF generation |
| `src/domain/services/OrganicCertificateService.ts` | `from '../../infrastructure/ipfs/IpfsService.js'` | IPFS storage |

**Recommendation:** Create domain interfaces for observability, PDF generation, IPFS, and satellite services. Inject implementations via dependency injection.

---

#### 2. Application Layer Importing Infrastructure (8 files)

**Severity: CRITICAL**

| File | Import | Issue |
|------|--------|-------|
| `src/application/use-cases/auth/Setup2FAUseCase.ts` | `from '../../../infrastructure/auth/TwoFactorService.js'` | 2FA service |
| `src/application/use-cases/auth/Enable2FAUseCase.ts` | `from '../../../infrastructure/auth/TwoFactorService.js'` | 2FA service |
| `src/application/use-cases/auth/Disable2FAUseCase.ts` | `from '../../../infrastructure/auth/TwoFactorService.js'` | 2FA service |
| `src/application/use-cases/auth/Get2FAStatusUseCase.ts` | `from '../../../infrastructure/auth/TwoFactorService.js'` | 2FA service |
| `src/application/use-cases/auth/Verify2FAUseCase.ts` | `from '../../../infrastructure/auth/TwoFactorService.js'` | 2FA service |
| `src/application/use-cases/auth/Verify2FAUseCase.ts` | `from '../../../infrastructure/cache/RedisClient.js'` | Redis cache |
| `src/application/use-cases/auth/RegenerateBackupCodesUseCase.ts` | `from '../../../infrastructure/auth/TwoFactorService.js'` | 2FA service |
| `src/application/use-cases/auth/LoginUseCase.ts` | `from '../../../infrastructure/cache/RedisClient.js'` | Redis cache |
| `src/application/use-cases/auth/LogoutUseCase.ts` | `from '../../../infrastructure/cache/RedisClient.js'` | Redis cache |

**Recommendation:**
1. Create `ITwoFactorService` interface in domain
2. Create `ICacheService` interface in domain
3. Inject implementations via constructor

---

#### 3. Presentation Layer Importing Infrastructure (57+ files)

**Severity: MEDIUM** (Common in pragmatic architectures)

Most route files directly import:
- Prisma repositories
- Redis clients
- Storage services
- Queue services
- Notification orchestrators

**Examples:**
- `src/presentation/routes/report.routes.ts` → ReportService
- `src/presentation/routes/temperature.routes.ts` → PrismaTemperatureReadingRepository
- `src/presentation/routes/api-keys.routes.ts` → ApiKeyService

**Recommendation:** This is a pragmatic trade-off. For a cleaner architecture:
1. Create use cases for all route handlers
2. Inject repositories into use cases
3. Routes only call use cases

---

### POSITIVE FINDINGS

#### No Circular Dependencies

```bash
# Verified with import analysis
# No circular dependency chains detected
```

#### Proper Dependency Inversion in Infrastructure

Infrastructure correctly implements domain interfaces:

| Interface | Implementation |
|-----------|----------------|
| `IUserRepository` | `PrismaUserRepository` |
| `IProducerRepository` | `PrismaProducerRepository` |
| `IBatchRepository` | `PrismaBatchRepository` |
| `IEventRepository` | `PrismaEventRepository` |
| `IRefreshTokenRepository` | `PrismaRefreshTokenRepository` |

#### Proper Layer Separation in app.ts

The main application factory (`app.ts`) demonstrates correct DI:

```typescript
// Repositories instantiated
const userRepository = new PrismaUserRepository(prisma);
const batchRepository = new PrismaBatchRepository();

// Use cases receive repositories
const useCases: AllUseCases = {
  auth: {
    loginUseCase: new LoginUseCase(userRepository, refreshTokenRepository),
    // ...
  },
  // ...
};

// Router receives use cases
apiRouter = createApiRouter(useCases, prisma);
```

---

## Recommendations

### Priority 1: Fix Domain Layer Violations

Create domain interfaces for infrastructure concerns:

```typescript
// src/domain/services/interfaces/IObservabilityService.ts
export interface IObservabilityService {
  addBreadcrumb(message: string, data?: Record<string, any>): void;
  captureException(error: Error, context?: Record<string, any>): void;
  instrumentAsync<T>(name: string, operation: () => Promise<T>): Promise<T>;
}

// src/domain/services/interfaces/IPdfGenerator.ts
export interface IPdfGenerator {
  generateCertificate(data: CertificateData): Promise<Buffer>;
}

// src/domain/services/interfaces/IIpfsService.ts
export interface IIpfsService {
  uploadFile(buffer: Buffer, filename: string): Promise<string>;
  getFileUrl(hash: string): string;
}
```

### Priority 2: Fix Application Layer Violations

Create interfaces for 2FA and cache:

```typescript
// src/domain/services/interfaces/ITwoFactorService.ts
export interface ITwoFactorService {
  generateSecret(email: string): { secret: string; qrCode: string };
  verifyToken(secret: string, token: string): boolean;
  generateBackupCodes(): string[];
}

// src/domain/services/interfaces/ICacheService.ts
export interface ICacheService {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T, ttlSeconds?: number): Promise<void>;
  delete(key: string): Promise<void>;
}
```

### Priority 3: Gradual Route Refactoring

For each route file:
1. Create corresponding use case if missing
2. Move business logic from route to use case
3. Route handler only calls use case

---

## Architecture Score

| Aspect | Score | Notes |
|--------|-------|-------|
| Layer Separation | 7/10 | Good structure, some violations |
| Dependency Direction | 6/10 | Domain imports infrastructure |
| Testability | 7/10 | Most components injectable |
| Modularity | 8/10 | Well-organized modules |
| Documentation | 9/10 | Excellent inline docs |
| **Overall** | **7.4/10** | Production-ready with room for improvement |

---

## Migration Path

### Phase 1: Domain Layer (1-2 days)
1. Create observability interface
2. Create PDF generator interface
3. Create IPFS service interface
4. Update domain services to use interfaces

### Phase 2: Application Layer (2-3 days)
1. Create 2FA service interface
2. Create cache service interface
3. Update auth use cases to use interfaces
4. Update app.ts to inject implementations

### Phase 3: Presentation Layer (Ongoing)
1. Identify routes with direct infrastructure access
2. Create use cases for missing operations
3. Refactor routes incrementally

---

*Generated by Claude Code Audit - December 25, 2025*
