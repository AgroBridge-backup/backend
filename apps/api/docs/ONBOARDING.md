# AgroBridge Backend - Developer Onboarding Guide

Welcome to the AgroBridge backend! This guide will help you get productive quickly.

---

## Quick Start (15 minutes)

### Prerequisites

- **Node.js 20+** - `node --version`
- **PostgreSQL 15+** - `psql --version`
- **Redis 7+** - `redis-cli --version`
- **Docker** (optional) - `docker --version`

### 1. Clone & Install

```bash
# Clone repository
git clone <repository-url>
cd agrobridge-backend/apps/api

# Install dependencies
npm install

# Generate Prisma client
npm run prisma:generate
```

### 2. Environment Setup

```bash
# Copy environment template
cp .env.example .env

# Edit .env with your local values
# Required: DATABASE_URL, REDIS_URL, JWT_SECRET
```

### 3. Database Setup

```bash
# Option A: Using Docker (recommended)
docker run -d --name postgres \
  -e POSTGRES_PASSWORD=dev123 \
  -e POSTGRES_DB=agrobridge_dev \
  -p 5432:5432 \
  postgres:15

docker run -d --name redis \
  -p 6379:6379 \
  redis:7-alpine

# Option B: Local PostgreSQL + Redis
# Ensure services are running on default ports

# Run migrations
npm run prisma:migrate

# Seed database (optional)
npm run prisma:seed
```

### 4. Start Development Server

```bash
npm run dev
# Server starts at http://localhost:4000
```

### 5. Verify Setup

```bash
# Health check
curl http://localhost:4000/health

# Expected response:
# {"status":"healthy","timestamp":"...","services":{"database":"connected","redis":"connected"}}
```

---

## Project Structure

```
apps/api/
├── src/
│   ├── domain/              # Business logic (framework-agnostic)
│   │   ├── entities/        # Domain models (Batch, Producer)
│   │   ├── services/        # Business rules
│   │   └── repositories/    # Data access interfaces
│   │
│   ├── application/         # Use case orchestration
│   │   └── use-cases/       # Application-specific flows
│   │       ├── auth/        # Authentication
│   │       ├── batches/     # Batch management
│   │       ├── organic-certificates/  # Certification
│   │       └── ...
│   │
│   ├── infrastructure/      # External concerns
│   │   ├── database/        # Prisma repositories
│   │   ├── cache/           # Redis caching
│   │   ├── blockchain/      # Ethers.js integration
│   │   ├── notifications/   # FCM, APNs, Email, SMS
│   │   └── monitoring/      # Sentry APM
│   │
│   ├── presentation/        # API layer
│   │   ├── routes/          # REST endpoints
│   │   ├── validation/      # Zod schemas
│   │   └── middlewares/     # Auth, rate limiting
│   │
│   ├── modules/             # Feature modules
│   │   ├── collections/     # Payment collections
│   │   ├── credit-scoring/  # Credit assessment
│   │   └── whatsapp-bot/    # WhatsApp integration
│   │
│   ├── app.ts               # Express app setup
│   └── server.ts            # Entry point
│
├── tests/                   # Test files
│   ├── unit/
│   ├── integration/
│   └── e2e/
│
├── docs/                    # Documentation
└── scripts/                 # Utility scripts
```

---

## Key Concepts

### 1. Clean Architecture

The codebase follows Clean Architecture (Domain-Driven Design):

| Layer | Purpose | Example |
|-------|---------|---------|
| **Domain** | Core business logic | `OrganicCertificateService` |
| **Application** | Use case orchestration | `GenerateCertificateUseCase` |
| **Infrastructure** | External integrations | `PrismaUserRepository` |
| **Presentation** | HTTP API | `organic-certificates.routes.ts` |

**Rule:** Inner layers never depend on outer layers.

### 2. Dependency Injection

Dependencies are injected via constructors:

```typescript
// In app.ts
const userRepository = new PrismaUserRepository(prisma);
const loginUseCase = new LoginUseCase(userRepository, refreshTokenRepository);

// Use cases receive repositories, not Prisma directly
```

### 3. Repository Pattern

Data access is abstracted through interfaces:

```typescript
// Domain interface (src/domain/repositories/)
interface IUserRepository {
  findById(id: string): Promise<User | null>;
  create(data: CreateUserDTO): Promise<User>;
}

// Infrastructure implementation (src/infrastructure/database/prisma/repositories/)
class PrismaUserRepository implements IUserRepository {
  constructor(private prisma: PrismaClient) {}

  async findById(id: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { id } });
  }
}
```

### 4. Use Case Pattern

Each user action has a dedicated use case:

```typescript
// src/application/use-cases/auth/LoginUseCase.ts
class LoginUseCase implements IUseCase<LoginDTO, AuthResult> {
  constructor(
    private userRepository: IUserRepository,
    private tokenRepository: IRefreshTokenRepository,
  ) {}

  async execute(input: LoginDTO): Promise<AuthResult> {
    // 1. Find user
    // 2. Verify password
    // 3. Generate tokens
    // 4. Return result
  }
}
```

