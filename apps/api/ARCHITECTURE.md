# Architecture Documentation - AgroBridge Backend API

## Overview

AgroBridge Backend follows Clean Architecture principles with Domain-Driven Design (DDD), ensuring separation of concerns, testability, and maintainability at enterprise scale.

**Last Updated**: December 13, 2025
**Version**: 1.0.0
**Architecture Pattern**: Clean Architecture (Hexagonal/Ports & Adapters)
**Lead Architect**: Alejandro Navarro Ayala, CEO & CTO

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                         API Layer (Controllers)                      │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐             │
│  │   Auth API   │  │  Producer    │  │   Batch      │  ...         │
│  │  Controller  │  │  Controller  │  │  Controller  │             │
│  └──────────────┘  └──────────────┘  └──────────────┘             │
└────────────────────────────┬─────────────────────────────────────────┘
                             │
┌────────────────────────────┴─────────────────────────────────────────┐
│                    Application Layer (Use Cases)                      │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐             │
│  │   Register   │  │    Create    │  │   Update     │  ...         │
│  │   User UC    │  │  Producer UC │  │   Batch UC   │             │
│  └──────────────┘  └──────────────┘  └──────────────┘             │
└────────────────────────────┬─────────────────────────────────────────┘
                             │
┌────────────────────────────┴─────────────────────────────────────────┐
│                      Domain Layer (Business Logic)                    │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐             │
│  │    User      │  │   Producer   │  │    Batch     │  ...         │
│  │   Entity     │  │   Entity     │  │   Entity     │             │
│  └──────────────┘  └──────────────┘  └──────────────┘             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐             │
│  │   Password   │  │    Email     │  │  BatchCode   │  ...         │
│  │     VO       │  │     VO       │  │     VO       │             │
│  └──────────────┘  └──────────────┘  └──────────────┘             │
└────────────────────────────┬─────────────────────────────────────────┘
                             │
┌────────────────────────────┴─────────────────────────────────────────┐
│                   Infrastructure Layer (Adapters)                     │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐             │
│  │   Prisma     │  │    Redis     │  │     AWS      │  ...         │
│  │  Repository  │  │    Cache     │  │   S3 Store   │             │
│  └──────────────┘  └──────────────┘  └──────────────┘             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐             │
│  │    HTTP      │  │   Logging    │  │    Email     │  ...         │
│  │  Middleware  │  │   (Winston)  │  │   Service    │             │
│  └──────────────┘  └──────────────┘  └──────────────┘             │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Layer Breakdown

### 1. Domain Layer (Core Business Logic)

**Location**: `src/domain/`

**Purpose**: Contains pure business logic with zero dependencies on external frameworks.

**Components**:

#### Entities (`src/domain/entities/`)
Business objects with identity and lifecycle.

**Example**:
```typescript
// src/domain/entities/User.ts
export class User {
  private constructor(
    public readonly id: UserId,
    public readonly email: Email,
    private password: Password,
    public readonly name: string,
    public readonly role: UserRole,
    public readonly createdAt: Date
  ) {}

  static create(props: UserProps): Result<User> {
    // Validation logic
    // Business rules enforcement
  }

  changePassword(newPassword: Password): Result<void> {
    // Business rule: can only change if not recently changed
    this.password = newPassword;
  }
}
```

#### Value Objects (`src/domain/value-objects/`)
Immutable objects defined by their attributes, not identity.

**Implemented**:
- ✅ `Password.ts` - Password validation and hashing
- ✅ `Email.ts` - Email format validation
- ✅ `UserId.ts` - UUID wrapper
- ✅ `BatchCode.ts` - Batch identifier
- ✅ `ProducerId.ts` - Producer identifier

**Example**:
```typescript
// src/domain/value-objects/Password.ts
export class Password extends ValueObject<string> {
  private constructor(value: string) {
    super(value);
  }

  static create(password: string): Result<Password> {
    if (password.length < 8) {
      return Result.fail('Password must be at least 8 characters');
    }
    if (!this.hasUppercase(password)) {
      return Result.fail('Password must contain uppercase letter');
    }
    // ... more validations
    return Result.ok(new Password(password));
  }

  async hash(): Promise<string> {
    return bcrypt.hash(this.value, 12);
  }

  async compare(hashed: string): Promise<boolean> {
    return bcrypt.compare(this.value, hashed);
  }
}
```

