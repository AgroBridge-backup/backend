# 🏗️ AgroBridge iOS - Architecture Documentation

📖 **Reading time:** ~25 minutes

**Version:** 1.0.0
**Last Updated:** November 28, 2024
**Architecture Pattern:** MVVM + Clean Architecture
**UI Framework:** SwiftUI
**Minimum iOS:** 15.0+

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Layer Responsibilities](#layer-responsibilities)
3. [Data Flow](#data-flow)
4. [Project Structure](#project-structure)
5. [Dependency Graph](#dependency-graph)
6. [Design Patterns Used](#design-patterns-used)
7. [Thread Safety](#thread-safety)
8. [Error Handling Strategy](#error-handling-strategy)
9. [Testing Strategy](#testing-strategy)
10. [Performance Considerations](#performance-considerations)
11. [Security Best Practices](#security-best-practices)

---

## Architecture Overview

AgroBridge iOS follows a **MVVM (Model-View-ViewModel) + Clean Architecture** pattern, ensuring:
- Clear separation of concerns
- Testability (ViewModels and Services are testable)
- Scalability (easy to add new features)
- Maintainability (single responsibility principle)

### Architecture Diagram

```
┌─────────────────────────────────────────────────────────┐
│                    PRESENTATION LAYER                    │
│                                                           │
│  ┌─────────────────┐         ┌──────────────────┐      │
│  │     VIEWS       │         │   VIEWMODELS     │      │
│  │   (SwiftUI)     │◄────────┤  (ObservableObject)│    │
│  │                 │  @Published  │              │      │
│  │ - LoginView     │         │ - LoginViewModel │      │
│  │ - DashboardView │         │ - DashboardVM    │      │
│  │ - CreateLoteView│         │ - CreateLoteVM   │      │
│  └─────────────────┘         └────────┬─────────┘      │
│                                       │                  │
└───────────────────────────────────────┼──────────────────┘
                                        │ Calls
                                        ▼
┌─────────────────────────────────────────────────────────┐
│                     BUSINESS LAYER                       │
│                                                           │
│  ┌────────────────────────────────────────────────┐     │
│  │              SERVICES (Use Cases)               │     │
│  │                                                  │     │
│  │  - AuthService (login, logout, refresh)        │     │
│  │  - LoteService (CRUD operations)               │     │
│  │  - DashboardService (fetch stats)              │     │
│  │  - ProductorService (CRUD operations)          │     │
│  └──────────────────────┬───────────────────────────┘   │
│                         │ Uses                           │
└─────────────────────────┼────────────────────────────────┘
                          ▼
┌─────────────────────────────────────────────────────────┐
│                      DATA LAYER                          │
│                                                           │
│  ┌────────────────┐      ┌─────────────────┐           │
│  │   APIClient    │      │  KeychainManager │           │
│  │                │      │                   │           │
│  │ - request()    │      │ - save()         │           │
│  │ - Generic      │      │ - retrieve()     │           │
│  │ - Async/Await  │      │ - delete()       │           │
│  └────────┬───────┘      └──────────────────┘           │
│           │                                               │
│           │ HTTP/JSON                                     │
└───────────┼───────────────────────────────────────────────┘
            ▼
    ┌──────────────┐
    │   BACKEND    │
    │  REST API    │
    │ AgroBridge   │
    └──────────────┘
```

---

## Layer Responsibilities

### 1. Presentation Layer (Views + ViewModels)

#### Views (SwiftUI)
**Responsibility:** Declarative UI, no business logic

**Rules:**
- ✅ Display data from ViewModels
- ✅ Handle user interactions
- ✅ Trigger ViewModel methods
- ❌ NO direct Service/API calls
- ❌ NO business logic
- ❌ NO data transformation

**Example:**
```swift
struct LoginView: View {
    @StateObject private var viewModel = LoginViewModel()

    var body: some View {
        VStack {
            CustomTextField(
                placeholder: "Email",
                text: $viewModel.email
            )

            CustomButton(
                title: "Iniciar Sesión",
                isLoading: viewModel.isLoading
            ) {
                Task {
                    await viewModel.login()  // ✅ Trigger ViewModel
                }
            }
        }
    }
}
```

#### ViewModels (ObservableObject)
**Responsibility:** Presentation logic, UI state management

**Rules:**
- ✅ Validate user input
- ✅ Transform data for UI display
- ✅ Manage loading/error states
- ✅ Call Services
- ❌ NO direct API calls
- ❌ NO UIKit dependencies
- ❌ NO knowledge of View structure

**Properties:**
- `@Published` for UI-observable state
- Private services injected via initializer or singleton
- Loading, error, success states

**Example:**
```swift
@MainActor
class LoginViewModel: ObservableObject {
    // MARK: - Published State
    @Published var email = ""
    @Published var password = ""
    @Published var isLoading = false
    @Published var showError = false
    @Published var errorMessage: String?

    // MARK: - Dependencies
    private let authService: AuthService

    init(authService: AuthService = .shared) {
        self.authService = authService
    }

    // MARK: - Computed Properties
    var isFormValid: Bool {
        email.isValidEmail && password.count >= 6
    }

    // MARK: - Actions
    func login() async {
        isLoading = true

        do {
            try await authService.login(
                email: email,
                password: password
            )
            // Service handles state change
        } catch {
            errorMessage = (error as? NetworkError)?.errorDescription
            showError = true
        }

        isLoading = false
    }
}
```

---

### 2. Business Layer (Services)

**Responsibility:** Business logic, use case orchestration

**Rules:**
- ✅ Implement business rules
- ✅ Orchestrate API calls via APIClient
- ✅ Handle authentication state
- ✅ Cache if needed
- ❌ NO UI code
- ❌ NO SwiftUI dependencies

**Patterns Used:**
- Singleton for shared state (AuthService, APIClient)
- Async/await for all operations
- Error propagation (throws)

**Example:**
```swift
@MainActor
class AuthService: ObservableObject {
    // MARK: - Published State
    @Published var isAuthenticated = false
    @Published var currentUser: User?

    // MARK: - Singleton
    static let shared = AuthService()

    // MARK: - Dependencies
    private let apiClient = APIClient.shared
    private let keychain = KeychainManager.shared

    private init() {
        checkExistingSession()
    }

    // MARK: - Public Methods
    func login(email: String, password: String) async throws {
        let request = LoginRequest(email: email, password: password)

        let response: LoginResponse = try await apiClient.request(
            endpoint: .login,
            method: .POST,
            body: request
        )

        // Save token
        try keychain.save(response.token, for: .authToken)

        // Update state
        currentUser = response.user
        isAuthenticated = true
    }

    func logout() async {
        // Clear token
        try? keychain.delete(for: .authToken)

        // Clear state
        currentUser = nil
        isAuthenticated = false

        // Notify backend (fire-and-forget)
        try? await apiClient.requestWithoutResponse(
            endpoint: .logout,
            method: .POST
        )
    }

    private func checkExistingSession() {
        if let token = try? keychain.retrieve(for: .authToken),
           !token.isEmpty {
            isAuthenticated = true
            // Could fetch current user here
        }
    }
}
```

---

### 3. Data Layer (Networking + Persistence)

#### APIClient (Networking)
**Responsibility:** HTTP communication, JSON encoding/decoding

**Features:**
- ✅ Generic request method with Codable
- ✅ Automatic JWT injection
- ✅ Error handling with NetworkError
- ✅ Async/await (no callbacks)
- ✅ Request/response logging (DEBUG)

**Example:**
```swift
class APIClient {
    static let shared = APIClient()

    func request<T: Decodable>(
        endpoint: Endpoint,
        method: HTTPMethod,
        body: Encodable? = nil,
        headers: [String: String]? = nil
    ) async throws -> T {
        // 1. Build URL
        guard let url = endpoint.url else {
            throw NetworkError.invalidURL
        }

        // 2. Build request
        var request = URLRequest(url: url)
        request.httpMethod = method.rawValue
        request.timeoutInterval = 30

        // 3. Add headers
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")

        // 4. Inject JWT if authenticated
        if let token = try? KeychainManager.shared.retrieve(for: .authToken) {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }

        // 5. Encode body if present
        if let body = body {
            let encoder = JSONEncoder()
            encoder.dateEncodingStrategy = .iso8601
            request.httpBody = try encoder.encode(body)
        }

        // 6. Execute request
        let (data, response) = try await URLSession.shared.data(for: request)

        // 7. Validate response
        guard let httpResponse = response as? HTTPURLResponse else {
            throw NetworkError.invalidResponse
        }

        // 8. Handle errors
        switch httpResponse.statusCode {
        case 200...299:
            break
        case 401:
            // Auto-logout on unauthorized
            await AuthService.shared.logout()
            throw NetworkError.unauthorized
        case 404:
            throw NetworkError.notFound
        case 500...599:
            throw NetworkError.serverError(statusCode: httpResponse.statusCode)
        default:
            throw NetworkError.unknown(NSError(domain: "", code: httpResponse.statusCode))
        }

        // 9. Decode response
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601

        do {
            let decoded = try decoder.decode(T.self, from: data)
            return decoded
        } catch {
            throw NetworkError.decodingError(error)
        }
    }
}
```

#### KeychainManager (Secure Storage)
**Responsibility:** Secure token storage

**Methods:**
- `save(_:for:)` - Save string to Keychain
- `retrieve(for:)` - Retrieve string from Keychain
- `delete(for:)` - Delete from Keychain

**Example:**
```swift
class KeychainManager {
    static let shared = KeychainManager()

    enum KeychainKey: String {
        case authToken = "com.agrobridge.authToken"
        case refreshToken = "com.agrobridge.refreshToken"
    }

    func save(_ value: String, for key: KeychainKey) throws {
        let data = value.data(using: .utf8)!

        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrAccount as String: key.rawValue,
            kSecValueData as String: data
        ]

        // Delete existing
        SecItemDelete(query as CFDictionary)

        // Add new
        let status = SecItemAdd(query as CFDictionary, nil)

        guard status == errSecSuccess else {
            throw KeychainError.saveFailed
        }
    }

    func retrieve(for key: KeychainKey) throws -> String {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrAccount as String: key.rawValue,
            kSecReturnData as String: true
        ]

        var result: AnyObject?
        let status = SecItemCopyMatching(query as CFDictionary, &result)

        guard status == errSecSuccess,
              let data = result as? Data,
              let string = String(data: data, encoding: .utf8) else {
            throw KeychainError.retrieveFailed
        }

        return string
    }
}
```

---

## Data Flow

### Example: User Login Flow

```
1. USER TAPS "Iniciar Sesión"
   ↓
2. LoginView calls viewModel.login()
   ↓
3. LoginViewModel:
   - Sets isLoading = true
   - Validates form
   - Calls authService.login(email, password)
   ↓
4. AuthService:
   - Creates LoginRequest
   - Calls apiClient.request()
   ↓
5. APIClient:
   - Builds URLRequest
   - Adds headers (Content-Type)
   - Encodes body to JSON
   - Executes URLSession.data(for:)
   - Receives HTTP response
   - Validates status code (200-299)
   - Decodes JSON to LoginResponse
   - Returns LoginResponse
   ↓
6. AuthService (continued):
   - Saves token to Keychain
   - Sets currentUser
   - Sets isAuthenticated = true
   ↓
7. LoginViewModel (continued):
   - Sets isLoading = false
   ↓
8. LoginView:
   - Observes isAuthenticated change
   - SwiftUI re-renders
   - AgroBridgeApp shows DashboardView (TabView)
```

### Example: Fetch Dashboard Stats

```
1. DashboardView appears
   ↓
2. .task { await viewModel.loadStats() }
   ↓
3. DashboardViewModel:
   - Sets isLoading = true
   - Calls dashboardService.fetchStats()
   ↓
4. DashboardService:
   - Calls apiClient.request(endpoint: .dashboardStats)
   ↓
5. APIClient:
   - Builds GET request to /dashboard/stats
   - Injects JWT from Keychain (Authorization: Bearer {token})
   - Executes request
   - Decodes DashboardStats
   - Returns DashboardStats
   ↓
6. DashboardService:
   - Returns stats
   ↓
7. DashboardViewModel:
   - Sets stats = result
   - Sets isLoading = false
   ↓
8. DashboardView:
   - SwiftUI re-renders
   - Shows 4 StatCards with data
```

---

## Project Structure

```
AgroBridge/
│
├── App/
│   └── AgroBridgeApp.swift                 # Entry point, TabView, @EnvironmentObject
│
├── Configuration/
│   └── AppConfiguration.swift              # Environment, URLs, feature flags
│
├── Core/
│   ├── Design/
│   │   └── AgroBridgeDesignSystem.swift   # Colors, fonts, spacing, shadows, animations
│   │
│   ├── Networking/
│   │   ├── APIClient.swift                 # Generic HTTP client
│   │   ├── Endpoint.swift                  # API endpoint definitions
│   │   ├── HTTPMethod.swift                # GET, POST, PUT, PATCH, DELETE
│   │   └── NetworkError.swift              # Error types
│   │
│   ├── Persistence/
│   │   └── KeychainManager.swift           # Secure storage
│   │
│   └── Extensions/
│       ├── Color+Extensions.swift          # Legacy color aliases
│       ├── Date+Extensions.swift           # Date formatters
│       └── String+Extensions.swift         # Email validation, trim
│
├── Models/
│   ├── User.swift                          # User, LoginRequest, LoginResponse
│   ├── Lote.swift                          # Lote, CreateLoteRequest
│   ├── Productor.swift                     # Productor, ProductorEstado
│   ├── DashboardStats.swift                # DashboardStats, EstadoConexion
│   └── ...
│
├── Services/
│   ├── AuthService.swift                   # Login, logout, session
│   ├── LoteService.swift                   # CRUD lotes
│   ├── ProductorService.swift              # CRUD productores
│   ├── DashboardService.swift              # Fetch stats
│   └── ...
│
├── ViewModels/
│   ├── LoginViewModel.swift                # Login form logic
│   ├── DashboardViewModel.swift            # Dashboard state
│   ├── CreateLoteViewModel.swift           # Create lote form
│   ├── LotesListViewModel.swift            # Lotes list
│   └── ...
│
└── Views/
    ├── Auth/
    │   └── LoginView.swift                 # Login screen
    │
    ├── Dashboard/
    │   └── DashboardView.swift             # Main dashboard
    │
    ├── Lote/
    │   ├── LotesListView.swift             # List of lotes
    │   ├── LoteDetailView.swift            # Lote details
    │   ├── CreateLoteView.swift            # Create lote form
    │   └── EditLoteView.swift              # Edit lote form
    │
    ├── Productor/
    │   ├── ProductoresListView.swift       # List of productores
    │   └── ...
    │
    └── Components/
        ├── StatCard.swift                  # Dashboard stat card
        ├── CustomButton.swift              # Reusable button
        ├── CustomTextField.swift           # Reusable text field
        ├── SkeletonLoader.swift            # Loading skeletons
        └── LoadingView.swift               # Loading spinner
```

---

## Dependency Graph

```
Views
  └─→ ViewModels
        └─→ Services
              ├─→ APIClient
              │     └─→ Endpoint
              │           └─→ HTTPMethod
              │
              └─→ KeychainManager

Core/Design (AgroBridgeDesignSystem)
  ↑ Used by ALL Views and Components
```

**Dependency Rules:**
1. Views depend on ViewModels (via @StateObject)
2. ViewModels depend on Services
3. Services depend on APIClient/KeychainManager
4. APIClient depends on Endpoint, HTTPMethod
5. Everyone can use Core/Design

**No Circular Dependencies:**
- Services NEVER import ViewModels
- APIClient NEVER imports Services
- Models are pure structs (no dependencies)

---

## Design Patterns Used

### 1. MVVM (Model-View-ViewModel)
- **View:** SwiftUI declarative UI
- **ViewModel:** ObservableObject with @Published
- **Model:** Codable structs

### 2. Singleton
- `APIClient.shared`
- `AuthService.shared`
- `KeychainManager.shared`

**Why:** Shared state (isAuthenticated, current user)

### 3. Dependency Injection
- ViewModels inject Services via initializer
- Services inject APIClient (or use singleton)

**Example:**
```swift
class LoginViewModel: ObservableObject {
    private let authService: AuthService

    init(authService: AuthService = .shared) {
        self.authService = authService
    }
}
```

### 4. Repository Pattern (implicit)
- Services act as repositories
- Abstract data sources (API vs local cache)

### 5. Observer Pattern
- SwiftUI's @Published + @StateObject
- Automatic UI updates on state change

### 6. Factory Pattern
- Endpoint enum creates URLs
- ButtonStyle enum creates button configs

### 7. Strategy Pattern
- NetworkError handles different error types
- AnimationPreset provides different animations

---

## Thread Safety

### @MainActor Usage

All ViewModels and Services that publish UI state use `@MainActor`:

```swift
@MainActor
class DashboardViewModel: ObservableObject {
    @Published var stats: DashboardStats?

    func loadStats() async {
        // Already on main thread
        stats = try? await service.fetchStats()
    }
}
```

**Why:** SwiftUI requires UI updates on main thread

### Async/Await
- All network calls use async/await (not callbacks)
- Cleaner error handling with try/catch
- Structured concurrency

---

## Error Handling Strategy

### 1. NetworkError (typed errors)
```swift
enum NetworkError: Error {
    case invalidURL
    case unauthorized        // 401
    case notFound           // 404
    case serverError(Int)   // 500+
    case decodingError(Error)
}

extension NetworkError: LocalizedError {
    var errorDescription: String? {
        switch self {
        case .unauthorized:
            return "Tu sesión ha expirado"
        case .notFound:
            return "Recurso no encontrado"
        // ...
        }
    }
}
```

### 2. ViewModel Error Handling
```swift
func login() async {
    do {
        try await authService.login(...)
    } catch let error as NetworkError {
        errorMessage = error.errorDescription
        showError = true
    } catch {
        errorMessage = MicroCopy.errorGeneric
        showError = true
    }
}
```

### 3. View Error Display
```swift
.alert("Error", isPresented: $viewModel.showError) {
    Button("OK", role: .cancel) {}
} message: {
    Text(viewModel.errorMessage ?? MicroCopy.errorGeneric)
}
```

---

## Testing Strategy

### Unit Tests (ViewModels)
```swift
@MainActor
class LoginViewModelTests: XCTestCase {
    var sut: LoginViewModel!
    var mockAuthService: MockAuthService!

    override func setUp() {
        mockAuthService = MockAuthService()
        sut = LoginViewModel(authService: mockAuthService)
    }

    func testLoginSuccess() async {
        // Given
        sut.email = "test@example.com"
        sut.password = "password123"

        // When
        await sut.login()

        // Then
        XCTAssertTrue(mockAuthService.loginCalled)
        XCTAssertFalse(sut.showError)
    }
}
```

### Integration Tests (Services)
```swift
class AuthServiceTests: XCTestCase {
    func testLoginWithValidCredentials() async throws {
        // Given
        let service = AuthService()

        // When
        try await service.login(email: "test@example.com", password: "test")

        // Then
        XCTAssertTrue(service.isAuthenticated)
        XCTAssertNotNil(service.currentUser)
    }
}
```

---

## Performance Considerations

### 1. Lazy Loading
- Use `LazyVStack` and `LazyVGrid` for lists
- Skeleton loading while data fetches

### 2. Image Caching
- Use AsyncImage with caching (future)
- Resize images before display

### 3. Request Debouncing
- Search bars should debounce (0.5s delay)
- Avoid excessive API calls

### 4. Pagination
- Implement cursor-based pagination for lists
- Load 20-50 items per page

---

## Security Best Practices

### 1. Token Storage
- ✅ JWT in Keychain (not UserDefaults)
- ✅ Secure enclave if available

### 2. Network Communication
- ✅ HTTPS only (App Transport Security)
- ✅ Certificate pinning (future)

### 3. Input Validation
- ✅ Client-side validation (email, password length)
- ✅ Server-side validation (never trust client)

### 4. Error Messages
- ✅ Generic errors to users (no stack traces)
- ✅ Detailed logs in DEBUG only

---

## Conclusion

AgroBridge iOS follows industry-standard architecture patterns, ensuring:
- **Scalability:** Easy to add new features
- **Testability:** ViewModels and Services are unit-testable
- **Maintainability:** Clear separation of concerns
- **Performance:** Async/await, lazy loading
- **Security:** Keychain, HTTPS, input validation

This architecture supports the app from MVP to enterprise scale.

---

**Document Version:** 1.0.0
**Author:** Alejandro Navarro Ayala - CEO & Senior Developer
**Last Updated:** November 28, 2024
**Status:** Production Ready
