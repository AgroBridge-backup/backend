# AgroBridge FinTech Postman Collection

## Installation

1. Open Postman
2. Click "Import" button
3. Select `AgroBridge-FinTech-v2.postman_collection.json`
4. Collection will appear in your workspace

## Configuration

### Environment Variables

Create a new Environment in Postman with these variables:

| Variable | Example Value | Description |
|----------|---------------|-------------|
| `base_url` | `http://localhost:4000/api/v1` | API base URL |
| `jwt_token` | `eyJhbGci...` | Your JWT authentication token |
| `verify_token` | `random_string_20_chars` | WhatsApp webhook verification token |
| `user_id` | `uuid-here` | Test user UUID |
| `advance_id` | `uuid-here` | Test advance UUID |

### Getting a JWT Token

```bash
# Login to get token
curl -X POST http://localhost:4000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@agrobridge.io","password":"your_password"}'

# Copy the "token" from response and paste into Postman environment
```

## Collection Structure

- **0. Health Checks** - System status endpoints
- **1. WhatsApp Bot** - Meta Cloud API integration (3 requests)
- **2. Credit Scoring** - Alternative credit assessment (5 requests)
- **3. Repayments** - Payment processing (7 requests)
- **4. Collections** - Automated reminders (6 requests)
- **5. Webhooks** - Payment provider webhooks (2 requests)

**Total:** 23 pre-configured requests

## Testing Workflow

### 1. Quick Health Check
Run: `0. Health Checks` -> `FinTech Health Check`

Expected: 200 OK with module status

### 2. Test Credit Scoring
1. Set `user_id` in environment
2. Run: `2. Credit Scoring` -> `Calculate Score`
3. Verify score between 0-1000

### 3. Test Repayments
1. Set `advance_id` in environment
2. Run: `3. Repayments` -> `Get Balance`
3. Run: `3. Repayments` -> `Record Payment`

### 4. Test Collections
1. Run: `4. Collections` -> `Get Collection Rules`
2. Run: `4. Collections` -> `Manual Collection Run`

## Authentication

Most endpoints require authentication. The collection uses **Bearer Token** at collection level.

To override for specific requests, edit the request's Authorization tab.

## Notes

- All timestamps are in ISO 8601 format
- Amounts are in MXN (Mexican Pesos) with 2 decimal places
- Admin endpoints require elevated permissions
