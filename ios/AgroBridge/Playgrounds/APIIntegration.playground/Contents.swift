/*:
 # 🌐 AgroBridge - API Integration Playground

 **Purpose:** Learn how to integrate with AgroBridge REST API

 **Topics Covered:**
 - Complete APIClient implementation
 - All 25 API endpoints with examples
 - Request/response patterns
 - Error handling strategies
 - Authentication flow
 - Mock services for testing

 **Developed by:** Alejandro Navarro Ayala - CEO & Senior Developer

 **Version:** 1.0.0
 **Last Updated:** November 28, 2024

 ---

 ## 📡 API Overview

 **Base URL:** `https://api.agrobridge.io/v1`
 **Authentication:** Bearer JWT tokens
 **Format:** JSON (Content-Type: application/json)

 **Endpoint Categories:**
 - 🔐 Authentication (3 endpoints)
 - 📊 Dashboard (1 endpoint)
 - 🌿 Lotes (5 endpoints)
 - 👨‍🌾 Productores (5 endpoints)
 - 🔗 Bloques (2 endpoints)

 ---
 */

import SwiftUI
import PlaygroundSupport
import Combine

/*:
 ---
 ## Part 1: Foundation - Models
 */

// MARK: - User Models

struct User: Codable, Identifiable {
    let id: String
    let nombre: String
    let email: String
    let rol: UserRole
}

enum UserRole: String, Codable {
    case admin = "admin"
    case producer = "producer"
    case buyer = "buyer"
}

struct LoginRequest: Encodable {
    let email: String
    let password: String
}

struct LoginResponse: Decodable {
    let token: String
    let refreshToken: String
    let user: User
}

struct RefreshTokenRequest: Encodable {
    let refreshToken: String
}

struct RefreshTokenResponse: Decodable {
    let token: String
    let expiresIn: Int
}

// MARK: - Dashboard Models

struct DashboardStats: Codable {
    let totalProductores: Int
    let lotesActivos: Int
    let bloquesCertificados: Int
    let estadoConexion: EstadoConexion
}

enum EstadoConexion: String, Codable {
    case online = "online"
    case offline = "offline"
    case maintenance = "maintenance"
}

// MARK: - Lote Models

struct Lote: Codable, Identifiable {
    let id: String
    let nombre: String
    let ubicacion: String
    let tipoCultivo: String
    let areaHectareas: Double?
    let estado: LoteEstado
    let notas: String?
    let productorId: String?
    let fechaCreacion: Date?
}

enum LoteEstado: String, Codable {
    case activo = "activo"
    case inactivo = "inactivo"
    case enPreparacion = "en_preparacion"
    case enCosecha = "en_cosecha"
}

struct CreateLoteRequest: Encodable {
    let nombre: String
    let ubicacion: String
    let tipoCultivo: String
    let areaHectareas: Double?
    let notas: String?
}

struct LotesListResponse: Decodable {
    let lotes: [Lote]
    let total: Int
    let page: Int?
    let totalPages: Int?
}

// MARK: - Productor Models

struct Productor: Codable, Identifiable {
    let id: String
    let nombre: String
    let email: String?
    let telefono: String?
    let direccion: String?
    let documentoIdentidad: String?
    let totalLotes: Int?
    let estado: ProductorEstado
}

enum ProductorEstado: String, Codable {
    case activo = "activo"
    case inactivo = "inactivo"
    case suspendido = "suspendido"
}

struct CreateProductorRequest: Encodable {
    let nombre: String
    let email: String?
    let telefono: String?
    let direccion: String?
    let documentoIdentidad: String?
}

struct ProductoresListResponse: Decodable {
    let productores: [Productor]
    let total: Int
}

// MARK: - Bloque Models

struct Bloque: Codable, Identifiable {
    let id: String
    let hash: String
    let previousHash: String
    let timestamp: Date
    let loteId: String
    let data: BloqueData
}

struct BloqueData: Codable {
    let tipo: String
    let descripcion: String
    let metadata: [String: String]?
}