#### Domain Events (`src/domain/events/`)
Events that represent something that happened in the domain.

**Example**:
```typescript
export class UserRegisteredEvent extends DomainEvent {
  constructor(
    public readonly userId: string,
    public readonly email: string,
    public readonly occurredAt: Date
  ) {
    super();
  }
}
```

---

### 2. Application Layer (Use Cases)

**Location**: `src/application/use-cases/`

**Purpose**: Orchestrates domain objects to fulfill specific business use cases.

**Structure**:
```
src/application/
├── use-cases/
│   ├── auth/
│   │   ├── RegisterUser.ts
│   │   ├── LoginUser.ts
│   │   └── RefreshToken.ts
│   ├── producers/
│   │   ├── CreateProducer.ts
│   │   ├── UpdateProducer.ts
│   │   └── DeleteProducer.ts
│   └── batches/
│       ├── CreateBatch.ts
│       └── UpdateBatch.ts
├── interfaces/
│   ├── IUserRepository.ts
│   ├── IProducerRepository.ts
│   └── IAuthService.ts
└── dtos/
    ├── UserDTO.ts
    └── ProducerDTO.ts
```

**Example Use Case**:
```typescript
// src/application/use-cases/auth/RegisterUser.ts
export class RegisterUser implements UseCase<RegisterUserDTO, Result<UserDTO>> {
  constructor(
    private userRepository: IUserRepository,
    private passwordService: IPasswordService,
    private eventDispatcher: IEventDispatcher
  ) {}

  async execute(request: RegisterUserDTO): Promise<Result<UserDTO>> {
    // 1. Validate input
    const emailOrError = Email.create(request.email);
    if (emailOrError.isFailure) {
      return Result.fail(emailOrError.error);
    }

    // 2. Check business rules
    const userExists = await this.userRepository.findByEmail(request.email);
    if (userExists) {
      return Result.fail('User already exists');
    }

    // 3. Create domain entity
    const passwordOrError = Password.create(request.password);
    if (passwordOrError.isFailure) {
      return Result.fail(passwordOrError.error);
    }

    const user = User.create({
      email: emailOrError.getValue(),
      password: passwordOrError.getValue(),
      name: request.name,
      role: UserRole.FARMER
    });

    // 4. Persist
    await this.userRepository.save(user.getValue());

    // 5. Dispatch event
    await this.eventDispatcher.dispatch(
      new UserRegisteredEvent(user.getValue().id, request.email, new Date())
    );

    return Result.ok(UserMapper.toDTO(user.getValue()));
  }
}
```

---

### 3. Infrastructure Layer (Technical Implementation)

**Location**: `src/infrastructure/`

**Purpose**: Implements interfaces defined in Application layer with concrete technologies.

**Structure**:
```
src/infrastructure/
├── database/
│   ├── prisma/
│   │   └── schema.prisma
│   ├── repositories/
│   │   ├── PrismaUserRepository.ts
│   │   ├── PrismaProducerRepository.ts
│   │   └── PrismaBatchRepository.ts
│   └── seed.ts
├── http/
│   ├── middleware/
│   │   ├── auth.middleware.ts
│   │   ├── cors.middleware.ts
│   │   ├── helmet.middleware.ts
│   │   ├── rate-limit.middleware.ts
│   │   ├── audit.middleware.ts
│   │   ├── error-handler.middleware.ts
│   │   └── performance.middleware.ts
│   └── server.ts
├── services/
│   ├── AuthService.ts
│   ├── EmailService.ts
│   └── StorageService.ts
├── notifications/
│   ├── queues/
│   │   └── NotificationQueue.ts
│   └── workers/
│       └── notification-worker.ts
└── logging/
    └── WinstonLogger.ts
```

