# Getting Started with AgroBridge API

Welcome to AgroBridge! This guide will help you get up and running with the API in less than 30 minutes.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Authentication](#authentication)
- [Your First Request](#your-first-request)
- [Common Use Cases](#common-use-cases)
- [Next Steps](#next-steps)
- [Troubleshooting](#troubleshooting)

---

## Prerequisites

Before you begin, ensure you have:

- **Node.js 20+** installed ([download](https://nodejs.org/))
- **PostgreSQL 16+** running ([download](https://www.postgresql.org/download/))
- **Redis 7+** running ([download](https://redis.io/download/))
- **npm** or **pnpm** package manager
- Basic knowledge of REST APIs and JWT authentication

### Verify Installation

```bash
node --version  # Should be v20.x.x or higher
psql --version  # Should be 16.x or higher
redis-cli ping  # Should return PONG
```

---

## Installation

### 1. Clone the Repository

```bash
git clone https://github.com/agrobridge/agrobridge-backend.git
cd agrobridge-backend
```

### 2. Install Dependencies

```bash
# Navigate to the API app
cd apps/api

# Install dependencies
npm install
```

### 3. Configure Environment

Copy the example environment file:

```bash
cp .env.example .env
```

Edit `.env` with your configuration:

```bash
# Database
DATABASE_URL="postgresql://postgres:password@localhost:5432/agrobridge_dev"

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

# JWT Secrets (generate with: openssl rand -base64 32)
JWT_ACCESS_SECRET=your_access_secret_here
JWT_REFRESH_SECRET=your_refresh_secret_here

# Encryption Key (generate with: openssl rand -base64 32)
ENCRYPTION_KEY=your_encryption_key_here

# AWS S3 (optional for file storage)
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your_key
AWS_SECRET_ACCESS_KEY=your_secret
S3_BUCKET=agrobridge-dev

# Stripe (optional for payments)
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

### 4. Generate Keys

Generate RSA key pairs for JWT signing:

```bash
npm run generate:keys
```

### 5. Run Database Migrations

```bash
npx prisma migrate dev
```

### 6. Seed Database (Optional)

Populate the database with sample data:

```bash
npm run prisma:seed
```

### 7. Start Development Server

```bash
npm run dev
```

The API should now be running at **http://localhost:3000**

### Verify Installation

```bash
curl http://localhost:3000/health
```

Expected response:
```json
{
  "status": "healthy",
  "timestamp": "2024-03-15T10:30:00Z"
}
```

---

## Authentication

AgroBridge uses JWT (JSON Web Tokens) for authentication.

### Register a New User

```bash
curl -X POST http://localhost:3000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "producer@example.com",
    "password": "SecurePassword123!",
    "name": "Test Producer",
    "role": "PRODUCER"
  }'
```

**Response:**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "clq1234567890",
      "email": "producer@example.com",
      "name": "Test Producer",
      "role": "PRODUCER"
    },
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

### Login

```bash
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "producer@example.com",
    "password": "SecurePassword123!"
  }'
```

**Save the `accessToken`** from the response! You'll need it for authenticated requests.

### Making Authenticated Requests

Include the access token in the `Authorization` header:

```bash
curl http://localhost:3000/api/v1/auth/me \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

### Token Refresh

When your access token expires (15 minutes), use the refresh token to get a new one:

```bash
curl -X POST http://localhost:3000/api/v1/auth/refresh \
  -H "Content-Type: application/json" \
  -d '{
    "refreshToken": "YOUR_REFRESH_TOKEN"
  }'
```

---

## Your First Request

Let's create a batch (product lot) and track it through the supply chain.

### 1. Create a Batch

```bash
curl -X POST http://localhost:3000/api/v1/batches \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -d '{
    "origin": "Organic Tomatoes",
    "variety": "Roma",
    "weightKg": 500,
    "harvestDate": "2024-03-15T08:00:00Z",
    "certifications": ["ORGANIC"]
  }'
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "clq_batch_123",
    "batchNumber": "BATCH-2024-001",
    "origin": "Organic Tomatoes",
    "variety": "Roma",
    "weightKg": 500,
    "status": "REGISTERED",
    "harvestDate": "2024-03-15T08:00:00Z",
    "certifications": ["ORGANIC"],
    "qrCodeUrl": "https://cdn.agrobridge.io/qr/clq_batch_123.png",
    "createdAt": "2024-03-15T10:30:00Z"
  }
}
```

### 2. Add a Traceability Event

```bash
curl -X POST http://localhost:3000/api/v1/events \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -d '{
    "batchId": "clq_batch_123",
    "title": "Quality Check Passed",
    "eventType": "QUALITY_CHECK",
    "description": "All quality standards met",
    "timestamp": "2024-03-15T10:00:00Z",
    "temperature": 22,
    "humidity": 65
  }'
```

### 3. Get Batch with Events

```bash
curl "http://localhost:3000/api/v1/batches/clq_batch_123?include=events" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "clq_batch_123",
    "origin": "Organic Tomatoes",
    "status": "REGISTERED",
    "events": [
      {
        "id": "evt_123",
        "title": "Quality Check Passed",
        "eventType": "QUALITY_CHECK",
        "timestamp": "2024-03-15T10:00:00Z"
      }
    ]
  }
}
```

---

## Common Use Cases

### Use Case 1: Producer Creates and Tracks Batch

```javascript
// 1. Login
const loginResponse = await fetch('/api/v1/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: 'producer@example.com',
    password: 'SecurePassword123!'
  })
});
const { data: { accessToken } } = await loginResponse.json();

// 2. Create batch
const batchResponse = await fetch('/api/v1/batches', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${accessToken}`
  },
  body: JSON.stringify({
    origin: 'Organic Strawberries',
    weightKg: 250,
    harvestDate: new Date().toISOString()
  })
});
const { data: batch } = await batchResponse.json();

// 3. Add harvest event
await fetch('/api/v1/events', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${accessToken}`
  },
  body: JSON.stringify({
    batchId: batch.id,
    eventType: 'HARVEST',
    title: 'Harvest Complete',
    location: 'Field A-12'
  })
});

// 4. Update status
await fetch(`/api/v1/batches/${batch.id}`, {
  method: 'PUT',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${accessToken}`
  },
  body: JSON.stringify({
    status: 'IN_TRANSIT'
  })
});
```

### Use Case 2: Consumer Scans QR Code

```javascript
// Get public batch information (no auth required)
const response = await fetch(`/api/v1/public/batches/${batchId}`);
const { data: batch } = await response.json();

// Display traceability timeline
batch.events.forEach(event => {
  console.log(`${event.timestamp}: ${event.title}`);
});
```

### Use Case 3: Generate Reports

```javascript
// Generate PDF report
const reportResponse = await fetch(
  `/api/v1/reports/batch/${batchId}?format=pdf`,
  {
    headers: { 'Authorization': `Bearer ${accessToken}` }
  }
);

// Download the PDF
const blob = await reportResponse.blob();
const url = URL.createObjectURL(blob);
window.open(url);
```

---

## API Endpoints Overview

| Category | Endpoint | Description |
|----------|----------|-------------|
| **Auth** | `POST /api/v1/auth/register` | Register new user |
| **Auth** | `POST /api/v1/auth/login` | Login and get tokens |
| **Auth** | `POST /api/v1/auth/refresh` | Refresh access token |
| **Auth** | `GET /api/v1/auth/me` | Get current user |
| **Batches** | `GET /api/v1/batches` | List batches |
| **Batches** | `POST /api/v1/batches` | Create batch |
| **Batches** | `GET /api/v1/batches/:id` | Get batch details |
| **Batches** | `PUT /api/v1/batches/:id` | Update batch |
| **Events** | `POST /api/v1/events` | Register event |
| **Events** | `GET /api/v1/events/:id` | Get event details |
| **Producers** | `GET /api/v1/producers` | List producers |
| **Reports** | `GET /api/v1/reports/batch/:id` | Generate report |
| **Health** | `GET /health` | Health check |

For complete API documentation, visit `/api-docs` on your server.

---

## Next Steps

1. **Explore Swagger UI** - Visit `http://localhost:3000/api-docs` for interactive API documentation
2. **Try GraphQL** - Explore the GraphQL playground at `http://localhost:3000/graphql`
3. **Import Postman Collection** - Download from `/docs/postman/collection.json`
4. **Read Architecture Guide** - Understand system design at `/docs/guides/ARCHITECTURE.md`
5. **Set Up 2FA** - Enable two-factor authentication for enhanced security

---

## Troubleshooting

### Database Connection Error

```
Error: P1001: Can't reach database server
```

**Solution:** Ensure PostgreSQL is running and `DATABASE_URL` is correct.

```bash
# Check if PostgreSQL is running
pg_isready

# Start PostgreSQL (macOS)
brew services start postgresql@16

# Start PostgreSQL (Ubuntu)
sudo systemctl start postgresql
```

### Redis Connection Error

```
Error: Redis connection failed
```

**Solution:** Start Redis server.

```bash
# Start Redis (macOS)
brew services start redis

# Start Redis (Ubuntu)
sudo systemctl start redis

# Verify Redis is running
redis-cli ping  # Should return PONG
```

### JWT Token Expired

```json
{
  "error": {
    "code": "TOKEN_EXPIRED",
    "message": "Access token has expired"
  }
}
```

**Solution:** Use the refresh token endpoint to get a new access token.

### Port Already in Use

```
Error: listen EADDRINUSE: address already in use :::3000
```

**Solution:** Change the port or kill the existing process.

```bash
# Find process using port 3000
lsof -i :3000

# Kill the process
kill -9 <PID>

# Or use a different port
PORT=3001 npm run dev
```

### Migration Errors

```
Error: Migration failed
```

**Solution:** Reset the database and run migrations again.

```bash
npx prisma migrate reset
npx prisma migrate dev
```

---

## Support

- **Documentation:** https://docs.agrobridge.io
- **GitHub Issues:** https://github.com/agrobridge/agrobridge-backend/issues
- **Email:** support@agrobridge.io
- **Discord:** https://discord.gg/agrobridge

---

Happy coding!
