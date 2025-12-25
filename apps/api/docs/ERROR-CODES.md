# Error Codes Reference

Complete reference for all **54 error codes** returned by AgroBridge API.

---

## Quick Lookup

| Code | HTTP | Category | Description |
|------|------|----------|-------------|
| `UNAUTHENTICATED` | 401 | Auth | No valid authentication token |
| `UNAUTHORIZED` | 403 | Auth | User lacks required permissions |
| `FORBIDDEN` | 403 | Auth | Action not allowed |
| `NOT_FOUND` | 404 | Resource | Resource does not exist |
| `VALIDATION_ERROR` | 400 | Input | Request validation failed |
| `RATE_LIMITED` | 429 | Rate Limit | Too many requests |
| `INTERNAL_ERROR` | 500 | System | Unexpected server error |

---

## Error Response Format

All errors follow this structure:

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable message",
    "details": "Additional context (optional)",
    "timestamp": "2025-12-25T12:00:00.000Z",
    "path": "/api/v1/endpoint",
    "requestId": "req_abc123xyz"
  }
}
```

**Fields**:
- `code`: Machine-readable error code (use for programmatic handling)
- `message`: User-friendly error description
- `details`: Technical details (only in development mode)
- `timestamp`: ISO 8601 timestamp when error occurred
- `path`: API endpoint that returned error
- `requestId`: Unique request ID for support tickets

---

## Authentication Errors

### UNAUTHENTICATED

**HTTP Status**: 401 Unauthorized

**Cause**: Request missing or contains invalid authentication token.

**When it happens**:
- No `Authorization` header provided
- Token is malformed (not valid JWT)
- Token signature verification failed
- Token has expired

**Example response**:
```json
{
  "success": false,
  "error": {
    "code": "UNAUTHENTICATED",
    "message": "Authentication required",
    "details": "No valid token provided in Authorization header"
  }
}
```

**How to fix (client)**:
```typescript
if (error.code === 'UNAUTHENTICATED') {
  // Token might be expired - try refresh
  const newToken = await refreshToken();
  if (newToken) {
    // Retry original request with new token
    return retryRequest(originalRequest, newToken);
  } else {
    // Refresh failed - redirect to login
    redirectToLogin();
  }
}
```

**How to fix (user)**: Log in again to get a new token.

---

### UNAUTHORIZED

**HTTP Status**: 403 Forbidden

**Cause**: User is authenticated but lacks permission for this action.

**When it happens**:
- User role doesn't have access (e.g., FARMER trying admin endpoint)
- Resource belongs to different user
- Account suspended or restricted

**Example response**:
```json
{
  "success": false,
  "error": {
    "code": "UNAUTHORIZED",
    "message": "You don't have permission to perform this action",
    "details": "Required role: ADMIN. Your role: FARMER"
  }
}
```

**How to fix**: Contact administrator to upgrade permissions, or use an account with appropriate role.

---

### FORBIDDEN

**HTTP Status**: 403 Forbidden

**Cause**: Action is not allowed regardless of permissions.

**When it happens**:
- Trying to modify immutable resource
- Feature disabled for this environment
- Action blocked by business rules

**Example response**:
```json
{
  "success": false,
  "error": {
    "code": "FORBIDDEN",
    "message": "This action is not allowed",
    "details": "Cannot modify approved certificates"
  }
}
```

---

### USER_NOT_FOUND

**HTTP Status**: 404 Not Found

**Cause**: Referenced user does not exist.

**When it happens**:
- User ID in URL/body doesn't exist
- User was deleted
- Typo in user ID

**How to fix**: Verify user ID is correct. If user was deleted, create new user.

---

### INVALID_CODE

**HTTP Status**: 400 Bad Request

**Cause**: Verification or confirmation code is invalid.

**When it happens**:
- Email verification code expired
- 2FA code incorrect
- Password reset token invalid

**Example response**:
```json
{
  "success": false,
  "error": {
    "code": "INVALID_CODE",
    "message": "Verification code is invalid or expired",
    "details": "Code expired at 2025-12-25T11:00:00Z"
  }
}
```

**How to fix**: Request a new verification code.

---

### INVALID_PROVIDER

**HTTP Status**: 400 Bad Request

**Cause**: OAuth provider specified is not supported.

**When it happens**:
- Using unsupported OAuth provider
- Provider disabled in configuration

**Supported providers**: `google`, `github`

---

## CSRF/Security Errors

### CSRF_TOKEN_MISSING

**HTTP Status**: 403 Forbidden

**Cause**: Required CSRF token not provided in request.

**How to fix**: Include `X-CSRF-Token` header with valid token from `/api/v1/auth/csrf`.

---

### CSRF_TOKEN_INVALID

**HTTP Status**: 403 Forbidden

**Cause**: CSRF token doesn't match expected value.

**How to fix**: Fetch a new CSRF token and retry.

---

### CSRF_TOKEN_EXPIRED

**HTTP Status**: 403 Forbidden

**Cause**: CSRF token has expired.

**How to fix**: Fetch a new CSRF token (they expire after 1 hour).

---

### XSS_DETECTED

**HTTP Status**: 400 Bad Request

**Cause**: Potential XSS attack detected in input.

**When it happens**:
- Input contains `<script>` tags
- Input contains JavaScript event handlers
- Input contains encoded malicious content

**How to fix**: Sanitize input - remove HTML tags and JavaScript.

---

## Validation Errors

### VALIDATION_ERROR

**HTTP Status**: 400 Bad Request

**Cause**: Request body failed validation.

**Example response**:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Validation failed",
    "details": [
      {
        "field": "email",
        "message": "Must be a valid email address"
      },
      {
        "field": "password",
        "message": "Must be at least 8 characters"
      }
    ]
  }
}
```

