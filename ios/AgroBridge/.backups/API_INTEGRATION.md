# 🌐 AgroBridge API Integration Guide

📖 **Reading time:** ~35 minutes

**Version:** 1.0.0
**Backend:** AgroBridge REST API
**Base URL:** `https://api.agrobridge.io/v1`
**Protocol:** HTTPS
**Format:** JSON

---

## Table of Contents

1. [Overview](#overview)
2. [Authentication](#authentication)
3. [APIClient Reference](#apiclient-reference)
4. [Endpoint Definitions](#endpoint-definitions)
5. [Error Handling](#error-handling)
6. [Request/Response Examples](#requestresponse-examples)
7. [Service Layer Patterns](#service-layer-patterns)
8. [Testing API Integration](#testing-api-integration)
9. [Troubleshooting](#troubleshooting)

---

## Overview

### Architecture Flow

```
ViewModel → Service → APIClient → Backend
   ↓          ↓          ↓            ↓
 UI State   Business   HTTP       REST API
           Logic      Request
```

**Key Principles:**
- ✅ ViewModels NEVER call APIClient directly
- ✅ Services orchestrate API calls
- ✅ APIClient handles HTTP/JSON
- ✅ Async/await throughout (no callbacks)
- ✅ Type-safe with Codable

---

## Authentication

### JWT Token Flow

```
1. User logs in with email/password
   ↓
2. Backend returns JWT token + user data
   ↓
3. Token saved to Keychain (secure storage)
   ↓
4. All subsequent requests include token:
   Authorization: Bearer {token}
   ↓
5. If 401 Unauthorized → Auto logout
```

---

### Login Request

```swift
// Request
struct LoginRequest: Codable {
    let email: String
    let password: String
}

// Response
struct LoginResponse: Codable {
    let token: String
    let refreshToken: String?
    let user: User
}

// Usage
let request = LoginRequest(
    email: "usuario@example.com",
    password: "password123"
)

let response: LoginResponse = try await apiClient.request(
    endpoint: .login,
    method: .POST,
    body: request
)

// Save token
try keychain.save(response.token, for: .authToken)
```

---

### Token Storage (Keychain)

```swift
class KeychainManager {
    static let shared = KeychainManager()

    enum KeychainKey: String {
        case authToken = "com.agrobridge.authToken"
        case refreshToken = "com.agrobridge.refreshToken"
    }

    // Save token
    func save(_ value: String, for key: KeychainKey) throws {
        let data = value.data(using: .utf8)!

        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrAccount as String: key.rawValue,
            kSecValueData as String: data
        ]

        SecItemDelete(query as CFDictionary)
        let status = SecItemAdd(query as CFDictionary, nil)

        guard status == errSecSuccess else {
            throw KeychainError.saveFailed
        }
    }

    // Retrieve token
    func retrieve(for key: KeychainKey) throws -> String {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrAccount as String: key.rawValue,
            kSecReturnData as String: true
        ]

        var result: AnyObject?
        let status = SecItemCopyMatching(query as CFDictionary, &result)

        guard status == errSecSuccess,
              let data = result as? Data,
              let string = String(data: data, encoding: .utf8) else {
            throw KeychainError.retrieveFailed
        }

        return string
    }

    // Delete token
    func delete(for key: KeychainKey) throws {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrAccount as String: key.rawValue
        ]

        let status = SecItemDelete(query as CFDictionary)

        guard status == errSecSuccess || status == errSecItemNotFound else {
            throw KeychainError.deleteFailed
        }
    }
}
```

---

### Automatic JWT Injection

APIClient automatically injects token from Keychain:

```swift
// Inside APIClient.request()
if let token = try? KeychainManager.shared.retrieve(for: .authToken) {
    request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
}
```

**No manual token management needed in Services!**

---

## APIClient Reference

### Location
`Core/Networking/APIClient.swift` (190 lines)

---

### Main Methods

#### 1. Generic Request (with response)

```swift
func request<T: Decodable>(
    endpoint: Endpoint,
    method: HTTPMethod,
    body: Encodable? = nil,
    headers: [String: String]? = nil
) async throws -> T
```

**Example:**
```swift
let stats: DashboardStats = try await apiClient.request(
    endpoint: .dashboardStats,
    method: .GET
)
```

---

#### 2. Request Without Response

```swift
func requestWithoutResponse(
    endpoint: Endpoint,
    method: HTTPMethod,
    body: Encodable? = nil,
    headers: [String: String]? = nil
) async throws
```

**Example:**
```swift
try await apiClient.requestWithoutResponse(
    endpoint: .logout,
    method: .POST
)
```

---

### Request Flow

```
1. Build URL from Endpoint
   ↓
2. Create URLRequest
   ↓
3. Set HTTP method (GET, POST, etc.)
   ↓
4. Add headers (Content-Type, Accept)
   ↓
5. Inject JWT token (if authenticated)
   ↓
6. Encode body to JSON (if present)
   ↓
7. Execute URLSession.data(for:)
   ↓
8. Validate HTTP status code
   ↓
9. Handle errors (401 → logout, 404, 500, etc.)
   ↓
10. Decode JSON to Codable type
   ↓
11. Return result
```

---

### Code Walkthrough

```swift
class APIClient {
    static let shared = APIClient()

    func request<T: Decodable>(
        endpoint: Endpoint,
        method: HTTPMethod,
        body: Encodable? = nil,
        headers: [String: String]? = nil
    ) async throws -> T {
        // 1. Build URL
        guard let url = endpoint.url else {
            throw NetworkError.invalidURL
        }

        // 2. Create request
        var request = URLRequest(url: url)
        request.httpMethod = method.rawValue
        request.timeoutInterval = 30

        // 3. Set headers
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("application/json", forHTTPHeaderField: "Accept")

        // Add custom headers
        headers?.forEach { key, value in
            request.setValue(value, forHTTPHeaderField: key)
        }

        // 4. Inject JWT
        if let token = try? KeychainManager.shared.retrieve(for: .authToken) {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }

        // 5. Encode body
        if let body = body {
            let encoder = JSONEncoder()
            encoder.dateEncodingStrategy = .iso8601
            request.httpBody = try encoder.encode(body)
        }

        // 6. Log request (DEBUG only)
        #if DEBUG
        print("📤 \(method.rawValue) \(url)")
        if let body = body {
            print("📦 Body: \(body)")
        }
        #endif

        // 7. Execute request
        let (data, response) = try await URLSession.shared.data(for: request)

        // 8. Validate response
        guard let httpResponse = response as? HTTPURLResponse else {
            throw NetworkError.invalidResponse
        }

        #if DEBUG
        print("📥 Status: \(httpResponse.statusCode)")
        #endif

        // 9. Handle errors
        switch httpResponse.statusCode {
        case 200...299:
            break  // Success
        case 401:
            // Auto logout on unauthorized
            await AuthService.shared.logout()
            throw NetworkError.unauthorized
        case 403:
            throw NetworkError.forbidden
        case 404:
            throw NetworkError.notFound
        case 500...599:
            throw NetworkError.serverError(statusCode: httpResponse.statusCode)
        default:
            throw NetworkError.unknown(NSError(domain: "", code: httpResponse.statusCode))
        }

        // 10. Decode response
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601

        do {
            let decoded = try decoder.decode(T.self, from: data)

            #if DEBUG
            print("✅ Decoded: \(T.self)")
            #endif

            return decoded
        } catch {
            #if DEBUG
            print("❌ Decoding error: \(error)")
            if let json = String(data: data, encoding: .utf8) {
                print("📄 Raw JSON: \(json)")
            }
            #endif
            throw NetworkError.decodingError(error)
        }
    }
}
```

---

## Endpoint Definitions

### Location
`Core/Networking/Endpoint.swift` (68 lines)

---

### Endpoint Enum

```swift
enum Endpoint {
    // Auth
    case login
    case refresh
    case logout

    // Dashboard
    case dashboardStats

    // Lotes
    case lotes
    case lote(id: String)
    case createLote
    case updateLote(id: String)
    case deleteLote(id: String)

    // Productores
    case productores
    case productor(id: String)
    case createProductor
    case updateProductor(id: String)
    case deleteProductor(id: String)

    // Bloques
    case bloques
    case bloque(id: String)

    var url: URL? {
        let baseURL = AppConfiguration.baseURL
        var path: String

        switch self {
        // Auth
        case .login:
            path = "/auth/login"
        case .refresh:
            path = "/auth/refresh"
        case .logout:
            path = "/auth/logout"

        // Dashboard
        case .dashboardStats:
            path = "/dashboard/stats"

        // Lotes
        case .lotes, .createLote:
            path = "/lotes"
        case .lote(let id), .updateLote(let id), .deleteLote(let id):
            path = "/lotes/\(id)"

        // Productores
        case .productores, .createProductor:
            path = "/productores"
        case .productor(let id), .updateProductor(let id), .deleteProductor(let id):
            path = "/productores/\(id)"

        // Bloques
        case .bloques:
            path = "/bloques"
        case .bloque(let id):
            path = "/bloques/\(id)"
        }

        return URL(string: baseURL + path)
    }
}
```

---

### HTTP Methods

```swift
enum HTTPMethod: String {
    case GET = "GET"
    case POST = "POST"
    case PUT = "PUT"
    case PATCH = "PATCH"
    case DELETE = "DELETE"
}
```

---

## Error Handling

### NetworkError Enum

```swift
enum NetworkError: Error {
    case invalidURL
    case invalidResponse
    case unauthorized           // 401
    case forbidden             // 403
    case notFound              // 404
    case serverError(statusCode: Int)  // 500+
    case decodingError(Error)
    case encodingError(Error)
    case noInternetConnection
    case timeout
    case unknown(Error)
}
```

---

### Localized Error Messages

```swift
extension NetworkError: LocalizedError {
    var errorDescription: String? {
        switch self {
        case .invalidURL:
            return "URL inválida"
        case .invalidResponse:
            return "Respuesta inválida del servidor"
        case .unauthorized:
            return "Tu sesión ha expirado. Por favor inicia sesión de nuevo"
        case .forbidden:
            return "No tienes permiso para realizar esta acción"
        case .notFound:
            return "Recurso no encontrado"
        case .serverError(let statusCode):
            return "Error del servidor (código \(statusCode))"
        case .decodingError:
            return "Error al procesar la respuesta"
        case .encodingError:
            return "Error al preparar la solicitud"
        case .noInternetConnection:
            return "Sin conexión a internet"
        case .timeout:
            return "La solicitud tardó demasiado"
        case .unknown:
            return "Error desconocido"
        }
    }
}
```

---

### Error Handling in ViewModels

```swift
@MainActor
class CreateLoteViewModel: ObservableObject {
    @Published var showError = false
    @Published var errorMessage: String?

    func createLote() async -> Bool {
        do {
            let request = CreateLoteRequest(...)
            let lote = try await loteService.createLote(request)
            return true
        } catch let error as NetworkError {
            // Use NetworkError's localized description
            errorMessage = error.errorDescription
            showError = true
            return false
        } catch {
            // Fallback for unknown errors
            errorMessage = MicroCopy.errorGeneric
            showError = true
            return false
        }
    }
}
```

---

## Request/Response Examples

### Authentication

#### POST /auth/login

**Request:**
```json
{
  "email": "usuario@example.com",
  "password": "password123"
}
```

**Response (200 OK):**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "refresh_token_here",
  "user": {
    "id": "user_123",
    "nombre": "Juan Pérez",
    "email": "usuario@example.com",
    "rol": "admin"
  }
}
```

**Swift:**
```swift
let request = LoginRequest(
    email: "usuario@example.com",
    password: "password123"
)

let response: LoginResponse = try await apiClient.request(
    endpoint: .login,
    method: .POST,
    body: request
)

print(response.user.nombre)  // "Juan Pérez"
```

---

### Dashboard

#### GET /dashboard/stats

**Request:**
```
Headers:
  Authorization: Bearer {token}
  Accept: application/json
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

print(stats.totalProductores)  // 248
```

---

### Lotes

#### GET /lotes (List)

**Request:**
```
Headers:
  Authorization: Bearer {token}
```

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
    },
    {
      "id": "lote_2",
      "nombre": "Lote Sur",
      "ubicacion": "Zona Sur",
      "tipoCultivo": "Fresa",
      "areaHectareas": 2.3,
      "estado": "activo",
      "fechaCreacion": "2024-11-15T09:30:00Z"
    }
  ],
  "total": 2
}
```

**Swift:**
```swift
struct LotesResponse: Codable {
    let lotes: [Lote]
    let total: Int
}

let response: LotesResponse = try await apiClient.request(
    endpoint: .lotes,
    method: .GET
)

response.lotes.forEach { lote in
    print("\(lote.nombre) - \(lote.tipoCultivo)")
}
```

---

#### POST /lotes (Create)

**Request:**
```json
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
  "id": "lote_3",
  "nombre": "Lote Nuevo",
  "ubicacion": "Zona Norte",
  "tipoCultivo": "Café",
  "areaHectareas": 10.0,
  "estado": "activo",
  "notas": "Lote experimental",
  "fechaCreacion": "2024-11-28T14:00:00Z"
}
```

**Swift:**
```swift
let request = CreateLoteRequest(
    nombre: "Lote Nuevo",
    ubicacion: "Zona Norte",
    tipoCultivo: "Café",
    areaHectareas: 10.0,
    notas: "Lote experimental"
)

let lote: Lote = try await apiClient.request(
    endpoint: .createLote,
    method: .POST,
    body: request
)

print("Lote creado: \(lote.id)")
```

---

#### PUT /lotes/:id (Update)

**Request:**
```json
{
  "nombre": "Lote Norte Actualizado",
  "ubicacion": "Valle Central",
  "tipoCultivo": "Aguacate",
  "areaHectareas": 6.0,
  "notas": "Área expandida"
}
```

**Response (200 OK):**
```json
{
  "id": "lote_1",
  "nombre": "Lote Norte Actualizado",
  "ubicacion": "Valle Central",
  "tipoCultivo": "Aguacate",
  "areaHectareas": 6.0,
  "estado": "activo",
  "notas": "Área expandida",
  "fechaCreacion": "2024-11-01T12:00:00Z",
  "fechaActualizacion": "2024-11-28T15:00:00Z"
}
```

**Swift:**
```swift
let request = CreateLoteRequest(...)

let lote: Lote = try await apiClient.request(
    endpoint: .updateLote(id: "lote_1"),
    method: .PUT,
    body: request
)
```

---

#### DELETE /lotes/:id

**Request:**
```
DELETE /lotes/lote_1
Headers:
  Authorization: Bearer {token}
```

**Response (204 No Content)**

**Swift:**
```swift
try await apiClient.requestWithoutResponse(
    endpoint: .deleteLote(id: "lote_1"),
    method: .DELETE
)
```

---

## Service Layer Patterns

### Service Structure

```swift
@MainActor
class LoteService: ObservableObject {
    // MARK: - Singleton
    static let shared = LoteService()

    // MARK: - Dependencies
    private let apiClient = APIClient.shared

    // MARK: - Published State (if needed)
    @Published var lotes: [Lote] = []

    private init() {}

    // MARK: - Public Methods

    /// Fetch all lotes
    func fetchLotes() async throws -> [Lote] {
        struct Response: Codable {
            let lotes: [Lote]
        }

        let response: Response = try await apiClient.request(
            endpoint: .lotes,
            method: .GET
        )

        lotes = response.lotes  // Update state
        return response.lotes
    }

    /// Create new lote
    func createLote(_ request: CreateLoteRequest) async throws -> Lote {
        let lote: Lote = try await apiClient.request(
            endpoint: .createLote,
            method: .POST,
            body: request
        )

        lotes.append(lote)  // Update state
        return lote
    }

    /// Fetch single lote
    func fetchLote(id: String) async throws -> Lote {
        return try await apiClient.request(
            endpoint: .lote(id: id),
            method: .GET
        )
    }

    /// Update lote
    func updateLote(id: String, request: CreateLoteRequest) async throws -> Lote {
        let lote: Lote = try await apiClient.request(
            endpoint: .updateLote(id: id),
            method: .PUT,
            body: request
        )

        // Update in array
        if let index = lotes.firstIndex(where: { $0.id == id }) {
            lotes[index] = lote
        }

        return lote
    }

    /// Delete lote
    func deleteLote(id: String) async throws {
        try await apiClient.requestWithoutResponse(
            endpoint: .deleteLote(id: id),
            method: .DELETE
        )

        // Remove from array
        lotes.removeAll { $0.id == id }
    }
}
```

---

### ViewModel Integration

```swift
@MainActor
class LotesListViewModel: ObservableObject {
    // MARK: - Published State
    @Published var lotes: [Lote] = []
    @Published var isLoading = false
    @Published var showError = false
    @Published var errorMessage: String?

    // MARK: - Dependencies
    private let loteService = LoteService.shared

    // MARK: - Actions
    func loadLotes() async {
        isLoading = true

        do {
            lotes = try await loteService.fetchLotes()
        } catch let error as NetworkError {
            errorMessage = error.errorDescription
            showError = true
        } catch {
            errorMessage = MicroCopy.errorGeneric
            showError = true
        }

        isLoading = false
    }

    func deleteLote(id: String) async -> Bool {
        do {
            try await loteService.deleteLote(id: id)
            lotes.removeAll { $0.id == id }
            return true
        } catch {
            errorMessage = MicroCopy.errorGeneric
            showError = true
            return false
        }
    }
}
```

---

## Testing API Integration

### Unit Tests (Mock Services)

```swift
@MainActor
class LotesListViewModelTests: XCTestCase {
    var sut: LotesListViewModel!
    var mockService: MockLoteService!

    override func setUp() {
        mockService = MockLoteService()
        sut = LotesListViewModel(service: mockService)
    }

    func testLoadLotesSuccess() async {
        // Given
        mockService.lotesToReturn = [
            Lote(id: "1", nombre: "Test Lote", ...)
        ]

        // When
        await sut.loadLotes()

        // Then
        XCTAssertEqual(sut.lotes.count, 1)
        XCTAssertFalse(sut.showError)
        XCTAssertTrue(mockService.fetchLotesCalled)
    }

    func testLoadLotesError() async {
        // Given
        mockService.shouldThrowError = true

        // When
        await sut.loadLotes()

        // Then
        XCTAssertTrue(sut.showError)
        XCTAssertNotNil(sut.errorMessage)
    }
}
```

---

## Troubleshooting

### Common Issues

#### 1. 401 Unauthorized

**Symptom:** All API calls return 401, user auto-logged out

**Causes:**
- Token expired
- Invalid token
- Token not in Keychain

**Solutions:**
```swift
// Check token exists
if let token = try? KeychainManager.shared.retrieve(for: .authToken) {
    print("Token: \(token)")
} else {
    print("No token found")
}

// Implement refresh token logic
func refreshToken() async -> Bool {
    // ...
}
```

---

#### 2. Decoding Errors

**Symptom:** Error: "keyNotFound" or "typeMismatch"

**Causes:**
- Backend response changed
- Missing/extra fields in model
- Date format mismatch

**Solutions:**
```swift
// Enable DEBUG logging
#if DEBUG
print("📄 Raw JSON: \(String(data: data, encoding: .utf8))")
#endif

// Check date strategy
decoder.dateDecodingStrategy = .iso8601  // Backend uses ISO8601

// Make fields optional if backend may omit
struct User: Codable {
    let id: String
    let nombre: String
    let email: String?  // ← Optional if backend may omit
}
```

---

#### 3. Timeout Errors

**Symptom:** Requests fail after 30 seconds

**Causes:**
- Slow network
- Backend processing delay
- Large response

**Solutions:**
```swift
// Increase timeout for specific requests
request.timeoutInterval = 60  // 60 seconds

// Add timeout handling
do {
    let result = try await apiClient.request(...)
} catch let error as URLError where error.code == .timedOut {
    // Handle timeout specifically
    errorMessage = "La solicitud tardó demasiado"
}
```

---

#### 4. No Internet Connection

**Symptom:** All requests fail immediately

**Solutions:**
```swift
import Network

class NetworkMonitor: ObservableObject {
    @Published var isConnected = true

    private let monitor = NWPathMonitor()
    private let queue = DispatchQueue(label: "NetworkMonitor")

    init() {
        monitor.pathUpdateHandler = { [weak self] path in
            DispatchQueue.main.async {
                self?.isConnected = path.status == .satisfied
            }
        }
        monitor.start(queue: queue)
    }
}

// In View
@StateObject var networkMonitor = NetworkMonitor()

if !networkMonitor.isConnected {
    Text("Sin conexión a internet")
}
```

---

**Document Version:** 1.0.0
**Author:** Alejandro Navarro Ayala - CEO & Senior Developer
**Last Updated:** November 28, 2024
**Status:** Production Ready
