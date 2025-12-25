# AgroBridge API

Backend API for AgroBridge - agricultural traceability and fintech platform.

```bash
# Get running in 60 seconds
git clone <repository-url> && cd agrobridge-backend/apps/api
cp .env.example .env
npm install && npm run prisma:generate && npm run prisma:migrate
npm run dev
# API running at http://localhost:4000
```

## What's Here

AgroBridge connects farmers to markets through verified product traceability and embedded financial services.

**Core Features:**
- **Traceability** - Track produce from farm to table with blockchain-anchored certificates
- **Organic Certification** - Generate, verify, and manage organic certificates
- **FinTech** - Credit scoring, advance payments, automated collections
- **Multi-channel Notifications** - Push, SMS, WhatsApp, Email

**Tech Stack:**
- TypeScript 5.3 / Node.js 20 / Express 4
- PostgreSQL 15 + Prisma ORM
- Redis for caching and queues
- Polygon blockchain for certificate anchoring

## Quick Reference

| Command | What it does |
|---------|--------------|
| `npm run dev` | Start development server (port 4000) |
| `npm test` | Run all tests |
| `npm run build` | Build for production |
| `npm run prisma:studio` | Open database browser |

**Health check:** `curl http://localhost:4000/health`

## Documentation

| Doc | Purpose |
|-----|---------|
| [Onboarding Guide](./docs/ONBOARDING.md) | New developer setup |
| [Architecture](./ARCHITECTURE.md) | System design and patterns |
| [API Reference](./API-DOCUMENTATION.md) | Endpoint documentation |
| [Deployment](./DEPLOYMENT.md) | Production deployment |
| [Troubleshooting](./docs/TROUBLESHOOTING.md) | Common issues and fixes |

## Project Structure

```
src/
├── domain/           # Business logic (entities, services)
├── application/      # Use cases (what the app can do)
├── infrastructure/   # External services (database, cache, APIs)
├── presentation/     # HTTP layer (routes, controllers)
└── modules/          # Feature modules (fintech, notifications)
```

The codebase uses [Clean Architecture](./ARCHITECTURE.md) - business logic is isolated from infrastructure concerns.

## API Overview

Base URL: `http://localhost:4000/api/v1`

| Endpoint | Description |
|----------|-------------|
| `POST /auth/login` | Get JWT token |
| `GET /producers` | List farmers |
| `POST /organic-certificates/generate` | Create certificate |
| `GET /verify/:number` | Public certificate verification |

All endpoints except `/health` and `/verify` require authentication:
```bash
curl -H "Authorization: Bearer <token>" http://localhost:4000/api/v1/producers
```

See [API Documentation](./API-DOCUMENTATION.md) for complete reference.

## Environment Variables

Required for development:

```bash
DATABASE_URL=postgresql://user:pass@localhost:5432/agrobridge
REDIS_URL=redis://localhost:6379
JWT_SECRET=your-32-character-secret-key-here
```

See `.env.example` for all options including AWS, blockchain, and notification settings.

## Running Tests

```bash
npm test              # All tests
npm run test:unit     # Unit tests only
npm run test:coverage # With coverage report
```

Current status: 515 tests passing.

## Contributing

1. Create a feature branch from `main`
2. Make your changes
3. Run `npm test` and `npm run type-check`
4. Open a PR

## Support

- **Issues:** [GitHub Issues](https://github.com/AgroBridge-backup/backend/issues)
- **Slack:** #backend-support
- **Docs:** See [Documentation](#documentation) section above
