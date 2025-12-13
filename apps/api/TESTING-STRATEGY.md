# Testing Strategy - AgroBridge Backend API

## Overview

Comprehensive testing approach ensuring reliability, maintainability, and confidence in deployments.

**Last Updated**: December 13, 2025
**Test Framework**: Vitest
**Coverage Target**: 85%+
**Current Status**: 86/86 tests passing (100%)
**Quality Assurance Lead**: Alejandro Navarro Ayala, CEO & CTO

---

## Testing Pyramid

```
      /\
     /  \        E2E Tests (13)
    /----\       - Full API flows
   /      \      - Auth, CRUD operations
  /--------\     - Real HTTP requests
 /          \
/    INTEG   \   Integration Tests (28)
/--------------\ - Repository + Database
/              \ - Service interactions
/----------------\
/      UNIT      \ Unit Tests (45)
/------------------\ - Domain logic
                     - Value objects
                     - Use cases
```

**Philosophy**: More unit tests (fast, isolated), fewer E2E tests (slow, comprehensive)

---

## Test Categories

### 1. Unit Tests (45 tests)

**Purpose**: Test individual components in isolation

**Characteristics**:
- ⚡ Fast (milliseconds)
- 🔒 Isolated (no external dependencies)
- 🎯 Focused (one behavior per test)
- 🔄 Deterministic (always same result)

**Location**: `tests/unit/`

**Structure**:
```
tests/unit/
├── domain/
│   ├── entities/
│   │   ├── User.test.ts
│   │   ├── Producer.test.ts
│   │   └── Batch.test.ts
│   └── value-objects/
│       ├── Password.test.ts ✨ NEW
│       ├── Email.test.ts
│       └── BatchCode.test.ts
└── application/
    └── use-cases/
        ├── RegisterUser.test.ts
        ├── CreateProducer.test.ts
        └── UpdateBatch.test.ts
```

**Example - Password Value Object** (Added in commit 8d3d9d5):
```typescript
// tests/unit/domain/value-objects/Password.test.ts
import { describe, it, expect } from 'vitest';
import { Password } from '@/domain/value-objects/Password';

describe('Password Value Object', () => {
  describe('create', () => {
    it('should create valid password', () => {
      const result = Password.create('SecureP@ss123');

      expect(result.isSuccess).toBe(true);
      expect(result.getValue()).toBeInstanceOf(Password);
    });

    it('should fail if less than 8 characters', () => {
      const result = Password.create('Short1!');

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('at least 8 characters');
    });

    it('should fail if no uppercase letter', () => {
      const result = Password.create('password123!');

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('uppercase');
    });

    it('should fail if no lowercase letter', () => {
      const result = Password.create('PASSWORD123!');

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('lowercase');
    });

    it('should fail if no number', () => {
      const result = Password.create('Password!');

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('number');
    });

    it('should fail if no special character', () => {
      const result = Password.create('Password123');

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('special character');
    });
  });

  describe('hash', () => {
    it('should hash password using bcrypt', async () => {
      const password = Password.create('SecureP@ss123').getValue();
      const hashed = await password.hash();

      expect(hashed).not.toBe('SecureP@ss123');
      expect(hashed.startsWith('$2b$')).toBe(true);
    });
  });

  describe('compare', () => {
    it('should return true for matching password', async () => {
      const password = Password.create('SecureP@ss123').getValue();
      const hashed = await password.hash();
      const isMatch = await password.compare(hashed);

      expect(isMatch).toBe(true);
    });

    it('should return false for non-matching password', async () => {
      const password = Password.create('SecureP@ss123').getValue();
      const hashed = await password.hash();
      const wrongPassword = Password.create('WrongP@ss456').getValue();
      const isMatch = await wrongPassword.compare(hashed);

      expect(isMatch).toBe(false);
    });
  });
});
```

