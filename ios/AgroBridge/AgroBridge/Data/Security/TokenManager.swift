//
//  TokenManager.swift
//  AgroBridge
//
//  Created by Alejandro Navarro Ayala - CEO & Senior Developer
//  Copyright © 2025 AgroBridge International. All rights reserved.
//
//  ANDROID EQUIVALENT: data/local/datastore/AuthDataStore.kt (EncryptedSharedPreferences)
//

import Foundation
import Security

/**
 * TokenManager - Gestión segura de tokens JWT en Keychain
 *
 * ANDROID EQUIVALENT: EncryptedSharedPreferences for token storage
 *
 * Responsabilidades:
 * ✓ Almacenar access token y refresh token de forma segura
 * ✓ Recuperar tokens desde Keychain
 * ✓ Eliminar tokens al hacer logout
 * ✓ Thread-safe operations con actor
 * ✓ Integración con ErrorHandler
 *
 * Uso:
 * ```swift
 * let tokenManager = TokenManager.shared
 *
 * // Guardar tokens después de login
 * try await tokenManager.saveTokens(
 *     accessToken: "eyJhbGciOiJ...",
 *     refreshToken: "eyJhbGciOiJ..."
 * )
 *
 * // Recuperar access token
 * if let token = try await tokenManager.getAccessToken() {
 *     request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
 * }
 *
 * // Eliminar tokens al hacer logout
 * try await tokenManager.clearAllTokens()
 * ```
 *
 * ANDROID PARITY: Matches EncryptedSharedPreferences functionality
 * - Same key names (ACCESS_TOKEN, REFRESH_TOKEN)
 * - Same security level (AES-256 in Keychain vs EncryptedSharedPreferences)
 * - Same operations (save, get, delete)
 */
