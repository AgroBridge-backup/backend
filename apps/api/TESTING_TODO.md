# AgroBridge API Testing Strategy

## Current Testing Status

### Test Framework
- **Runner**: Vitest (v1.2.1)
- **HTTP Testing**: Supertest
- **Coverage**: @vitest/coverage-v8

### Existing Test Coverage

| Category | Location | Status | Notes |
|----------|----------|--------|-------|
| Unit Tests | `tests/unit/` | ✅ Implemented | Domain logic, services |
| Integration Tests | `tests/integration/` | ✅ Implemented | API endpoints, WebSocket |
| E2E Tests | `tests/e2e/` | ✅ Implemented | Full flow testing |
| Load Tests | `tests/load/` | ✅ Implemented | k6 scripts |
| Performance | `tests/performance/` | ✅ Implemented | Benchmarks |
| Security | `tests/security/` | ✅ Implemented | Security tests |

### Running Tests

```bash
# All tests
npm test

# Unit tests only
npm run test:unit

# Integration tests
npm run test:integration

# E2E tests (requires DB reset)
npm run test:e2e

# With coverage
npm run test:coverage

# CI mode (verbose output)
npm run test:ci

# Load testing (requires k6 installed)
npm run test:load
npm run test:load:smoke
npm run test:load:full
npm run test:load:stress
```

---

## Testing Goals (Target)

| Metric | Target | Current | Status |
|--------|--------|---------|--------|
| Unit Test Coverage | >80% | ~75% | 🟡 In Progress |
| Integration Coverage | >60% | ~60% | ✅ Met |
| E2E Critical Flows | 100% | 100% | ✅ Met |
| Build Time | <5 min | ~3 min | ✅ Met |

---

## Priority Testing Areas

### P0 - Critical (Must Have)

#### Authentication & Authorization
- [ ] Login flow (happy path + failures)
- [ ] 2FA setup, enable, disable, verify
- [ ] Token refresh mechanism
- [ ] Session invalidation on logout
- [ ] Rate limiting on auth endpoints
- [ ] API key creation and validation

#### Core Business Logic
- [ ] Batch creation with blockchain hash
- [ ] Traceability event registration
- [ ] Producer whitelisting flow
- [ ] Certificate generation

#### Security
- [ ] SQL injection prevention (parameterized queries)
- [ ] XSS in user inputs
- [ ] CSRF protection
- [ ] JWT expiration handling
- [ ] Rate limit bypass attempts

### P1 - High Priority

#### Financial Module (Cash Flow Bridge)
- [ ] Credit score calculation
- [ ] Advance contract creation
- [ ] Repayment processing
- [ ] Pool capital management

#### Notifications
- [ ] Push notification delivery
- [ ] Email template rendering
- [ ] SMS delivery (mock)
- [ ] Notification preferences

#### Integrations
- [ ] WhatsApp webhook handling
- [ ] Stripe webhook processing
- [ ] Blockchain transaction submission

### P2 - Medium Priority

#### Reporting
- [ ] PDF generation
- [ ] CSV/Excel export
- [ ] Audit log querying

#### Performance
- [ ] Cache hit rates
- [ ] Database query optimization
- [ ] Response compression

---

## Test File Naming Convention

```
tests/
├── unit/
│   ├── domain/
│   │   └── BatchEntity.test.ts
│   ├── services/
│   │   └── CreditScoringService.test.ts
│   └── use-cases/
│       └── CreateBatchUseCase.test.ts
├── integration/
│   ├── auth.test.ts
│   ├── batches.test.ts
│   └── websocket.test.ts
├── e2e/
│   ├── traceability-flow.test.ts
│   └── payment-flow.test.ts
├── load/
│   └── k6/
│       ├── smoke.test.js
│       ├── load.test.js
│       └── stress.test.js
└── security/
    └── injection.test.ts
```

---

## Test Data Management

### Database Seeding

```bash
# Seed test database
npm run prisma:seed

# Reset and seed
npm run db:push && npm run prisma:seed
```

### Test Fixtures

Location: `tests/fixtures/`

```typescript
// Example fixture usage
import { createTestUser, createTestBatch } from '../fixtures';

describe('BatchController', () => {
  let testUser: User;
  let testBatch: Batch;

  beforeEach(async () => {
    testUser = await createTestUser();
    testBatch = await createTestBatch(testUser.id);
  });
});
```

---

## CI/CD Integration

### GitHub Actions

Tests run automatically on:
- Push to `main` or `develop`
- Pull requests to `main` or `develop`

### Pre-commit Hooks

Consider adding:
```json
{
  "husky": {
    "hooks": {
      "pre-commit": "npm run lint && npm run test:unit"
    }
  }
}
```

---

## Performance Benchmarks

### API Response Time Targets

| Endpoint | Target | P95 | P99 |
|----------|--------|-----|-----|
| GET /health | <10ms | 5ms | 10ms |
| GET /api/v1/batches | <100ms | 80ms | 150ms |
| POST /api/v1/batches | <500ms | 300ms | 500ms |
| GET /api/v1/batches/:id | <50ms | 40ms | 80ms |
| POST /api/v1/auth/login | <200ms | 150ms | 300ms |

### Load Test Thresholds

```javascript
// k6 thresholds
export const options = {
  thresholds: {
    http_req_duration: ['p(95)<500', 'p(99)<1000'],
    http_req_failed: ['rate<0.01'],
    http_reqs: ['rate>100'],
  },
};
```

---

## TODO: Priority Additions

### Week 1
1. [ ] Add missing auth flow tests (2FA edge cases)
2. [ ] Add API key service unit tests
3. [ ] Add audit logger integration tests

### Week 2
1. [ ] Add Cash Flow Bridge integration tests
2. [ ] Add WebSocket reconnection tests
3. [ ] Add rate limiter stress tests

### Week 3
1. [ ] Add security penetration tests
2. [ ] Add chaos engineering tests (network failures)
3. [ ] Add performance regression tests

### Week 4
1. [ ] Achieve >80% unit test coverage
2. [ ] Document all test scenarios
3. [ ] Set up test dashboards

---

## Mocking Strategy

### External Services

| Service | Mock Library | Notes |
|---------|--------------|-------|
| Redis | `ioredis-mock` | In-memory mock |
| PostgreSQL | Test container | Real Postgres in CI |
| Stripe | `stripe-mock` | Official mock server |
| SendGrid | Mock transport | Custom mock |
| Twilio | Mock client | Custom mock |
| Firebase | `firebase-admin-mock` | Custom mock |

### Environment Variables for Testing

```env
NODE_ENV=test
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/agrobridge_test
REDIS_HOST=localhost
REDIS_PORT=6379
JWT_SECRET=test-secret-key-for-ci-pipeline
JWT_EXPIRES_IN=1h
```

---

## Coverage Reports

After running `npm run test:coverage`:

- HTML Report: `coverage/index.html`
- JSON Report: `coverage/coverage-final.json`
- LCOV Report: `coverage/lcov.info` (for Codecov)

### Viewing Coverage

```bash
# Generate and open coverage report
npm run test:coverage
open coverage/index.html
```

---

## Contact

For testing questions, contact the engineering team or open an issue in the repository.
