/*:
 # 🏛️ AgroBridge - MVVM Architecture Playground

 **Purpose:** Learn MVVM + Clean Architecture patterns used in AgroBridge

 **Topics Covered:**
 - MVVM layer separation
 - Data flow: View → ViewModel → Service → APIClient
 - @Published and @StateObject reactive patterns
 - Async/await networking
 - Error handling strategies
 - Complete login flow example

 **Developed by:** Alejandro Navarro Ayala - CEO & Senior Developer

 **Version:** 1.0.0
 **Last Updated:** November 28, 2024

 ---

 ## 📚 Architecture Overview

 ```
 ┌─────────────────────────────────────────┐
 │         VIEWS (SwiftUI)                 │
 │  - Declarative UI                       │
 │  - Observes ViewModels                  │
 │  - NO business logic                    │
 └────────────────┬────────────────────────┘
                  │ @StateObject
                  │ @Published
                  ▼
 ┌─────────────────────────────────────────┐
 │         VIEW MODELS                     │
 │  - Presentation logic                   │
 │  - Form validation                      │
 │  - Transform data for UI                │
 │  - Publishes state changes              │
 └────────────────┬────────────────────────┘
                  │ Calls
                  ▼
 ┌─────────────────────────────────────────┐
 │         SERVICES                        │
 │  - Business logic                       │
 │  - Orchestrates APIClient               │
 │  - Manages global state                 │
 └────────────────┬────────────────────────┘
                  │ Uses
                  ▼
 ┌─────────────────────────────────────────┐
 │         API CLIENT                      │
 │  - Generic networking                   │
 │  - HTTP requests                        │
 │  - Error handling                       │
 └────────────────┬────────────────────────┘
                  │ HTTP/JSON
                  ▼
           ┌──────────────┐
           │   BACKEND    │
           │  AgroBridge  │
           └──────────────┘
 ```

 ---
 */

import SwiftUI
import PlaygroundSupport
import Combine

/*:
 ---
 ## Part 1: Foundation - Models & Networking

 Every architecture starts with data models and networking infrastructure.
 */

// MARK: - Models

/// User model - Represents authenticated user data
struct User: Codable, Identifiable {
    let id: String
    let nombre: String
    let email: String
    let rol: UserRole

    enum UserRole: String, Codable {
        case admin = "admin"
        case producer = "producer"
        case buyer = "buyer"
    }
}

/// Login request payload
struct LoginRequest: Encodable {
    let email: String
    let password: String
}

/// Login response from API
struct LoginResponse: Decodable {
    let token: String
    let refreshToken: String
    let user: User
}

/// Dashboard statistics model
struct DashboardStats: Codable {
    let totalProductores: Int
    let lotesActivos: Int
    let bloquesCertificados: Int
    let estadoConexion: EstadoConexion

    enum EstadoConexion: String, Codable {
        case online = "online"
        case offline = "offline"
        case maintenance = "maintenance"
    }
}

// MARK: - Network Errors

/// Custom network errors with descriptive messages
enum NetworkError: Error, LocalizedError {
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

    var errorDescription: String? {
        switch self {
        case .invalidURL:
            return "URL inválida"
        case .invalidResponse:
            return "Respuesta del servidor inválida"
        case .unauthorized:
            return "No autorizado. Por favor inicia sesión nuevamente"
        case .forbidden:
            return "No tienes permisos para realizar esta acción"
        case .notFound:
            return "Recurso no encontrado"
        case .serverError(let code):
            return "Error del servidor (código \(code))"
        case .decodingError:
            return "Error al procesar la respuesta"
        case .encodingError:
            return "Error al preparar la solicitud"
        case .noInternetConnection:
            return "Sin conexión a internet"
        case .timeout:
            return "Tiempo de espera agotado"
        case .unknown:
            return "Error desconocido. Intenta de nuevo"
        }
    }
}

/*:
 ---
 ## Part 2: API Client - The Networking Layer

 Generic, reusable HTTP client using async/await
 */

// MARK: - HTTP Method

