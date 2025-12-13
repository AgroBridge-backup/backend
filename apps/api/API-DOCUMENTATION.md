# API Documentation - AgroBridge Backend

## Base URL

- **Development**: `http://localhost:3000`
- **Staging**: `https://api-staging.agrobridge.io`
- **Production**: `https://api.agrobridge.io`

**Version**: 1.0.0
**Last Updated**: December 13, 2025
**API Lead**: Alejandro Navarro Ayala, CEO & CTO

---

## Authentication

All protected endpoints require JWT token in Authorization header:

```
Authorization: Bearer <token>
```

**Token Expiration**:
- Access Token: 7 days
- Refresh Token: 30 days

---

## Response Format

### Success Response
```json
{
  "success": true,
  "data": {
    // Response data here
  }
}
```

### Error Response
```json
{
  "success": false,
  "error": "Error message",
  "statusCode": 400,
  "timestamp": "2025-12-13T00:00:00.000Z"
}
```

---

## Endpoints

### Health Check

#### GET /health
Check API health status (public endpoint).

**Response 200 (Healthy)**:
```json
{
  "status": "healthy",
  "timestamp": "2025-12-13T00:00:00.000Z",
  "database": "connected",
  "uptime": 123456
}
```

**Response 503 (Unhealthy)**:
```json
{
  "status": "unhealthy",
  "timestamp": "2025-12-13T00:00:00.000Z",
  "database": "disconnected",
  "uptime": 123456
}
```

---

## Authentication Endpoints

### POST /api/auth/register
Register a new user account.

**Request Body**:
```json
{
  "email": "user@example.com",
  "password": "SecureP@ss123",
  "name": "John Doe"
}
```

**Password Requirements**:
- Minimum 8 characters
- At least 1 uppercase letter (A-Z)
- At least 1 lowercase letter (a-z)
- At least 1 number (0-9)
- At least 1 special character (!@#$%^&*)

**Response 201 (Created)**:
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "uuid",
      "email": "user@example.com",
      "name": "John Doe",
      "role": "FARMER",
      "createdAt": "2025-12-13T00:00:00.000Z"
    },
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

**Response 400 (Validation Error)**:
```json
{
  "success": false,
  "error": "Password must contain at least 1 uppercase letter",
  "statusCode": 400
}
```

**Response 400 (User Exists)**:
```json
{
  "success": false,
  "error": "User with this email already exists",
  "statusCode": 400
}
```

---

### POST /api/auth/login
Login with existing credentials.

**Request Body**:
```json
{
  "email": "user@example.com",
  "password": "SecureP@ss123"
}
```

**Response 200 (Success)**:
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "uuid",
      "email": "user@example.com",
      "name": "John Doe",
      "role": "FARMER"
    },
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

**Response 401 (Invalid Credentials)**:
```json
{
  "success": false,
  "error": "Invalid email or password",
  "statusCode": 401
}
```

---

### POST /api/auth/refresh
Refresh JWT token (requires authentication).

**Headers**:
```
Authorization: Bearer <current-token>
```

**Response 200 (Success)**:
```json
{
  "success": true,
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

**Response 401 (Invalid Token)**:
```json
{
  "success": false,
  "error": "Invalid or expired token",
  "statusCode": 401
}
```

---

### GET /api/auth/me
Get current authenticated user (requires authentication).

**Headers**:
```
Authorization: Bearer <token>
```

**Response 200 (Success)**:
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "email": "user@example.com",
    "name": "John Doe",
    "role": "FARMER",
    "createdAt": "2025-12-13T00:00:00.000Z"
  }
}
```

---

## Producer Endpoints

### POST /api/producers
Create a new producer (authentication required).

**Headers**:
```
Authorization: Bearer <token>
```

**Request Body**:
```json
{
  "name": "Green Farm",
  "location": "Jalisco, Mexico",
  "certifications": ["Organic", "Fair Trade"]
}
```

**Response 201 (Created)**:
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "name": "Green Farm",
    "location": "Jalisco, Mexico",
    "certifications": ["Organic", "Fair Trade"],
    "userId": "uuid",
    "createdAt": "2025-12-13T00:00:00.000Z",
    "updatedAt": "2025-12-13T00:00:00.000Z"
  }
}
```

**Response 400 (Validation Error)**:
```json
{
  "success": false,
  "error": "Producer name is required",
  "statusCode": 400
}
```

---

### GET /api/producers
List all producers (authentication required, pagination supported).

**Headers**:
```
Authorization: Bearer <token>
```

**Query Parameters**:
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 10, max: 100)
- `search` (optional): Search by name
- `location` (optional): Filter by location

**Example Request**:
```
GET /api/producers?page=1&limit=10&search=Green&location=Jalisco
```

**Response 200 (Success)**:
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "name": "Green Farm",
      "location": "Jalisco, Mexico",
      "certifications": ["Organic"],
      "createdAt": "2025-12-13T00:00:00.000Z"
    },
    {
      "id": "uuid",
      "name": "Green Valley",
      "location": "Jalisco, Mexico",
      "certifications": ["Fair Trade"],
      "createdAt": "2025-12-13T00:00:00.000Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 2,
    "totalPages": 1
  }
}
```