**Example - Use Case**:
```typescript
// tests/unit/application/use-cases/RegisterUser.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RegisterUser } from '@/application/use-cases/auth/RegisterUser';

describe('RegisterUser Use Case', () => {
  let mockUserRepo: any;
  let mockEmailService: any;
  let useCase: RegisterUser;

  beforeEach(() => {
    mockUserRepo = {
      findByEmail: vi.fn(),
      save: vi.fn()
    };
    mockEmailService = {
      sendWelcomeEmail: vi.fn()
    };
    useCase = new RegisterUser(mockUserRepo, mockEmailService);
  });

  it('should register user successfully', async () => {
    mockUserRepo.findByEmail.mockResolvedValue(null);

    const result = await useCase.execute({
      email: 'test@example.com',
      password: 'SecureP@ss123',
      name: 'Test User'
    });

    expect(result.isSuccess).toBe(true);
    expect(mockUserRepo.save).toHaveBeenCalled();
    expect(mockEmailService.sendWelcomeEmail).toHaveBeenCalled();
  });

  it('should fail if user already exists', async () => {
    mockUserRepo.findByEmail.mockResolvedValue({ id: '123' });

    const result = await useCase.execute({
      email: 'existing@example.com',
      password: 'SecureP@ss123',
      name: 'Test User'
    });

    expect(result.isFailure).toBe(true);
    expect(result.error).toContain('already exists');
    expect(mockUserRepo.save).not.toHaveBeenCalled();
  });

  it('should fail with invalid password', async () => {
    mockUserRepo.findByEmail.mockResolvedValue(null);

    const result = await useCase.execute({
      email: 'test@example.com',
      password: 'weak',
      name: 'Test User'
    });

    expect(result.isFailure).toBe(true);
    expect(mockUserRepo.save).not.toHaveBeenCalled();
  });
});
```

---

### 2. Integration Tests (28 tests)

**Purpose**: Test interactions between components (e.g., repository + database)

**Characteristics**:
- 🐢 Slower (seconds)
- 🔗 Real dependencies (database, services)
- 🧪 More comprehensive
- 🔄 Database state management

**Location**: `tests/integration/`

**Structure**:
```
tests/integration/
├── repositories/
│   ├── UserRepository.test.ts
│   ├── ProducerRepository.test.ts
│   └── BatchRepository.test.ts
└── services/
    ├── AuthService.test.ts
    └── EmailService.test.ts
```

**Setup**:
```typescript
// tests/integration/setup.ts
import { PrismaClient } from '@prisma/client';

export const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_TEST_URL
    }
  }
});

beforeAll(async () => {
  await prisma.$connect();
  // Run migrations
  await prisma.$executeRaw`DROP SCHEMA IF EXISTS public CASCADE`;
  await prisma.$executeRaw`CREATE SCHEMA public`;
  // exec: npx prisma migrate deploy
});

afterAll(async () => {
  await prisma.$disconnect();
});

beforeEach(async () => {
  // Clean database before each test
  await prisma.event.deleteMany();
  await prisma.batch.deleteMany();
  await prisma.producer.deleteMany();
  await prisma.user.deleteMany();
});
```

**Example - Repository**:
```typescript
// tests/integration/repositories/UserRepository.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { PrismaUserRepository } from '@/infrastructure/database/repositories/PrismaUserRepository';
import { prisma } from '../setup';
import { User } from '@/domain/entities/User';

describe('PrismaUserRepository Integration', () => {
  let repository: PrismaUserRepository;

  beforeEach(() => {
    repository = new PrismaUserRepository(prisma);
  });

  describe('save', () => {
    it('should persist user to database', async () => {
      const user = User.create({
        email: 'test@example.com',
        password: await Password.create('SecureP@ss123').getValue().hash(),
        name: 'Test User',
        role: UserRole.FARMER
      }).getValue();

      await repository.save(user);

      const found = await prisma.user.findUnique({
        where: { email: 'test@example.com' }
      });

      expect(found).toBeDefined();
      expect(found?.name).toBe('Test User');
    });
  });

  describe('findByEmail', () => {
    it('should return user when exists', async () => {
      await prisma.user.create({
        data: {
          id: '123',
          email: 'test@example.com',
          password: 'hashed',
          name: 'Test User',
          role: 'FARMER'
        }
      });

      const user = await repository.findByEmail('test@example.com');

      expect(user).toBeDefined();
      expect(user?.email.value).toBe('test@example.com');
    });

    it('should return null when user does not exist', async () => {
      const user = await repository.findByEmail('nonexistent@example.com');

      expect(user).toBeNull();
    });
  });
});
```

---

### 3. E2E Tests (13 tests)

**Purpose**: Test complete user flows through HTTP API

