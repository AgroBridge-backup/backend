# AgroBridge Backend

Agricultural traceability platform enabling transparent, secure tracking from farm to consumer.

[![CI/CD](https://github.com/agrobridge/agrobridge-backend/workflows/CI/badge.svg)](https://github.com/agrobridge/agrobridge-backend/actions)
[![Version](https://img.shields.io/badge/version-2.0.0-green.svg)](https://github.com/agrobridge/agrobridge-backend/releases)
[![License](https://img.shields.io/badge/license-Proprietary-blue.svg)](LICENSE)

---

**Intellectual Property & All Rights Reserved**

This source code, documentation, technical specifications, and all artifacts related to the AgroBridge platform are the exclusive intellectual property of Alejandro Navarro Ayala and/or AGROBRIDGE S.A. de C.V. ("the Company"). Any reproduction, distribution, modification, sublicensing, or unauthorized disclosure of any portion of this project is strictly forbidden without the express written consent of the Company or Alejandro Navarro Ayala.

2025 Alejandro Navarro Ayala / AGROBRIDGE S.A. de C.V. All rights reserved.

---

## Features

- **Batch Traceability** - Track agricultural products through entire supply chain
- **Producer Management** - Manage producer profiles and certifications
- **Event Tracking** - Record harvest, transportation, quality checks, and more
- **Authentication** - JWT + 2FA + OAuth2 (Google, GitHub)
- **Payments** - Stripe subscription billing
- **Reports** - Generate PDF, CSV, Excel reports
- **Notifications** - Multi-channel (Push, SMS, Email, In-App)
- **Analytics** - Dashboard statistics and insights
- **Real-time** - WebSocket support for live updates
- **API** - REST v2 + GraphQL

---

## Quick Start

### Prerequisites

- Node.js 20+
- PostgreSQL 16+
- Redis 7+
- Docker (optional)

### Installation

```bash
# Clone repository
git clone https://github.com/agrobridge/agrobridge-backend.git
cd agrobridge-backend/apps/api

# Install dependencies
npm install

# Configure environment
cp .env.example .env
# Edit .env with your configuration

# Generate JWT keys
npm run generate:keys

# Run migrations
npx prisma migrate dev

# Start development server
npm run dev
```

Server running at **http://localhost:3000**

---

## Documentation

### API Documentation

| Resource | URL | Description |
|----------|-----|-------------|
| **Swagger UI** | `/api-docs` | Interactive REST API documentation |
| **GraphQL Playground** | `/graphql` | GraphQL schema explorer |
| **OpenAPI (JSON)** | `/openapi.json` | OpenAPI 3.0 specification |
| **OpenAPI (YAML)** | `/openapi.yaml` | OpenAPI 3.0 specification |
| **API Portal** | `/docs/api` | Developer documentation portal |

### Developer Guides

| Guide | Description |
|-------|-------------|
| [Getting Started](docs/guides/GETTING_STARTED.md) | Quick start for new developers |
| [Architecture](docs/ARCHITECTURE.md) | System architecture overview |
| [Deployment](docs/guides/DEPLOYMENT.md) | Production deployment guide |
| [API Reference](docs/guides/API_REFERENCE.md) | Complete endpoint reference |
| [Contributing](docs/CONTRIBUTING.md) | Contribution guidelines |

### Postman Collection

Import the Postman collection for quick API testing:

```
docs/postman/AgroBridge-API.postman_collection.json
docs/postman/AgroBridge-API.postman_environment.json
```

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     API Gateway / Load Balancer              │
└──────────────────────────┬──────────────────────────────────┘
                           │
           ┌───────────────┴───────────────┐
           │                               │
    ┌──────▼──────┐              ┌────────▼────────┐
    │   REST API   │              │   GraphQL API    │
    └──────┬───────┘              └────────┬─────────┘
           │                               │
           └───────────────┬───────────────┘
                           │
              ┌────────────▼────────────┐
              │   Clean Architecture    │
              │   (Domain-Driven)       │
              └────────────┬────────────┘
                           │
       ┌───────────────────┼───────────────────┐
       │                   │                   │
┌──────▼──────┐   ┌────────▼──────┐   ┌───────▼──────┐
│  PostgreSQL  │   │     Redis     │   │   AWS S3     │
└──────────────┘   └───────────────┘   └──────────────┘
```

---

## Tech Stack

### Core
- **Runtime:** Node.js 20
- **Language:** TypeScript 5
- **Framework:** Express.js 4
- **ORM:** Prisma 5

### Data
- **Database:** PostgreSQL 16
- **Cache:** Redis 7
- **Storage:** AWS S3
- **Queue:** Bull/BullMQ

### API
- **REST:** OpenAPI/Swagger
- **GraphQL:** GraphQL Yoga
- **WebSocket:** Socket.IO

### DevOps
- **Containerization:** Docker
- **Orchestration:** Kubernetes
- **CI/CD:** GitHub Actions
- **Monitoring:** Prometheus + Grafana

---

## Project Structure

```
apps/api/
├── src/
│   ├── application/        # Application layer (use cases)
│   ├── domain/             # Domain layer (business logic)
│   ├── infrastructure/     # Infrastructure (DB, cache, external APIs)
│   │   └── docs/           # API documentation
│   │       └── swagger/    # Swagger configuration
│   ├── presentation/       # Presentation (routes, controllers)
│   └── shared/             # Shared utilities
├── tests/                  # Tests (unit, integration, e2e, load)
└── package.json

docs/
├── guides/                 # Developer guides
├── postman/                # Postman collections
└── technical/              # Technical documentation
```

---

## Testing

```bash
# Run all tests
npm test

# Run unit tests
npm run test:unit

# Run integration tests
npm run test:integration

# Run load tests
npm run test:load

# Generate coverage report
npm run test:coverage
```

---

## API Endpoints

### Authentication

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/auth/register` | Register new user |
| POST | `/api/v1/auth/login` | Login and get tokens |
| POST | `/api/v1/auth/refresh` | Refresh access token |
| GET | `/api/v1/auth/me` | Get current user |
| POST | `/api/v1/auth/2fa/setup` | Setup 2FA |

### Batches

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/batches` | List batches |
| POST | `/api/v1/batches` | Create batch |
| GET | `/api/v1/batches/:id` | Get batch details |
| PUT | `/api/v1/batches/:id` | Update batch |
| DELETE | `/api/v1/batches/:id` | Delete batch |

### Events

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/events` | Register event |
| GET | `/api/v1/events/:id` | Get event details |
| POST | `/api/v1/events/:id/verify` | Verify on blockchain |

### Health

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Health check |
| GET | `/health/ready` | Readiness probe |
| GET | `/health/live` | Liveness probe |

For complete API documentation, visit `/api-docs` on your server.

---

## Deployment

### Docker

```bash
# Build image
docker build -t agrobridge-api .

# Run with docker-compose
docker-compose up -d
```

### Kubernetes

```bash
# Apply manifests
kubectl apply -f k8s/base/

# Check status
kubectl get pods -n agrobridge
```

See [Deployment Guide](docs/guides/DEPLOYMENT.md) for detailed instructions.

---

## Environment Variables

```bash
# Database
DATABASE_URL="postgresql://..."

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379

# JWT
JWT_ACCESS_SECRET=your_secret
JWT_REFRESH_SECRET=your_secret

# AWS
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your_key
AWS_SECRET_ACCESS_KEY=your_secret
S3_BUCKET=agrobridge

# Stripe
STRIPE_SECRET_KEY=sk_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

---

## Scripts

```bash
npm run dev           # Start development server
npm run build         # Build for production
npm run start         # Start production server
npm run test          # Run tests
npm run lint          # Lint code
npm run prisma:studio # Open Prisma Studio
```

---

## Contributing

See [CONTRIBUTING.md](docs/CONTRIBUTING.md) for contribution guidelines.

---

## License

Proprietary - 2025 AgroBridge. All rights reserved.

---

## Support

- **Documentation:** https://docs.agrobridge.io
- **Email:** support@agrobridge.io
- **Issues:** https://github.com/agrobridge/agrobridge-backend/issues

---

**Production URLs:**
- **Main Domain:** https://agrobridgeint.com
- **API Backend:** https://api.agrobridgeint.com
- **Health Check:** https://api.agrobridgeint.com/health