**How to fix (client)**:
```typescript
if (error.code === 'VALIDATION_ERROR') {
  const fieldErrors = error.details;
  fieldErrors.forEach(({ field, message }) => {
    // Show error next to form field
    setFieldError(field, message);
  });
}
```

---

### INVALID_INPUT

**HTTP Status**: 400 Bad Request

**Cause**: General input validation failure.

---

### INVALID_REQUEST

**HTTP Status**: 400 Bad Request

**Cause**: Request structure is malformed.

**When it happens**:
- Invalid JSON body
- Missing required fields
- Wrong content type

---

### MISSING_CONTENT_TYPE

**HTTP Status**: 415 Unsupported Media Type

**Cause**: `Content-Type` header not specified.

**How to fix**: Add `Content-Type: application/json` header.

---

### UNSUPPORTED_MEDIA_TYPE

**HTTP Status**: 415 Unsupported Media Type

**Cause**: Content-Type is not supported.

**Supported types**: `application/json`, `multipart/form-data`

---

### MISSING_SIGNATURE

**HTTP Status**: 400 Bad Request

**Cause**: Webhook request missing signature header.

**When it happens**: Webhook from Stripe/external service without signature.

---

## Resource Errors

### NOT_FOUND

**HTTP Status**: 404 Not Found

**Cause**: Requested resource doesn't exist.

**Example response**:
```json
{
  "success": false,
  "error": {
    "code": "NOT_FOUND",
    "message": "Resource not found",
    "details": "Batch with ID 'batch_xyz' does not exist"
  }
}
```

---

### FIELD_NOT_FOUND

**HTTP Status**: 404 Not Found

**Cause**: Referenced organic field doesn't exist.

---

### ANALYSIS_NOT_FOUND / NO_ANALYSIS_FOUND

**HTTP Status**: 404 Not Found

**Cause**: Satellite analysis for field doesn't exist.

**How to fix**: Request new satellite analysis for the field.

---

### CONFLICT

**HTTP Status**: 409 Conflict

**Cause**: Request conflicts with current state.

**When it happens**:
- Creating duplicate resource
- Modifying resource that changed
- Concurrent update conflict

---

## Rate Limiting Errors

### RATE_LIMITED

**HTTP Status**: 429 Too Many Requests

**Cause**: Too many requests in time window.

**Example response**:
```json
{
  "success": false,
  "error": {
    "code": "RATE_LIMITED",
    "message": "Too many requests",
    "details": "Rate limit: 100 requests per 15 minutes"
  },
  "retryAfter": 300
}
```

**Headers**:
```
Retry-After: 300
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 0
X-RateLimit-Reset: 1703505600
```