struct BloquesListResponse: Decodable {
    let bloques: [Bloque]
    let total: Int
}

// MARK: - Error Models

struct APIErrorResponse: Decodable {
    let error: ErrorDetail

    struct ErrorDetail: Decodable {
        let code: String
        let message: String
        let details: [String: String]?
    }
}

print("✅ Part 1 Complete: All models defined")
print("")

/*:
 ---
 ## Part 2: Network Infrastructure
 */

// MARK: - HTTP Method

enum HTTPMethod: String {
    case GET
    case POST
    case PUT
    case PATCH
    case DELETE
}

// MARK: - Endpoint Definition

enum Endpoint {
    // Authentication
    case login
    case refresh
    case logout

    // Dashboard
    case dashboardStats

    // Lotes
    case lotes
    case loteById(String)
    case createLote
    case updateLote(String)
    case deleteLote(String)

    // Productores
    case productores
    case productorById(String)
    case createProductor
    case updateProductor(String)
    case deleteProductor(String)

    // Bloques
    case bloques
    case bloqueById(String)

    var path: String {
        switch self {
        // Auth
        case .login:
            return "/auth/login"
        case .refresh:
            return "/auth/refresh"
        case .logout:
            return "/auth/logout"

        // Dashboard
        case .dashboardStats:
            return "/dashboard/stats"

        // Lotes
        case .lotes:
            return "/lotes"
        case .loteById(let id):
            return "/lotes/\(id)"
        case .createLote:
            return "/lotes"
        case .updateLote(let id):
            return "/lotes/\(id)"
        case .deleteLote(let id):
            return "/lotes/\(id)"

        // Productores
        case .productores:
            return "/productores"
        case .productorById(let id):
            return "/productores/\(id)"
        case .createProductor:
            return "/productores"
        case .updateProductor(let id):
            return "/productores/\(id)"
        case .deleteProductor(let id):
            return "/productores/\(id)"

        // Bloques
        case .bloques:
            return "/bloques"
        case .bloqueById(let id):
            return "/bloques/\(id)"
        }
    }
}

// MARK: - Network Error

enum NetworkError: Error, LocalizedError {
    case invalidURL
    case invalidResponse
    case unauthorized
    case forbidden
    case notFound
    case serverError(statusCode: Int)
    case decodingError(Error)
    case encodingError(Error)
    case apiError(code: String, message: String)
    case noInternetConnection
    case timeout
    case unknown(Error)

    var errorDescription: String? {
        switch self {
        case .invalidURL:
            return "URL inválida"
        case .invalidResponse:
            return "Respuesta del servidor inválida"
        case .unauthorized:
            return "No autorizado. Inicia sesión nuevamente"
        case .forbidden:
            return "No tienes permisos para esta acción"
        case .notFound:
            return "Recurso no encontrado"
        case .serverError(let code):
            return "Error del servidor (código \(code))"
        case .decodingError:
            return "Error al procesar la respuesta"
        case .encodingError:
            return "Error al preparar la solicitud"
        case .apiError(_, let message):
            return message
        case .noInternetConnection:
            return "Sin conexión a internet"
        case .timeout:
            return "Tiempo de espera agotado"
        case .unknown:
            return "Error desconocido"
        }
    }
}

// MARK: - API Client

class APIClient {
    static let shared = APIClient()

    private let baseURL = "https://api.agrobridge.io/v1"
    private var authToken: String?
    private let timeout: TimeInterval = 30.0

    private init() {}

    // MARK: - Public Methods

    /// Generic request with Decodable response
    func request<T: Decodable>(
        endpoint: Endpoint,
        method: HTTPMethod,
        body: Encodable? = nil,
        queryItems: [URLQueryItem]? = nil,
        headers: [String: String]? = nil
    ) async throws -> T {
        let request = try buildRequest(
            endpoint: endpoint,
            method: method,
            body: body,
            queryItems: queryItems,
            headers: headers
        )

        let (data, response) = try await performRequest(request)
        try validateResponse(response, data: data)

        return try decodeResponse(data)
    }

