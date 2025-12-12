//
//  AuthDTOs.swift
//  AgroBridge
//
//  Created by Alejandro Navarro Ayala - CEO & Senior Developer
//  Copyright © 2025 AgroBridge International. All rights reserved.
//
//  ANDROID EQUIVALENT: data/dto/AuthDtos.kt
//

import Foundation

/**
 * AuthDTOs - Data Transfer Objects para autenticación
 *
 * ANDROID EQUIVALENT: AuthDtos.kt
 *
 * Flujo de autenticación:
 * 1. Cliente → LoginRequest → Backend
 * 2. Backend → TokenResponse (access_token + refresh_token)
 * 3. Client almacena tokens en TokenManager (cifrados en Keychain)
 * 4. Client envía access_token en header: Authorization: Bearer {token}
 * 5. Si access_token expira → Cliente envía RefreshTokenRequest
 * 6. Backend → TokenResponse (nuevo access_token)
 */

// MARK: - Login Request

/**
 * LoginRequest - Credenciales de inicio de sesión
 *
 * ANDROID EQUIVALENT: data class LoginRequest
 *
 * Endpoint: POST /v1/auth/login
 * Content-Type: application/json
 *
 * Body:
 * ```json
 * {
 *   "email": "farmer@agrobridge.com",
 *   "password": "secure_password_123"
 * }
 * ```
 */
struct LoginRequest: Codable {
    let email: String
    let password: String

    init(email: String, password: String) {
        precondition(!email.trimmingCharacters(in: .whitespaces).isEmpty, "Email no puede estar vacío")
        precondition(!password.trimmingCharacters(in: .whitespaces).isEmpty, "Contraseña no puede estar vacía")

        self.email = email
        self.password = password
    }
}

// MARK: - Token Response

/**
 * TokenResponse - Respuesta con tokens JWT
 *
 * ANDROID EQUIVALENT: data class TokenResponse
 *
 * Response:
 * ```json
 * {
 *   "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
 *   "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
 *   "token_type": "Bearer",
 *   "expires_in": 3600,
 *   "user": { ... }
 * }
 * ```
 */
struct TokenResponse: Codable {
    let accessToken: String
    let refreshToken: String
    let tokenType: String
    let expiresIn: Int64  // Seconds
    let user: UserDTO?

    enum CodingKeys: String, CodingKey {
        case accessToken = "access_token"
        case refreshToken = "refresh_token"
        case tokenType = "token_type"
        case expiresIn = "expires_in"
        case user
    }
}

// MARK: - Refresh Token Request

/**
 * RefreshTokenRequest - Solicitar nuevo access_token
 *
 * ANDROID EQUIVALENT: data class RefreshTokenRequest
 *
 * Endpoint: POST /v1/auth/refresh
 * Authorization: Bearer {access_token}
 * Content-Type: application/json
 *
 * Body:
 * ```json
 * {
 *   "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
 * }
 * ```
 */
struct RefreshTokenRequest: Codable {
    let refreshToken: String

    enum CodingKeys: String, CodingKey {
        case refreshToken = "refresh_token"
    }

    init(refreshToken: String) {
        precondition(!refreshToken.trimmingCharacters(in: .whitespaces).isEmpty, "Refresh token no puede estar vacío")
        self.refreshToken = refreshToken
    }
}

// MARK: - Logout Request

/**
 * LogoutRequest - Solicitar invalidación de sesión
 *
 * ANDROID EQUIVALENT: data class LogoutRequest
 *
 * Endpoint: POST /v1/auth/logout
 * Authorization: Bearer {access_token}
 * Content-Type: application/json
 *
 * Body:
 * ```json
 * {
 *   "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
 * }
 * ```
 */
struct LogoutRequest: Codable {
    let accessToken: String

    enum CodingKeys: String, CodingKey {
        case accessToken = "access_token"
    }
}

// MARK: - User DTO

/**
 * UserDTO - Información del usuario autenticado
 *
 * ANDROID EQUIVALENT: data class UserDto
 *
 * Incluido en TokenResponse después de login exitoso
 */
