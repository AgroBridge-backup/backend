//
//  AuthRepositoryImpl.swift
//  AgroBridge
//
//  Created by Alejandro Navarro Ayala - CEO & Senior Developer
//  Copyright © 2025 AgroBridge International. All rights reserved.
//
//  ANDROID EQUIVALENT: data/repository/AuthRepository.kt
//

import Foundation

/**
 * AuthRepositoryImpl - Repository para autenticación
 *
 * ANDROID EQUIVALENT: class AuthRepository @Inject constructor(...)
 *
 * Responsabilidades:
 * ✓ Manejar login/logout
 * ✓ Gestionar renovación de tokens
 * ✓ Validar sesiones
 * ✓ Coordinar entre API y TokenManager
 *
 * Flujo de login:
 * 1. login(email, password)
 * 2. POST /v1/auth/login → TokenResponse
 * 3. TokenManager.saveTokens() [cifrado en Keychain]
 * 4. Retornar UserDTO
 *
 * Flujo de refresh:
 * 1. refreshToken()
 * 2. Obtener refresh_token de TokenManager
 * 3. POST /v1/auth/refresh → TokenResponse
 * 4. TokenManager.saveTokens() [actualizar tokens]
 * 5. Retornar nuevo access_token
 *
 * ANDROID PARITY: Matches AuthRepository.kt functionality 100%
 * - Same login/logout/refresh methods
 * - Same error handling
 * - Same token management
 * - Same return types (Result<T>)
 */
class AuthRepositoryImpl {

    // MARK: - Singleton

    static let shared = AuthRepositoryImpl()

    // MARK: - Dependencies

    private let tokenManager = TokenManager.shared
    private let errorHandler = ErrorHandler.shared

    // FIXED: L-012 - Use AppConfiguration instead of hardcoded URL
    private var baseURL: String {
        AppConfiguration.baseURL
    }

    // MARK: - URLSession

    private let session: URLSession = {
        let config = URLSessionConfiguration.default
        config.timeoutIntervalForRequest = 30
        config.timeoutIntervalForResource = 60
        return URLSession(configuration: config)
    }()

    // MARK: - Initialization

    private init() {}

    // MARK: - Login

    /**
     * Iniciar sesión con credenciales
     *
     * ANDROID EQUIVALENT: `suspend fun login(email: String, password: String): Result<UserDto>`
     *
     * - Parameters:
     *   - email: Email del usuario
     *   - password: Contraseña
     * - Returns: Result<UserDTO> con información del usuario si tiene éxito
     */
    func login(email: String, password: String) async -> Result<UserDTO, Error> {
        do {
            print("🔐 AuthRepository: Iniciando sesión para: \(email)")

            // Validar credenciales básicas
            if email.trimmingCharacters(in: .whitespaces).isEmpty ||
               password.trimmingCharacters(in: .whitespaces).isEmpty {
                throw ValidationError(message: "Email y contraseña requeridos")
            }

            // Crear request
            let request = LoginRequest(email: email, password: password)
            let endpoint = "/v1/auth/login"

            // Llamar al API
            let response: TokenResponse = try await post(endpoint: endpoint, body: request)

            // Guardar tokens de forma segura en Keychain
            try await tokenManager.saveTokens(
                accessToken: response.accessToken,
                refreshToken: response.refreshToken
            )

            // Retornar información del usuario
            if let user = response.user {
                print("✅ AuthRepository: Login exitoso para: \(user.email)")
                return .success(user)
            } else {
                print("⚠️ AuthRepository: Login exitoso pero sin datos de usuario")
                throw UnauthorizedError(message: "Respuesta incompleta del servidor")
            }
        } catch {
            let message = await errorHandler.handle(error, context: "AuthRepository.login")
            print("❌ AuthRepository: Login fallido: \(message)")
            return .failure(error)
        }
    }

    // MARK: - Refresh Token