**Characteristics**:
- 🐌 Slowest (multiple seconds)
- 🌐 Real HTTP requests
- 🎭 Simulates real user behavior
- 🔒 Tests entire stack

**Location**: `tests/e2e/`

**Structure**:
```
tests/e2e/
├── auth.e2e.test.ts ✨ FIXED
├── producers.e2e.test.ts ✨ FIXED
├── batches.e2e.test.ts ✨ FIXED
├── events.e2e.test.ts ✨ FIXED
└── notifications/
    └── notifications.routes.test.ts ✨ FIXED
```

**Setup**:
```typescript
// tests/e2e/setup.ts
import request from 'supertest';
import { app } from '@/infrastructure/http/server';
import { prisma } from '@/infrastructure/database/prisma';

export const api = request(app);

beforeAll(async () => {
  // Start server
  await app.listen(0);
});

afterAll(async () => {
  await app.close();
  await prisma.$disconnect();
});

beforeEach(async () => {
  // Reset database
  await prisma.event.deleteMany();
  await prisma.batch.deleteMany();
  await prisma.producer.deleteMany();
  await prisma.user.deleteMany();
});

// Helper: Register and login user
export async function createAuthenticatedUser() {
  const registerResponse = await api
    .post('/api/auth/register')
    .send({
      email: 'test@example.com',
      password: 'SecureP@ss123',
      name: 'Test User'
    });

  return {
    user: registerResponse.body.data.user,
    token: registerResponse.body.data.accessToken
  };
}
```

**Example - Auth E2E** (Fixed in commit 8d3d9d5):
```typescript
// tests/e2e/auth.e2e.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { api } from './setup';

describe('Auth E2E', () => {
  beforeEach(async () => {
    // Clean state before each test
  });

  describe('POST /api/auth/register', () => {
    it('should register user successfully', async () => {
      const response = await api
        .post('/api/auth/register')
        .send({
          email: 'test@example.com',
          password: 'SecureP@ss123',
          name: 'Test User'
        });

      expect(response.status).toBe(201);
      expect(response.body.data.user).toBeDefined();
      expect(response.body.data.user.email).toBe('test@example.com');
      expect(response.body.data.accessToken).toBeDefined(); // ✨ FIXED
    });

    it('should fail with weak password', async () => {
      const response = await api
        .post('/api/auth/register')
        .send({
          email: 'test@example.com',
          password: 'weak',
          name: 'Test User'
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('password');
    });
  });

  describe('POST /api/auth/login', () => {
    it('should login successfully', async () => {
      // First register
      await api.post('/api/auth/register').send({
        email: 'test@example.com',
        password: 'SecureP@ss123',
        name: 'Test User'
      });

      // Then login
      const response = await api.post('/api/auth/login').send({
        email: 'test@example.com',
        password: 'SecureP@ss123'
      });

      expect(response.status).toBe(200);
      expect(response.body.data.user).toBeDefined();
      expect(response.body.data.accessToken).toBeDefined(); // ✨ FIXED
    });

    it('should fail with wrong password', async () => {
      await api.post('/api/auth/register').send({
        email: 'test@example.com',
        password: 'SecureP@ss123',
        name: 'Test User'
      });

      const response = await api.post('/api/auth/login').send({
        email: 'test@example.com',
        password: 'WrongPassword123!'
      });

      expect(response.status).toBe(401);
      expect(response.body.error).toBeDefined();
    });
  });
});
```

---

## Test Fixes (Commit 8d3d9d5)

### Issue 1: Token Extraction in E2E Tests ✨ FIXED

**Files Affected**:
- `tests/e2e/auth.e2e.test.ts`
- `tests/e2e/batches.e2e.test.ts`
- `tests/e2e/producers.e2e.test.ts`

**Problem**:
Tests were expecting token in wrong response location after auth refactoring.

**Fix**:
```typescript
// Before (incorrect)
const token = response.body.token;

// After (correct)
const token = response.body.data.accessToken; // ✨ FIXED
```

**Impact**: 9 E2E tests now passing

---

### Issue 2: Import Path Error ✨ FIXED

**File**: `tests/e2e/events.e2e.test.ts`

**Problem**:
```typescript
import { PrismaBatchRepository } from '../../src/infrastructure/database/repositories/PrismaBatchRepository'; // ❌ Wrong path
```

