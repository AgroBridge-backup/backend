# API Reference

Base URL: `http://localhost:4000/api/v1` (development)

---

## Quick Start

### Get a token

```bash
curl -X POST http://localhost:4000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"Password123!"}'
```

### Use the token

```bash
curl http://localhost:4000/api/v1/producers \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

## Common Workflows

### Track a Product from Farm to Consumer

```bash
# 1. Create a producer (farmer)
curl -X POST http://localhost:4000/api/v1/producers \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Green Farm","location":"Jalisco, Mexico"}'

# 2. Create a batch of product
curl -X POST http://localhost:4000/api/v1/batches \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"code":"BATCH-001","producerId":"<producer-id>","quantity":1000,"productType":"Coffee"}'

# 3. Add tracking events
curl -X POST http://localhost:4000/api/v1/events \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"batchId":"<batch-id>","type":"HARVESTED","description":"Batch harvested"}'

# 4. Track progress
curl http://localhost:4000/api/v1/batches/<batch-id> \
  -H "Authorization: Bearer $TOKEN"
```

### Generate an Organic Certificate

```bash
# 1. Create certificate request
curl -X POST http://localhost:4000/api/v1/organic-certificates/generate \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"fieldIds":["<field-id>"],"cropType":"COFFEE","certificationStandard":"ORGANIC_USDA"}'

# 2. Check certificate status
curl http://localhost:4000/api/v1/organic-certificates/<id> \
  -H "Authorization: Bearer $TOKEN"

