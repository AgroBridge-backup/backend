# API Reference

Complete reference for AgroBridge API endpoints.

## Base URL

```
https://api.agrobridge.io
```

## Authentication

Most endpoints require JWT authentication:

```
Authorization: Bearer YOUR_ACCESS_TOKEN
```

Get your access token from `/api/v1/auth/login`.

---

## Authentication Endpoints

### Register User

```http
POST /api/v1/auth/register
```

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "SecurePassword123!",
  "name": "John Doe",
  "role": "PRODUCER"
}
```

**Response:** `201 Created`
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "clq123",
      "email": "user@example.com",
      "name": "John Doe",
      "role": "PRODUCER"
    },
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

### Login

```http
POST /api/v1/auth/login
```

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "SecurePassword123!"
}
```

**Response:** `200 OK`
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "clq123",
      "email": "user@example.com",
      "twoFactorEnabled": false
    },
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

### Refresh Token

```http
POST /api/v1/auth/refresh
```

**Request Body:**
```json
{
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Response:** `200 OK`
```json
{
  "success": true,
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

### Get Current User

```http
GET /api/v1/auth/me
```

**Headers:**
```
Authorization: Bearer YOUR_ACCESS_TOKEN
```

**Response:** `200 OK`
```json
{
  "success": true,
  "data": {
    "id": "clq123",
    "email": "user@example.com",
    "name": "John Doe",
    "role": "PRODUCER",
    "twoFactorEnabled": false,
    "createdAt": "2024-03-15T10:30:00Z"
  }
}
```

### Logout

```http
POST /api/v1/auth/logout
```

**Headers:**
```
Authorization: Bearer YOUR_ACCESS_TOKEN
```

**Response:** `200 OK`
```json
{
  "success": true,
  "message": "Logged out successfully"
}
```

---

## Batch Endpoints

### List Batches

```http
GET /api/v1/batches
```

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `page` | integer | Page number (default: 1) |
| `limit` | integer | Items per page (max: 100, default: 20) |
| `status` | string | Filter by status (REGISTERED, IN_TRANSIT, etc) |
| `search` | string | Search in origin, variety |
| `sort` | string | Sort field (prefix with - for descending) |
| `producerId` | string | Filter by producer ID |

**Example Request:**
```bash
curl "https://api.agrobridge.io/api/v1/batches?page=1&limit=20&status=REGISTERED" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Response:** `200 OK`
```json
{
  "success": true,
  "data": [
    {
      "id": "clq_batch_123",
      "batchNumber": "BATCH-2024-001",
      "origin": "Organic Tomatoes",
      "variety": "Roma",
      "weightKg": 500.5,
      "status": "REGISTERED",
      "harvestDate": "2024-03-15T08:00:00Z",
      "certifications": ["ORGANIC"],
      "producer": {
        "id": "clq_producer_456",
        "businessName": "Green Valley Farm"
      },
      "createdAt": "2024-03-15T10:30:00Z"
    }
  ],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 150,
    "totalPages": 8
  },
  "links": {
    "self": "/api/v1/batches?page=1&limit=20",
    "next": "/api/v1/batches?page=2&limit=20"
  }
}
```

### Create Batch

```http
POST /api/v1/batches
```

**Request Body:**
```json
{
  "origin": "Organic Tomatoes",
  "variety": "Roma",
  "weightKg": 500.5,
  "harvestDate": "2024-03-15T08:00:00Z",
  "certifications": ["ORGANIC"],
  "metadata": {
    "field": "A-12",
    "temperature": 22
  }
}
```

**Response:** `201 Created`
```json
{
  "success": true,
  "data": {
    "id": "clq_batch_123",
    "batchNumber": "BATCH-2024-001",
    "origin": "Organic Tomatoes",
    "variety": "Roma",
    "weightKg": 500.5,
    "status": "REGISTERED",
    "harvestDate": "2024-03-15T08:00:00Z",
    "certifications": ["ORGANIC"],
    "qrCodeUrl": "https://cdn.agrobridge.io/qr/clq_batch_123.png",
    "createdAt": "2024-03-15T10:30:00Z"
  }
}
```

### Get Batch by ID

```http
GET /api/v1/batches/:id
```

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `include` | string | Related entities (producer, events) |

**Response:** `200 OK`
```json
{
  "success": true,
  "data": {
    "id": "clq_batch_123",
    "batchNumber": "BATCH-2024-001",
    "origin": "Organic Tomatoes",
    "status": "IN_TRANSIT",
    "producer": {
      "id": "clq_producer_456",
      "businessName": "Green Valley Farm"
    },
    "events": [
      {
        "id": "evt_123",
        "title": "Harvest Complete",
        "eventType": "HARVEST",
        "timestamp": "2024-03-15T08:00:00Z"
      }
    ]
  }
}
```

### Update Batch

```http
PUT /api/v1/batches/:id
```

**Request Body:**
```json
{
  "status": "IN_TRANSIT",
  "weightKg": 485.2
}
```

**Response:** `200 OK`

### Delete Batch

```http
DELETE /api/v1/batches/:id
```

**Response:** `204 No Content`

---

## Event Endpoints

### Register Event

```http
POST /api/v1/events
```

**Request Body:**
```json
{
  "batchId": "clq_batch_123",
  "title": "Quality Check Passed",
  "eventType": "QUALITY_CHECK",
  "description": "All quality standards met",
  "timestamp": "2024-03-15T10:00:00Z",
  "location": "Warehouse A",
  "temperature": 22,
  "humidity": 65,
  "gpsCoordinates": {
    "latitude": 17.0542,
    "longitude": -96.7061
  }
}
```

**Event Types:**
- `HARVEST` - Harvest event
- `QUALITY_CHECK` - Quality inspection
- `TRANSPORT` - Transportation event
- `STORAGE` - Storage event
- `DELIVERY` - Delivery event
- `REJECTION` - Rejection event
- `OTHER` - Custom event

**Response:** `201 Created`
```json
{
  "success": true,
  "data": {
    "id": "evt_123",
    "batchId": "clq_batch_123",
    "title": "Quality Check Passed",
    "eventType": "QUALITY_CHECK",
    "timestamp": "2024-03-15T10:00:00Z",
    "ipfsHash": "QmXoypizjW3WknFiJnKLwHCnL72vedxjQkDDP1mXWo6uco",
    "createdAt": "2024-03-15T10:30:00Z"
  }
}
```

### Get Event by ID

```http
GET /api/v1/events/:id
```

**Response:** `200 OK`

### Verify Event

```http
POST /api/v1/events/:id/verify
```

Verifies event data on blockchain.

**Response:** `200 OK`
```json
{
  "success": true,
  "data": {
    "verified": true,
    "blockchainTxHash": "0x1234567890abcdef...",
    "timestamp": "2024-03-15T10:30:00Z"
  }
}
```

---

## Producer Endpoints

### List Producers

```http
GET /api/v1/producers
```

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `page` | integer | Page number |
| `limit` | integer | Items per page |
| `isWhitelisted` | boolean | Filter by whitelist status |

**Response:** `200 OK`

### Get Producer by ID

```http
GET /api/v1/producers/:id
```

**Response:** `200 OK`
```json
{
  "success": true,
  "data": {
    "id": "clq_producer_456",
    "businessName": "Green Valley Farm",
    "email": "contact@greenvalley.com",
    "location": "Oaxaca, Mexico",
    "certifications": ["ORGANIC", "FAIR_TRADE"],
    "isWhitelisted": true,
    "walletAddress": "0x1234567890abcdef..."
  }
}
```

### Whitelist Producer

```http
POST /api/v1/producers/:id/whitelist
```

**Required Role:** ADMIN

**Response:** `200 OK`

### Add Certification

```http
POST /api/v1/producers/:id/certifications
```

**Request Body:**
```json
{
  "certification": "ORGANIC"
}
```

**Response:** `200 OK`

---

## Report Endpoints

### Generate Batch Report

```http
GET /api/v1/reports/batch/:id
```

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `format` | string | Output format (pdf, csv, xlsx) |

**Response:** Binary file download

### Export Batches

```http
POST /api/v1/exports/batches
```

**Request Body:**
```json
{
  "format": "xlsx",
  "filters": {
    "status": "REGISTERED",
    "dateFrom": "2024-01-01",
    "dateTo": "2024-12-31"
  }
}
```

**Response:** Binary file download

---

## GraphQL API

### Endpoint

```
POST https://api.agrobridge.io/graphql
```

### Example Queries

**Get Batches:**
```graphql
query GetBatches {
  batches(
    filter: { status: REGISTERED }
    pagination: { page: 1, limit: 20 }
  ) {
    edges {
      node {
        id
        origin
        weightKg
        producer {
          businessName
        }
        events {
          title
          timestamp
        }
      }
    }
    pageInfo {
      hasNextPage
      totalCount
    }
  }
}
```

**Create Batch:**
```graphql
mutation CreateBatch($input: CreateBatchInput!) {
  createBatch(input: $input) {
    id
    origin
    weightKg
    qrCodeUrl
  }
}
```

**Variables:**
```json
{
  "input": {
    "origin": "Organic Tomatoes",
    "weightKg": 500,
    "harvestDate": "2024-03-15T08:00:00Z"
  }
}
```

---

## Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `VALIDATION_ERROR` | 400 | Request validation failed |
| `UNAUTHORIZED` | 401 | Authentication required |
| `TOKEN_EXPIRED` | 401 | Access token expired |
| `FORBIDDEN` | 403 | Insufficient permissions |
| `NOT_FOUND` | 404 | Resource not found |
| `CONFLICT` | 409 | Resource already exists |
| `RATE_LIMIT_EXCEEDED` | 429 | Too many requests |
| `INTERNAL_ERROR` | 500 | Internal server error |

### Error Response Format

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Validation failed",
    "details": [
      {
        "field": "email",
        "message": "Invalid email format"
      }
    ]
  }
}
```

