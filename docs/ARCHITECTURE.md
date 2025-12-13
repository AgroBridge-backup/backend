# AgroBridge Backend Architecture

## System Overview

```
                    ┌──────────────┐
                    │   Internet   │
                    └──────┬───────┘
                           │
                    ┌──────▼───────┐
                    │    Nginx     │ :80, :443
                    │ Reverse Proxy│ (SSL Termination)
                    └──────┬───────┘
                           │
                    ┌──────▼───────┐
                    │     PM2      │ :4000
                    │  (Node.js)   │
                    └──────┬───────┘
                           │
            ┌──────────────┼──────────────┐
            │              │              │
     ┌──────▼──────┐ ┌────▼─────┐ ┌─────▼─────┐
     │  PostgreSQL │ │  Redis   │ │   Logs    │
     │    :5432    │ │  :6379   │ │ (Winston) │
     └─────────────┘ └──────────┘ └───────────┘
```

---

## Technology Stack

### Core
| Component | Technology | Version |
|-----------|------------|---------|
| Runtime | Node.js | 20.x |
| Language | TypeScript | 5.x |
| ORM | Prisma | 5.x |
| Process Manager | PM2 | Latest |

### Infrastructure
| Component | Technology |
|-----------|------------|
| Server | AWS EC2 (Ubuntu 22.04) |
| Database | PostgreSQL 14 |
| Cache | Redis 7 |
| Reverse Proxy | Nginx |
| SSL | Let's Encrypt (Certbot) |

### Monitoring
| Component | Technology |
|-----------|------------|
| Logging | Winston + Daily Rotate |
| Error Tracking | Sentry |
| Health Checks | Custom + Smoke Tests |
| Load Testing | k6 |