actor TokenManager {

    // MARK: - Singleton

    static let shared = TokenManager()

    // MARK: - Keychain Keys (matches Android exactly)

    private enum KeychainKey {
        static let accessToken = "com.agrobridge.accessToken"
        static let refreshToken = "com.agrobridge.refreshToken"
        static let service = "com.agrobridge.auth"
    }

    // MARK: - Private Properties

    private let errorHandler = ErrorHandler.shared

    // MARK: - Initialization

    private init() {}

    // MARK: - Public Methods - Save Tokens

    /**
     * Guarda ambos tokens (access y refresh) en Keychain
     *
     * ANDROID EQUIVALENT: `suspend fun saveTokens(accessToken: String, refreshToken: String)`
     *
     * - Parameters:
     *   - accessToken: JWT access token
     *   - refreshToken: JWT refresh token
     * - Throws: DatabaseError si falla el guardado
     */
    func saveTokens(accessToken: String, refreshToken: String) async throws {
        do {
            try saveToKeychain(key: KeychainKey.accessToken, value: accessToken)
            try saveToKeychain(key: KeychainKey.refreshToken, value: refreshToken)

            print("🔐 TokenManager: Tokens saved successfully")
        } catch {
            let message = await errorHandler.handle(error, context: "TokenManager.saveTokens")
            throw DatabaseError(message: message)
        }
    }

    /**
     * Guarda solo el access token (para refresh operations)
     *
     * ANDROID EQUIVALENT: `suspend fun saveAccessToken(token: String)`
     */
    func saveAccessToken(_ token: String) async throws {
        do {
            try saveToKeychain(key: KeychainKey.accessToken, value: token)
            print("🔐 TokenManager: Access token updated")
        } catch {
            let message = await errorHandler.handle(error, context: "TokenManager.saveAccessToken")
            throw DatabaseError(message: message)
        }
    }

    /**
     * Guarda solo el refresh token
     *
     * ANDROID EQUIVALENT: `suspend fun saveRefreshToken(token: String)`
     */
    func saveRefreshToken(_ token: String) async throws {
        do {
            try saveToKeychain(key: KeychainKey.refreshToken, value: token)
            print("🔐 TokenManager: Refresh token updated")
        } catch {
            let message = await errorHandler.handle(error, context: "TokenManager.saveRefreshToken")
            throw DatabaseError(message: message)
        }
    }

    // MARK: - Public Methods - Get Tokens

    /**
     * Recupera el access token desde Keychain
     *
     * ANDROID EQUIVALENT: `suspend fun getAccessToken(): String?`
     *
     * - Returns: Access token o nil si no existe
     */
    func getAccessToken() async throws -> String? {
        do {
            return try getFromKeychain(key: KeychainKey.accessToken)
        } catch {
            // Si no existe, no es error crítico
            if (error as NSError).code == errSecItemNotFound {
                return nil
            }

            let message = await errorHandler.handle(error, context: "TokenManager.getAccessToken")
            throw DatabaseError(message: message)
        }
    }

    /**
     * Recupera el refresh token desde Keychain
     *
     * ANDROID EQUIVALENT: `suspend fun getRefreshToken(): String?`
     *
     * - Returns: Refresh token o nil si no existe
     */
    func getRefreshToken() async throws -> String? {
        do {
            return try getFromKeychain(key: KeychainKey.refreshToken)
        } catch {
            // Si no existe, no es error crítico
            if (error as NSError).code == errSecItemNotFound {
                return nil
            }

            let message = await errorHandler.handle(error, context: "TokenManager.getRefreshToken")
            throw DatabaseError(message: message)
        }
    }

    /**
     * Verifica si existe un access token válido
     *
     * ANDROID EQUIVALENT: `suspend fun hasValidToken(): Boolean`
     */
    func hasAccessToken() async -> Bool {
        do {
            let token = try await getAccessToken()
            return token != nil && !token!.isEmpty
        } catch {
            return false
        }
    }

    /**
     * Verifica si existe un refresh token
     */
    func hasRefreshToken() async -> Bool {
        do {
            let token = try await getRefreshToken()
            return token != nil && !token!.isEmpty
        } catch {
            return false
        }
    }

    // MARK: - Public Methods - Delete Tokens

    /**
     * Elimina solo el access token
     *
     * ANDROID EQUIVALENT: `suspend fun deleteAccessToken()`
     */
    func deleteAccessToken() async throws {
        do {
            try deleteFromKeychain(key: KeychainKey.accessToken)
            print("🔐 TokenManager: Access token deleted")
        } catch {
            // Si no existe, no es error
            if (error as NSError).code != errSecItemNotFound {
                let message = await errorHandler.handle(error, context: "TokenManager.deleteAccessToken")
                throw DatabaseError(message: message)
            }
        }
    }

    /**
     * Elimina solo el refresh token
     *
     * ANDROID EQUIVALENT: `suspend fun deleteRefreshToken()`
     */
    func deleteRefreshToken() async throws {
        do {
            try deleteFromKeychain(key: KeychainKey.refreshToken)
            print("🔐 TokenManager: Refresh token deleted")
        } catch {
            // Si no existe, no es error
            if (error as NSError).code != errSecItemNotFound {
                let message = await errorHandler.handle(error, context: "TokenManager.deleteRefreshToken")
                throw DatabaseError(message: message)
            }
        }
    }

    /**
     * Elimina todos los tokens (logout)
     *
     * ANDROID EQUIVALENT: `suspend fun clearAll()`
     */
    func clearAllTokens() async throws {
        try await deleteAccessToken()
        try await deleteRefreshToken()

        print("🔐 TokenManager: All tokens cleared (logout)")
    }

    // MARK: - Private Keychain Methods

    /**
     * Guarda un valor en Keychain de forma segura
     *
     * Usa kSecAttrAccessibleWhenUnlockedThisDeviceOnly para máxima seguridad
     * (no se sincroniza con iCloud, solo accesible cuando dispositivo desbloqueado)
     */
    private func saveToKeychain(key: String, value: String) throws {
        guard let data = value.data(using: .utf8) else {
            throw DatabaseError(message: "Failed to encode token data")
        }

        // Query para buscar si ya existe
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: KeychainKey.service,
            kSecAttrAccount as String: key
        ]

        // Eliminar valor anterior si existe
        SecItemDelete(query as CFDictionary)

        // Nuevo query para guardar
        var newQuery = query
        newQuery[kSecValueData as String] = data
        newQuery[kSecAttrAccessible as String] = kSecAttrAccessibleWhenUnlockedThisDeviceOnly

        let status = SecItemAdd(newQuery as CFDictionary, nil)

        guard status == errSecSuccess else {
            throw NSError(
                domain: NSOSStatusErrorDomain,
                code: Int(status),
                userInfo: [NSLocalizedDescriptionKey: "Failed to save to Keychain (status: \(status))"]
            )
        }
    }

    /**
     * Recupera un valor desde Keychain
     */
    private func getFromKeychain(key: String) throws -> String? {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: KeychainKey.service,
            kSecAttrAccount as String: key,
            kSecReturnData as String: true,
            kSecMatchLimit as String: kSecMatchLimitOne
        ]

        var result: AnyObject?
        let status = SecItemCopyMatching(query as CFDictionary, &result)

        guard status == errSecSuccess else {
            throw NSError(
                domain: NSOSStatusErrorDomain,
                code: Int(status),
                userInfo: [NSLocalizedDescriptionKey: "Failed to read from Keychain (status: \(status))"]
            )
        }

        guard let data = result as? Data,
              let value = String(data: data, encoding: .utf8) else {
            throw DatabaseError(message: "Failed to decode token data")
        }

        return value
    }

    /**
     * Elimina un valor desde Keychain
     */
    private func deleteFromKeychain(key: String) throws {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: KeychainKey.service,
            kSecAttrAccount as String: key
        ]

        let status = SecItemDelete(query as CFDictionary)

        guard status == errSecSuccess || status == errSecItemNotFound else {
            throw NSError(
                domain: NSOSStatusErrorDomain,
                code: Int(status),
                userInfo: [NSLocalizedDescriptionKey: "Failed to delete from Keychain (status: \(status))"]
            )
        }
    }

    // MARK: - Token Inspection (for debugging)

    /**
     * Decodifica JWT payload sin verificar firma (para inspección local)
     *
     * ANDROID EQUIVALENT: JWT.decode() helper
     */
    func decodeTokenPayload(_ token: String) -> [String: Any]? {
        let parts = token.components(separatedBy: ".")
        guard parts.count == 3 else { return nil }

        let payloadBase64 = parts[1]
        // Agregar padding si es necesario
        var base64 = payloadBase64
            .replacingOccurrences(of: "-", with: "+")
            .replacingOccurrences(of: "_", with: "/")

        while base64.count % 4 != 0 {
            base64 += "="
        }

        guard let data = Data(base64Encoded: base64),
              let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else {
            return nil
        }

        return json
    }

    /**
     * Verifica si un token ha expirado (basado en claim 'exp')
     *
     * ANDROID EQUIVALENT: isTokenExpired() helper
     */
    func isTokenExpired(_ token: String) -> Bool {
        guard let payload = decodeTokenPayload(token),
              let exp = payload["exp"] as? TimeInterval else {
            return true // Si no se puede decodificar, asumir expirado
        }

        let expirationDate = Date(timeIntervalSince1970: exp)
        return Date() >= expirationDate
    }

    /**
     * Obtiene información del usuario desde el access token
     */
    func getUserInfoFromToken() async throws -> TokenUserInfo? {
        guard let token = try await getAccessToken() else {
            return nil
        }

        guard let payload = decodeTokenPayload(token) else {
            return nil
        }

        return TokenUserInfo(
            userId: payload["userId"] as? String,
            email: payload["email"] as? String,
            nombre: payload["nombre"] as? String,
            rol: payload["rol"] as? String
        )
    }
}

// MARK: - Supporting Types

/**
 * Información del usuario extraída del JWT token
 *
 * ANDROID EQUIVALENT: data class TokenUserInfo
 */
struct TokenUserInfo {
    let userId: String?
    let email: String?
    let nombre: String?
    let rol: String?
}

// MARK: - Convenience Extensions

extension TokenManager {

    /**
     * Verifica si el usuario está autenticado (tiene tokens válidos)
     *
     * ANDROID EQUIVALENT: `suspend fun isAuthenticated(): Boolean`
     */
    func isAuthenticated() async -> Bool {
        guard let accessToken = try? await getAccessToken(),
              !accessToken.isEmpty else {
            return false
        }

        // Verificar si el token no ha expirado
        return !isTokenExpired(accessToken)
    }

    /**
     * Verifica si necesita refresh (token expirado pero refresh token disponible)
     */
    func needsTokenRefresh() async -> Bool {
        guard let accessToken = try? await getAccessToken(),
              !accessToken.isEmpty else {
            return false
        }

        // Si access token expiró pero hay refresh token, necesita refresh
        if isTokenExpired(accessToken) {
            return await hasRefreshToken()
        }

        return false
    }
}
