import Foundation

// MARK: - Network Error
/// Errores personalizados para operaciones de red
enum NetworkError: LocalizedError {
    case invalidURL
    case invalidResponse
    case unauthorized
    case forbidden
    case notFound
    case serverError(statusCode: Int)
    case decodingError(Error)
    case encodingError(Error)
    case noInternetConnection
    case timeout
    case unknown(Error)

    // MARK: - Error Description
    var errorDescription: String? {
        switch self {
        case .invalidURL:
            return "La URL es inválida"
        case .invalidResponse:
            return "La respuesta del servidor no es válida"
        case .unauthorized:
            return "No estás autorizado. Por favor inicia sesión nuevamente"
        case .forbidden:
            return "No tienes permisos para realizar esta acción"
        case .notFound:
            return "El recurso solicitado no fue encontrado"
        case .serverError(let statusCode):
            return "Error del servidor (código: \(statusCode))"
        case .decodingError:
            return "Error al procesar los datos del servidor"
        case .encodingError:
            return "Error al preparar los datos para enviar"
        case .noInternetConnection:
            return "No hay conexión a internet. Verifica tu conexión"
        case .timeout:
            return "La solicitud tardó demasiado tiempo. Intenta nuevamente"
        case .unknown(let error):
            return "Error desconocido: \(error.localizedDescription)"
        }
    }

    // MARK: - Inicialización desde HTTP Status Code
    static func from(statusCode: Int) -> NetworkError {
        switch statusCode {
        case 401:
            return .unauthorized
        case 403:
            return .forbidden
        case 404:
            return .notFound
        case 500...599:
            return .serverError(statusCode: statusCode)
        default:
            return .invalidResponse
        }
    }
}