#### Repositories (Data Access)
```typescript
// src/infrastructure/database/repositories/PrismaUserRepository.ts
export class PrismaUserRepository implements IUserRepository {
  constructor(private prisma: PrismaClient) {}

  async findByEmail(email: string): Promise<User | null> {
    const userData = await this.prisma.user.findUnique({
      where: { email }
    });

    if (!userData) return null;

    return UserMapper.toDomain(userData);
  }

  async save(user: User): Promise<void> {
    const raw = UserMapper.toPersistence(user);
    await this.prisma.user.create({
      data: raw
    });
  }
}
```

#### HTTP Middleware Stack

Recently Added (Commit 8d3d9d5):

1. **Security Middleware** (`helmet.middleware.ts`)
   - Content Security Policy
   - XSS Protection
   - Frameguard
   - HSTS

2. **CORS Middleware** (`cors.middleware.ts`)
   - Whitelist-based origin validation
   - Credentials support
   - Pre-flight caching

3. **Rate Limiting Middleware** (`rate-limit.middleware.ts`)
   - Per-IP rate limiting
   - Endpoint-specific limits
   - DDoS protection

4. **Audit Logging Middleware** (`audit.middleware.ts`)
   - Request/response logging
   - User action tracking
   - Compliance (GDPR, SOC 2)

5. **Performance Middleware** (`performance.middleware.ts`)
   - Response time tracking
   - Slow query detection
   - Metrics collection

6. **Error Handler Middleware** (`error-handler.middleware.ts`)
   - Centralized error handling
   - Error formatting
   - Stack trace sanitization (production)

---

### 4. API Layer (Controllers & Routes)

**Location**: `src/api/` or `src/presentation/`

**Purpose**: HTTP interface exposing use cases via REST API.

**Structure**:
```
src/presentation/
├── controllers/
│   ├── auth.controller.ts
│   ├── producer.controller.ts
│   ├── batch.controller.ts
│   ├── event.controller.ts
│   └── health.controller.ts
├── routes/
│   ├── auth.routes.ts
│   ├── producer.routes.ts
│   ├── batch.routes.ts
│   ├── event.routes.ts
│   └── health.routes.ts
├── validators/
│   ├── auth.validators.ts
│   └── common.validators.ts
└── middlewares/
    └── validate.middleware.ts
```

**Example Controller**:
```typescript
// src/presentation/controllers/auth.controller.ts
export class AuthController {
  constructor(
    private registerUserUC: RegisterUser,
    private loginUserUC: LoginUser
  ) {}

  async register(req: Request, res: Response): Promise<void> {
    const result = await this.registerUserUC.execute(req.body);

    if (result.isFailure) {
      res.status(400).json({ error: result.error });
      return;
    }

    res.status(201).json({
      success: true,
      data: {
        user: result.getValue(),
        token: this.generateToken(result.getValue())
      }
    });
  }

  async login(req: Request, res: Response): Promise<void> {
    const result = await this.loginUserUC.execute(req.body);

    if (result.isFailure) {
      res.status(401).json({ error: result.error });
      return;
    }

    res.status(200).json({
      success: true,
      data: {
        user: result.getValue(),
        token: this.generateToken(result.getValue())
      }
    });
  }
}
```

**Health Check Endpoint** (Added in commit 8d3d9d5):
```typescript
// src/presentation/controllers/health.controller.ts
export class HealthController {
  async check(req: Request, res: Response): Promise<void> {
    try {
      // Check database connectivity
      await prisma.$queryRaw`SELECT 1`;

      res.status(200).json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        database: 'connected',
        uptime: process.uptime()
      });
    } catch (error) {
      res.status(503).json({
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        database: 'disconnected',
        uptime: process.uptime()
      });
    }
  }
}
```

---

## Design Patterns Used

### 1. Repository Pattern
**Purpose**: Abstract data access layer

**Benefits**:
- Testability (easy mocking)
- Database agnostic
- Centralized queries

**Example**:
```typescript
interface IUserRepository {
  findById(id: string): Promise<User | null>;
  findByEmail(email: string): Promise<User | null>;
  save(user: User): Promise<void>;
  update(user: User): Promise<void>;
  delete(id: string): Promise<void>;
}
```

