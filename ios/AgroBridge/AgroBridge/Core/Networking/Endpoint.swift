import Foundation

// MARK: - Endpoint
/// Define todos los endpoints del API de AgroBridge
enum Endpoint {
    // MARK: - Autenticación
    case login
    case refreshToken
    case logout

    // MARK: - Dashboard
    case dashboardStats

    // MARK: - Lotes
    case lotes
    case createLote
    case lote(id: String)
    case updateLote(id: String)
    case deleteLote(id: String)

    // MARK: - Productores
    case productores
    case createProductor
    case productor(id: String)
    case updateProductor(id: String)
    case deleteProductor(id: String)

    // MARK: - Bloques
    case bloques
    case createBloque
    case bloque(id: String)
    case updateBloque(id: String)
    case deleteBloque(id: String)
    case bloqueStats(id: String)

    // MARK: - Analytics
    case analytics(periodo: String?)

    // MARK: - Path
    /// Retorna el path del endpoint
    var path: String {
        switch self {
        // Auth
        case .login:
            return "/auth/login"
        case .refreshToken:
            return "/auth/refresh"
        case .logout:
            return "/auth/logout"

        // Dashboard
        case .dashboardStats:
            return "/dashboard/stats"

        // Lotes
        case .lotes:
            return "/lotes"
        case .createLote:
            return "/lotes"
        case .lote(let id):
            return "/lotes/\(id)"
        case .updateLote(let id):
            return "/lotes/\(id)"
        case .deleteLote(let id):
            return "/lotes/\(id)"

        // Productores
        case .productores:
            return "/productores"
        case .createProductor:
            return "/productores"
        case .productor(let id):
            return "/productores/\(id)"
        case .updateProductor(let id):
            return "/productores/\(id)"
        case .deleteProductor(let id):
            return "/productores/\(id)"

        // Bloques
        case .bloques:
            return "/bloques"
        case .createBloque:
            return "/bloques"
        case .bloque(let id):
            return "/bloques/\(id)"
        case .updateBloque(let id):
            return "/bloques/\(id)"
        case .deleteBloque(let id):
            return "/bloques/\(id)"
        case .bloqueStats(let id):
            return "/bloques/\(id)/stats"

        // Analytics
        case .analytics(let periodo):
            if let periodo = periodo {
                return "/analytics?periodo=\(periodo)"
            }
            return "/analytics"
        }
    }

    // MARK: - URL
    /// Retorna la URL completa del endpoint
    var url: URL? {
        return URL(string: AppConfiguration.baseURL + path)
    }
}