enum HTTPMethod: String {
    case GET
    case POST
    case PUT
    case PATCH
    case DELETE
}

// MARK: - Endpoint

enum Endpoint {
    case login
    case dashboardStats
    case logout

    var path: String {
        switch self {
        case .login:
            return "/auth/login"
        case .dashboardStats:
            return "/dashboard/stats"
        case .logout:
            return "/auth/logout"
        }
    }
}

// MARK: - API Client

/// Generic HTTP client for all network requests
class APIClient {
    static let shared = APIClient()

    private let baseURL = "https://api.agrobridge.io/v1"
    private var authToken: String?

    private init() {}

    /// Generic request method with Codable response
    func request<T: Decodable>(
        endpoint: Endpoint,
        method: HTTPMethod,
        body: Encodable? = nil,
        headers: [String: String]? = nil
    ) async throws -> T {
        // 1. Build URL
        guard let url = URL(string: baseURL + endpoint.path) else {
            throw NetworkError.invalidURL
        }

        // 2. Create request
        var request = URLRequest(url: url)
        request.httpMethod = method.rawValue
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("application/json", forHTTPHeaderField: "Accept")

        // 3. Add auth token if available
        if let token = authToken {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }

        // 4. Add custom headers
        headers?.forEach { key, value in
            request.setValue(value, forHTTPHeaderField: key)
        }

        // 5. Encode body if present
        if let body = body {
            do {
                let encoder = JSONEncoder()
                encoder.dateEncodingStrategy = .iso8601
                request.httpBody = try encoder.encode(body)
            } catch {
                throw NetworkError.encodingError(error)
            }
        }

        // 6. Perform request
        let (data, response) = try await URLSession.shared.data(for: request)

        // 7. Validate response
        guard let httpResponse = response as? HTTPURLResponse else {
            throw NetworkError.invalidResponse
        }

        // 8. Handle HTTP status codes
        switch httpResponse.statusCode {
        case 200...299:
            break // Success
        case 401:
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

        // 9. Decode response
        do {
            let decoder = JSONDecoder()
            decoder.dateDecodingStrategy = .iso8601
            let decoded = try decoder.decode(T.self, from: data)
            return decoded
        } catch {
            throw NetworkError.decodingError(error)
        }
    }

    /// Set authentication token
    func setAuthToken(_ token: String?) {
        self.authToken = token
    }

    /// Clear authentication token
    func clearAuthToken() {
        self.authToken = nil
    }
}

print("✅ Part 2 Complete: APIClient ready")
print("   - Generic request method with async/await")
print("   - Automatic token injection")
print("   - Error handling with custom NetworkError")
print("")

/*:
 ---
 ## Part 3: Services - Business Logic Layer

 Services orchestrate API calls and manage global state
 */

// MARK: - Keychain Manager (Simplified)

/// Secure storage for JWT tokens
class KeychainManager {
    static let shared = KeychainManager()
    private init() {}

    // Simplified in-memory storage for playground
    private var storage: [String: String] = [:]

    func save(_ value: String, for key: String) {
        storage[key] = value
        print("🔐 Keychain: Saved '\(key)'")
    }

    func retrieve(_ key: String) -> String? {
        return storage[key]
    }

    func delete(_ key: String) {
        storage.removeValue(forKey: key)
        print("🔐 Keychain: Deleted '\(key)'")
    }
}

// MARK: - Auth Service

/// Handles all authentication operations
class AuthService: ObservableObject {
    static let shared = AuthService()

    @Published var currentUser: User?
    @Published var isAuthenticated = false

    private let apiClient = APIClient.shared
    private let keychainManager = KeychainManager.shared

    private init() {
        checkExistingSession()
    }

    /// Check if user has valid session on app launch
    func checkExistingSession() {
        if let token = keychainManager.retrieve("authToken") {
            apiClient.setAuthToken(token)
            isAuthenticated = true
            print("✅ Found existing session")
        } else {
            print("ℹ️ No existing session")
        }
    }