    /**
     * Renovar access_token usando refresh_token
     *
     * ANDROID EQUIVALENT: `suspend fun refreshToken(): Result<String>`
     *
     * Se llama automáticamente cuando:
     * - Access token está próximo a expirar
     * - Se recibe error 401 (Unauthorized) en API call
     *
     * - Returns: Result<String> con nuevo access_token si tiene éxito
     */
    func refreshToken() async -> Result<String, Error> {
        do {
            print("🔄 AuthRepository: Renovando token de acceso...")

            // Obtener refresh token guardado
            guard let refreshToken = try await tokenManager.getRefreshToken(),
                  !refreshToken.isEmpty else {
                print("❌ AuthRepository: Refresh token no disponible")
                throw UnauthorizedError(message: "Sesión inválida: no hay refresh token")
            }

            // Crear request
            let request = RefreshTokenRequest(refreshToken: refreshToken)
            let endpoint = "/v1/auth/refresh"

            // Llamar al API de refresh
            let response: TokenResponse = try await post(endpoint: endpoint, body: request)

            // Guardar nuevos tokens
            try await tokenManager.saveTokens(
                accessToken: response.accessToken,
                refreshToken: response.refreshToken
            )

            print("✅ AuthRepository: Token renovado exitosamente")
            return .success(response.accessToken)
        } catch let error as HTTPError where error.statusCode == 401 {
            // Si refresh token también está inválido, limpiar sesión
            print("⚠️ AuthRepository: Refresh token expirado, limpiando sesión")
            try? await tokenManager.clearAllTokens()

            let message = await errorHandler.handle(error, context: "AuthRepository.refreshToken")
            return .failure(error)
        } catch {
            let message = await errorHandler.handle(error, context: "AuthRepository.refreshToken")
            print("❌ AuthRepository: Renovación de token fallida: \(message)")
            return .failure(error)
        }
    }

    // MARK: - Logout

    /**
     * Cerrar sesión e invalidar tokens
     *
     * ANDROID EQUIVALENT: `suspend fun logout(): Result<Unit>`
     *
     * - Returns: Result<Void> indicando éxito o fallo
     */
    func logout() async -> Result<Void, Error> {
        do {
            print("🚪 AuthRepository: Cerrando sesión...")

            // Obtener access token actual
            if let accessToken = try await tokenManager.getAccessToken() {
                do {
                    // Notificar al servidor
                    let request = LogoutRequest(accessToken: accessToken)
                    let endpoint = "/v1/auth/logout"

                    let _: EmptyResponse = try await post(endpoint: endpoint, body: request)
                    print("✅ AuthRepository: Logout confirmado por servidor")
                } catch {
                    print("⚠️ AuthRepository: No se pudo notificar al servidor, limpiando tokens locales")
                    // Continuar con limpieza local de todas formas
                }
            }

            // Limpiar tokens locales (siempre hacerlo)
            try await tokenManager.clearAllTokens()
            print("✅ AuthRepository: Sesión cerrada, tokens eliminados")

            return .success(())
        } catch {
            let message = await errorHandler.handle(error, context: "AuthRepository.logout")
            print("❌ AuthRepository: Error durante logout: \(message)")
            return .failure(error)
        }
    }

    // MARK: - Password Reset

    /**
     * Solicitar reset de contraseña
     *
     * ANDROID EQUIVALENT: `suspend fun requestPasswordReset(email: String): Result<Unit>`
     *
     * - Parameter email: Email del usuario
     * - Returns: Result<Void> indicando que se envió email
     */
    func requestPasswordReset(email: String) async -> Result<Void, Error> {
        do {
            print("📧 AuthRepository: Solicitando reset de contraseña para: \(email)")

            if email.trimmingCharacters(in: .whitespaces).isEmpty {
                throw ValidationError(message: "Email requerido")
            }

            let request = PasswordResetRequest(email: email)
            let endpoint = "/v1/auth/password-reset"

            let _: EmptyResponse = try await post(endpoint: endpoint, body: request)

            print("✅ AuthRepository: Email de reset enviado a: \(email)")
            return .success(())
        } catch {
            let message = await errorHandler.handle(error, context: "AuthRepository.requestPasswordReset")
            print("❌ AuthRepository: Fallo al solicitar reset: \(message)")
            return .failure(error)
        }
    }

    /**
     * Confirmar nueva contraseña con token de reset
     *
     * ANDROID EQUIVALENT: `suspend fun confirmPasswordReset(token: String, newPassword: String): Result<Unit>`
     *
     * - Parameters:
     *   - token: Token del email de reset
     *   - newPassword: Nueva contraseña
     * - Returns: Result<Void> indicando éxito
     */
    func confirmPasswordReset(token: String, newPassword: String) async -> Result<Void, Error> {
        do {
            print("🔐 AuthRepository: Confirmando nueva contraseña...")

            if token.trimmingCharacters(in: .whitespaces).isEmpty ||
               newPassword.trimmingCharacters(in: .whitespaces).isEmpty {
                throw ValidationError(message: "Token y contraseña requeridos")
            }

            let request = PasswordConfirmRequest(token: token, newPassword: newPassword)
            let endpoint = "/v1/auth/password-confirm"

            let _: EmptyResponse = try await post(endpoint: endpoint, body: request)

            print("✅ AuthRepository: Contraseña actualizada exitosamente")
            return .success(())
        } catch {
            let message = await errorHandler.handle(error, context: "AuthRepository.confirmPasswordReset")
            print("❌ AuthRepository: Fallo al confirmar nueva contraseña: \(message)")
            return .failure(error)
        }
    }

