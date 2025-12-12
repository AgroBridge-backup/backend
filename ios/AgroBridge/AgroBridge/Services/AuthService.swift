import Foundation
import Combine

// MARK: - Auth Service
/// Servicio de autenticación - Maneja login, logout, refresh token y sesión
@MainActor
class AuthService: ObservableObject {
    // MARK: - Singleton
    static let shared = AuthService()

    // MARK: - Published Properties
    @Published private(set) var isAuthenticated = false
    @Published private(set) var currentUser: User?
    @Published private(set) var isLoading = false
    @Published private(set) var errorMessage: String?

    // MARK: - Private Properties
    private let apiClient = APIClient.shared
    private let keychain = KeychainManager.shared

    // MARK: - Inicialización
    private init() {
        // Verificar sesión existente al inicializar
        checkExistingSession()
    }

    // MARK: - Login
    /// Realiza login con email y contraseña
    /// - Parameters:
    ///   - email: Email del usuario
    ///   - password: Contraseña
    /// - Throws: NetworkError si falla
    func login(email: String, password: String) async throws {
        isLoading = true
        errorMessage = nil

        defer { isLoading = false }

        do {
            // Crear request
            let request = LoginRequest(email: email, password: password)

            // Llamar al endpoint
            let response: LoginResponse = try await apiClient.request(
                endpoint: .login,
                method: .post,
                body: request
            )

            // Guardar token en Keychain
            keychain.save(response.token, for: .authToken)

            if let refreshToken = response.refreshToken {
                keychain.save(refreshToken, for: .refreshToken)
            }

            keychain.save(email, for: .userEmail)

            // Actualizar APIClient con el nuevo token
            apiClient.authToken = response.token

            // Actualizar estado
            currentUser = response.user
            isAuthenticated = true

            // Log evento de login (Firebase Analytics)
            logEvent("login_success", parameters: ["method": "email"])

            print("✅ Login exitoso: \(response.user.email)")

        } catch {
            // Manejar error
            errorMessage = (error as? NetworkError)?.errorDescription ?? error.localizedDescription
            print("❌ Error en login: \(error)")

            // Log evento de error
            logEvent("login_failed", parameters: ["error": errorMessage ?? "unknown"])

            throw error
        }
    }

    // MARK: - Logout
    /// Cierra la sesión del usuario
    func logout() async {
        isLoading = true

        defer { isLoading = false }

        do {
            // Intentar llamar al endpoint de logout (opcional)
            try? await apiClient.requestWithoutResponse(
                endpoint: .logout,
                method: .post
            )
        }

        // Limpiar Keychain
        keychain.deleteAll()

        // Limpiar estado
        apiClient.authToken = nil
        currentUser = nil
        isAuthenticated = false

        // Log evento
        logEvent("logout", parameters: nil)

        print("✅ Logout exitoso")
    }

    // MARK: - Refresh Token
    /// Refresca el token de autenticación
    /// - Returns: true si se refrescó exitosamente
    @discardableResult
    func refreshToken() async -> Bool {
        guard let refreshToken = keychain.get(for: .refreshToken) else {
            print("❌ No hay refresh token guardado")
            return false
        }

        do {
            let request = RefreshTokenRequest(refreshToken: refreshToken)

            let response: RefreshTokenResponse = try await apiClient.request(
                endpoint: .refreshToken,
                method: .post,
                body: request
            )

            // Guardar nuevo token
            keychain.save(response.token, for: .authToken)
            apiClient.authToken = response.token

            print("✅ Token refrescado exitosamente")
            return true

        } catch {
            print("❌ Error refrescando token: \(error)")

            // Si falla el refresh, hacer logout
            await logout()
            return false
        }
    }

    // MARK: - Check Existing Session
    /// Verifica si existe una sesión guardada y la restaura
    func checkExistingSession() {
        guard let token = keychain.get(for: .authToken) else {
            print("ℹ️ No hay sesión guardada")
            return
        }

        // Restaurar token en APIClient
        apiClient.authToken = token

        // Intentar obtener usuario actual
        Task {
            await fetchCurrentUser()
        }
    }

    // MARK: - Fetch Current User
    /// Obtiene los datos del usuario actual desde el servidor
    private func fetchCurrentUser() async {
        // TODO: Implementar cuando exista el endpoint GET /auth/me
        // Por ahora, simulamos recuperación desde Keychain

        if let email = keychain.get(for: .userEmail) {
            // Usuario mock - En producción, esto vendría del servidor
            currentUser = User(
                id: "temp-id",
                email: email,
                nombre: nil,
                rol: .productor,
                createdAt: nil,
                updatedAt: nil
            )
            isAuthenticated = true
            print("✅ Sesión restaurada para: \(email)")
        }
    }

    // MARK: - Helpers
    /// Log de eventos (Firebase Analytics)
    private func logEvent(_ name: String, parameters: [String: Any]?) {
        guard AppConfiguration.enableFirebaseAnalytics else { return }

        // TODO: Agregar cuando Firebase esté configurado
        // Analytics.logEvent(name, parameters: parameters)

        print("📊 Analytics Event: \(name) - \(parameters ?? [:])")
    }
}