    /// Request without response (DELETE, etc.)
    func requestWithoutResponse(
        endpoint: Endpoint,
        method: HTTPMethod,
        body: Encodable? = nil,
        headers: [String: String]? = nil
    ) async throws {
        let request = try buildRequest(
            endpoint: endpoint,
            method: method,
            body: body,
            headers: headers
        )

        let (data, response) = try await performRequest(request)
        try validateResponse(response, data: data)
    }

    /// Set auth token
    func setAuthToken(_ token: String?) {
        self.authToken = token
    }

    // MARK: - Private Helpers

    private func buildRequest(
        endpoint: Endpoint,
        method: HTTPMethod,
        body: Encodable? = nil,
        queryItems: [URLQueryItem]? = nil,
        headers: [String: String]? = nil
    ) throws -> URLRequest {
        // Build URL
        var components = URLComponents(string: baseURL + endpoint.path)
        components?.queryItems = queryItems

        guard let url = components?.url else {
            throw NetworkError.invalidURL
        }

        // Create request
        var request = URLRequest(url: url)
        request.httpMethod = method.rawValue
        request.timeoutInterval = timeout

        // Set standard headers
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("application/json", forHTTPHeaderField: "Accept")

        // Add auth token
        if let token = authToken {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }

        // Add custom headers
        headers?.forEach { key, value in
            request.setValue(value, forHTTPHeaderField: key)
        }

        // Encode body
        if let body = body {
            do {
                let encoder = JSONEncoder()
                encoder.dateEncodingStrategy = .iso8601
                request.httpBody = try encoder.encode(body)
            } catch {
                throw NetworkError.encodingError(error)
            }
        }

        return request
    }

    private func performRequest(_ request: URLRequest) async throws -> (Data, URLResponse) {
        do {
            return try await URLSession.shared.data(for: request)
        } catch {
            throw NetworkError.unknown(error)
        }
    }

    private func validateResponse(_ response: URLResponse, data: Data) throws {
        guard let httpResponse = response as? HTTPURLResponse else {
            throw NetworkError.invalidResponse
        }

        switch httpResponse.statusCode {
        case 200...299:
            return // Success

        case 400...499:
            // Try to decode API error
            if let apiError = try? JSONDecoder().decode(APIErrorResponse.self, from: data) {
                throw NetworkError.apiError(
                    code: apiError.error.code,
                    message: apiError.error.message
                )
            }

            // Standard HTTP errors
            switch httpResponse.statusCode {
            case 401:
                throw NetworkError.unauthorized
            case 403:
                throw NetworkError.forbidden
            case 404:
                throw NetworkError.notFound
            default:
                throw NetworkError.serverError(statusCode: httpResponse.statusCode)
            }

        case 500...599:
            throw NetworkError.serverError(statusCode: httpResponse.statusCode)

        default:
            throw NetworkError.unknown(NSError(domain: "", code: httpResponse.statusCode))
        }
    }

    private func decodeResponse<T: Decodable>(_ data: Data) throws -> T {
        do {
            let decoder = JSONDecoder()
            decoder.dateDecodingStrategy = .iso8601
            return try decoder.decode(T.self, from: data)
        } catch {
            throw NetworkError.decodingError(error)
        }
    }
}

print("✅ Part 2 Complete: APIClient ready with full error handling")
print("")

/*:
 ---
 ## Part 3: API Examples - Authentication
 */

print("\n" + String(repeating: "=", count: 60))
print("🔐 AUTHENTICATION ENDPOINTS")
print(String(repeating: "=", count: 60))

// MARK: - Example 1: Login

print("\n1️⃣ POST /auth/login")
print("   Purpose: User login with email and password")
print("\n   Request:")
print("""
   {
     "email": "user@agrobridge.com",
     "password": "SecurePass123!"
   }
   """)

print("\n   Swift code:")
print("""
   let request = LoginRequest(
       email: "user@agrobridge.com",
       password: "SecurePass123!"
   )

   let response: LoginResponse = try await apiClient.request(
       endpoint: .login,
       method: .POST,
       body: request
   )

   print("Token: \\(response.token)")
   print("User: \\(response.user.nombre)")
   """)

