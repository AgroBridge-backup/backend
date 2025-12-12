# 👨‍💻 AgroBridge iOS - Development Guide

📖 **Reading time:** ~30 minutes

**Version:** 1.0.0
**Target:** iOS 15.0+
**Language:** Swift 5.9+
**Framework:** SwiftUI

---

## Table of Contents

1. [Getting Started](#getting-started)
2. [Project Setup](#project-setup)
3. [Code Style Guide](#code-style-guide)
4. [SwiftUI Best Practices](#swiftui-best-practices)
5. [MVVM Patterns](#mvvm-patterns)
6. [Common Tasks](#common-tasks)
7. [Debugging Tips](#debugging-tips)
8. [Performance Optimization](#performance-optimization)
9. [Git Workflow](#git-workflow)
10. [Code Review Checklist](#code-review-checklist)

---

## Getting Started

### Prerequisites

- **macOS:** Ventura (13.0) or later
- **Xcode:** 15.0 or later
- **Swift:** 5.9+
- **iOS Deployment Target:** 15.0+
- **CocoaPods/SPM:** Not required (no external dependencies)

---

### Project Structure Tour

```
AgroBridge/
│
├── App/
│   └── AgroBridgeApp.swift          # 🚪 Entry point
│
├── Core/
│   ├── Design/                      # 🎨 Design system
│   ├── Networking/                  # 🌐 API client
│   ├── Persistence/                 # 💾 Keychain
│   └── Extensions/                  # 🔧 Utilities
│
├── Models/                          # 📦 Data models
├── Services/                        # 💼 Business logic
├── ViewModels/                      # 🎭 Presentation logic
└── Views/                           # 👁️ UI components
    ├── Auth/
    ├── Dashboard/
    ├── Lote/
    ├── Productor/
    ├── Profile/
    └── Components/                  # 🧩 Reusable UI
```

---

## Project Setup

### 1. Clone Repository

```bash
git clone https://github.com/agrobridge/agrobridge-ios.git
cd agrobridge-ios
```

---

### 2. Open in Xcode

```bash
open AgroBridge.xcodeproj
```

---

### 3. Select Target

- Target: **AgroBridge**
- Scheme: **AgroBridge**
- Simulator: **iPhone 15 Pro** (or any iOS 15+ device)

---

### 4. Build & Run

```
Cmd + R  (or Product → Run)
```

**Expected:** App launches to LoginView with animated gradient.

---

### 5. Environment Configuration

Edit `Configuration/AppConfiguration.swift`:

```swift
enum Environment {
    case development
    case staging
    case production

    static let current: Environment = .development  // ← Change here
}
```

**URLs:**
- Development: `http://localhost:3000/v1`
- Staging: `https://staging-api.agrobridge.io/v1`
- Production: `https://api.agrobridge.io/v1`

---

## Code Style Guide

### Naming Conventions

#### Files
```swift
// PascalCase
LoginView.swift
DashboardViewModel.swift
AuthService.swift
```

#### Types (Classes, Structs, Enums)
```swift
// PascalCase
class APIClient { }
struct User { }
enum NetworkError { }
```

#### Properties & Functions
```swift
// camelCase
var isLoading = false
func fetchStats() async { }
```

#### Constants
```swift
// camelCase (not SCREAMING_SNAKE)
static let maxRetries = 3
let defaultTimeout: TimeInterval = 30
```

#### Enum Cases
```swift
enum UserRole {
    case admin          // camelCase
    case productor
    case inspector
}
```

---

### Comments

**Always in Spanish:**

```swift
// ✅ CORRECT
/// Servicio de autenticación con JWT
class AuthService {
    // Solicitud de login al backend
    func login() async throws { }
}

// ❌ INCORRECT
/// Authentication service with JWT
class AuthService {
    // Login request to backend
    func login() async throws { }
}
```

**Use MARK:**

```swift
class DashboardViewModel: ObservableObject {
    // MARK: - Properties
    @Published var stats: DashboardStats?
    @Published var isLoading = false

    // MARK: - Dependencies
    private let service = DashboardService.shared

    // MARK: - Initialization
    init() { }

    // MARK: - Public Methods
    func loadStats() async { }

    // MARK: - Private Methods
    private func handleError() { }
}
```

---

### Imports

**Order:**
1. Foundation/UIKit/SwiftUI (system)
2. Third-party frameworks
3. Internal modules

```swift
import SwiftUI
import Combine

// (no third-party)

// (no internal modules)
```

---

### Line Length

**Maximum:** 120 characters (soft limit)

```swift
// ✅ GOOD
let user = User(
    id: "123",
    nombre: "Juan",
    email: "juan@example.com"
)

// ❌ BAD (too long)
let user = User(id: "123", nombre: "Juan Pérez García", email: "juan.perez@example.com", rol: .admin, fechaRegistro: Date())
```

---

### Spacing

```swift
// ✅ CORRECT spacing
func login(email: String, password: String) async throws {
    let request = LoginRequest(email: email, password: password)

    let response: LoginResponse = try await apiClient.request(
        endpoint: .login,
        method: .POST,
        body: request
    )

    return response
}

// ❌ INCORRECT (inconsistent spacing)
func login(email:String,password:String)async throws{
    let request=LoginRequest(email:email,password:password)
    let response:LoginResponse=try await apiClient.request(endpoint:.login,method:.POST,body:request)
    return response
}
```

---

## SwiftUI Best Practices

### 1. Extract Subviews

✅ **DO:**
```swift
struct DashboardView: View {
    var body: some View {
        VStack {
            headerView
            statsGrid
            quickActions
        }
    }

    private var headerView: some View {
        VStack {
            Text("Dashboard")
        }
    }

    private var statsGrid: some View {
        LazyVGrid(...) { }
    }
}
```

❌ **DON'T:**
```swift
struct DashboardView: View {
    var body: some View {
        VStack {
            // 100+ lines of nested views
            VStack {
                HStack {
                    VStack {
                        // ...
                    }
                }
            }
        }
    }
}
```

**Rule:** If `body` exceeds 50 lines, extract subviews.

---

### 2. Use @StateObject for ViewModels

✅ **DO:**
```swift
struct LoginView: View {
    @StateObject private var viewModel = LoginViewModel()
}
```

❌ **DON'T:**
```swift
struct LoginView: View {
    @ObservedObject var viewModel = LoginViewModel()  // ❌ Recreates on every render
}
```

**Rule:**
- `@StateObject`: When View **owns** the ViewModel
- `@ObservedObject`: When View **receives** the ViewModel from parent

---

### 3. Prefer @Binding Over Closures

✅ **DO:**
```swift
struct CustomTextField: View {
    @Binding var text: String  // Two-way binding
}

// Usage
CustomTextField(text: $viewModel.email)
```

❌ **DON'T:**
```swift
struct CustomTextField: View {
    let text: String
    let onChange: (String) -> Void
}

// Usage
CustomTextField(
    text: viewModel.email,
    onChange: { viewModel.email = $0 }
)
```

---

### 4. Use Task for Async Work

✅ **DO:**
```swift
.task {
    await viewModel.loadStats()
}

.onAppear {
    Task {
        await viewModel.loadStats()
    }
}
```

❌ **DON'T:**
```swift
.onAppear {
    viewModel.loadStats()  // ❌ Compiler error: async in sync context
}
```

---

### 5. Prefer @Published Over Manual Updates

✅ **DO:**
```swift
class ViewModel: ObservableObject {
    @Published var stats: DashboardStats?

    func loadStats() async {
        stats = try? await service.fetch()  // Auto-updates UI
    }
}
```

❌ **DON'T:**
```swift
class ViewModel: ObservableObject {
    var stats: DashboardStats?

    func loadStats() async {
        stats = try? await service.fetch()
        objectWillChange.send()  // Manual notification
    }
}
```

---

## MVVM Patterns

### ViewModel Template

```swift
import SwiftUI

// MARK: - ViewName + ViewModel
@MainActor
class FeatureViewModel: ObservableObject {
    // MARK: - Published State (UI observes these)
    @Published var data: [Item] = []
    @Published var isLoading = false
    @Published var showError = false
    @Published var errorMessage: String?

    // Form fields (if applicable)
    @Published var textField = ""
    @Published var selectedOption: Option?

    // MARK: - Dependencies
    private let service: FeatureService

    // MARK: - Initialization
    init(service: FeatureService = .shared) {
        self.service = service
    }

    // MARK: - Computed Properties
    var isFormValid: Bool {
        !textField.isEmpty && selectedOption != nil
    }

    // MARK: - Public Actions
    func loadData() async {
        isLoading = true

        do {
            data = try await service.fetchData()
        } catch let error as NetworkError {
            errorMessage = error.errorDescription
            showError = true
        } catch {
            errorMessage = MicroCopy.errorGeneric
            showError = true
        }

        isLoading = false
    }

    func submit() async -> Bool {
        guard isFormValid else { return false }

        do {
            try await service.submitData(textField)
            return true
        } catch {
            errorMessage = MicroCopy.errorGeneric
            showError = true
            return false
        }
    }

    // MARK: - Private Helpers
    private func validateInput() -> Bool {
        // Validation logic
        return true
    }
}
```

---

### View Integration

```swift
struct FeatureView: View {
    @StateObject private var viewModel = FeatureViewModel()
    @Environment(\.dismiss) var dismiss

    var body: some View {
        ZStack {
            Color.backgroundPrimary.ignoresSafeArea()

            if viewModel.isLoading && viewModel.data.isEmpty {
                SkeletonLoadingView(type: .list)
            } else {
                contentView
            }
        }
        .task {
            await viewModel.loadData()
        }
        .alert("Error", isPresented: $viewModel.showError) {
            Button("OK") {}
        } message: {
            Text(viewModel.errorMessage ?? MicroCopy.errorGeneric)
        }
    }

    private var contentView: some View {
        ScrollView {
            LazyVStack(spacing: Spacing.md) {
                ForEach(viewModel.data) { item in
                    ItemRow(item: item)
                }
            }
        }
        .refreshable {
            await viewModel.loadData()
        }
    }
}
```

---

## Common Tasks

### Add New Feature (Complete Workflow)

#### 1. Create Model

```swift
// Models/Feature.swift
struct Feature: Codable, Identifiable {
    let id: String
    let nombre: String
    let descripcion: String?
    let fechaCreacion: Date?
}

struct CreateFeatureRequest: Codable {
    let nombre: String
    let descripcion: String?
}
```

---

#### 2. Add Endpoint

```swift
// Core/Networking/Endpoint.swift
enum Endpoint {
    // ... existing cases

    // Features
    case features
    case feature(id: String)
    case createFeature
    case updateFeature(id: String)
    case deleteFeature(id: String)

    var url: URL? {
        // ... existing code

        // Features
        case .features, .createFeature:
            path = "/features"
        case .feature(let id), .updateFeature(let id), .deleteFeature(let id):
            path = "/features/\(id)"
    }
}
```

---

#### 3. Create Service

```swift
// Services/FeatureService.swift
@MainActor
class FeatureService: ObservableObject {
    static let shared = FeatureService()
    private let apiClient = APIClient.shared

    func fetchFeatures() async throws -> [Feature] {
        struct Response: Codable {
            let features: [Feature]
        }

        let response: Response = try await apiClient.request(
            endpoint: .features,
            method: .GET
        )

        return response.features
    }

    func createFeature(_ request: CreateFeatureRequest) async throws -> Feature {
        return try await apiClient.request(
            endpoint: .createFeature,
            method: .POST,
            body: request
        )
    }
}
```

---

#### 4. Create ViewModel

```swift
// ViewModels/FeaturesListViewModel.swift
@MainActor
class FeaturesListViewModel: ObservableObject {
    @Published var features: [Feature] = []
    @Published var isLoading = false
    @Published var showError = false
    @Published var errorMessage: String?

    private let service = FeatureService.shared

    func loadFeatures() async {
        isLoading = true

        do {
            features = try await service.fetchFeatures()
        } catch let error as NetworkError {
            errorMessage = error.errorDescription
            showError = true
        } catch {
            errorMessage = MicroCopy.errorGeneric
            showError = true
        }

        isLoading = false
    }
}
```

---

#### 5. Create View

```swift
// Views/Feature/FeaturesListView.swift
struct FeaturesListView: View {
    @StateObject private var viewModel = FeaturesListViewModel()

    var body: some View {
        NavigationView {
            ZStack {
                Color.backgroundPrimary.ignoresSafeArea()

                if viewModel.isLoading && viewModel.features.isEmpty {
                    SkeletonLoadingView(type: .list)
                } else {
                    featuresList
                }
            }
            .navigationTitle("Features")
            .task {
                await viewModel.loadFeatures()
            }
        }
    }

    private var featuresList: some View {
        ScrollView {
            LazyVStack(spacing: Spacing.md) {
                ForEach(viewModel.features) { feature in
                    FeatureRow(feature: feature)
                }
            }
            .padding(Spacing.lg)
        }
    }
}

struct FeatureRow: View {
    let feature: Feature

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.xs) {
            Text(feature.nombre)
                .font(.displaySmall)
                .foregroundColor(.textPrimary)

            if let descripcion = feature.descripcion {
                Text(descripcion)
                    .font(.bodyMedium)
                    .foregroundColor(.textSecondary)
            }
        }
        .padding(Spacing.md)
        .background(Color.backgroundSecondary)
        .cornerRadius(CornerRadius.medium)
        .shadow(ShadowStyle.soft)
    }
}
```

---

### Add API Call to Existing Feature

```swift
// 1. Add endpoint
case .featureStats(let id):
    path = "/features/\(id)/stats"

// 2. Add to Service
func fetchFeatureStats(id: String) async throws -> FeatureStats {
    return try await apiClient.request(
        endpoint: .featureStats(id: id),
        method: .GET
    )
}

// 3. Add to ViewModel
@Published var stats: FeatureStats?

func loadStats(id: String) async {
    do {
        stats = try await service.fetchFeatureStats(id: id)
    } catch {
        // Handle error
    }
}

// 4. Update View
if let stats = viewModel.stats {
    StatsView(stats: stats)
}
```

---

## Debugging Tips

### 1. Print Debugging

```swift
// In APIClient
#if DEBUG
print("📤 \(method.rawValue) \(url)")
print("📦 Body: \(body)")
print("📥 Status: \(httpResponse.statusCode)")
print("✅ Decoded: \(T.self)")
#endif
```

---

### 2. Xcode Breakpoints

**Set breakpoint:**
- Click line number in Xcode
- Run with `Cmd + R`
- When hit, inspect variables in Debug Area

**Conditional breakpoint:**
- Right-click breakpoint → Edit Breakpoint
- Condition: `errorMessage != nil`

---

### 3. View Hierarchy Inspector

```
Debug → View Debugging → Capture View Hierarchy
```

Shows 3D view of UI layers.

---

### 4. Memory Graph

```
Debug → Memory Graph
```

Detect retain cycles (memory leaks).

---

## Performance Optimization

### 1. Use LazyVStack/LazyVGrid

✅ **DO:**
```swift
LazyVStack {
    ForEach(items) { item in
        ItemRow(item: item)
    }
}
```

❌ **DON'T:**
```swift
VStack {
    ForEach(items) { item in  // ❌ Renders ALL items immediately
        ItemRow(item: item)
    }
}
```

---

### 2. Avoid Heavy Computations in body

✅ **DO:**
```swift
@State private var processedData: [Item] = []

var body: some View {
    List(processedData) { }
}

.task {
    processedData = heavyComputation(rawData)
}
```

❌ **DON'T:**
```swift
var body: some View {
    List(heavyComputation(rawData)) { }  // ❌ Runs on EVERY render
}
```

---

### 3. Profile with Instruments

```
Product → Profile (Cmd + I)
```

**Templates:**
- **Time Profiler:** Find slow functions
- **Allocations:** Memory usage
- **Leaks:** Memory leaks

---

## Git Workflow

### Branch Naming

```
feature/dashboard-stats
bugfix/login-crash
hotfix/api-timeout
refactor/clean-viewmodels
```

---

### Commit Messages

**Format:**
```
<type>(<scope>): <subject>

[optional body]
```

**Types:**
- `feat`: New feature
- `fix`: Bug fix
- `refactor`: Code refactoring
- `docs`: Documentation
- `style`: Formatting, whitespace
- `test`: Tests
- `chore`: Build, dependencies

**Examples:**
```
feat(dashboard): add skeleton loading

fix(login): resolve keyboard dismiss issue

refactor(networking): extract error handling

docs(api): document authentication flow
```

---

### Pull Request Checklist

Before submitting PR:

- [ ] Code compiles without warnings
- [ ] No force unwraps (`!`) added
- [ ] All new code uses Design System
- [ ] ViewModels tested (if applicable)
- [ ] Accessibility labels added
- [ ] Comments in Spanish
- [ ] MARK: sections added
- [ ] No hardcoded strings (use MicroCopy)
- [ ] Screenshots attached (UI changes)

---

## Code Review Checklist

### Architecture

- [ ] ViewModels don't import UIKit/SwiftUI
- [ ] Services don't know about Views
- [ ] APIClient used correctly (no direct URLSession in Services)

### Code Quality

- [ ] No force unwraps (`!`) unless absolutely safe
- [ ] Optional chaining (`?.`) used appropriately
- [ ] Guard statements for early returns
- [ ] Async/await used (no callbacks)

### UI/UX

- [ ] Design system tokens used (colors, fonts, spacing)
- [ ] Haptic feedback on interactions
- [ ] Animations smooth (AnimationPreset)
- [ ] Loading states with SkeletonLoader
- [ ] Error messages user-friendly (MicroCopy)

### Accessibility

- [ ] `.accessibilityLabel()` on important elements
- [ ] `.accessibilityHint()` for actions
- [ ] `.accessibilityTraits()` set correctly
- [ ] VoiceOver tested

### Performance

- [ ] LazyVStack/LazyVGrid for long lists
- [ ] Heavy computations outside body
- [ ] No memory leaks (checked with Instruments)

### Testing

- [ ] ViewModels unit tested
- [ ] Edge cases covered
- [ ] Error paths tested

---

## Quick Reference

### Common Shortcuts

| Action | Shortcut |
|--------|----------|
| Build | Cmd + B |
| Run | Cmd + R |
| Stop | Cmd + . |
| Clean Build Folder | Cmd + Shift + K |
| Open Quickly | Cmd + Shift + O |
| Jump to Definition | Cmd + Click |
| Find in Project | Cmd + Shift + F |
| Format Code | Ctrl + I |

---

### Helpful Commands

```bash
# Clean DerivedData
rm -rf ~/Library/Developer/Xcode/DerivedData

# Reset simulator
xcrun simctl erase all

# List simulators
xcrun simctl list devices

# Take screenshot (simulator)
xcrun simctl io booted screenshot screenshot.png
```

---

### Resources

**Documentation:**
- [ARCHITECTURE.md](ARCHITECTURE.md) - App architecture
- [DESIGN_SYSTEM.md](DESIGN_SYSTEM.md) - Design tokens
- [COMPONENTS.md](COMPONENTS.md) - UI components
- [API_INTEGRATION.md](API_INTEGRATION.md) - Backend integration

**External:**
- [Apple HIG](https://developer.apple.com/design/human-interface-guidelines/)
- [SwiftUI Docs](https://developer.apple.com/documentation/swiftui)
- [Swift Style Guide](https://google.github.io/swift/)

---

**Document Version:** 1.0.0
**Author:** Alejandro Navarro Ayala - CEO & Senior Developer
**Last Updated:** November 28, 2024
**Status:** Production Ready

---

**Happy Coding! 🚀**
