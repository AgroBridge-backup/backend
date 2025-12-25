# API Endpoints Reference

Complete reference for all **309 endpoints** in AgroBridge API.

**Base URL**: `https://api.agrobridge.com.mx/api/v1` (production)
**Local**: `http://localhost:4000/api/v1` (development)

---

## Table of Contents

1. [Authentication](#authentication) (21 endpoints)
2. [Producers](#producers) (7 endpoints)
3. [Batches](#batches) (8 endpoints)
4. [Events](#events) (6 endpoints)
5. [Organic Certificates](#organic-certificates) (12 endpoints)
6. [Organic Fields](#organic-fields) (9 endpoints)
7. [Field Inspections](#field-inspections) (12 endpoints)
8. [Export Companies](#export-companies) (9 endpoints)
9. [Export Company Dashboard](#export-company-dashboard) (17 endpoints)
10. [Cold Chain](#cold-chain) (15 endpoints)
11. [Transit Tracking](#transit-tracking) (10 endpoints)
12. [Payments](#payments) (16 endpoints)
13. [Notifications](#notifications) (18 endpoints)
14. [Quality Metrics](#quality-metrics) (8 endpoints)
15. [Satellite Analysis](#satellite-analysis) (6 endpoints)
16. [Referrals](#referrals) (7 endpoints)
17. [Invoicing](#invoicing) (4 endpoints)
18. [API Keys](#api-keys) (5 endpoints)
19. [Public Verification](#public-verification) (3 endpoints)
20. [Health & System](#health--system) (6 endpoints)
21. [v2 API](#v2-api) (21 endpoints)
22. [Modules](#modules) (25 endpoints)

---

## Quick Reference

### Authentication Required

Most endpoints require JWT token in header:
```bash
Authorization: Bearer eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...
```

### Public Endpoints (No Auth)

| Method | Path | Description |
|--------|------|-------------|
| POST | `/auth/login` | User login |
| POST | `/auth/register` | User registration |
| POST | `/auth/forgot-password` | Password reset request |
| GET | `/health` | Health check |
| GET | `/verify/:number` | Certificate verification |
| GET | `/public/batch/:code` | Public batch traceability |

### Rate Limits

| Endpoint Category | Limit | Window |
|------------------|-------|--------|
| Authentication | 5 req | 15 min |
| Registration | 3 req | 1 hour |
| Password Reset | 3 req | 1 hour |
| Certificate Generation | 10 req | 1 min |
| General API | 100 req | 15 min |
| Public API | 60 req | 1 min |

---

## Authentication

**Base path**: `/api/v1/auth`

### POST /auth/login

Login with email and password.

**Auth**: Public
**Rate Limit**: 5/15min

**Request**:
```bash
curl -X POST https://api.agrobridge.com.mx/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "Password123!"
  }'
```

**Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "usr_abc123",
      "email": "user@example.com",
      "name": "John Doe",
      "role": "FARMER"
    },
    "accessToken": "eyJhbGciOiJSUzI1NiIs...",
    "refreshToken": "eyJhbGciOiJSUzI1NiIs...",
    "expiresIn": 900
  }
}
```

**Errors**:
| Code | Description |
|------|-------------|
| `VALIDATION_ERROR` | Invalid email format or missing fields |
| `UNAUTHENTICATED` | Wrong email or password |
| `RATE_LIMIT_AUTH_EXCEEDED` | Too many login attempts |

---

### POST /auth/register

Register a new user account.

**Auth**: Public
**Rate Limit**: 3/hour

**Request**:
```bash
curl -X POST https://api.agrobridge.com.mx/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "newuser@example.com",
    "password": "SecurePass123!",
    "name": "Jane Doe",
    "role": "FARMER"
  }'
```

**Password Requirements**:
- Minimum 8 characters
- At least 1 uppercase letter
- At least 1 lowercase letter
- At least 1 number
- At least 1 special character (!@#$%^&*)

**Response** (201 Created):
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "usr_xyz789",
      "email": "newuser@example.com",
      "name": "Jane Doe",
      "role": "FARMER",
      "emailVerified": false
    },
    "message": "Verification email sent"
  }
}
```

---

### POST /auth/refresh

Refresh access token using refresh token.

**Auth**: Required (refresh token)

**Request**:
```bash
curl -X POST https://api.agrobridge.com.mx/api/v1/auth/refresh \
  -H "Content-Type: application/json" \
  -d '{
    "refreshToken": "eyJhbGciOiJSUzI1NiIs..."
  }'
```

**Response**:
```json
{
  "success": true,
  "data": {
    "accessToken": "eyJhbGciOiJSUzI1NiIs...",
    "expiresIn": 900
  }
}
```

---

### POST /auth/logout

Invalidate current token.

**Auth**: Required

**Request**:
```bash
curl -X POST https://api.agrobridge.com.mx/api/v1/auth/logout \
  -H "Authorization: Bearer $TOKEN"
```

---

### GET /auth/me

Get current user profile.

**Auth**: Required

**Request**:
```bash
curl https://api.agrobridge.com.mx/api/v1/auth/me \
  -H "Authorization: Bearer $TOKEN"
```

**Response**:
```json
{
  "success": true,
  "data": {
    "id": "usr_abc123",
    "email": "user@example.com",
    "name": "John Doe",
    "role": "FARMER",
    "emailVerified": true,
    "twoFactorEnabled": false,
    "createdAt": "2025-01-15T12:00:00Z"
  }
}
```

---

### POST /auth/forgot-password

Request password reset email.

**Auth**: Public
**Rate Limit**: 3/hour per email

**Request**:
```bash
curl -X POST https://api.agrobridge.com.mx/api/v1/auth/forgot-password \
  -H "Content-Type: application/json" \
  -d '{"email": "user@example.com"}'
```

---

### POST /auth/reset-password

Reset password with token from email.

**Request**:
```bash
curl -X POST https://api.agrobridge.com.mx/api/v1/auth/reset-password \
  -H "Content-Type: application/json" \
  -d '{
    "token": "reset_token_from_email",
    "password": "NewSecurePass123!"
  }'
```

---

### POST /auth/verify-email

Verify email address with token.

**Request**:
```bash
curl -X POST https://api.agrobridge.com.mx/api/v1/auth/verify-email \
  -H "Content-Type: application/json" \
  -d '{"token": "verification_token"}'
```

---

### Two-Factor Authentication

#### POST /auth/2fa/setup

Enable 2FA for account.

**Auth**: Required

**Response**:
```json
{
  "success": true,
  "data": {
    "secret": "JBSWY3DPEHPK3PXP",
    "qrCode": "data:image/png;base64,..."
  }
}
```

#### POST /auth/2fa/verify

Verify 2FA code.

**Request**:
```json
{"code": "123456"}
```

#### POST /auth/2fa/disable

Disable 2FA (requires code).

#### GET /auth/2fa/status

Check 2FA status.

---

### OAuth

#### GET /auth/oauth/google

Redirect to Google OAuth.

#### GET /auth/oauth/google/callback

Google OAuth callback (internal).

#### GET /auth/oauth/github

Redirect to GitHub OAuth.

#### GET /auth/oauth/github/callback

GitHub OAuth callback (internal).

#### POST /auth/oauth/link/google

Link Google account to existing user.

#### POST /auth/oauth/link/github

Link GitHub account to existing user.

#### GET /auth/oauth/providers

List linked OAuth providers.

---

## Producers

**Base path**: `/api/v1/producers`

### GET /producers

List all producers with pagination.

**Auth**: Required
**Roles**: All authenticated users

**Query Parameters**:
| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `page` | number | 1 | Page number |
| `limit` | number | 20 | Items per page (max 100) |
| `search` | string | - | Search by name |
| `location` | string | - | Filter by location |
| `certified` | boolean | - | Filter by certification status |

**Request**:
```bash
curl "https://api.agrobridge.com.mx/api/v1/producers?page=1&limit=10&certified=true" \
  -H "Authorization: Bearer $TOKEN"
```

**Response**:
```json
{
  "success": true,
  "data": [
    {
      "id": "prod_abc123",
      "name": "Organic Farm Co.",
      "location": "Jalisco, Mexico",
      "certifications": ["USDA Organic", "Fair Trade"],
      "createdAt": "2025-01-10T10:00:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 45,
    "totalPages": 5
  }
}
```

---

### GET /producers/:id

Get producer by ID.

**Request**:
```bash
curl https://api.agrobridge.com.mx/api/v1/producers/prod_abc123 \
  -H "Authorization: Bearer $TOKEN"
```

---

### POST /producers

Create new producer.

**Auth**: Required
**Roles**: ADMIN, EXPORT_COMPANY_ADMIN

**Request**:
```bash
curl -X POST https://api.agrobridge.com.mx/api/v1/producers \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Green Valley Farm",
    "location": "Michoacan, Mexico",
    "certifications": ["Organic"],
    "contactEmail": "farm@example.com"
  }'
```

---

### PUT /producers/:id

Update producer.

### DELETE /producers/:id

Delete producer (soft delete).

### GET /producers/:id/batches

List producer's batches.

### GET /producers/:id/certificates

List producer's certificates.

---

## Batches

**Base path**: `/api/v1/batches`

### GET /batches

List batches with filtering.

**Query Parameters**:
| Param | Type | Description |
|-------|------|-------------|
| `producerId` | string | Filter by producer |
| `productType` | string | Filter by product type |
| `status` | string | Filter by status |
| `startDate` | date | Created after |
| `endDate` | date | Created before |

**Request**:
```bash
curl "https://api.agrobridge.com.mx/api/v1/batches?productType=Avocado&status=ACTIVE" \
  -H "Authorization: Bearer $TOKEN"
```

---

### GET /batches/:id

Get batch with full event history.

**Response**:
```json
{
  "success": true,
  "data": {
    "id": "batch_xyz",
    "code": "BATCH-2025-001",
    "productType": "Avocado",
    "quantity": 1000,
    "unit": "kg",
    "producer": {
      "id": "prod_abc",
      "name": "Green Farm"
    },
    "events": [
      {
        "type": "HARVESTED",
        "timestamp": "2025-01-15T08:00:00Z",
        "location": "Field A"
      },
      {
        "type": "PROCESSED",
        "timestamp": "2025-01-15T14:00:00Z"
      }
    ],
    "certificate": {
      "number": "AGB-MX-2025-0001",
      "status": "APPROVED"
    }
  }
}
```

---

### GET /batches/by-number/:batchNumber

Get batch by public batch number.

### POST /batches

Create new batch.

**Request**:
```json
{
  "code": "BATCH-2025-002",
  "producerId": "prod_abc123",
  "quantity": 500,
  "unit": "kg",
  "productType": "Avocado",
  "harvestDate": "2025-02-01",
  "metadata": {
    "variety": "Hass",
    "grade": "Export Quality"
  }
}
```

### PUT /batches/:id

Update batch.

### DELETE /batches/:id

Delete batch.

### GET /batches/:id/history

Get batch history with all events.

### GET /batches/farmer/:farmerId

Get all batches for a farmer.

---

## Events

**Base path**: `/api/v1/events`

Track supply chain events for batches.

### GET /events

List events with filtering.

**Query Parameters**:
| Param | Type | Description |
|-------|------|-------------|
| `batchId` | string | Filter by batch |
| `type` | string | Filter by event type |
| `startDate` | date | Events after |
| `endDate` | date | Events before |

**Event Types**:
- `HARVESTED` - Batch harvested from field
- `PROCESSED` - Processing complete
- `PACKAGED` - Packaged for shipping
- `SHIPPED` - Left origin facility
- `RECEIVED` - Arrived at destination
- `QUALITY_CHECK` - Quality inspection performed
- `TEMPERATURE_LOGGED` - Cold chain reading
- `CUSTOM` - Custom event

---

### GET /events/:id

Get single event details.

### POST /events

Create new event.

**Request**:
```bash
curl -X POST https://api.agrobridge.com.mx/api/v1/events \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "batchId": "batch_xyz",
    "type": "PROCESSED",
    "description": "Avocados washed and sorted",
    "location": "Processing Facility A",
    "metadata": {
      "temperature": "4°C",
      "humidity": "85%"
    }
  }'
```

---

## Organic Certificates

**Base path**: `/api/v1/organic-certificates`

### POST /organic-certificates/generate

Generate new organic certificate.

**Auth**: Required
**Roles**: FARMER, EXPORT_COMPANY_ADMIN
**Rate Limit**: 10/min

**Request**:
```bash
curl -X POST https://api.agrobridge.com.mx/api/v1/organic-certificates/generate \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "fieldIds": ["field_123", "field_456"],
    "cropType": "AVOCADO",
    "certificationStandard": "ORGANIC_USDA",
    "notes": "Export certification for US market"
  }'
```

**Certification Standards**:
- `ORGANIC_USDA` - USDA National Organic Program
- `ORGANIC_EU` - EU Organic Regulation
- `SENASICA` - Mexican SENASICA certification

**Response**:
```json
{
  "success": true,
  "data": {
    "certificateId": "cert_xyz789",
    "certificateNumber": "AGB-MX-2025-000123",
    "status": "PROCESSING",
    "estimatedCompletion": "2025-12-25T15:30:00Z",
    "qrCodeUrl": "https://api.agrobridge.com.mx/verify/AGB-MX-2025-000123"
  }
}
```

---

### GET /organic-certificates

List certificates.

**Query Parameters**:
| Param | Type | Description |
|-------|------|-------------|
| `status` | string | PENDING, PROCESSING, APPROVED, REJECTED, EXPIRED |
| `farmerId` | string | Filter by farmer |
| `cropType` | string | Filter by crop |

### GET /organic-certificates/:id

Get certificate details.

### GET /organic-certificates/:id/pdf

Download certificate PDF.

**Response**: PDF file download

### POST /organic-certificates/:id/approve

Approve certificate (admin only).

**Roles**: ADMIN, QA_INSPECTOR

### POST /organic-certificates/:id/reject

Reject certificate with reason.

**Request**:
```json
{
  "reason": "Insufficient inspection records",
  "details": "Field inspection from last 30 days required"
}
```

### POST /organic-certificates/:id/revoke

Revoke issued certificate.

### GET /organic-certificates/:id/blockchain

Get blockchain anchoring details.

**Response**:
```json
{
  "success": true,
  "data": {
    "txHash": "0xabc123...",
    "blockNumber": 12345678,
    "network": "polygon-mainnet",
    "ipfsHash": "QmXyz...",
    "timestamp": "2025-12-25T12:00:00Z"
  }
}
```

---

## Organic Fields

**Base path**: `/api/v1/organic-fields`

### GET /organic-fields

List organic fields.

### POST /organic-fields

Register new organic field.

**Request**:
```json
{
  "name": "North Orchard",
  "location": {
    "coordinates": [-103.3496, 20.6597],
    "address": "Jalisco, Mexico"
  },
  "area": 5.5,
  "areaUnit": "hectares",
  "cropTypes": ["AVOCADO", "MANGO"],
  "organicSince": "2020-01-01"
}
```

### GET /organic-fields/:id

Get field details with recent inspections.

### PUT /organic-fields/:id

Update field information.

### DELETE /organic-fields/:id

Deactivate field.

### GET /organic-fields/:id/inspections

List field inspections.

### GET /organic-fields/:id/satellite

Get satellite imagery analysis.

### POST /organic-fields/:id/boundary

Update field boundary coordinates.

---

## Field Inspections

**Base path**: `/api/v1/field-inspections`

### GET /field-inspections

List inspections.

### POST /field-inspections

Create inspection record.

**Request**:
```json
{
  "fieldId": "field_123",
  "inspectorId": "user_inspector",
  "inspectionType": "ROUTINE",
  "findings": {
    "soilCondition": "GOOD",
    "pestControl": "ORGANIC_COMPLIANT",
    "irrigationSystem": "DRIP"
  },
  "photos": ["photo_id_1", "photo_id_2"],
  "notes": "All organic practices verified"
}
```

### GET /field-inspections/:id

Get inspection details.

### PUT /field-inspections/:id

Update inspection.

### POST /field-inspections/:id/verify

Verify inspection (QA).

### POST /field-inspections/:id/photos

Upload inspection photos.

### GET /field-inspections/pending

List pending verifications.

### GET /field-inspections/stats

Get inspection statistics.

### GET /field-inspections/types

List inspection types.

---

## Export Companies

**Base path**: `/api/v1/export-companies`

### GET /export-companies

List export companies.

### POST /export-companies

Register export company.

### GET /export-companies/:id

Get company details.

### PUT /export-companies/:id

Update company.

### GET /export-companies/:id/farmers

List associated farmers.

### POST /export-companies/:id/farmers

Associate farmer.

### DELETE /export-companies/:id/farmers/:farmerId

Remove farmer association.

### GET /export-companies/:id/certificates

List company certificates.

### GET /export-companies/:id/stats

Get company statistics.

---

## Export Company Dashboard

**Base path**: `/api/v1/export-company-dashboard`

### GET /dashboard

Main dashboard overview.

### GET /dashboard/certificates/pending

Pending certificates.

### GET /dashboard/certificates/approved

Approved certificates.

### GET /dashboard/farmers

Farmer overview.

### GET /dashboard/batches

Batch overview.

### GET /dashboard/quality

Quality metrics.

### GET /dashboard/exports

Export history.

### GET /dashboard/analytics

Analytics data.

### POST /dashboard/reports/generate

Generate custom report.

### GET /dashboard/notifications

Dashboard notifications.

### GET /dashboard/activity

Recent activity feed.

---

## Cold Chain

**Base path**: `/api/v1/cold-chain`

Temperature monitoring for transport.

### POST /cold-chain/sensors

Register temperature sensor.

### GET /cold-chain/sensors

List sensors.

### GET /cold-chain/sensors/:id

Get sensor details.

### PATCH /cold-chain/sensors/:id/assign

Assign sensor to shipment.

### PATCH /cold-chain/sensors/:id/status

Update sensor status.

### POST /cold-chain/sessions

Start cold chain session.

### GET /cold-chain/sessions

List sessions.

### GET /cold-chain/sessions/:id

Get session details.

### POST /cold-chain/sessions/:id/end

End cold chain session.

### GET /cold-chain/sessions/:id/readings

Get all temperature readings.

### GET /cold-chain/sessions/:id/report

Generate cold chain report.

### POST /cold-chain/readings

Log temperature reading.

**Request**:
```json
{
  "sessionId": "session_123",
  "sensorId": "sensor_456",
  "temperature": 4.2,
  "humidity": 85,
  "location": {
    "lat": 20.6597,
    "lng": -103.3496
  }
}
```

### POST /cold-chain/readings/bulk

Bulk upload readings.

### GET /cold-chain/dashboard

Cold chain dashboard.

---

## Transit Tracking

**Base path**: `/api/v1/transit`

### POST /transit/sessions

Start transit session.

### GET /transit/sessions

List transit sessions.

### GET /transit/sessions/:id

Get session details.

### POST /transit/sessions/:id/end

End transit session.

### POST /transit/locations

Add location update.

**Request**:
```json
{
  "sessionId": "transit_123",
  "location": {
    "lat": 20.6597,
    "lng": -103.3496
  },
  "speed": 60,
  "heading": 180,
  "timestamp": "2025-12-25T12:00:00Z"
}
```

### GET /transit/sessions/:id/route

Get complete route.

### GET /transit/sessions/:id/eta

Calculate ETA.

### POST /transit/alerts

Create transit alert.

### GET /transit/live

Live tracking view.

---

## Payments

**Base path**: `/api/v1/payments`

### POST /payments/checkout

Create checkout session.

**Request**:
```json
{
  "planId": "premium_monthly",
  "successUrl": "https://app.agrobridge.io/success",
  "cancelUrl": "https://app.agrobridge.io/cancel"
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "checkoutUrl": "https://checkout.stripe.com/c/pay/...",
    "sessionId": "cs_xxx"
  }
}
```

### GET /payments/subscription

Get current subscription.

### POST /payments/subscription/cancel

Cancel subscription.

### POST /payments/subscription/upgrade

Upgrade subscription.

### GET /payments/invoices

List payment invoices.

### GET /payments/invoices/:id

Get invoice details.

### POST /payments/methods

Add payment method.

### GET /payments/methods

List payment methods.

### DELETE /payments/methods/:id

Remove payment method.

### POST /payments/webhooks/stripe

Stripe webhook (internal).

### GET /payments/tiers

List subscription tiers.

---

## Notifications

**Base path**: `/api/v1/notifications`

### GET /notifications

List user notifications.

**Query Parameters**:
| Param | Type | Description |
|-------|------|-------------|
| `unread` | boolean | Filter unread only |
| `type` | string | Filter by type |
| `limit` | number | Limit results |

### GET /notifications/:id

Get notification details.

### PATCH /notifications/:id/read

Mark as read.

### POST /notifications/mark-all-read

Mark all as read.

### DELETE /notifications/:id

Delete notification.

### GET /notifications/preferences

Get notification preferences.

### PUT /notifications/preferences

Update preferences.

**Request**:
```json
{
  "email": {
    "certificates": true,
    "inspections": true,
    "marketing": false
  },
  "push": {
    "certificates": true,
    "inspections": true
  },
  "sms": {
    "urgent": true
  }
}
```

### POST /notifications/devices

Register device for push.

**Request**:
```json
{
  "token": "fcm_device_token",
  "platform": "ios",
  "deviceId": "device_unique_id"
}
```

### DELETE /notifications/devices/:id

Unregister device.

---

## Quality Metrics

**Base path**: `/api/v1/quality-metrics`

### GET /quality-metrics

List quality metrics.

### POST /quality-metrics

Record quality metric.

### GET /quality-metrics/:id

Get metric details.

### GET /quality-metrics/stats

Aggregate statistics.

### GET /quality-metrics/thresholds

Quality thresholds configuration.

### GET /quality-metrics/thresholds/:cropType

Get thresholds for crop type.

### GET /quality-metrics/trend

Quality trend over time.

### POST /quality-metrics/:id/verify

Verify quality metric.

---

## Satellite Analysis

**Base path**: `/api/v1/satellite-analysis`

### POST /satellite-analysis/request

Request satellite analysis.

**Request**:
```json
{
  "fieldId": "field_123",
  "analysisType": "NDVI",
  "dateRange": {
    "start": "2025-01-01",
    "end": "2025-01-31"
  }
}
```

### GET /satellite-analysis/:id

Get analysis results.

### GET /satellite-analysis/field/:fieldId

Get analyses for field.

### GET /satellite-analysis/:id/images

Get satellite images.

### GET /satellite-analysis/:id/report

Generate analysis report.

### GET /satellite-analysis/types

List analysis types.

---

## Referrals

**Base path**: `/api/v1/referrals`

### GET /referrals/code

Get user's referral code.

### GET /referrals

List referrals made.

### GET /referrals/stats

Referral statistics.

### POST /referrals/validate

Validate referral code.

### GET /referrals/rewards

List earned rewards.

### POST /referrals/claim

Claim reward.

### GET /referrals/leaderboard

Top referrers.

---

## Invoicing

**Base path**: `/api/v1/invoicing`

### POST /invoicing/generate

Generate invoice (CFDI for Mexico).

### GET /invoicing/:id

Get invoice details.

### GET /invoicing/:id/pdf

Download invoice PDF.

### POST /invoicing/:id/cancel

Cancel invoice.

---

## API Keys

**Base path**: `/api/v1/api-keys`

### GET /api-keys

List API keys.

### POST /api-keys

Create API key.

**Request**:
```json
{
  "name": "Production Key",
  "permissions": ["read:certificates", "write:batches"],
  "expiresAt": "2026-12-31T23:59:59Z"
}
```

### GET /api-keys/:id

Get key details.

### DELETE /api-keys/:id

Revoke API key.

### POST /api-keys/:id/rotate

Rotate key.

---

## Public Verification

**Base path**: `/api/v1`

### GET /verify/:certificateNumber

Public certificate verification.

**Auth**: Public

**Request**:
```bash
curl https://api.agrobridge.com.mx/api/v1/verify/AGB-MX-2025-000123
```

**Response**:
```json
{
  "success": true,
  "data": {
    "valid": true,
    "certificate": {
      "number": "AGB-MX-2025-000123",
      "issuedTo": "Green Valley Farm",
      "cropType": "Avocado",
      "standard": "USDA Organic",
      "issuedDate": "2025-01-15",
      "expiryDate": "2026-01-15",
      "status": "VALID"
    },
    "blockchain": {
      "verified": true,
      "txHash": "0xabc...",
      "network": "polygon"
    }
  }
}
```

### GET /public/batch/:code

Public batch traceability.

### GET /public/producer/:id

Public producer profile.

---

## Health & System

### GET /health

System health check.

**Auth**: Public

**Response**:
```json
{
  "status": "healthy",
  "timestamp": "2025-12-25T12:00:00Z",
  "services": {
    "database": "connected",
    "redis": "connected",
    "blockchain": "connected"
  },
  "uptime": 123456
}
```

### GET /health/ready

Kubernetes readiness probe.

### GET /health/startup

Kubernetes startup probe.

### GET /health/metrics

Prometheus metrics.

### GET /health/cache

Cache status.

### GET /health/queues

Queue status.

---

## v2 API

**Base path**: `/api/v2`

Version 2 API with enhanced features.

### Analytics

- GET `/v2/analytics/overview`
- GET `/v2/analytics/certificates`
- GET `/v2/analytics/batches`
- GET `/v2/analytics/quality`
- GET `/v2/analytics/timeline`
- GET `/v2/analytics/export`
- POST `/v2/analytics/custom`

### Enhanced CRUD

- GET `/v2/batches` - Enhanced filtering
- GET `/v2/batches/:id` - Extended details
- GET `/v2/events` - Real-time events
- GET `/v2/producers` - Extended profiles

---

## Modules

### WhatsApp Bot

**Base path**: `/api/v1/whatsapp`

- POST `/whatsapp/webhook` - Meta webhook
- GET `/whatsapp/webhook` - Webhook verification

### Credit Scoring

**Base path**: `/api/v1/credit`

- GET `/credit/score/:farmerId`
- POST `/credit/calculate`
- GET `/credit/history/:farmerId`
- GET `/credit/factors`
- POST `/credit/refresh`

### Collections

**Base path**: `/api/v1/collections`

- GET `/collections/pending`
- POST `/collections/process`
- GET `/collections/:id`
- POST `/collections/:id/remind`
- GET `/collections/stats`
- POST `/collections/bulk-remind`

### Repayments

**Base path**: `/api/v1/repayments`

- GET `/repayments`
- POST `/repayments`
- GET `/repayments/:id`
- POST `/repayments/:id/process`
- GET `/repayments/schedule/:advanceId`
- POST `/repayments/partial`
- GET `/repayments/overdue`
- POST `/repayments/extend`
- GET `/repayments/stats`

### Cash Flow Bridge

**Base path**: `/api/v1/advances`

- GET `/advances`
- POST `/advances/request`
- GET `/advances/:id`
- POST `/advances/:id/approve`
- POST `/advances/:id/disburse`
- GET `/advances/eligibility`
- GET `/advances/pools`
- GET `/advances/pools/:id/metrics`

---

## Error Handling

All endpoints return errors in this format:

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable message",
    "details": "Additional context",
    "requestId": "req_abc123"
  }
}
```

See [Error Codes Reference](./ERROR-CODES.md) for complete error documentation.

---

## SDK Examples

### JavaScript/TypeScript

```typescript
import { AgroBridgeClient } from '@agrobridge/sdk';

const client = new AgroBridgeClient({
  apiKey: 'your_api_key',
  baseUrl: 'https://api.agrobridge.com.mx'
});

// Get certificate
const cert = await client.certificates.get('cert_123');

// Generate certificate
const newCert = await client.certificates.generate({
  fieldIds: ['field_1'],
  cropType: 'AVOCADO',
  standard: 'ORGANIC_USDA'
});
```

### Python

```python
from agrobridge import AgroBridgeClient

client = AgroBridgeClient(api_key="your_api_key")

# Get certificate
cert = client.certificates.get("cert_123")

# List batches
batches = client.batches.list(product_type="Avocado")
```

### cURL

```bash
# Set your token
export TOKEN="your_jwt_token"

# List certificates
curl -H "Authorization: Bearer $TOKEN" \
  https://api.agrobridge.com.mx/api/v1/organic-certificates

# Create batch
curl -X POST \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"code":"BATCH-001","productType":"Avocado"}' \
  https://api.agrobridge.com.mx/api/v1/batches
```

---

**Last updated**: December 25, 2025
**Endpoints documented**: 309/309 (100%)
**API Version**: v1 (v2 in beta)