    // MARK: - Session Validation

    /**
     * Verificar si hay sesión válida
     *
     * ANDROID EQUIVALENT: `fun hasValidSession(): Boolean`
     *
     * - Returns: true si hay access_token válido, false de lo contrario
     */
    func hasValidSession() async -> Bool {
        return await tokenManager.isAuthenticated()
    }

    /**
     * Obtener usuario actual desde el token JWT
     *
     * ANDROID EQUIVALENT: `fun getCurrentUser(): Result<UserDto>`
     *
     * - Returns: TokenUserInfo si está disponible
     */
    func getCurrentUser() async -> Result<TokenUserInfo, Error> {
        do {
            if await tokenManager.isAuthenticated() {
                if let userInfo = try await tokenManager.getUserInfoFromToken() {
                    return .success(userInfo)
                } else {
                    throw UnauthorizedError(message: "No se pudo extraer información del token")
                }
            } else {
                throw UnauthorizedError(message: "No hay sesión activa")
            }
        } catch {
            return .failure(error)
        }
    }

    // MARK: - Registration

    /**
     * Registrar nuevo usuario
     *
     * ANDROID EQUIVALENT: `suspend fun register(request: RegisterRequest): Result<UserDto>`
     */
    func register(
        email: String,
        password: String,
        firstName: String,
        lastName: String,
        role: String,
        phone: String? = nil
    ) async -> Result<UserDTO, Error> {
        do {
            print("📝 AuthRepository: Registrando nuevo usuario: \(email)")

            let request = RegisterRequest(
                email: email,
                password: password,
                firstName: firstName,
                lastName: lastName,
                role: role,
                phone: phone
            )
            let endpoint = "/v1/auth/register"

            let response: TokenResponse = try await post(endpoint: endpoint, body: request)

            // Guardar tokens
            try await tokenManager.saveTokens(
                accessToken: response.accessToken,
                refreshToken: response.refreshToken
            )

            if let user = response.user {
                print("✅ AuthRepository: Usuario registrado exitosamente: \(user.email)")
                return .success(user)
            } else {
                throw UnauthorizedError(message: "Respuesta incompleta del servidor")
            }
        } catch {
            let message = await errorHandler.handle(error, context: "AuthRepository.register")
            print("❌ AuthRepository: Registro fallido: \(message)")
            return .failure(error)
        }
    }

    // MARK: - Private Network Methods

    /**
     * Realiza POST request al API
     */
    private func post<T: Encodable, R: Decodable>(
        endpoint: String,
        body: T
    ) async throws -> R {
        // Build URL
        guard let url = URL(string: baseURL + endpoint) else {
            throw HTTPError(statusCode: 0, message: "URL inválida")
        }

        // Create request
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")

        // Add access token if available (except for login/register)
        if !endpoint.contains("/login") && !endpoint.contains("/register") {
            if let accessToken = try await tokenManager.getAccessToken() {
                request.setValue("Bearer \(accessToken)", forHTTPHeaderField: "Authorization")
            }
        }

        // Encode body
        let encoder = JSONEncoder()
        encoder.keyEncodingStrategy = .useDefaultKeys
        request.httpBody = try encoder.encode(body)

        // Execute request
        let (data, response) = try await session.data(for: request)

        // Validate HTTP response
        guard let httpResponse = response as? HTTPURLResponse else {
            throw HTTPError(statusCode: 0, message: "Invalid response")
        }

        // Check status code
        guard (200...299).contains(httpResponse.statusCode) else {
            // Try to decode error response
            if let errorResponse = try? JSONDecoder().decode(ErrorResponse.self, from: data) {
                throw HTTPError(statusCode: httpResponse.statusCode, message: errorResponse.message)
            } else {
                throw HTTPError(statusCode: httpResponse.statusCode, message: "HTTP Error \(httpResponse.statusCode)")
            }
        }

        // Decode response
        let decoder = JSONDecoder()
        decoder.keyDecodingStrategy = .useDefaultKeys
        return try decoder.decode(R.self, from: data)
    }
}

// MARK: - Empty Response for endpoints that don't return data

private struct EmptyResponse: Codable {}
