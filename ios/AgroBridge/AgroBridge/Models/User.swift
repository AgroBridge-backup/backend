import Foundation

// MARK: - User Model
/// Modelo que representa un usuario autenticado en AgroBridge
struct User: Codable, Identifiable {
    let id: String
    let email: String
    let nombre: String?
    let rol: UserRole
    let createdAt: Date?
    let updatedAt: Date?

    enum CodingKeys: String, CodingKey {
        case id
        case email
        case nombre
        case rol
        case createdAt = "created_at"
        case updatedAt = "updated_at"
    }
}

// MARK: - UserRole
enum UserRole: String, Codable {
    case admin = "admin"
    case productor = "productor"
    case comprador = "comprador"
    case operador = "operador"

    var displayName: String {
        switch self {
        case .admin: return "Administrador"
        case .productor: return "Productor"
        case .comprador: return "Comprador"
        case .operador: return "Operador"
        }
    }
}

// MARK: - LoginRequest
/// Request para endpoint POST /auth/login
struct LoginRequest: Codable {
    let email: String
    let password: String
}

// MARK: - LoginResponse
/// Response del endpoint POST /auth/login
struct LoginResponse: Codable {
    let token: String
    let refreshToken: String?
    let user: User
    let expiresIn: Int? // Segundos hasta expiración del token

    enum CodingKeys: String, CodingKey {
        case token
        case refreshToken = "refresh_token"
        case user
        case expiresIn = "expires_in"
    }
}

// MARK: - RefreshTokenRequest
/// Request para endpoint POST /auth/refresh
struct RefreshTokenRequest: Codable {
    let refreshToken: String

    enum CodingKeys: String, CodingKey {
        case refreshToken = "refresh_token"
    }
}

// MARK: - RefreshTokenResponse
/// Response del endpoint POST /auth/refresh
struct RefreshTokenResponse: Codable {
    let token: String
    let expiresIn: Int?

    enum CodingKeys: String, CodingKey {
        case token
        case expiresIn = "expires_in"
    }
}