### 2. Dependency Injection
**Purpose**: Loose coupling between layers

**Implementation**: Constructor injection

**Example**:
```typescript
class RegisterUser {
  constructor(
    private userRepo: IUserRepository,      // Injected dependency
    private emailService: IEmailService     // Injected dependency
  ) {}
}
```

### 3. Result Pattern (Railway Oriented Programming)
**Purpose**: Explicit error handling without exceptions

**Example**:
```typescript
class Result<T> {
  private constructor(
    public isSuccess: boolean,
    public value?: T,
    public error?: string
  ) {}

  static ok<U>(value: U): Result<U> {
    return new Result<U>(true, value);
  }

  static fail<U>(error: string): Result<U> {
    return new Result<U>(false, undefined, error);
  }
}
```

### 4. Value Object Pattern
**Purpose**: Encapsulate validation and behavior of primitive values

**Example**: `Password`, `Email`, `UserId`

### 5. Use Case Pattern
**Purpose**: Each use case represents one business operation

**Example**: `RegisterUser`, `CreateProducer`, `UpdateBatch`

### 6. Mapper Pattern
**Purpose**: Transform between domain entities and DTOs/persistence models

**Example**:
```typescript
class UserMapper {
  static toDomain(raw: any): User {
    // Convert database record to domain entity
  }

  static toDTO(user: User): UserDTO {
    // Convert domain entity to DTO
  }

  static toPersistence(user: User): any {
    // Convert domain entity to database record
  }
}
```

---

## Data Flow Examples

### Example 1: User Registration Flow

```
Client → POST /api/auth/register
  ↓
API Layer (AuthController)
  - Validates request (Joi validator)
  - Calls RegisterUser use case
  ↓
Application Layer (RegisterUser use case)
  - Creates Email value object
  - Creates Password value object
  - Checks if user exists (via repository)
  - Creates User entity
  - Saves via repository
  - Dispatches UserRegisteredEvent
  ↓
Infrastructure Layer
  - PrismaUserRepository persists to PostgreSQL
  - Event handler sends welcome email
  ↓
API Layer
  - Returns 201 Created with user data + JWT token
```

### Example 2: Create Batch Flow

```
Client → POST /api/batches (with JWT token)
  ↓
Middleware Stack
  - Rate limiter checks request count
  - Auth middleware validates JWT
  - Audit logger records request
  ↓
API Layer (BatchController)
  - Validates request body
  - Calls CreateBatch use case
  ↓
Application Layer (CreateBatch use case)
  - Validates producer exists
  - Creates Batch entity with business rules
  - Saves via repository
  ↓
Infrastructure Layer
  - PrismaBatchRepository persists to PostgreSQL
  ↓
API Layer
  - Returns 201 Created with batch data
```

---

## Database Schema (Prisma)

**Location**: `src/infrastructure/database/prisma/schema.prisma`

**Key Models**:
```prisma
model User {
  id        String   @id @default(uuid())
  email     String   @unique
  password  String
  name      String
  role      UserRole
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  producers Producer[]
}

model Producer {
  id        String   @id @default(uuid())
  name      String
  location  String
  userId    String
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  user    User    @relation(fields: [userId], references: [id])
  batches Batch[]
}

model Batch {
  id          String   @id @default(uuid())
  code        String   @unique
  producerId  String
  quantity    Int
  harvestDate DateTime
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  producer Producer @relation(fields: [producerId], references: [id])
  events   Event[]
}

model Event {
  id          String   @id @default(uuid())
  batchId     String
  type        String
  description String
  location    String?
  timestamp   DateTime @default(now())

  batch Batch @relation(fields: [batchId], references: [id])
}
```

**Indexes**:
- `User.email` (unique)
- `Batch.code` (unique)
- `Batch.producerId` (foreign key)
- `Event.batchId` (foreign key)

---

## Security Architecture

### Authentication Flow
```
User submits credentials
  ↓
Password validated against hashed version
  ↓
JWT token generated (7d expiration)
  ↓
Token includes: userId, email, role
  ↓
Client includes token in Authorization header
  ↓
Auth middleware validates token on each request
  ↓
Request context includes authenticated user
```

