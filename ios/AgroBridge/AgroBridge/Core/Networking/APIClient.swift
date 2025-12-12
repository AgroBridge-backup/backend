import Foundation

// MARK: - API Client
/// Cliente principal para todas las peticiones HTTP a la API de AgroBridge
@MainActor
class APIClient {
    // MARK: - Singleton
    static let shared = APIClient()

    // MARK: - Properties
    private let session: URLSession
    private let decoder: JSONDecoder
    private let encoder: JSONEncoder

    // Token de autenticación (se actualiza desde AuthService)
    var authToken: String?

    // MARK: - Inicialización
    private init() {
        // Configurar URLSession con timeout
        let configuration = URLSessionConfiguration.default
        configuration.timeoutIntervalForRequest = AppConfiguration.requestTimeout
        configuration.timeoutIntervalForResource = AppConfiguration.requestTimeout * 2
        self.session = URLSession(configuration: configuration)

        // Configurar JSON Decoder
        self.decoder = JSONDecoder()
        self.decoder.dateDecodingStrategy = .custom({ decoder in
            let container = try decoder.singleValueContainer()
            let dateString = try container.decode(String.self)

            // Intentar ISO8601 primero
            if let date = Date.iso8601Formatter.date(from: dateString) {
                return date
            }

            // Intentar formato alternativo
            let formatter = DateFormatter()
            formatter.dateFormat = "yyyy-MM-dd'T'HH:mm:ss.SSSZ"
            if let date = formatter.date(from: dateString) {
                return date
            }

            throw DecodingError.dataCorruptedError(in: container, debugDescription: "Cannot decode date string \(dateString)")
        })

        // Configurar JSON Encoder
        self.encoder = JSONEncoder()
        self.encoder.dateEncodingStrategy = .custom({ date, encoder in
            var container = encoder.singleValueContainer()
            let dateString = Date.iso8601Formatter.string(from: date)
            try container.encode(dateString)
        })
    }

    // MARK: - Request Generic
    /// Realiza una petición HTTP genérica
    /// - Parameters:
    ///   - endpoint: El endpoint a llamar
    ///   - method: Método HTTP (GET, POST, etc.)
    ///   - body: Cuerpo de la petición (Encodable)
    ///   - headers: Headers adicionales
    /// - Returns: Objeto decodificado del tipo especificado
    func request<T: Decodable>(
        endpoint: Endpoint,
        method: HTTPMethod,
        body: Encodable? = nil,
        headers: [String: String]? = nil
    ) async throws -> T {
        // Validar URL
        guard let url = endpoint.url else {
            throw NetworkError.invalidURL
        }

        // Crear request
        var request = URLRequest(url: url)
        request.httpMethod = method.rawValue

        // Agregar headers básicos
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("application/json", forHTTPHeaderField: "Accept")

        // Agregar token de autenticación si existe
        if let token = authToken {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }

        // Agregar headers adicionales
        headers?.forEach { key, value in
            request.setValue(value, forHTTPHeaderField: key)
        }

        // Agregar body si existe
        if let body = body {
            do {
                request.httpBody = try encoder.encode(body)
            } catch {
                throw NetworkError.encodingError(error)
            }
        }

        // Log de request (solo en desarrollo)
        if AppConfiguration.isLoggingEnabled {
            logRequest(request, body: body)
        }

        // Realizar petición
        do {
            let (data, response) = try await session.data(for: request)

            // Validar respuesta HTTP
            guard let httpResponse = response as? HTTPURLResponse else {
                throw NetworkError.invalidResponse
            }

            // Log de response (solo en desarrollo)
            if AppConfiguration.isLoggingEnabled {
                logResponse(httpResponse, data: data)
            }

            // Validar status code
            guard (200...299).contains(httpResponse.statusCode) else {
                throw NetworkError.from(statusCode: httpResponse.statusCode)
            }

            // Decodificar respuesta
            do {
                let decodedResponse = try decoder.decode(T.self, from: data)
                return decodedResponse
            } catch {
                print("❌ Error decodificando: \(error)")
                if let jsonString = String(data: data, encoding: .utf8) {
                    print("📄 JSON recibido: \(jsonString)")
                }
                throw NetworkError.decodingError(error)
            }

        } catch let error as NetworkError {
            throw error
        } catch let error as URLError {
            // Manejar errores de URLSession
            switch error.code {
            case .notConnectedToInternet, .networkConnectionLost:
                throw NetworkError.noInternetConnection
            case .timedOut:
                throw NetworkError.timeout
            default:
                throw NetworkError.unknown(error)
            }
        } catch {
            throw NetworkError.unknown(error)
        }
    }

    // MARK: - Request sin Response (para DELETE, etc.)
    /// Realiza una petición HTTP sin esperar respuesta decodificada
    func requestWithoutResponse(
        endpoint: Endpoint,
        method: HTTPMethod,
        body: Encodable? = nil,
        headers: [String: String]? = nil
    ) async throws {
        // Usar EmptyResponse como placeholder
        let _: EmptyResponse = try await request(
            endpoint: endpoint,
            method: method,
            body: body,
            headers: headers
        )
    }

    // MARK: - Logging Helpers
    private func logRequest(_ request: URLRequest, body: Encodable?) {
        print("🌐 [\(request.httpMethod ?? "?")] \(request.url?.absoluteString ?? "unknown")")

        if let headers = request.allHTTPHeaderFields, !headers.isEmpty {
            print("📋 Headers: \(headers)")
        }

        if let body = body {
            if let jsonData = try? encoder.encode(body),
               let jsonString = String(data: jsonData, encoding: .utf8) {
                print("📦 Body: \(jsonString)")
            }
        }
    }

    private func logResponse(_ response: HTTPURLResponse, data: Data) {
        let statusEmoji = (200...299).contains(response.statusCode) ? "✅" : "❌"
        print("\(statusEmoji) Response: \(response.statusCode)")

        if let jsonString = String(data: data, encoding: .utf8) {
            print("📥 Data: \(jsonString.prefix(500))") // Limitar a 500 caracteres
        }
    }
}

// MARK: - EmptyResponse
/// Respuesta vacía para endpoints que no retornan datos
struct EmptyResponse: Codable {}