### Security
| Component | Technology |
|-----------|------------|
| Authentication | JWT (RS256) |
| Database Auth | SCRAM-SHA-256 |
| Transport | TLS 1.3 (Let's Encrypt) |

---

## Directory Structure

```
agrobridge-backend/
├── apps/
│   └── api/
│       ├── src/
│       │   ├── application/       # Use cases & business logic
│       │   ├── domain/            # Entities & value objects
│       │   ├── infrastructure/    # External services
│       │   │   ├── cache/         # Redis client
│       │   │   ├── config/        # Environment config
│       │   │   ├── database/      # Prisma client & repos
│       │   │   ├── http/          # Middleware
│       │   │   ├── logging/       # Winston logger
│       │   │   └── monitoring/    # Sentry
│       │   ├── presentation/      # Controllers & routes
│       │   └── shared/            # Utilities & errors
│       ├── prisma/
│       │   ├── schema.prisma      # Database schema
│       │   └── migrations/        # DB migrations
│       └── logs/                  # Application logs
├── scripts/
│   ├── deploy-staging.sh          # Staging deployment
│   ├── backup-database.sh         # DB backups
│   ├── pm2-monitor.sh             # Resource monitoring
│   ├── smoke-tests.sh             # Health checks
│   └── run-load-tests.sh          # k6 load tests
├── tests/
│   ├── unit/                      # Unit tests
│   ├── integration/               # Integration tests
│   └── load/                      # k6 load test scripts
├── docs/
│   ├── PRODUCTION.md              # Production operations
│   ├── RUNBOOK.md                 # Incident response
│   └── ARCHITECTURE.md            # This file
└── .github/
    └── workflows/                 # CI/CD pipelines
```

---

## Data Flow

### Request Lifecycle

1. **Client** → HTTPS request
2. **Nginx** → SSL termination, reverse proxy
3. **PM2** → Process management
4. **Application**:
   - Correlation ID middleware
   - Rate limiting (Redis)
   - Authentication middleware (JWT)
   - Request validation
   - Business logic
   - Database query (Prisma)
5. **Response** → JSON

### Authentication Flow

```
Client → POST /api/v1/auth/login
  → Validate credentials
  → Generate JWT (RS256)
  → Return { accessToken, refreshToken }

Client → Request with Bearer token
  → Verify JWT signature
  → Check blacklist (Redis)
  → Process request
```

---

## Database Schema

### Core Tables

| Table | Description |
|-------|-------------|
| `users` | User accounts and credentials |
| `batches` | Agricultural batches (lotes) |
| `transactions` | Blockchain transaction records |
| `refresh_tokens` | JWT refresh token tracking |
| `audit_logs` | Security audit trail |

### Key Relationships

- User → Batches (1:N)
- Batch → Transactions (1:N)
- User → RefreshTokens (1:N)

---

## Deployment Pipeline

```
Developer → git push develop
  ↓
GitHub Actions CI
  ├─ Lint & TypeScript Check
  ├─ Unit Tests
  ├─ Integration Tests
  └─ Build
  ↓
Deploy to Staging (auto)
  ↓
Smoke Tests
  ↓
Load Tests (k6)
  ↓
Manual Approval (for production)
  ↓
Deploy to Production
  ↓
Health Check (auto-rollback if fail)
```

---

## Security Measures

### Network
- HTTPS only (TLS 1.3)
- Security groups (SSH, HTTP, HTTPS only)
- Nginx rate limiting (10 req/s, burst 20)

### Application
- JWT authentication (RS256)
- CORS restrictions
- Input validation (Zod)
- SQL injection protection (Prisma)
- Helmet security headers

### Database
- SCRAM-SHA-256 authentication
- SSL/TLS connections
- Localhost-only access
- Encrypted backups

### Secrets
- No credentials in code
- .env with restricted permissions (600)
- JWT keys with restricted permissions

---

## Monitoring & Observability

### Metrics Collected
- Request latency (P50, P95, P99)
- Error rate
- Database query time
- Memory/CPU usage

### Log Retention
| Log Type | Retention |
|----------|-----------|
| Application | 14 days |
| Error | 30 days |
| HTTP | 7 days |
| Exceptions | 30 days |

### Alerts (via PM2 Monitor)
- CPU > 70%
- Memory > 80%
- Process crashed/errored
- Health check failure

---

## Scaling Strategy

### Current (t2.micro)
- Single instance
- ~50-100 concurrent users
- Cost: ~$11/month

### Next Step (t3.small)
- 2 PM2 instances (cluster)
- ~200-300 concurrent users
- Cost: ~$26/month

### Future (Production Scale)
- Horizontal: Multiple EC2 behind ALB
- Database: RDS PostgreSQL (Multi-AZ)
- Cache: ElastiCache Redis
- CDN: CloudFront
- Cost: ~$150-300/month

---

## API Versioning

Current version: **v1**

Base URL: `https://api-staging.agrobridge.io/api/v1`

### Endpoints Overview

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | /health | No | Health check |
| POST | /auth/login | No | User login |
| POST | /auth/register | No | User registration |
| POST | /auth/refresh | No | Refresh token |
| GET | /auth/me | Yes | Get current user |
| GET | /batches | Yes | List batches |
| POST | /batches | Yes | Create batch |
| GET | /batches/:id | Yes | Get batch details |

---

## Disaster Recovery

### Backups
| Type | Frequency | Retention |
|------|-----------|-----------|
| Daily | 3:00 AM | 7 days |
| Weekly | Sundays | 4 weeks |

### Recovery Objectives
- **RTO** (Recovery Time): < 1 hour
- **RPO** (Recovery Point): < 24 hours

### Rollback Capability
- Automatic on health check failure
- Manual via `deploy-staging.sh rollback`
- Git-based version control

---

## Future Enhancements

### Short-term
- [ ] AWS Secrets Manager integration
- [ ] CloudWatch custom dashboards
- [ ] Automated scaling

### Medium-term
- [ ] Multi-region deployment
- [ ] Read replicas for database
- [ ] Redis cluster

### Long-term
- [ ] Kubernetes migration
- [ ] Event-driven architecture (SQS/SNS)
- [ ] GraphQL API option