**How to fix (client)**:
```typescript
if (error.code === 'RATE_LIMITED') {
  const retryAfter = response.headers.get('Retry-After') || 60;
  await sleep(retryAfter * 1000);
  return retryRequest();
}
```

---

### RATE_LIMIT_EXCEEDED

**HTTP Status**: 429 Too Many Requests

**Cause**: General rate limit exceeded.

---

### RATE_LIMIT_AUTH_EXCEEDED

**HTTP Status**: 429 Too Many Requests

**Cause**: Authentication endpoint rate limit (5 req/15 min).

**Limit**: 5 requests per 15 minutes per IP.

**Why stricter**: Protects against brute-force password attacks.

---

### RATE_LIMIT_REGISTRATION_EXCEEDED

**HTTP Status**: 429 Too Many Requests

**Cause**: Registration rate limit (3 req/hour).

**Limit**: 3 registrations per hour per IP.

---

### RATE_LIMIT_PASSWORD_RESET_EXCEEDED

**HTTP Status**: 429 Too Many Requests

**Cause**: Password reset rate limit (3 req/hour).

**Limit**: 3 password reset requests per hour per email.

---

### RATE_LIMIT_REFRESH_EXCEEDED

**HTTP Status**: 429 Too Many Requests

**Cause**: Token refresh rate limit.

---

### RATE_LIMIT_OAUTH_EXCEEDED

**HTTP Status**: 429 Too Many Requests

**Cause**: OAuth login rate limit.

---

### RATE_LIMIT_CREATION_EXCEEDED

**HTTP Status**: 429 Too Many Requests

**Cause**: Resource creation rate limit.

**Limit**: 50 creates per hour.

---

### RATE_LIMIT_CERTGEN_EXCEEDED

**HTTP Status**: 429 Too Many Requests

**Cause**: Certificate generation rate limit.

**Limit**: 10 certificates per minute (expensive operation).

---

### RATE_LIMIT_API_EXCEEDED

**HTTP Status**: 429 Too Many Requests

**Cause**: General API rate limit.

**Limit**: 100 requests per 15 minutes.

---

### RATE_LIMIT_PUBLIC_API_EXCEEDED

**HTTP Status**: 429 Too Many Requests

**Cause**: Public endpoint rate limit.

---

### RATE_LIMIT_SENSITIVE_EXCEEDED

**HTTP Status**: 429 Too Many Requests

**Cause**: Sensitive operation rate limit.

---

### RATE_LIMIT_ADMIN_EXCEEDED

**HTTP Status**: 429 Too Many Requests

**Cause**: Admin endpoint rate limit.

---

### QUOTA_EXCEEDED

**HTTP Status**: 429 Too Many Requests

**Cause**: Monthly/plan quota exceeded.

**Example**: Free tier limited to 100 certificates/month.

**How to fix**: Upgrade plan or wait for quota reset.

---

## API Versioning Errors

### INVALID_API_VERSION

**HTTP Status**: 400 Bad Request

**Cause**: Requested API version format is invalid.

**Valid formats**: `v1`, `v2`, `2024-01-01`

---

### UNSUPPORTED_API_VERSION / VERSION_NOT_SUPPORTED

**HTTP Status**: 400 Bad Request

**Cause**: Requested API version is not supported.

**Supported versions**: `v1`, `v2`

---

### API_VERSION_TOO_LOW

**HTTP Status**: 400 Bad Request

**Cause**: API version is below minimum supported.

**How to fix**: Upgrade client to use v1 or later.

---

## Business Logic Errors

### INSUFFICIENT_INSPECTIONS

**HTTP Status**: 422 Unprocessable Entity

**Cause**: Not enough inspections to generate certificate.

**When it happens**: Trying to generate organic certificate without required inspections.

**How to fix**: Complete required field inspections first.

---

### UNVERIFIED_INSPECTIONS

**HTTP Status**: 422 Unprocessable Entity

**Cause**: Inspections exist but not verified.

**How to fix**: Get inspector to verify pending inspections.

---

### INSUFFICIENT_ORGANIC_INPUTS

**HTTP Status**: 422 Unprocessable Entity

**Cause**: Not enough organic input records.

---

### UNVERIFIED_ORGANIC_INPUTS