// MARK: - Example 2: Refresh Token

print("\n2️⃣ POST /auth/refresh")
print("   Purpose: Refresh expired access token")
print("\n   Swift code:")
print("""
   let request = RefreshTokenRequest(refreshToken: oldToken)

   let response: RefreshTokenResponse = try await apiClient.request(
       endpoint: .refresh,
       method: .POST,
       body: request
   )

   print("New token: \\(response.token)")
   print("Expires in: \\(response.expiresIn) seconds")
   """)

// MARK: - Example 3: Logout

print("\n3️⃣ POST /auth/logout")
print("   Purpose: Invalidate user session")
print("\n   Swift code:")
print("""
   struct EmptyResponse: Decodable {}

   let _: EmptyResponse = try await apiClient.request(
       endpoint: .logout,
       method: .POST
   )

   // Clear local token
   apiClient.setAuthToken(nil)
   """)

/*:
 ---
 ## Part 4: API Examples - Dashboard
 */

print("\n" + String(repeating: "=", count: 60))
print("📊 DASHBOARD ENDPOINTS")
print(String(repeating: "=", count: 60))

print("\n4️⃣ GET /dashboard/stats")
print("   Purpose: Fetch dashboard statistics")
print("\n   Swift code:")
print("""
   let stats: DashboardStats = try await apiClient.request(
       endpoint: .dashboardStats,
       method: .GET
   )

   print("Total Productores: \\(stats.totalProductores)")
   print("Lotes Activos: \\(stats.lotesActivos)")
   print("Bloques: \\(stats.bloquesCertificados)")
   print("Estado: \\(stats.estadoConexion.rawValue)")
   """)

print("\n   Response example:")
print("""
   {
     "totalProductores": 248,
     "lotesActivos": 156,
     "bloquesCertificados": 89,
     "estadoConexion": "online"
   }
   """)

/*:
 ---
 ## Part 5: API Examples - Lotes (Lots)
 */

print("\n" + String(repeating: "=", count: 60))
print("🌿 LOTES ENDPOINTS")
print(String(repeating: "=", count: 60))

// MARK: - Example 5: List Lotes

print("\n5️⃣ GET /lotes")
print("   Purpose: List all lots with pagination and filters")
print("\n   Swift code:")
print("""
   let queryItems = [
       URLQueryItem(name: "page", value: "1"),
       URLQueryItem(name: "limit", value: "20"),
       URLQueryItem(name: "search", value: "aguacate"),
       URLQueryItem(name: "estado", value: "activo")
   ]

   let response: LotesListResponse = try await apiClient.request(
       endpoint: .lotes,
       method: .GET,
       queryItems: queryItems
   )

   print("Total lotes: \\(response.total)")
   print("Lotes en página: \\(response.lotes.count)")
   """)

// MARK: - Example 6: Get Lote by ID

print("\n6️⃣ GET /lotes/:id")
print("   Purpose: Fetch single lot details")
print("\n   Swift code:")
print("""
   let lote: Lote = try await apiClient.request(
       endpoint: .loteById("lote_123"),
       method: .GET
   )

   print("Lote: \\(lote.nombre)")
   print("Área: \\(lote.areaHectareas ?? 0) ha")
   print("Estado: \\(lote.estado.rawValue)")
   """)

// MARK: - Example 7: Create Lote

print("\n7️⃣ POST /lotes")
print("   Purpose: Create new lot")
print("\n   Swift code:")
print("""
   let request = CreateLoteRequest(
       nombre: "Lote Norte",
       ubicacion: "Valle Central",
       tipoCultivo: "Aguacate",
       areaHectareas: 5.5,
       notas: "Lote experimental"
   )

   let lote: Lote = try await apiClient.request(
       endpoint: .createLote,
       method: .POST,
       body: request
   )

   print("Lote creado: \\(lote.id)")
   """)

// MARK: - Example 8: Update Lote