---

### GET /api/producers/:id
Get producer by ID (authentication required).

**Headers**:
```
Authorization: Bearer <token>
```

**Response 200 (Success)**:
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "name": "Green Farm",
    "location": "Jalisco, Mexico",
    "certifications": ["Organic", "Fair Trade"],
    "userId": "uuid",
    "createdAt": "2025-12-13T00:00:00.000Z",
    "updatedAt": "2025-12-13T00:00:00.000Z",
    "batches": [
      {
        "id": "uuid",
        "code": "BATCH-001",
        "quantity": 1000
      }
    ]
  }
}
```

**Response 404 (Not Found)**:
```json
{
  "success": false,
  "error": "Producer not found",
  "statusCode": 404
}
```

---

### PUT /api/producers/:id
Update producer (authentication required, owner only).

**Headers**:
```
Authorization: Bearer <token>
```

**Request Body** (all fields optional):
```json
{
  "name": "Updated Farm Name",
  "location": "New Location",
  "certifications": ["Organic", "Fair Trade", "Rainforest Alliance"]
}
```

**Response 200 (Success)**:
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "name": "Updated Farm Name",
    "location": "New Location",
    "certifications": ["Organic", "Fair Trade", "Rainforest Alliance"],
    "updatedAt": "2025-12-13T01:00:00.000Z"
  }
}
```

**Response 403 (Forbidden)**:
```json
{
  "success": false,
  "error": "You don't have permission to update this producer",
  "statusCode": 403
}
```

---

### DELETE /api/producers/:id
Delete producer (authentication required, owner only).

**Headers**:
```
Authorization: Bearer <token>
```

**Response 204 (No Content)**

**Response 403 (Forbidden)**:
```json
{
  "success": false,
  "error": "You don't have permission to delete this producer",
  "statusCode": 403
}
```

**Response 400 (Has Batches)**:
```json
{
  "success": false,
  "error": "Cannot delete producer with active batches",
  "statusCode": 400
}
```

---

## Batch Endpoints

### POST /api/batches
Create a new batch (authentication required).

**Headers**:
```
Authorization: Bearer <token>
```

**Request Body**:
```json
{
  "code": "BATCH-001",
  "producerId": "uuid",
  "quantity": 1000,
  "unit": "kg",
  "harvestDate": "2025-12-01",
  "productType": "Coffee Beans",
  "metadata": {
    "variety": "Arabica",
    "altitude": "1500m"
  }
}
```

**Response 201 (Created)**:
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "code": "BATCH-001",
    "producerId": "uuid",
    "quantity": 1000,
    "unit": "kg",
    "harvestDate": "2025-12-01T00:00:00.000Z",
    "productType": "Coffee Beans",
    "metadata": {
      "variety": "Arabica",
      "altitude": "1500m"
    },
    "createdAt": "2025-12-13T00:00:00.000Z"
  }
}
```

**Response 400 (Duplicate Code)**:
```json
{
  "success": false,
  "error": "Batch with code BATCH-001 already exists",
  "statusCode": 400
}
```

---

### GET /api/batches
List all batches (authentication required, pagination supported).

**Headers**:
```
Authorization: Bearer <token>
```

**Query Parameters**:
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 10)
- `producerId` (optional): Filter by producer
- `productType` (optional): Filter by product type
- `startDate` (optional): Filter by harvest date (from)
- `endDate` (optional): Filter by harvest date (to)

**Response 200 (Success)**:
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "code": "BATCH-001",
      "quantity": 1000,
      "unit": "kg",
      "productType": "Coffee Beans",
      "harvestDate": "2025-12-01T00:00:00.000Z",
      "producer": {
        "id": "uuid",
        "name": "Green Farm"
      }
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 1,
    "totalPages": 1
  }
}
```

---

### GET /api/batches/:id
Get batch by ID (authentication required).

**Response 200 (Success)**:
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "code": "BATCH-001",
    "quantity": 1000,
    "unit": "kg",
    "productType": "Coffee Beans",
    "harvestDate": "2025-12-01T00:00:00.000Z",
    "metadata": {
      "variety": "Arabica",
      "altitude": "1500m"
    },
    "producer": {
      "id": "uuid",
      "name": "Green Farm",
      "location": "Jalisco, Mexico"
    },
    "events": [
      {
        "id": "uuid",
        "type": "HARVESTED",
        "description": "Batch harvested",
        "timestamp": "2025-12-01T08:00:00.000Z"
      }
    ]
  }
}
```

---

### PUT /api/batches/:id
Update batch (authentication required).

**Request Body** (all fields optional):
```json
{
  "quantity": 1500,
  "metadata": {
    "variety": "Arabica",
    "altitude": "1500m",
    "notes": "Premium grade"
  }
}
```

**Response 200 (Success)**:
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "code": "BATCH-001",
    "quantity": 1500,
    "metadata": {
      "variety": "Arabica",
      "altitude": "1500m",
      "notes": "Premium grade"
    },
    "updatedAt": "2025-12-13T01:00:00.000Z"
  }
}
```