    /// Login with email and password
    func login(email: String, password: String) async throws -> LoginResponse {
        print("\n🔐 AuthService.login()")
        print("   Email: \(email)")

        // 1. Create request
        let request = LoginRequest(email: email, password: password)

        // 2. Call API
        let response: LoginResponse = try await apiClient.request(
            endpoint: .login,
            method: .POST,
            body: request
        )

        print("   ✅ Login successful")
        print("   User: \(response.user.nombre)")
        print("   Role: \(response.user.rol.rawValue)")

        // 3. Save token to Keychain
        keychainManager.save(response.token, for: "authToken")
        keychainManager.save(response.refreshToken, for: "refreshToken")

        // 4. Update APIClient token
        apiClient.setAuthToken(response.token)

        // 5. Update published state
        await MainActor.run {
            self.currentUser = response.user
            self.isAuthenticated = true
        }

        return response
    }

    /// Logout user
    func logout() async {
        print("\n🚪 AuthService.logout()")

        // 1. Call logout endpoint (fire and forget)
        do {
            _ = try? await apiClient.request(
                endpoint: .logout,
                method: .POST
            ) as EmptyResponse
        } catch {
            // Ignore errors, logout anyway
        }

        // 2. Clear tokens
        keychainManager.delete("authToken")
        keychainManager.delete("refreshToken")
        apiClient.clearAuthToken()

        // 3. Update state
        await MainActor.run {
            self.currentUser = nil
            self.isAuthenticated = false
        }

        print("   ✅ Logged out successfully")
    }
}

// Helper for empty responses
struct EmptyResponse: Decodable {}

// MARK: - Dashboard Service

/// Handles dashboard data operations
class DashboardService: ObservableObject {
    static let shared = DashboardService()

    private let apiClient = APIClient.shared

    private init() {}

    /// Fetch dashboard statistics
    func fetchStats() async throws -> DashboardStats {
        print("\n📊 DashboardService.fetchStats()")

        let stats: DashboardStats = try await apiClient.request(
            endpoint: .dashboardStats,
            method: .GET
        )

        print("   ✅ Stats fetched")
        print("   Productores: \(stats.totalProductores)")
        print("   Lotes: \(stats.lotesActivos)")
        print("   Estado: \(stats.estadoConexion.rawValue)")

        return stats
    }
}

print("✅ Part 3 Complete: Services ready")
print("   - AuthService: login, logout, session management")
print("   - DashboardService: fetch stats")
print("")

/*:
 ---
 ## Part 4: ViewModels - Presentation Logic Layer

 ViewModels sit between Views and Services, handling:
 - UI state (@Published properties)
 - Form validation
 - Calling services
 - Error handling
 */

// MARK: - Login ViewModel

/// ViewModel for LoginView
class LoginViewModel: ObservableObject {
    // MARK: - Published Properties (UI observes these)

    @Published var email = ""
    @Published var password = ""
    @Published var isLoading = false
    @Published var showError = false
    @Published var errorMessage = ""

    // MARK: - Computed Properties

    var isFormValid: Bool {
        isEmailValid && isPasswordValid
    }

    var isEmailValid: Bool {
        let emailRegex = "[A-Z0-9a-z._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,64}"
        let emailPredicate = NSPredicate(format: "SELF MATCHES %@", emailRegex)
        return emailPredicate.evaluate(with: email)
    }

    var isPasswordValid: Bool {
        password.count >= 6
    }

    // MARK: - Dependencies

    private let authService = AuthService.shared

    // MARK: - Actions

    /// Handle login button tap
    @MainActor
    func login() async {
        print("\n🎯 LoginViewModel.login()")
        print("   Validating form...")

        // 1. Validate form
        guard isFormValid else {
            print("   ❌ Form validation failed")
            errorMessage = "Email o contraseña inválidos"
            showError = true
            return
        }

        print("   ✅ Form valid")

        // 2. Set loading state
        isLoading = true

        // 3. Call service
        do {
            _ = try await authService.login(
                email: email,
                password: password
            )

            // 4. Success - view will auto-navigate via isAuthenticated
            print("   ✅ ViewModel: Login successful")
            isLoading = false

        } catch let error as NetworkError {
            // 5. Handle network errors
            print("   ❌ ViewModel: Login failed - \(error.localizedDescription ?? "")")
            errorMessage = error.errorDescription ?? "Error desconocido"
            showError = true
            isLoading = false

        } catch {
            // 6. Handle unexpected errors
            print("   ❌ ViewModel: Unexpected error - \(error)")
            errorMessage = "Algo salió mal. Intenta de nuevo"
            showError = true
            isLoading = false
        }
    }
}

// MARK: - Dashboard ViewModel

/// ViewModel for DashboardView
class DashboardViewModel: ObservableObject {
    // MARK: - Published Properties