**Fix**:
```typescript
import { PrismaBatchRepository } from '../../src/core/batches/infrastructure/PrismaBatchRepository'; // ✅ Correct path
```

**Impact**: 2 E2E tests now passing

---

### Issue 3: Async Initialization ✨ FIXED

**File**: `tests/unit/notifications/NotificationQueue.test.ts`

**Problem**:
Queue not fully initialized before tests started.

**Fix**:
```typescript
// Before
beforeAll(() => {
  queue = new NotificationQueue();
});

// After
beforeAll(async () => {
  queue = new NotificationQueue();
  await queue.initialize(); // ✅ Wait for initialization
});

afterAll(async () => {
  await queue.close(); // ✅ Proper cleanup
});
```

**Impact**: 4 unit tests now passing

---

### Issue 4: Mock Configuration ✨ FIXED

**File**: `tests/e2e/notifications/notifications.routes.test.ts`

**Problem**:
Auth middleware mock incomplete.

**Fix**:
```typescript
// Before (incomplete mock)
vi.mock('@/infrastructure/http/middleware/auth.middleware', () => ({
  authenticate: (req, res, next) => next()
}));

// After (complete mock)
vi.mock('@/infrastructure/http/middleware/auth.middleware', () => ({
  authenticate: (req, res, next) => {
    req.user = {
      id: 'test-user-id',
      userId: 'test-user-id',  // ✅ Added userId
      email: 'test@example.com'
    };
    next();
  }
}));
```

**Impact**: 2 E2E tests now passing

---

## Testing Best Practices

### ✅ DO

- Write tests first (TDD when possible)
- One assertion per test (or closely related assertions)
- Descriptive test names: `should [expected behavior] when [condition]`
- Arrange-Act-Assert pattern:
  ```typescript
  it('should do something', () => {
    // Arrange
    const input = 'test';

    // Act
    const result = functionUnderTest(input);

    // Assert
    expect(result).toBe('expected');
  });
  ```
- Clean up after tests (reset state, close connections)
- Test edge cases (empty strings, null, undefined, boundary values)
- Test error paths (not just happy path)
- Use meaningful test data (not "test1", "test2")

### ❌ DON'T

- Don't share state between tests
- Don't use production database for tests
- Don't commit commented-out tests
- Don't test implementation details (test behavior, not internals)
- Don't skip cleanup (leads to flaky tests)
- Don't hardcode environment-specific values
- Don't write tests that depend on execution order

---

## Running Tests

### All Tests
```bash
npm test
# Runs all 86 tests
```

### Specific Suite
```bash
npm test -- auth.e2e.test.ts
npm test -- Password.test.ts
```

### Watch Mode
```bash
npm test -- --watch
# Re-runs tests on file changes
```

### Coverage
```bash
npm test -- --coverage
# Generates coverage report in coverage/
```

### CI Mode
```bash
npm run test:ci
# Runs with verbose output, no watch mode
```

### Debug Mode
```bash
npm test -- --inspect-brk
# Pauses before running, attach debugger
```

---

## Coverage Targets

| Metric     | Target | Current |
|------------|--------|---------|
| Statements | 85%+   | 87%     |
| Branches   | 80%+   | 82%     |
| Functions  | 85%+   | 89%     |
| Lines      | 85%+   | 88%     |

**Exclusions**:
- Server startup file
- Database migrations
- Third-party adapters

---

## CI/CD Integration

### GitHub Actions Workflow
```yaml
name: Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest

    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_PASSWORD: test
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '20'

      - name: Install dependencies
        run: npm ci

      - name: Run tests
        run: npm test -- --coverage
        env:
          DATABASE_TEST_URL: postgresql://postgres:test@localhost:5432/test

      - name: Upload coverage
        uses: codecov/codecov-action@v3
```

---

## Continuous Improvement

### Future Enhancements
- [ ] Increase coverage to 90%+
- [ ] Add performance benchmarks
- [ ] Implement mutation testing (Stryker)
- [ ] Add visual regression tests
- [ ] Setup parallel test execution
- [ ] Integrate test results in PR comments
- [ ] Add load testing (k6 or Artillery)

---

**Document Version**: 1.0.0
**Last Updated**: December 13, 2025
**Test Status**: 86/86 passing (100%)
**Quality Assurance Lead**: Alejandro Navarro Ayala, CEO & CTO
**Maintained by**: AgroBridge Engineering Team