---

### DELETE /api/batches/:id
Delete batch (authentication required).

**Response 204 (No Content)**

---

## Event Endpoints

### POST /api/events
Create an event for a batch (authentication required).

**Headers**:
```
Authorization: Bearer <token>
```

**Request Body**:
```json
{
  "batchId": "uuid",
  "type": "PROCESSED",
  "description": "Coffee beans processed and dried",
  "location": "Processing Plant A",
  "metadata": {
    "temperature": "65°C",
    "duration": "48 hours"
  }
}
```

**Event Types**:
- `HARVESTED`
- `PROCESSED`
- `PACKAGED`
- `SHIPPED`
- `RECEIVED`
- `QUALITY_CHECK`
- `CUSTOM`

**Response 201 (Created)**:
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "batchId": "uuid",
    "type": "PROCESSED",
    "description": "Coffee beans processed and dried",
    "location": "Processing Plant A",
    "metadata": {
      "temperature": "65°C",
      "duration": "48 hours"
    },
    "timestamp": "2025-12-13T00:00:00.000Z"
  }
}
```

---

### GET /api/events
List events (authentication required).

**Query Parameters**:
- `batchId` (optional): Filter by batch ID
- `type` (optional): Filter by event type
- `startDate` (optional): Filter by timestamp (from)
- `endDate` (optional): Filter by timestamp (to)

**Response 200 (Success)**:
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "batchId": "uuid",
      "type": "HARVESTED",
      "description": "Batch harvested",
      "location": "Field A",
      "timestamp": "2025-12-01T08:00:00.000Z",
      "batch": {
        "code": "BATCH-001",
        "productType": "Coffee Beans"
      }
    },
    {
      "id": "uuid",
      "batchId": "uuid",
      "type": "PROCESSED",
      "description": "Coffee beans processed",
      "location": "Processing Plant A",
      "timestamp": "2025-12-02T10:00:00.000Z"
    }
  ]
}
```

---

### GET /api/events/:id
Get event by ID (authentication required).

**Response 200 (Success)**:
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "batchId": "uuid",
    "type": "PROCESSED",
    "description": "Coffee beans processed and dried",
    "location": "Processing Plant A",
    "metadata": {
      "temperature": "65°C",
      "duration": "48 hours"
    },
    "timestamp": "2025-12-13T00:00:00.000Z",
    "batch": {
      "code": "BATCH-001",
      "productType": "Coffee Beans",
      "producer": {
        "name": "Green Farm"
      }
    }
  }
}
```

---

## Error Codes

### HTTP Status Codes

| Code | Meaning | Description |
|------|---------|-------------|
| 200 | OK | Request successful |
| 201 | Created | Resource created successfully |
| 204 | No Content | Request successful, no content to return |
| 400 | Bad Request | Validation error or malformed request |
| 401 | Unauthorized | Missing or invalid authentication token |
| 403 | Forbidden | Insufficient permissions |
| 404 | Not Found | Resource not found |
| 429 | Too Many Requests | Rate limit exceeded |
| 500 | Internal Server Error | Server error |
| 503 | Service Unavailable | Server unhealthy (database down, etc.) |

---

## Rate Limiting

### Rate Limits by Endpoint Type

| Endpoint Type | Limit | Window |
|---------------|-------|--------|
| Auth endpoints (`/api/auth/*`) | 5 requests | 15 minutes |
| General API | 100 requests | 15 minutes |
| Password reset | 3 requests | 1 hour |

### Rate Limit Headers

Response includes rate limit information:
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1702425600
```

### Rate Limit Exceeded Response

**Response 429**:
```json
{
  "success": false,
  "error": "Too many requests, please try again later",
  "retryAfter": 900,
  "statusCode": 429
}
```

---

## Security Headers

All API responses include security headers:

- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `X-XSS-Protection: 1; mode=block`
- `Strict-Transport-Security: max-age=31536000; includeSubDomains`
- `Content-Security-Policy: default-src 'self'`

---

## CORS Policy

**Allowed Origins** (Production):
- `https://agrobridge.io`
- `https://www.agrobridge.io`
- `https://app.agrobridge.io`

**Allowed Methods**:
- GET
- POST
- PUT
- DELETE
- PATCH
- OPTIONS

**Allowed Headers**:
- `Content-Type`
- `Authorization`

**Credentials**: Supported

---

## Versioning

**Current Version**: v1

API versioning is included in the URL path:
- `/api/v1/producers`
- `/api/v1/batches`

Future versions will be:
- `/api/v2/...`

---

## SDKs and Client Libraries

**Coming Soon**:
- JavaScript/TypeScript SDK
- Python SDK
- Mobile SDK (React Native)

---

## Webhooks (Planned)

**Coming in v1.1**:
- Batch created
- Event added
- Producer updated

---

**Document Version**: 1.0.0
**Last Updated**: December 13, 2025
**API Lead**: Alejandro Navarro Ayala, CEO & CTO
**Maintained by**: AgroBridge Engineering Team
**Support**: api-support@agrobridge.io