    @Published var stats: DashboardStats?
    @Published var isLoading = false
    @Published var showError = false
    @Published var errorMessage = ""

    // MARK: - Dependencies

    private let dashboardService = DashboardService.shared

    // MARK: - Lifecycle

    init() {
        // Load stats on init
        Task {
            await loadStats()
        }
    }

    // MARK: - Actions

    /// Load dashboard statistics
    @MainActor
    func loadStats() async {
        print("\n🎯 DashboardViewModel.loadStats()")

        isLoading = true

        do {
            let fetchedStats = try await dashboardService.fetchStats()
            self.stats = fetchedStats
            isLoading = false
            print("   ✅ ViewModel: Stats loaded")

        } catch let error as NetworkError {
            errorMessage = error.errorDescription ?? "Error al cargar estadísticas"
            showError = true
            isLoading = false
            print("   ❌ ViewModel: Failed - \(errorMessage)")

        } catch {
            errorMessage = "Error desconocido"
            showError = true
            isLoading = false
            print("   ❌ ViewModel: Unexpected error")
        }
    }

    /// Refresh stats (pull-to-refresh)
    @MainActor
    func refresh() async {
        print("\n🔄 DashboardViewModel.refresh()")
        await loadStats()
    }
}

print("✅ Part 4 Complete: ViewModels ready")
print("   - LoginViewModel: form validation, login logic")
print("   - DashboardViewModel: load/refresh stats")
print("")

/*:
 ---
 ## Part 5: Views - The UI Layer

 SwiftUI views that observe ViewModels and react to state changes
 */

// MARK: - Login View

struct LoginView: View {
    // Observe ViewModel
    @StateObject private var viewModel = LoginViewModel()

    // Listen to auth state
    @ObservedObject private var authService = AuthService.shared

    var body: some View {
        NavigationView {
            VStack(spacing: 24) {
                // Logo
                Image(systemName: "leaf.fill")
                    .font(.system(size: 80))
                    .foregroundColor(.green)
                    .padding(.bottom, 20)

                Text("AgroBridge")
                    .font(.system(size: 34, weight: .bold))
                    .foregroundColor(.primary)

                Text("Iniciar Sesión")
                    .font(.title2)
                    .foregroundColor(.secondary)
                    .padding(.bottom, 20)

                // Email field
                VStack(alignment: .leading, spacing: 8) {
                    Text("Email")
                        .font(.subheadline)
                        .foregroundColor(.secondary)

                    TextField("tu@email.com", text: $viewModel.email)
                        .textFieldStyle(.roundedBorder)
                        .autocapitalization(.none)
                        .keyboardType(.emailAddress)
                        .disabled(viewModel.isLoading)

                    if !viewModel.email.isEmpty && !viewModel.isEmailValid {
                        Text("Email inválido")
                            .font(.caption)
                            .foregroundColor(.red)
                    }
                }

                // Password field
                VStack(alignment: .leading, spacing: 8) {
                    Text("Contraseña")
                        .font(.subheadline)
                        .foregroundColor(.secondary)

                    SecureField("••••••", text: $viewModel.password)
                        .textFieldStyle(.roundedBorder)
                        .disabled(viewModel.isLoading)

                    if !viewModel.password.isEmpty && !viewModel.isPasswordValid {
                        Text("Mínimo 6 caracteres")
                            .font(.caption)
                            .foregroundColor(.red)
                    }
                }

                // Login button
                Button(action: {
                    Task {
                        await viewModel.login()
                    }
                }) {
                    HStack {
                        if viewModel.isLoading {
                            ProgressView()
                                .progressViewStyle(CircularProgressViewStyle(tint: .white))
                        } else {
                            Text("Iniciar Sesión")
                                .fontWeight(.semibold)
                        }
                    }
                    .frame(maxWidth: .infinity)
                    .frame(height: 52)
                    .background(viewModel.isFormValid ? Color.green : Color.gray)
                    .foregroundColor(.white)
                    .cornerRadius(12)
                }
                .disabled(!viewModel.isFormValid || viewModel.isLoading)

                Spacer()
            }
            .padding(24)
            .navigationTitle("")
            .alert("Error", isPresented: $viewModel.showError) {
                Button("OK") { }
            } message: {
                Text(viewModel.errorMessage)
            }
        }
    }
}

// MARK: - Dashboard View

struct DashboardView: View {
    @StateObject private var viewModel = DashboardViewModel()
    @ObservedObject private var authService = AuthService.shared