struct UserDTO: Codable {
    let id: String
    let email: String
    let firstName: String
    let lastName: String
    let role: String  // "farmer", "importer", "admin"
    let profilePictureUrl: String?
    let phone: String?
    let verifiedAt: Int64?
    let lastLoginAt: Int64?
    let createdAt: Int64

    enum CodingKeys: String, CodingKey {
        case id
        case email
        case firstName = "first_name"
        case lastName = "last_name"
        case role
        case profilePictureUrl = "profile_picture_url"
        case phone
        case verifiedAt = "verified_at"
        case lastLoginAt = "last_login_at"
        case createdAt = "created_at"
    }

    /// Nombre completo del usuario
    var fullName: String {
        return "\(firstName) \(lastName)".trimmingCharacters(in: .whitespaces)
    }

    /// Indica si el usuario es administrador
    var isAdmin: Bool {
        return role.lowercased() == "admin"
    }

    /// Indica si el usuario es agricultor/productor
    var isFarmer: Bool {
        return role.lowercased() == "farmer"
    }

    /// Indica si el usuario es importador
    var isImporter: Bool {
        return role.lowercased() == "importer"
    }
}

// MARK: - Error Response

/**
 * ErrorResponse - Respuesta de error estándar del API
 *
 * ANDROID EQUIVALENT: data class ErrorResponse
 *
 * Response:
 * ```json
 * {
 *   "error": "INVALID_CREDENTIALS",
 *   "message": "Email o contraseña incorrectos",
 *   "details": { ... },
 *   "timestamp": 1734567890
 * }
 * ```
 */
struct ErrorResponse: Codable {
    let error: String
    let message: String
    let details: [String: Any]?
    let timestamp: Int64

    enum CodingKeys: String, CodingKey {
        case error
        case message
        case details
        case timestamp
    }

    // Custom decoder para manejar [String: Any]
    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)

        error = try container.decode(String.self, forKey: .error)
        message = try container.decode(String.self, forKey: .message)
        timestamp = try container.decode(Int64.self, forKey: .timestamp)

        // Decodificar details como Dictionary<String, Any>
        if let detailsContainer = try? container.nestedContainer(keyedBy: JSONCodingKeys.self, forKey: .details) {
            details = try detailsContainer.decode([String: Any].self)
        } else {
            details = nil
        }
    }
}

// MARK: - Password Reset Request

/**
 * PasswordResetRequest - Solicitar reset de contraseña
 *
 * ANDROID EQUIVALENT: data class PasswordResetRequest
 *
 * Endpoint: POST /v1/auth/password-reset
 * Content-Type: application/json
 *
 * Body:
 * ```json
 * {
 *   "email": "farmer@agrobridge.com"
 * }
 * ```
 */
struct PasswordResetRequest: Codable {
    let email: String

    init(email: String) {
        precondition(!email.trimmingCharacters(in: .whitespaces).isEmpty, "Email no puede estar vacío")
        self.email = email
    }
}

// MARK: - Password Confirm Request

/**
 * PasswordConfirmRequest - Confirmar nueva contraseña con token
 *
 * ANDROID EQUIVALENT: data class PasswordConfirmRequest
 *
 * Endpoint: POST /v1/auth/password-confirm
 * Content-Type: application/json
 *
 * Body:
 * ```json
 * {
 *   "token": "reset_token_from_email",
 *   "password": "new_password_123"
 * }
 * ```
 */
struct PasswordConfirmRequest: Codable {
    let token: String
    let newPassword: String

    enum CodingKeys: String, CodingKey {
        case token
        case newPassword = "password"
    }

    init(token: String, newPassword: String) {
        precondition(!token.trimmingCharacters(in: .whitespaces).isEmpty, "Token no puede estar vacío")
        precondition(!newPassword.trimmingCharacters(in: .whitespaces).isEmpty, "Nueva contraseña no puede estar vacía")
        precondition(newPassword.count >= 8, "Contraseña debe tener al menos 8 caracteres")

        self.token = token
        self.newPassword = newPassword
    }
}