---

## Rate Limits

| Endpoint Type | Limit |
|---------------|-------|
| Authentication | 5 requests / 15 minutes |
| General API | 100 requests / 15 minutes |
| Webhooks | Unlimited |

Rate limit headers:
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1710504600
```

---

## Pagination

All list endpoints support pagination:

```
GET /api/v1/batches?page=2&limit=50
```

**Response includes:**
```json
{
  "meta": {
    "page": 2,
    "limit": 50,
    "total": 500,
    "totalPages": 10
  },
  "links": {
    "first": "/api/v1/batches?page=1&limit=50",
    "prev": "/api/v1/batches?page=1&limit=50",
    "self": "/api/v1/batches?page=2&limit=50",
    "next": "/api/v1/batches?page=3&limit=50",
    "last": "/api/v1/batches?page=10&limit=50"
  }
}
```

---

## Webhooks

### Register Webhook

```http
POST /api/v1/webhooks
```

**Request Body:**
```json
{
  "url": "https://your-app.com/webhooks/agrobridge",
  "events": ["batch.created", "event.created"],
  "secret": "your_webhook_secret"
}
```

### Webhook Events

- `batch.created` - New batch created
- `batch.updated` - Batch updated
- `batch.deleted` - Batch deleted
- `event.created` - New event registered
- `event.verified` - Event verified on blockchain

### Webhook Payload

```json
{
  "id": "wh_123",
  "type": "batch.created",
  "data": {
    "id": "clq_batch_123",
    "origin": "Organic Tomatoes"
  },
  "timestamp": "2024-03-15T10:30:00Z"
}
```

### Verify Webhook Signature

```javascript
const crypto = require('crypto');

function verifyWebhook(payload, signature, secret) {
  const hmac = crypto.createHmac('sha256', secret);
  const digest = hmac.update(payload).digest('hex');
  return signature === `sha256=${digest}`;
}
```

---

## SDKs

### JavaScript/TypeScript

```bash
npm install @agrobridge/sdk
```

```typescript
import { AgroBridge } from '@agrobridge/sdk';

const client = new AgroBridge({
  apiKey: 'YOUR_API_KEY',
  baseUrl: 'https://api.agrobridge.io',
});

const batch = await client.batches.create({
  origin: 'Organic Tomatoes',
  weightKg: 500,
});
```

### Python

```bash
pip install agrobridge
```

```python
from agrobridge import AgroBridge

client = AgroBridge(api_key="YOUR_API_KEY")

batch = client.batches.create(
    origin="Organic Tomatoes",
    weight_kg=500
)
```

---

## Support

- **Documentation:** https://docs.agrobridge.io
- **Discord:** https://discord.gg/agrobridge
- **Email:** api@agrobridge.io