    var body: some View {
        NavigationView {
            ScrollView {
                VStack(spacing: 20) {
                    // Header
                    HStack {
                        VStack(alignment: .leading) {
                            Text("Hola, \(authService.currentUser?.nombre ?? "Usuario")")
                                .font(.title2)
                                .fontWeight(.bold)
                            Text("Dashboard Principal")
                                .font(.subheadline)
                                .foregroundColor(.secondary)
                        }
                        Spacer()
                        Button(action: {
                            Task {
                                await authService.logout()
                            }
                        }) {
                            Image(systemName: "rectangle.portrait.and.arrow.right")
                                .font(.title3)
                        }
                    }
                    .padding(.horizontal)

                    // Stats
                    if viewModel.isLoading {
                        ProgressView("Cargando estadísticas...")
                            .padding(.top, 40)
                    } else if let stats = viewModel.stats {
                        LazyVGrid(columns: [
                            GridItem(.flexible()),
                            GridItem(.flexible())
                        ], spacing: 16) {
                            StatCardView(
                                title: "Productores",
                                value: "\(stats.totalProductores)",
                                icon: "person.3.fill",
                                color: .green
                            )

                            StatCardView(
                                title: "Lotes Activos",
                                value: "\(stats.lotesActivos)",
                                icon: "leaf.fill",
                                color: .blue
                            )

                            StatCardView(
                                title: "Bloques",
                                value: "\(stats.bloquesCertificados)",
                                icon: "cube.fill",
                                color: .orange
                            )

                            StatCardView(
                                title: "Estado",
                                value: stats.estadoConexion.rawValue.capitalized,
                                icon: "wifi",
                                color: stats.estadoConexion == .online ? .green : .red
                            )
                        }
                        .padding(.horizontal)
                    }

                    Spacer()
                }
                .padding(.vertical)
            }
            .navigationTitle("AgroBridge")
            .refreshable {
                await viewModel.refresh()
            }
            .alert("Error", isPresented: $viewModel.showError) {
                Button("Reintentar") {
                    Task {
                        await viewModel.loadStats()
                    }
                }
                Button("Cancelar", role: .cancel) { }
            } message: {
                Text(viewModel.errorMessage)
            }
        }
    }
}

// MARK: - Stat Card Component

struct StatCardView: View {
    let title: String
    let value: String
    let icon: String
    let color: Color

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Image(systemName: icon)
                    .font(.title2)
                    .foregroundColor(color)
                Spacer()
            }

            Text(value)
                .font(.system(size: 28, weight: .bold))
                .foregroundColor(.primary)

            Text(title)
                .font(.subheadline)
                .foregroundColor(.secondary)
        }
        .padding()
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color.white)
        .cornerRadius(16)
        .shadow(color: Color.black.opacity(0.05), radius: 8, x: 0, y: 2)
    }
}

// MARK: - Main App View

struct MVVMDemoApp: View {
    @ObservedObject private var authService = AuthService.shared