---

## Common Tasks

### Adding a New API Endpoint

1. **Create/update route file:**
```typescript
// src/presentation/routes/my-feature.routes.ts
import { Router } from 'express';
import { authenticate } from '../middlewares/auth.middleware.js';

export function createMyFeatureRouter(): Router {
  const router = Router();

  router.get('/', authenticate, async (req, res) => {
    // Handler logic
  });

  return router;
}
```

2. **Register in routes/index.ts:**
```typescript
import { createMyFeatureRouter } from './my-feature.routes.js';

router.use('/my-feature', createMyFeatureRouter());
```

### Adding a New Use Case

1. **Create use case file:**
```typescript
// src/application/use-cases/my-feature/DoSomethingUseCase.ts
import { IUseCase } from '../../../shared/interfaces/IUseCase.js';

interface DoSomethingInput { /* ... */ }
interface DoSomethingOutput { /* ... */ }

export class DoSomethingUseCase implements IUseCase<DoSomethingInput, DoSomethingOutput> {
  constructor(private someRepository: ISomeRepository) {}

  async execute(input: DoSomethingInput): Promise<DoSomethingOutput> {
    // Business logic here
  }
}
```

2. **Register in app.ts** (if needed for DI)

### Running Database Migrations

```bash
# Create new migration
npm run prisma:migrate -- --name add_new_table

# Apply migrations
npm run prisma:migrate

# View database in browser
npm run prisma:studio
```

### Running Tests

```bash
# All tests
npm test

# Unit tests only
npm run test:unit

# Integration tests
npm run test:integration

# With coverage
npm run test:coverage

# Watch mode (development)
npm test -- --watch
```

---

## API Overview

### Base URLs

| Environment | URL |
|-------------|-----|
| Development | `http://localhost:4000/api/v1` |
| Staging | `https://staging-api.agrobridge.com.mx/api/v1` |
| Production | `https://api.agrobridge.com.mx/api/v1` |

### Authentication

```bash
# Login
curl -X POST http://localhost:4000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"password123"}'

# Use token for authenticated requests
curl http://localhost:4000/api/v1/producers \
  -H "Authorization: Bearer <your-token>"
```

### Key Endpoints

| Endpoint | Description |
|----------|-------------|
| `POST /auth/login` | User login |
| `POST /auth/register` | User registration |
| `GET /producers` | List producers |
| `POST /organic-certificates/generate` | Generate certificate |
| `GET /verify/:certificateNumber` | Public verification |
| `GET /health` | Health check |

See [API-DOCUMENTATION.md](./API-DOCUMENTATION.md) for complete reference.

---

## Configuration

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `NODE_ENV` | Yes | `development`, `staging`, `production` |
| `PORT` | No | Server port (default: 4000) |
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `REDIS_URL` | Yes | Redis connection string |
| `JWT_SECRET` | Yes | JWT signing secret |
| `JWT_EXPIRES_IN` | No | Token expiry (default: 7d) |
| `SENTRY_DSN` | No | Sentry error tracking |
| `AWS_REGION` | No | AWS region for S3/SES |

See `.env.example` for all options.

---

## Debugging

### VS Code Launch Configuration

```json
// .vscode/launch.json
{
  "version": "0.2.0",
  "configurations": [
    {
      "type": "node",
      "request": "launch",
      "name": "Debug API",
      "runtimeExecutable": "npm",
      "runtimeArgs": ["run", "dev"],
      "env": { "NODE_ENV": "development" },
      "console": "integratedTerminal"
    }
  ]
}
```

### Enable Debug Logging

```bash
# In .env
LOG_LEVEL=debug

# Or via command line
LOG_LEVEL=debug npm run dev
```

### Prisma Studio

```bash
# Visual database browser
npm run prisma:studio
# Opens at http://localhost:5555
```

---

## Useful Commands

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server with hot reload |
| `npm run build` | Build for production |
| `npm run start:prod` | Start production server |
| `npm test` | Run all tests |
| `npm run type-check` | TypeScript type checking |
| `npm run lint` | Run ESLint |
| `npm run format` | Format code with Prettier |
| `npm run prisma:studio` | Open Prisma database browser |
| `npm run prisma:migrate` | Run database migrations |

---

## Getting Help

1. **Documentation**: Check `docs/` folder
2. **Architecture**: See [ARCHITECTURE.md](./ARCHITECTURE.md)
3. **API Reference**: See [API-DOCUMENTATION.md](./API-DOCUMENTATION.md)
4. **Troubleshooting**: See [TROUBLESHOOTING.md](./TROUBLESHOOTING.md)
5. **Team**: Ask in Slack #backend-support

---

## Next Steps

1. [ ] Complete environment setup
2. [ ] Run the test suite to verify everything works
3. [ ] Explore the codebase structure
4. [ ] Read the architecture documentation
5. [ ] Pick up your first task!

---

*Last updated: December 25, 2025*