# 3. Public verification (no auth required)
curl http://localhost:4000/api/v1/verify/CERT-2025-001234
```

---

## Authentication

All endpoints except `/health` and `/verify/*` require a JWT token.

### POST /auth/login

```bash
curl -X POST http://localhost:4000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"Password123!"}'
```

**Response:**
```json
{
  "success": true,
  "data": {
    "user": {"id": "uuid", "email": "user@example.com", "role": "FARMER"},
    "accessToken": "eyJhbG..."
  }
}
```

### POST /auth/register

```bash
curl -X POST http://localhost:4000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"new@example.com","password":"Password123!","name":"John Doe"}'
```

**Password requirements:** 8+ chars, uppercase, lowercase, number, special character.

### GET /auth/me

Get current user info.

```bash
curl http://localhost:4000/api/v1/auth/me \
  -H "Authorization: Bearer $TOKEN"
```

### POST /auth/refresh

Refresh your token before it expires.

```bash
curl -X POST http://localhost:4000/api/v1/auth/refresh \
  -H "Authorization: Bearer $TOKEN"
```

---

## Producers

### GET /producers

List all producers with pagination.

```bash
curl "http://localhost:4000/api/v1/producers?page=1&limit=10" \
  -H "Authorization: Bearer $TOKEN"
```

**Query params:** `page`, `limit`, `search`, `location`

### GET /producers/:id

```bash
curl http://localhost:4000/api/v1/producers/<id> \
  -H "Authorization: Bearer $TOKEN"
```

### POST /producers

```bash
curl -X POST http://localhost:4000/api/v1/producers \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Green Farm","location":"Jalisco, Mexico","certifications":["Organic"]}'
```

### PUT /producers/:id

```bash
curl -X PUT http://localhost:4000/api/v1/producers/<id> \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Updated Farm Name"}'
```

### DELETE /producers/:id

```bash
curl -X DELETE http://localhost:4000/api/v1/producers/<id> \
  -H "Authorization: Bearer $TOKEN"
```

---

## Batches

### GET /batches

List batches with filtering.

```bash
curl "http://localhost:4000/api/v1/batches?producerId=<id>&productType=Coffee" \
  -H "Authorization: Bearer $TOKEN"
```

**Query params:** `page`, `limit`, `producerId`, `productType`, `startDate`, `endDate`

### GET /batches/:id

```bash
curl http://localhost:4000/api/v1/batches/<id> \
  -H "Authorization: Bearer $TOKEN"
```

Returns batch with all events and producer info.

### POST /batches

```bash
curl -X POST http://localhost:4000/api/v1/batches \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "code": "BATCH-001",
    "producerId": "<producer-id>",
    "quantity": 1000,
    "unit": "kg",
    "productType": "Coffee Beans",
    "harvestDate": "2025-12-01",
    "metadata": {"variety": "Arabica"}
  }'
```

### PUT /batches/:id

```bash
curl -X PUT http://localhost:4000/api/v1/batches/<id> \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"quantity": 1500}'
```

### DELETE /batches/:id

```bash
curl -X DELETE http://localhost:4000/api/v1/batches/<id> \
  -H "Authorization: Bearer $TOKEN"
```

---

## Events

Track supply chain events for batches.

### POST /events

```bash
curl -X POST http://localhost:4000/api/v1/events \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "batchId": "<batch-id>",
    "type": "PROCESSED",
    "description": "Coffee beans processed and dried",
    "location": "Processing Plant A",
    "metadata": {"temperature": "65°C", "duration": "48 hours"}
  }'
```

**Event types:** `HARVESTED`, `PROCESSED`, `PACKAGED`, `SHIPPED`, `RECEIVED`, `QUALITY_CHECK`, `CUSTOM`

### GET /events

```bash
curl "http://localhost:4000/api/v1/events?batchId=<id>" \
  -H "Authorization: Bearer $TOKEN"
```

**Query params:** `batchId`, `type`, `startDate`, `endDate`

### GET /events/:id

```bash
curl http://localhost:4000/api/v1/events/<id> \
  -H "Authorization: Bearer $TOKEN"
```

---

## Organic Certificates

### POST /organic-certificates/generate

Request a new certificate.

```bash
curl -X POST http://localhost:4000/api/v1/organic-certificates/generate \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "fieldIds": ["<field-id>"],
    "cropType": "COFFEE",
    "certificationStandard": "ORGANIC_USDA"
  }'
```

**Standards:** `ORGANIC_USDA`, `ORGANIC_EU`, `SENASICA`

### GET /organic-certificates

List certificates.

```bash
curl "http://localhost:4000/api/v1/organic-certificates?status=APPROVED" \
  -H "Authorization: Bearer $TOKEN"
```

### GET /organic-certificates/:id

```bash
curl http://localhost:4000/api/v1/organic-certificates/<id> \
  -H "Authorization: Bearer $TOKEN"
```

### POST /organic-certificates/:id/approve

Approve a pending certificate (admin only).

```bash
curl -X POST http://localhost:4000/api/v1/organic-certificates/<id>/approve \
  -H "Authorization: Bearer $TOKEN"
```

### GET /verify/:certificateNumber

Public endpoint - no auth required.

```bash
curl http://localhost:4000/api/v1/verify/CERT-2025-001234
```

---

## Response Format

### Success

```json
{
  "success": true,
  "data": { ... }
}
```

### Error

```json
{
  "success": false,
  "error": "Error message",
  "statusCode": 400
}
```

### Paginated

```json
{
  "success": true,
  "data": [ ... ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 50,
    "totalPages": 5
  }
}
```

---

## Error Codes

| Code | Meaning |
|------|---------|
| 400 | Bad request / validation error |
| 401 | Not authenticated |
| 403 | Not authorized |
| 404 | Not found |
| 429 | Rate limit exceeded |
| 500 | Server error |

---

## Rate Limits

| Endpoint | Limit | Window |
|----------|-------|--------|
| `/auth/*` | 5 requests | 15 minutes |
| All other endpoints | 100 requests | 15 minutes |

When rate limited, you'll receive:
```json
{"success": false, "error": "Too many requests", "retryAfter": 900}
```

---

## Health Check

```bash
curl http://localhost:4000/health
```

```json
{
  "status": "healthy",
  "timestamp": "2025-12-13T00:00:00.000Z",
  "services": {
    "database": "connected",
    "redis": "connected"
  }
}
```