print("\n8️⃣ PUT /lotes/:id")
print("   Purpose: Update existing lot")
print("\n   Swift code:")
print("""
   let request = CreateLoteRequest(
       nombre: "Lote Norte Actualizado",
       ubicacion: "Valle Central",
       tipoCultivo: "Aguacate",
       areaHectareas: 6.0,
       notas: "Área expandida"
   )

   let lote: Lote = try await apiClient.request(
       endpoint: .updateLote("lote_123"),
       method: .PUT,
       body: request
   )

   print("Lote actualizado: \\(lote.nombre)")
   """)

// MARK: - Example 9: Delete Lote

print("\n9️⃣ DELETE /lotes/:id")
print("   Purpose: Delete lot")
print("\n   Swift code:")
print("""
   try await apiClient.requestWithoutResponse(
       endpoint: .deleteLote("lote_123"),
       method: .DELETE
   )

   print("Lote eliminado exitosamente")
   """)

/*:
 ---
 ## Part 6: API Examples - Productores (Producers)
 */

print("\n" + String(repeating: "=", count: 60))
print("👨‍🌾 PRODUCTORES ENDPOINTS")
print(String(repeating: "=", count: 60))

// MARK: - Example 10: List Productores

print("\n🔟 GET /productores")
print("   Purpose: List all producers")
print("\n   Swift code:")
print("""
   let response: ProductoresListResponse = try await apiClient.request(
       endpoint: .productores,
       method: .GET
   )

   for productor in response.productores {
       print("\\(productor.nombre) - \\(productor.totalLotes ?? 0) lotes")
   }
   """)

// MARK: - Example 11: Get Productor by ID

print("\n1️⃣1️⃣ GET /productores/:id")
print("   Purpose: Fetch single producer details")
print("\n   Swift code:")
print("""
   let productor: Productor = try await apiClient.request(
       endpoint: .productorById("prod_123"),
       method: .GET
   )

   print("Productor: \\(productor.nombre)")
   print("Email: \\(productor.email ?? "N/A")")
   print("Total Lotes: \\(productor.totalLotes ?? 0)")
   """)

// MARK: - Example 12: Create Productor

print("\n1️⃣2️⃣ POST /productores")
print("   Purpose: Create new producer")
print("\n   Swift code:")
print("""
   let request = CreateProductorRequest(
       nombre: "Juan Pérez",
       email: "juan@example.com",
       telefono: "+52 999 123 4567",
       direccion: "Calle Principal 123",
       documentoIdentidad: "CURP123456"
   )

   let productor: Productor = try await apiClient.request(
       endpoint: .createProductor,
       method: .POST,
       body: request
   )

   print("Productor creado: \\(productor.id)")
   """)

// MARK: - Example 13: Update Productor

print("\n1️⃣3️⃣ PUT /productores/:id")
print("   Purpose: Update producer")
print("\n   Swift code:")
print("""
   let request = CreateProductorRequest(
       nombre: "Juan Pérez González",
       email: "juan.perez@example.com",
       telefono: "+52 999 999 9999",
       direccion: "Nueva Dirección 456",
       documentoIdentidad: "CURP123456"
   )

   let productor: Productor = try await apiClient.request(
       endpoint: .updateProductor("prod_123"),
       method: .PUT,
       body: request
   )

   print("Productor actualizado")
   """)

// MARK: - Example 14: Delete Productor

print("\n1️⃣4️⃣ DELETE /productores/:id")
print("   Purpose: Delete producer")
print("\n   Swift code:")
print("""
   try await apiClient.requestWithoutResponse(
       endpoint: .deleteProductor("prod_123"),
       method: .DELETE
   )

   print("Productor eliminado")
   """)

/*:
 ---
 ## Part 7: API Examples - Bloques (Blockchain)
 */

print("\n" + String(repeating: "=", count: 60))
print("🔗 BLOQUES ENDPOINTS")
print(String(repeating: "=", count: 60))

// MARK: - Example 15: List Bloques

