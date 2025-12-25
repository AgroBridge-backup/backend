# Getting Started

This guide gets you from zero to running the API locally. By the end, you'll have:
- A working development environment
- Understanding of the project structure
- Your first API request working

**Time needed:** 15-20 minutes

---

## Prerequisites

Before you start, you'll need:

| Tool | Version | Check with |
|------|---------|------------|
| Node.js | 20+ | `node --version` |
| PostgreSQL | 15+ | `psql --version` |
| Redis | 7+ | `redis-cli --version` |

**Don't have these?** The easiest path is Docker:
```bash
# Start PostgreSQL and Redis with one command
docker run -d --name postgres -e POSTGRES_PASSWORD=dev123 -e POSTGRES_DB=agrobridge_dev -p 5432:5432 postgres:15
docker run -d --name redis -p 6379:6379 redis:7-alpine
```

---

## Step 1: Clone and Install

```bash
git clone <repository-url>
cd agrobridge-backend/apps/api
npm install
```

This takes 2-3 minutes. While waiting, move to Step 2.

---

## Step 2: Configure Environment

```bash
cp .env.example .env
```

Open `.env` and update these three values:

```bash
DATABASE_URL=postgresql://postgres:dev123@localhost:5432/agrobridge_dev
REDIS_URL=redis://localhost:6379
JWT_SECRET=any-string-at-least-32-characters-long
```

> **Tip:** For local development, the values above work if you used our Docker commands.

---

## Step 3: Set Up the Database

```bash
npm run prisma:generate    # Generate Prisma client
npm run prisma:migrate     # Create database tables
npm run prisma:seed        # Add sample data (optional)
```

**If migration fails:** Check that PostgreSQL is running and your DATABASE_URL is correct.

---

## Step 4: Start the Server

```bash
npm run dev
```

You should see:
```
[INFO] Server running on http://localhost:4000
[INFO] Database connected
[INFO] Redis connected
```

---

## Step 5: Verify Everything Works

```bash
curl http://localhost:4000/health
```

Expected response:
```json
{"status":"healthy","timestamp":"...","services":{"database":"connected","redis":"connected"}}
```

You're done with setup.

---

## Understanding the Codebase

### Project Structure

```
src/
├── domain/              # The "what" - business rules
│   ├── entities/        # Core objects (User, Batch, Certificate)
│   ├── services/        # Business logic
│   └── repositories/    # Data access interfaces
│
├── application/         # The "how" - use cases
│   └── use-cases/       # One file per user action
│
├── infrastructure/      # The "with what" - external stuff
│   ├── database/        # Prisma repositories
│   ├── cache/           # Redis caching
│   ├── blockchain/      # Ethereum/Polygon
│   └── notifications/   # Push, Email, SMS
│
├── presentation/        # The "where" - HTTP layer
│   ├── routes/          # API endpoints
│   └── middlewares/     # Auth, validation, rate limiting
│
└── modules/             # Feature modules
    ├── collections/     # Payment collection
    ├── credit-scoring/  # Credit assessment
    └── whatsapp-bot/    # WhatsApp integration
```

### The Key Idea: Clean Architecture

Business logic lives in `domain/` and doesn't know about databases or HTTP. This means:
- You can test business rules without a database
- Switching databases doesn't require rewriting business logic
- New features go in predictable places

### Where Things Live

| You want to... | Look in... |
|----------------|------------|
| Add an API endpoint | `src/presentation/routes/` |
| Add business logic | `src/domain/services/` |
| Change database queries | `src/infrastructure/database/` |
| Add a new use case | `src/application/use-cases/` |
| Send notifications | `src/infrastructure/notifications/` |

---

## Common Tasks

### Adding a New Endpoint

1. Create or edit a route file:
```typescript
// src/presentation/routes/my-feature.routes.ts
import { Router } from 'express';
import { authenticate } from '../middlewares/auth.middleware.js';

export function createMyFeatureRouter(): Router {
  const router = Router();

  router.get('/', authenticate, async (req, res) => {
    res.json({ message: 'Hello from my feature' });
  });

  return router;
}
```

2. Register in `src/presentation/routes/index.ts`:
```typescript
import { createMyFeatureRouter } from './my-feature.routes.js';
router.use('/my-feature', createMyFeatureRouter());
```

3. Test it:
```bash
curl http://localhost:4000/api/v1/my-feature
```

### Adding a Database Migration

```bash
# Modify prisma/schema.prisma, then:
npm run prisma:migrate -- --name describe_your_change
```

### Running Tests

```bash
npm test                    # All tests
npm test -- --watch         # Watch mode (re-runs on changes)
npm run test:unit           # Unit tests only
npm run test:coverage       # With coverage report
```

### Debugging

**View database:**
```bash
npm run prisma:studio
# Opens at http://localhost:5555
```

**Enable verbose logging:**
```bash
LOG_LEVEL=debug npm run dev
```

**VS Code debugging:** Launch config is in `.vscode/launch.json`

---

## Making Your First API Call

### 1. Log in to get a token

```bash
curl -X POST http://localhost:4000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@agrobridge.com","password":"Admin123!"}'
```

Copy the `accessToken` from the response.

### 2. Use the token for authenticated requests

```bash
curl http://localhost:4000/api/v1/producers \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

---

## When Things Go Wrong

### "Can't reach database server"

```bash
# Is PostgreSQL running?
docker ps | grep postgres

# Not running? Start it:
docker start postgres
```

### "Redis connection refused"

```bash
# Is Redis running?
docker ps | grep redis

# Not running? Start it:
docker start redis
```

### "Prisma client not generated"

```bash
npm run prisma:generate
```

### "Migration failed"

```bash
# Reset database (destroys data!)
npm run prisma:migrate reset
```

See [Troubleshooting](./TROUBLESHOOTING.md) for more solutions.

---

## Useful Commands

| Command | What it does |
|---------|--------------|
| `npm run dev` | Start dev server with hot reload |
| `npm run build` | Build for production |
| `npm test` | Run tests |
| `npm run type-check` | Check TypeScript types |
| `npm run lint` | Run linter |
| `npm run prisma:studio` | Visual database browser |
| `npm run prisma:migrate` | Run migrations |

---

## Next Steps

Now that you're set up:

1. **Explore the API** - See [API Documentation](../API-DOCUMENTATION.md)
2. **Understand the architecture** - See [Architecture](../ARCHITECTURE.md)
3. **Pick up a task** - Check the project board

Questions? Ask in Slack #backend-support.