// MARK: - Register Request

/**
 * RegisterRequest - Registro de nuevo usuario
 *
 * ANDROID EQUIVALENT: data class RegisterRequest
 *
 * Endpoint: POST /v1/auth/register
 * Content-Type: application/json
 */
struct RegisterRequest: Codable {
    let email: String
    let password: String
    let firstName: String
    let lastName: String
    let role: String
    let phone: String?

    enum CodingKeys: String, CodingKey {
        case email
        case password
        case firstName = "first_name"
        case lastName = "last_name"
        case role
        case phone
    }

    init(email: String, password: String, firstName: String, lastName: String, role: String, phone: String? = nil) {
        precondition(!email.trimmingCharacters(in: .whitespaces).isEmpty, "Email no puede estar vacío")
        precondition(!password.trimmingCharacters(in: .whitespaces).isEmpty, "Contraseña no puede estar vacía")
        precondition(!firstName.trimmingCharacters(in: .whitespaces).isEmpty, "Nombre no puede estar vacío")
        precondition(!lastName.trimmingCharacters(in: .whitespaces).isEmpty, "Apellido no puede estar vacío")
        precondition(!role.trimmingCharacters(in: .whitespaces).isEmpty, "Rol no puede estar vacío")

        self.email = email
        self.password = password
        self.firstName = firstName
        self.lastName = lastName
        self.role = role
        self.phone = phone
    }
}

// MARK: - Helper for [String: Any] Decoding

private struct JSONCodingKeys: CodingKey {
    var stringValue: String
    var intValue: Int?

    init?(stringValue: String) {
        self.stringValue = stringValue
        self.intValue = nil
    }

    init?(intValue: Int) {
        self.stringValue = "\(intValue)"
        self.intValue = intValue
    }
}

extension KeyedDecodingContainer where K == JSONCodingKeys {
    func decode(_ type: [String: Any].Type) throws -> [String: Any] {
        var dictionary = [String: Any]()

        for key in allKeys {
            if let boolValue = try? decode(Bool.self, forKey: key) {
                dictionary[key.stringValue] = boolValue
            } else if let stringValue = try? decode(String.self, forKey: key) {
                dictionary[key.stringValue] = stringValue
            } else if let intValue = try? decode(Int.self, forKey: key) {
                dictionary[key.stringValue] = intValue
            } else if let doubleValue = try? decode(Double.self, forKey: key) {
                dictionary[key.stringValue] = doubleValue
            } else if let nestedDictionary = try? decode([String: Any].self, forKey: key) {
                dictionary[key.stringValue] = nestedDictionary
            } else if let nestedArray = try? decode([Any].self, forKey: key) {
                dictionary[key.stringValue] = nestedArray
            }
        }

        return dictionary
    }

    func decode(_ type: [Any].Type, forKey key: K) throws -> [Any] {
        var container = try nestedUnkeyedContainer(forKey: key)
        return try container.decode([Any].self)
    }
}

extension UnkeyedDecodingContainer {
    mutating func decode(_ type: [Any].Type) throws -> [Any] {
        var array: [Any] = []

        while !isAtEnd {
            if let value = try? decode(Bool.self) {
                array.append(value)
            } else if let value = try? decode(String.self) {
                array.append(value)
            } else if let value = try? decode(Int.self) {
                array.append(value)
            } else if let value = try? decode(Double.self) {
                array.append(value)
            } else if let nestedDictionary = try? decode([String: Any].self) {
                array.append(nestedDictionary)
            } else if let nestedArray = try? decode([Any].self) {
                array.append(nestedArray)
            }
        }

        return array
    }

    mutating func decode(_ type: [String: Any].Type) throws -> [String: Any] {
        let container = try nestedContainer(keyedBy: JSONCodingKeys.self)
        return try container.decode([String: Any].self)
    }
}