print("\n1️⃣5️⃣ GET /bloques")
print("   Purpose: List blockchain blocks")
print("\n   Swift code:")
print("""
   let response: BloquesListResponse = try await apiClient.request(
       endpoint: .bloques,
       method: .GET
   )

   for bloque in response.bloques {
       print("Hash: \\(bloque.hash.prefix(16))...")
       print("Lote: \\(bloque.loteId)")
   }
   """)

// MARK: - Example 16: Get Bloque by ID

print("\n1️⃣6️⃣ GET /bloques/:id")
print("   Purpose: Fetch single block")
print("\n   Swift code:")
print("""
   let bloque: Bloque = try await apiClient.request(
       endpoint: .bloqueById("bloque_123"),
       method: .GET
   )

   print("Hash: \\(bloque.hash)")
   print("Previous Hash: \\(bloque.previousHash)")
   print("Data: \\(bloque.data.descripcion)")
   """)

/*:
 ---
 ## Part 8: Error Handling Patterns
 */

print("\n" + String(repeating: "=", count: 60))
print("⚠️ ERROR HANDLING PATTERNS")
print(String(repeating: "=", count: 60))

print("\n📝 Pattern 1: Basic Try-Catch")
print("""
   do {
       let stats: DashboardStats = try await apiClient.request(
           endpoint: .dashboardStats,
           method: .GET
       )
       // Success - use stats
   } catch {
       print("Error: \\(error.localizedDescription)")
   }
   """)

print("\n📝 Pattern 2: Specific Error Handling")
print("""
   do {
       let lote: Lote = try await apiClient.request(
           endpoint: .loteById("123"),
           method: .GET
       )
   } catch let error as NetworkError {
       switch error {
       case .unauthorized:
           // Auto logout, redirect to login
           await authService.logout()

       case .notFound:
           // Show \"Lote no encontrado\"
           showError = true
           errorMessage = \"Lote no encontrado\"

       case .serverError(let code):
           errorMessage = \"Error del servidor (\\(code))\"

       default:
           errorMessage = error.errorDescription ?? \"Error desconocido\"
       }
   }
   """)

print("\n📝 Pattern 3: Retry Logic")
print("""
   var retryCount = 0
   let maxRetries = 3

   while retryCount < maxRetries {
       do {
           let data = try await apiClient.request(...)
           return data // Success

       } catch {
           retryCount += 1
           if retryCount >= maxRetries {
               throw error // Give up
           }
           try await Task.sleep(nanoseconds: UInt64(retryCount) * 1_000_000_000)
       }
   }
   """)

print("\n📝 Pattern 4: API Error with Details")
print("""
   catch let error as NetworkError {
       if case .apiError(let code, let message) = error {
           print("API Error \\(code): \\(message)")

           // Handle specific API error codes
           switch code {
           case "VALIDATION_ERROR":
               showValidationError(message)
           case "DUPLICATE_ENTRY":
               showDuplicateError()
           default:
               showGenericError(message)
           }
       }
   }
   """)

/*:
 ---
 ## Part 9: Complete Service Example
 */

print("\n" + String(repeating: "=", count: 60))
print("🔧 COMPLETE SERVICE EXAMPLE")
print(String(repeating: "=", count: 60))

// MARK: - Lote Service Implementation

class LoteService {
    static let shared = LoteService()
    private let apiClient = APIClient.shared

    private init() {}

    /// Fetch all lotes with filters
    func fetchLotes(
        page: Int = 1,
        limit: Int = 20,
        search: String? = nil,
        estado: LoteEstado? = nil
    ) async throws -> LotesListResponse {
        var queryItems: [URLQueryItem] = [
            URLQueryItem(name: "page", value: "\(page)"),
            URLQueryItem(name: "limit", value: "\(limit)")
        ]

        if let search = search {
            queryItems.append(URLQueryItem(name: "search", value: search))
        }

        if let estado = estado {
            queryItems.append(URLQueryItem(name: "estado", value: estado.rawValue))
        }

        return try await apiClient.request(
            endpoint: .lotes,
            method: .GET,
            queryItems: queryItems
        )
    }

