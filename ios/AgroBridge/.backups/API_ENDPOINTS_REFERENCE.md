# 🌐 AgroBridge API - Endpoints Quick Reference

📖 **Reading time:** ~5 minutes | **Print-friendly format**

**API Version:** v1
**Base URL:** `https://api.agrobridge.io/v1`
**Last Updated:** November 28, 2024

---

## 📋 Table of Contents

1. [Authentication](#authentication)
2. [Dashboard](#dashboard)
3. [Lotes (Lots)](#lotes-lots)
4. [Productores (Producers)](#productores-producers)
5. [Bloques (Blocks)](#bloques-blocks)
6. [Response Codes](#response-codes)
7. [Error Handling](#error-handling)

---

## 🔐 Authentication

### POST `/auth/login`
**Purpose:** User login with email and password

```http
POST /auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "SecurePass123!"
}
```

**Response (200 OK):**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "refresh_token_here",
  "user": {
    "id": "uuid-123",
    "nombre": "John Doe",
    "email": "user@example.com",
    "rol": "producer"
  }
}
```

**Swift:**
```swift
let response: LoginResponse = try await apiClient.request(
    endpoint: .login,
    method: .POST,
    body: LoginRequest(email: email, password: password)
)
```

---

### POST `/auth/refresh`
**Purpose:** Refresh expired access token

```http
POST /auth/refresh
Content-Type: application/json
Authorization: Bearer {refreshToken}
```

**Response (200 OK):**
```json
{
  "token": "new_access_token",
  "expiresIn": 3600
}
```

---

### POST `/auth/logout`
**Purpose:** Invalidate user session

```http
POST /auth/logout
Authorization: Bearer {token}
```

**Response (204 No Content)**

---

## 📊 Dashboard

### GET `/dashboard/stats`
**Purpose:** Fetch dashboard statistics

```http
GET /dashboard/stats
Authorization: Bearer {token}
```

**Response (200 OK):**
```json
{
  "totalProductores": 248,
  "lotesActivos": 156,
  "bloquesCertificados": 89,
  "estadoConexion": "online"
}
```

**Swift:**
```swift
let stats: DashboardStats = try await apiClient.request(
    endpoint: .dashboardStats,
    method: .GET
)
```

---

## 🌿 Lotes (Lots)

### GET `/lotes`
**Purpose:** List all lots

```http
GET /lotes
Authorization: Bearer {token}
```

**Query Parameters:**
- `page` (number): Page number (default: 1)
- `limit` (number): Items per page (default: 20)
- `search` (string): Search by name or location
- `tipoCultivo` (string): Filter by crop type
- `estado` (string): Filter by status (activo, inactivo)

**Response (200 OK):**
```json
{
  "lotes": [
    {
      "id": "lote_1",
      "nombre": "Lote Norte",
      "ubicacion": "Valle Central",
      "tipoCultivo": "Aguacate",
      "areaHectareas": 5.5,
      "estado": "activo",
      "fechaCreacion": "2024-11-01T12:00:00Z"
    }
  ],
  "total": 156,
  "page": 1,
  "totalPages": 8
}
```

---

### GET `/lotes/:id`
**Purpose:** Fetch single lot details

```http
GET /lotes/lote_123
Authorization: Bearer {token}
```

**Response (200 OK):**
```json
{
  "id": "lote_123",
  "nombre": "Lote Norte",
  "ubicacion": "Valle Central",
  "tipoCultivo": "Aguacate",
  "areaHectareas": 5.5,
  "estado": "activo",
  "notas": "Lote con buen rendimiento",
  "productorId": "prod_456",
  "fechaCreacion": "2024-11-01T12:00:00Z"
}
```

---

### POST `/lotes`
**Purpose:** Create new lot

```http
POST /lotes
Authorization: Bearer {token}
Content-Type: application/json

{
  "nombre": "Lote Nuevo",
  "ubicacion": "Zona Norte",
  "tipoCultivo": "Café",
  "areaHectareas": 10.0,
  "notas": "Lote experimental"
}
```

**Response (201 Created):**
```json
{
  "id": "lote_789",
  "nombre": "Lote Nuevo",
  "ubicacion": "Zona Norte",
  "tipoCultivo": "Café",
  "areaHectareas": 10.0,
  "estado": "activo",
  "fechaCreacion": "2024-11-28T14:00:00Z"
}
```

**Swift:**
```swift
let lote: Lote = try await apiClient.request(
    endpoint: .createLote,
    method: .POST,
    body: CreateLoteRequest(
        nombre: "Lote Nuevo",
        ubicacion: "Zona Norte",
        tipoCultivo: "Café",
        areaHectareas: 10.0
    )
)
```

---

### PUT `/lotes/:id`
**Purpose:** Update existing lot

```http
PUT /lotes/lote_123
Authorization: Bearer {token}
Content-Type: application/json

{
  "nombre": "Lote Norte Actualizado",
  "ubicacion": "Valle Central",
  "tipoCultivo": "Aguacate",
  "areaHectareas": 6.0
}
```

**Response (200 OK):** Updated lot object

---

### DELETE `/lotes/:id`
**Purpose:** Delete lot

```http
DELETE /lotes/lote_123
Authorization: Bearer {token}
```

**Response (204 No Content)**

**Swift:**
```swift
try await apiClient.requestWithoutResponse(
    endpoint: .deleteLote(id: "lote_123"),
    method: .DELETE
)
```

---

## 👨‍🌾 Productores (Producers)

### GET `/productores`
**Purpose:** List all producers

```http
GET /productores
Authorization: Bearer {token}
```

**Response (200 OK):**
```json
{
  "productores": [
    {
      "id": "prod_1",
      "nombre": "Juan Pérez",
      "email": "juan@example.com",
      "telefono": "+52 999 123 4567",
      "totalLotes": 5,
      "estado": "activo"
    }
  ],
  "total": 248
}
```

---

### GET `/productores/:id`
**Purpose:** Fetch single producer details

```http
GET /productores/prod_123
Authorization: Bearer {token}
```

---

### POST `/productores`
**Purpose:** Create new producer

```http
POST /productores
Authorization: Bearer {token}
Content-Type: application/json

{
  "nombre": "Juan Pérez",
  "email": "juan@example.com",
  "telefono": "+52 999 123 4567",
  "direccion": "Calle Principal 123",
  "documentoIdentidad": "CURP123456"
}
```

**Response (201 Created):** Producer object

---

### PUT `/productores/:id`
**Purpose:** Update producer

**Response (200 OK):** Updated producer object

---

### DELETE `/productores/:id`
**Purpose:** Delete producer

**Response (204 No Content)**

---

## 🔗 Bloques (Blocks)

### GET `/bloques`
**Purpose:** List blockchain blocks

```http
GET /bloques
Authorization: Bearer {token}
```

**Response (200 OK):**
```json
{
  "bloques": [
    {
      "id": "bloque_1",
      "hash": "a1b2c3d4e5f6...",
      "previousHash": "0000000000...",
      "timestamp": "2024-11-28T14:00:00Z",
      "loteId": "lote_123",
      "data": {...}
    }
  ],
  "total": 89
}
```

---

### GET `/bloques/:id`
**Purpose:** Fetch single block

```http
GET /bloques/bloque_123
Authorization: Bearer {token}
```

**Response (200 OK):** Block object with full details

---

## 📋 Response Codes

| Code | Meaning | Action |
|------|---------|--------|
| **200** | OK | Success |
| **201** | Created | Resource created successfully |
| **204** | No Content | Success (no body returned) |
| **400** | Bad Request | Invalid request body or parameters |
| **401** | Unauthorized | Invalid or expired token → Auto logout |
| **403** | Forbidden | Insufficient permissions |
| **404** | Not Found | Resource doesn't exist |
| **422** | Unprocessable Entity | Validation error |
| **429** | Too Many Requests | Rate limit exceeded |
| **500** | Internal Server Error | Server error |
| **503** | Service Unavailable | Server maintenance |

---

## ⚠️ Error Handling

### Error Response Format

All errors follow this structure:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Email format is invalid",
    "details": {
      "field": "email",
      "value": "invalid-email"
    }
  }
}
```

### Error Codes

| Code | Description |
|------|-------------|
| `VALIDATION_ERROR` | Request validation failed |
| `AUTH_FAILED` | Authentication failed |
| `TOKEN_EXPIRED` | JWT token expired |
| `RESOURCE_NOT_FOUND` | Requested resource not found |
| `DUPLICATE_ENTRY` | Resource already exists |
| `PERMISSION_DENIED` | Insufficient permissions |
| `RATE_LIMIT_EXCEEDED` | Too many requests |
| `SERVER_ERROR` | Internal server error |

---

## 🔧 Swift Error Handling

```swift
do {
    let stats: DashboardStats = try await apiClient.request(
        endpoint: .dashboardStats,
        method: .GET
    )
    // Success
} catch let error as NetworkError {
    switch error {
    case .unauthorized:
        // Auto logout, redirect to login
        await AuthService.shared.logout()
    case .notFound:
        // Show "Resource not found"
        showError = true
        errorMessage = "No se encontró el recurso"
    case .serverError(let code):
        // Server error
        errorMessage = "Error del servidor (código \(code))"
    default:
        // Generic error
        errorMessage = MicroCopy.errorGeneric
    }
}
```

---

## 🔑 Authentication Headers

All authenticated requests require:

```http
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
Content-Type: application/json
Accept: application/json
```

**Token Lifecycle:**
- **Access Token:** Valid for 1 hour
- **Refresh Token:** Valid for 7 days
- **Auto Refresh:** APIClient refreshes 5 minutes before expiration

---

## 🚀 Rate Limits

| Endpoint Type | Limit |
|--------------|-------|
| Authentication | 10 requests/minute |
| Read operations (GET) | 100 requests/minute |
| Write operations (POST/PUT/DELETE) | 50 requests/minute |
| Dashboard | 20 requests/minute |

**Rate Limit Headers:**
```http
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1701187200
```

---

## 📚 Full Documentation

For complete API documentation including:
- Request/response examples
- Authentication flow
- Service layer patterns
- Testing strategies
- Troubleshooting

See: **[API_INTEGRATION.md](API_INTEGRATION.md)**

---

**Author:** Alejandro Navarro Ayala - CEO & Senior Developer
**For:** AgroBridge iOS Team
**Print this reference for quick API lookups!** 🖨️