**HTTP Status**: 422 Unprocessable Entity

**Cause**: Organic inputs not verified.

---

### INSUFFICIENT_PHOTOS

**HTTP Status**: 422 Unprocessable Entity

**Cause**: Required photos not uploaded.

**How to fix**: Upload required inspection photos.

---

### UNSUPPORTED_CROP

**HTTP Status**: 400 Bad Request

**Cause**: Crop type not supported for certification.

**Supported crops**: AVOCADO, BERRY, MANGO, TOMATO, COFFEE, etc.

---

## Document Generation Errors

### PDF_GENERATION_ERROR

**HTTP Status**: 500 Internal Server Error

**Cause**: Failed to generate PDF document.

**When it happens**:
- Template rendering failed
- PDF library error
- Memory exhaustion

---

### PDF_NOT_AVAILABLE

**HTTP Status**: 404 Not Found

**Cause**: PDF not yet generated or expired.

**How to fix**: Regenerate PDF or wait for async generation.

---

### YAML_GENERATION_ERROR

**HTTP Status**: 500 Internal Server Error

**Cause**: Failed to generate YAML export.

---

### RESPONSE_TOO_LARGE

**HTTP Status**: 413 Payload Too Large

**Cause**: Response exceeds maximum size.

**How to fix**: Use pagination or request smaller date range.

---

## External Service Errors

### WEBHOOK_ERROR

**HTTP Status**: 500 Internal Server Error

**Cause**: Webhook delivery failed.

---

### SCAN_ERROR

**HTTP Status**: 500 Internal Server Error

**Cause**: Virus scanning failed.

---

### VIRUS_DETECTED

**HTTP Status**: 400 Bad Request

**Cause**: Uploaded file contains malware.

**Action**: File rejected. Upload clean file.

---

## System Errors

### INTERNAL_ERROR

**HTTP Status**: 500 Internal Server Error

**Cause**: Unexpected server error.

**Example response**:
```json
{
  "success": false,
  "error": {
    "code": "INTERNAL_ERROR",
    "message": "An unexpected error occurred",
    "requestId": "req_abc123xyz"
  }
}
```

**How to fix**: Report to support with `requestId`. Check Sentry for details.

---

### ERROR_CODE

**HTTP Status**: 500 Internal Server Error

**Cause**: Generic error (should not appear in production).

---

## Error Handling Best Practices

### Client-Side

```typescript
async function apiRequest(url: string, options: RequestInit) {
  const response = await fetch(url, options);
  const data = await response.json();

  if (!data.success) {
    const error = data.error;

    switch (error.code) {
      case 'UNAUTHENTICATED':
        return handleUnauthenticated();

      case 'RATE_LIMITED':
        const retryAfter = response.headers.get('Retry-After');
        return retryWithBackoff(url, options, retryAfter);

      case 'VALIDATION_ERROR':
        return showValidationErrors(error.details);

      case 'NOT_FOUND':
        return showNotFoundMessage();

      default:
        // Log unexpected errors
        logToSentry(error);
        return showGenericError();
    }
  }

  return data;
}
```

### Retry Logic

```typescript
async function retryWithBackoff(
  url: string,
  options: RequestInit,
  initialDelay: number = 1000,
  maxRetries: number = 3
) {
  let delay = initialDelay;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const response = await fetch(url, options);
      if (response.ok) return response.json();

      if (response.status === 429) {
        // Rate limited - use Retry-After header
        delay = parseInt(response.headers.get('Retry-After') || '60') * 1000;
      } else if (response.status >= 500) {
        // Server error - exponential backoff
        delay *= 2;
      } else {
        // Client error - don't retry
        throw new Error(`Request failed: ${response.status}`);
      }

      await sleep(delay);
    } catch (err) {
      if (attempt === maxRetries - 1) throw err;
      await sleep(delay);
      delay *= 2;
    }
  }
}
```

---

## Getting Help

**For error `requestId`**: Include in support tickets for faster resolution.

**Sentry tracking**: All 5xx errors logged with stack trace.

**Support channels**:
- Slack: #backend-support
- Email: support@agrobridge.io

---

**Last updated**: December 25, 2025
**Error codes documented**: 54/54 (100%)