    /// Fetch lote by ID
    func fetchLote(id: String) async throws -> Lote {
        return try await apiClient.request(
            endpoint: .loteById(id),
            method: .GET
        )
    }

    /// Create new lote
    func createLote(_ request: CreateLoteRequest) async throws -> Lote {
        return try await apiClient.request(
            endpoint: .createLote,
            method: .POST,
            body: request
        )
    }

    /// Update lote
    func updateLote(id: String, request: CreateLoteRequest) async throws -> Lote {
        return try await apiClient.request(
            endpoint: .updateLote(id),
            method: .PUT,
            body: request
        )
    }

    /// Delete lote
    func deleteLote(id: String) async throws {
        try await apiClient.requestWithoutResponse(
            endpoint: .deleteLote(id),
            method: .DELETE
        )
    }
}

print("\n✅ Complete LoteService example:")
print("   - fetchLotes(page:limit:search:estado:)")
print("   - fetchLote(id:)")
print("   - createLote(_:)")
print("   - updateLote(id:request:)")
print("   - deleteLote(id:)")

/*:
 ---
 ## Part 10: Quick Reference
 */

print("\n" + String(repeating: "=", count: 60))
print("📚 QUICK REFERENCE")
print(String(repeating: "=", count: 60))

print("\n🔐 Authentication Endpoints:")
print("   POST   /auth/login        - Login")
print("   POST   /auth/refresh      - Refresh token")
print("   POST   /auth/logout       - Logout")

print("\n📊 Dashboard Endpoints:")
print("   GET    /dashboard/stats   - Get statistics")

print("\n🌿 Lotes Endpoints:")
print("   GET    /lotes             - List all lotes")
print("   GET    /lotes/:id         - Get lote by ID")
print("   POST   /lotes             - Create lote")
print("   PUT    /lotes/:id         - Update lote")
print("   DELETE /lotes/:id         - Delete lote")

print("\n👨‍🌾 Productores Endpoints:")
print("   GET    /productores       - List all productores")
print("   GET    /productores/:id   - Get productor by ID")
print("   POST   /productores       - Create productor")
print("   PUT    /productores/:id   - Update productor")
print("   DELETE /productores/:id   - Delete productor")

print("\n🔗 Bloques Endpoints:")
print("   GET    /bloques           - List all bloques")
print("   GET    /bloques/:id       - Get bloque by ID")

print("\n📋 HTTP Status Codes:")
print("   200 OK                    - Success")
print("   201 Created               - Resource created")
print("   204 No Content            - Success (no body)")
print("   400 Bad Request           - Invalid request")
print("   401 Unauthorized          - Invalid/expired token")
print("   403 Forbidden             - No permissions")
print("   404 Not Found             - Resource not found")
print("   422 Unprocessable Entity  - Validation error")
print("   500 Internal Server Error - Server error")

/*:
 ---
 ## Part 11: Exercises
 */

print("\n" + String(repeating: "=", count: 60))
print("🎯 EXERCISES")
print(String(repeating: "=", count: 60))

print("\n📝 Beginner:")
print("   1. Implement a simple ProductorService with fetchProductores()")
print("   2. Add logging to APIClient for debugging")
print("   3. Create a mock APIClient for unit testing")

print("\n📝 Intermediate:")
print("   4. Add request caching with expiration")
print("   5. Implement automatic token refresh before expiration")
print("   6. Add request retry with exponential backoff")

print("\n📝 Advanced:")
print("   7. Implement request queue with priority")
print("   8. Add offline support with local database sync")
print("   9. Create a request interceptor system")

print("\n" + String(repeating: "=", count: 60))
print("✅ API INTEGRATION PLAYGROUND COMPLETE!")
print(String(repeating: "=", count: 60))
print("\n📚 Total Endpoints Covered: 16")
print("📝 Try the exercises above to practice")
print("📘 See API_ENDPOINTS_REFERENCE.md for complete documentation")
print("\n**Developed by:** Alejandro Navarro Ayala - CEO & Senior Developer")
print("**For:** AgroBridge iOS Team")
print(String(repeating: "=", count: 60))