    var body: some View {
        if authService.isAuthenticated {
            DashboardView()
        } else {
            LoginView()
        }
    }
}

print("✅ Part 5 Complete: Views ready")
print("   - LoginView: reactive to LoginViewModel")
print("   - DashboardView: reactive to DashboardViewModel")
print("   - Auto-navigation based on isAuthenticated")
print("")

/*:
 ---
 ## Part 6: Data Flow Demonstration

 Let's trace a complete login flow through all layers
 */

print("\n" + String(repeating: "=", count: 60))
print("🎬 COMPLETE LOGIN FLOW DEMONSTRATION")
print(String(repeating: "=", count: 60))

print("\n📱 User enters:")
print("   Email: user@agrobridge.com")
print("   Password: secure123")
print("   Taps 'Iniciar Sesión' button")

print("\n📊 Data Flow:")
print("   1. LoginView → LoginViewModel.login()")
print("   2. LoginViewModel validates form")
print("   3. LoginViewModel → AuthService.login()")
print("   4. AuthService → APIClient.request()")
print("   5. APIClient makes HTTP POST to /auth/login")
print("   6. Backend responds with token + user data")
print("   7. APIClient decodes JSON to LoginResponse")
print("   8. AuthService saves token to Keychain")
print("   9. AuthService updates @Published currentUser")
print("   10. LoginViewModel sets isLoading = false")
print("   11. LoginView observes isAuthenticated = true")
print("   12. App auto-navigates to DashboardView")
print("   13. DashboardViewModel.init() triggers loadStats()")
print("   14. DashboardService.fetchStats() → APIClient")
print("   15. Stats displayed in DashboardView")

/*:
 ---
 ## Part 7: Key MVVM Principles
 */

print("\n" + String(repeating: "=", count: 60))
print("📚 KEY MVVM PRINCIPLES")
print(String(repeating: "=", count: 60))

print("\n✅ DO:")
print("   - Views ONLY observe ViewModels (@StateObject, @ObservedObject)")
print("   - ViewModels publish UI state (@Published)")
print("   - ViewModels call Services for business logic")
print("   - Services orchestrate APIClient and manage global state")
print("   - APIClient is generic and reusable")
print("   - Use async/await for all networking")
print("   - Handle errors at ViewModel level")

print("\n❌ DON'T:")
print("   - Views should NOT call Services directly")
print("   - Views should NOT have business logic")
print("   - ViewModels should NOT make HTTP requests directly")
print("   - Services should NOT know about UI")
print("   - Use callbacks/closures (prefer async/await)")

/*:
 ---
 ## Part 8: Interactive Exercises
 */

print("\n" + String(repeating: "=", count: 60))
print("🎯 EXERCISES")
print(String(repeating: "=", count: 60))

print("\n📝 Beginner:")
print("   1. Add a 'Remember Me' toggle to LoginViewModel")
print("   2. Add email formatting helper to String extension")
print("   3. Create a loading skeleton for DashboardView")

print("\n📝 Intermediate:")
print("   4. Implement CreateLoteViewModel with form validation")
print("   5. Add pull-to-refresh to a list view")
print("   6. Implement proper error retry logic")

print("\n📝 Advanced:")
print("   7. Add JWT token refresh logic to APIClient")
print("   8. Implement offline-first caching with Combine")
print("   9. Create a generic ListViewModel<T> base class")

/*:
 ---
 ## Part 9: Live Preview

 See the MVVM architecture in action!
 */

// Set up live preview
PlaygroundPage.current.setLiveView(
    MVVMDemoApp()
        .frame(width: 375, height: 812)
)

print("\n" + String(repeating: "=", count: 60))
print("✅ MVVM ARCHITECTURE PLAYGROUND COMPLETE!")
print(String(repeating: "=", count: 60))
print("\n📘 See the live preview on the right →")
print("📝 Try the exercises above to practice")
print("📚 Review ARCHITECTURE.md for complete documentation")
print("\n**Developed by:** Alejandro Navarro Ayala - CEO & Senior Developer")
print("**For:** AgroBridge iOS Team")
print(String(repeating: "=", count: 60))