### Authorization
- **RBAC**: Role-Based Access Control
- **Roles**: ADMIN, FARMER, EXPORTER
- **Middleware**: Checks user role before controller execution

---

## Performance Optimizations

### 1. Database
- ✅ Connection pooling (`connection_limit=20`)
- ✅ Optimized queries (select only needed fields)
- ✅ Indexes on frequently queried fields
- ✅ N+1 query elimination

### 2. API
- ✅ Response compression (gzip)
- ✅ Caching headers
- ✅ Pagination on list endpoints

### 3. Infrastructure
- ✅ PM2 cluster mode (multi-core utilization)
- ✅ Docker multi-stage build (smaller image)
- ✅ Nginx reverse proxy (static file serving)

---

## Scalability Considerations

### Horizontal Scaling
- **Stateless API**: No session storage in memory
- **Database**: Can add read replicas
- **Load Balancer**: Nginx/ALB distributes traffic
- **Auto-scaling**: ECS/K8s can scale based on CPU/memory

### Vertical Scaling
- **Database**: Upgrade RDS instance type
- **API**: Increase container CPU/memory

### Future Enhancements
- [ ] Redis caching layer
- [ ] ElasticSearch for search
- [ ] Message queue (RabbitMQ/SQS) for async operations
- [ ] CDN for static assets
- [ ] Multi-region deployment

---

## Technology Stack Summary

| Layer | Technologies |
|-------|-------------|
| **Language** | TypeScript 5.3 |
| **Runtime** | Node.js 20.x |
| **Framework** | Express 4.x |
| **Database** | PostgreSQL 15.x |
| **ORM** | Prisma 5.x |
| **Cache** | Redis 7.x |
| **Testing** | Vitest |
| **Logging** | Winston |
| **Validation** | Joi/Zod |
| **Auth** | JWT (jsonwebtoken) |
| **Security** | Helmet, bcrypt |
| **Process Manager** | PM2 |
| **Containerization** | Docker |

---

## Architecture Principles

### 1. Separation of Concerns
Each layer has a specific responsibility and doesn't know about outer layers.

### 2. Dependency Rule
Dependencies point inward. Domain layer has no dependencies on outer layers.

### 3. Testability
Business logic (domain + application) can be tested without infrastructure.

### 4. Technology Agnostic Core
Domain layer doesn't depend on Express, Prisma, or any framework.

### 5. Explicit Over Implicit
Use Result pattern instead of throwing exceptions. Explicit error handling.

### 6. DRY (Don't Repeat Yourself)
Reusable value objects, mappers, and utility functions.

---

## Future Architecture Enhancements

### Phase 2 (Post-Seed Funding)
- [ ] **Event Sourcing**: Store all state changes as events
- [ ] **CQRS**: Separate read/write models
- [ ] **Microservices**: Split into smaller services
  - Auth Service
  - Producer Service
  - Batch Service
  - Event Service
- [ ] **Message Queue**: RabbitMQ or AWS SQS
- [ ] **API Gateway**: Kong or AWS API Gateway

### Phase 3 (Series A+)
- [ ] **GraphQL API**: In addition to REST
- [ ] **WebSockets**: Real-time updates
- [ ] **Multi-tenancy**: Separate data per organization
- [ ] **Multi-region**: Deploy in multiple AWS regions
- [ ] **Kubernetes**: Replace ECS for more control

---

## References

- [Clean Architecture by Robert C. Martin](https://blog.cleancoder.com/uncle-bob/2012/08/13/the-clean-architecture.html)
- [Domain-Driven Design by Eric Evans](https://www.domainlanguage.com/ddd/)
- [Node.js Best Practices](https://github.com/goldbergyoni/nodebestpractices)
- [TypeScript Deep Dive](https://basarat.gitbook.io/typescript/)

---

**Document Version**: 1.0.0
**Last Updated**: December 13, 2025
**Maintained by**: AgroBridge Engineering Team
**Lead Architect**: Alejandro Navarro Ayala, CEO & CTO
**Contact**: engineering@agrobridge.io
