# 📖 AgroBridge - Code Examples Catalog

**Purpose:** Copy-paste ready code snippets for common tasks

📖 **Reading time:** ~12 minutes | **Print-friendly format**

**Developed by:** Alejandro Navarro Ayala - CEO & Senior Developer

**Version:** 1.0.0
**Last Updated:** November 28, 2024
**Status:** Production Ready

---

## 📋 Table of Contents

1. [Design System Examples](#design-system-examples)
2. [UI Components](#ui-components)
3. [MVVM Patterns](#mvvm-patterns)
4. [API Integration](#api-integration)
5. [Navigation](#navigation)
6. [State Management](#state-management)
7. [Error Handling](#error-handling)
8. [Common Patterns](#common-patterns)

---

## 🎨 Design System Examples

### Colors

```swift
// MARK: - Brand Colors
.foregroundColor(.agroGreen)        // Primary brand color #2D5016
.foregroundColor(.agroGreenLight)   // Accent/CTA #57A02B
.background(.agroGreenTint)         // Subtle backgrounds #E8F5E3

// MARK: - Semantic Colors
.foregroundColor(.successGreen)     // Success states
.foregroundColor(.warningAmber)     // Warnings
.foregroundColor(.errorRed)         // Errors
.foregroundColor(.infoBlue)         // Information

// MARK: - Text Colors
.foregroundColor(.textPrimary)      // Headlines, body (#1C1C1E)
.foregroundColor(.textSecondary)    // Captions, labels (#6C6C70)
.foregroundColor(.textTertiary)     // Placeholders (#AEAEB2)

// MARK: - Background Colors
.background(.backgroundPrimary)     // App background (#F8FAF7)
.background(.backgroundSecondary)   // Cards (#FFFFFF)
.foregroundColor(.divider)          // Borders (#E5E5EA)
```

### Typography

```swift
// MARK: - Display (Headlines)
Text("Hero Title")
    .font(.displayLarge)            // 34pt, bold

Text("Section Header")
    .font(.displayMedium)           // 28pt, semibold

Text("Card Title")
    .font(.displaySmall)            // 22pt, semibold

// MARK: - Body (Content)
Text("Primary content")
    .font(.bodyLarge)               // 17pt, regular

Text("Secondary content")
    .font(.bodyMedium)              // 15pt, regular

Text("Caption, footnotes")
    .font(.bodySmall)               // 13pt, regular

// MARK: - Label (UI Elements)
Text("Button Text")
    .font(.labelLarge)              // 17pt, semibold

Text("Form Label")
    .font(.labelMedium)             // 15pt, medium

Text("Badge")
    .font(.labelSmall)              // 12pt, medium
```

### Spacing

```swift
// MARK: - Spacing (4pt Grid System)
.padding(Spacing.xxs)               //  4pt - Tight
.padding(Spacing.xs)                //  8pt - Compact
.padding(Spacing.sm)                // 12pt - Comfortable
.padding(Spacing.md)                // 16pt - Default ⭐
.padding(Spacing.lg)                // 20pt - Generous
.padding(Spacing.xl)                // 24pt - Spacious
.padding(Spacing.xxl)               // 32pt - Large gaps
.padding(Spacing.xxxl)              // 48pt - Hero spacing

// MARK: - Common Spacing Patterns
VStack(spacing: Spacing.md) { }     // Default vertical spacing
HStack(spacing: Spacing.xs) { }     // Icon + text
.padding(.horizontal, Spacing.lg)   // Screen edges
.padding(.vertical, Spacing.xl)     // Section padding
```

### Shadows & Corner Radius

```swift
// MARK: - Shadows
.shadow(ShadowStyle.subtle)         // Barely visible
.shadow(ShadowStyle.soft)           // Cards (default) ⭐
.shadow(ShadowStyle.medium)         // Floating buttons
.shadow(ShadowStyle.strong)         // Modals, overlays

// MARK: - Corner Radius
.cornerRadius(CornerRadius.small)   //  8pt - Badges, chips
.cornerRadius(CornerRadius.medium)  // 12pt - Buttons, text fields
.cornerRadius(CornerRadius.large)   // 16pt - Cards, modals ⭐
.cornerRadius(CornerRadius.xlarge)  // 20pt - Hero cards
.cornerRadius(CornerRadius.xxlarge) // 24pt - Extra large
```

---

## 🧩 UI Components

### StatCard (Dashboard Metric)

```swift
StatCard(
    title: "Productores",
    value: "248",
    icon: "person.3.fill",
    trend: .up("+12%"),
    color: .agroGreen
)
```

**Full Implementation:**
```swift
struct StatCard: View {
    let title: String
    let value: String
    let icon: String
    let trend: Trend?
    let color: Color

    enum Trend {
        case up(String)
        case down(String)
        case neutral
    }

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.md) {
            HStack {
                // Icon
                ZStack {
                    Circle()
                        .fill(color.opacity(0.12))
                        .frame(width: 48, height: 48)
                    Image(systemName: icon)
                        .foregroundColor(color)
                        .font(.title2)
                }

                Spacer()

                // Trend badge
                if let trend = trend {
                    trendBadge(trend)
                }
            }

            Text(value)
                .font(.displayMedium)
                .foregroundColor(.textPrimary)

            Text(title)
                .font(.bodyMedium)
                .foregroundColor(.textSecondary)
        }
        .padding(Spacing.lg)
        .background(Color.backgroundSecondary)
        .cornerRadius(CornerRadius.large)
        .shadow(ShadowStyle.soft)
    }

    private func trendBadge(_ trend: Trend) -> some View {
        HStack(spacing: 4) {
            switch trend {
            case .up(let value):
                Image(systemName: "arrow.up")
                    .foregroundColor(.successGreen)
                Text(value)
                    .foregroundColor(.successGreen)
            case .down(let value):
                Image(systemName: "arrow.down")
                    .foregroundColor(.errorRed)
                Text(value)
                    .foregroundColor(.errorRed)
            case .neutral:
                Image(systemName: "minus")
                    .foregroundColor(.textSecondary)
            }
        }
        .font(.caption)
        .fontWeight(.semibold)
    }
}
```

### CustomButton

```swift
// MARK: - Primary Button
CustomButton(
    title: "Crear Lote",
    icon: "plus.circle.fill",
    style: .primary,
    isLoading: false
) {
    // Action
}

// MARK: - Secondary Button
CustomButton(
    title: "Cancelar",
    style: .secondary
) {
    // Action
}

// MARK: - Destructive Button
CustomButton(
    title: "Eliminar",
    icon: "trash.fill",
    style: .destructive
) {
    // Action
}
```

**Full Implementation:**
```swift
struct CustomButton: View {
    let title: String
    let icon: String?
    let style: ButtonStyle
    let isLoading: Bool
    let action: () -> Void

    enum ButtonStyle {
        case primary, secondary, tertiary, destructive

        var backgroundColor: Color {
            switch self {
            case .primary: return .agroGreenLight
            case .secondary: return .backgroundSecondary
            case .tertiary: return .clear
            case .destructive: return .errorRed
            }
        }

        var foregroundColor: Color {
            switch self {
            case .primary, .destructive: return .white
            case .secondary, .tertiary: return .textPrimary
            }
        }
    }

    @State private var isPressed = false

    init(
        title: String,
        icon: String? = nil,
        style: ButtonStyle = .primary,
        isLoading: Bool = false,
        action: @escaping () -> Void
    ) {
        self.title = title
        self.icon = icon
        self.style = style
        self.isLoading = isLoading
        self.action = action
    }

    var body: some View {
        Button(action: {
            HapticFeedback.medium()
            withAnimation(AnimationPreset.spring) {
                isPressed = true
            }
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.1) {
                isPressed = false
                action()
            }
        }) {
            HStack(spacing: Spacing.xs) {
                if isLoading {
                    ProgressView()
                        .progressViewStyle(CircularProgressViewStyle(tint: style.foregroundColor))
                } else {
                    if let icon = icon {
                        Image(systemName: icon)
                    }
                    Text(title)
                        .font(.labelLarge)
                }
            }
            .frame(maxWidth: .infinity)
            .frame(height: 52)
            .background(style.backgroundColor)
            .foregroundColor(style.foregroundColor)
            .cornerRadius(CornerRadius.medium)
        }
        .scaleEffect(isPressed ? 0.96 : 1.0)
        .animation(AnimationPreset.spring, value: isPressed)
    }
}
```

### CustomTextField

```swift
CustomTextField(
    placeholder: "Email",
    icon: "envelope.fill",
    text: $viewModel.email,
    keyboardType: .emailAddress
)
```

**Full Implementation:**
```swift
struct CustomTextField: View {
    let placeholder: String
    let icon: String?
    @Binding var text: String
    var keyboardType: UIKeyboardType = .default
    var isSecure: Bool = false

    @FocusState private var isFocused: Bool

    var body: some View {
        HStack(spacing: Spacing.sm) {
            if let icon = icon {
                Image(systemName: icon)
                    .foregroundColor(isFocused ? .agroGreenLight : .textSecondary)
                    .font(.body)
            }

            if isSecure {
                SecureField(placeholder, text: $text)
                    .focused($isFocused)
            } else {
                TextField(placeholder, text: $text)
                    .keyboardType(keyboardType)
                    .autocapitalization(.none)
                    .focused($isFocused)
            }
        }
        .padding(Spacing.md)
        .background(Color.backgroundSecondary)
        .cornerRadius(CornerRadius.medium)
        .overlay(
            RoundedRectangle(cornerRadius: CornerRadius.medium)
                .stroke(isFocused ? Color.agroGreenLight : Color.divider, lineWidth: 1)
        )
    }
}
```

### LoadingView

```swift
// MARK: - Full Screen Loading
LoadingView(message: "Cargando lotes...")

// MARK: - Inline Loading
if isLoading {
    ProgressView("Guardando cambios...")
}
```

---

## 🏛️ MVVM Patterns

### ViewModel Template

```swift
import SwiftUI
import Combine

class ExampleViewModel: ObservableObject {
    // MARK: - Published Properties (UI observes these)
    @Published var data: [Item] = []
    @Published var isLoading = false
    @Published var showError = false
    @Published var errorMessage = ""

    // MARK: - Private Properties
    private let service: ExampleService
    private var cancellables = Set<AnyCancellable>()

    // MARK: - Initialization
    init(service: ExampleService = ExampleService.shared) {
        self.service = service
        loadData()
    }

    // MARK: - Public Methods
    @MainActor
    func loadData() async {
        isLoading = true

        do {
            let fetchedData = try await service.fetchData()
            self.data = fetchedData
            isLoading = false
        } catch let error as NetworkError {
            errorMessage = error.errorDescription ?? "Error desconocido"
            showError = true
            isLoading = false
        } catch {
            errorMessage = "Error inesperado"
            showError = true
            isLoading = false
        }
    }

    @MainActor
    func refresh() async {
        await loadData()
    }
}
```

### View Template

```swift
struct ExampleView: View {
    @StateObject private var viewModel = ExampleViewModel()

    var body: some View {
        NavigationView {
            content
                .navigationTitle("Title")
                .toolbar {
                    ToolbarItem(placement: .navigationBarTrailing) {
                        Button("Acción") {
                            // Action
                        }
                    }
                }
                .alert("Error", isPresented: $viewModel.showError) {
                    Button("Reintentar") {
                        Task {
                            await viewModel.loadData()
                        }
                    }
                    Button("Cancelar", role: .cancel) { }
                } message: {
                    Text(viewModel.errorMessage)
                }
        }
    }

    @ViewBuilder
    private var content: some View {
        if viewModel.isLoading {
            ProgressView("Cargando...")
        } else if viewModel.data.isEmpty {
            emptyState
        } else {
            list
        }
    }

    private var list: some View {
        List(viewModel.data) { item in
            // Item view
        }
        .refreshable {
            await viewModel.refresh()
        }
    }

    private var emptyState: some View {
        VStack(spacing: Spacing.lg) {
            Image(systemName: "tray")
                .font(.system(size: 80))
                .foregroundColor(.textSecondary)

            Text("No hay datos")
                .font(.displaySmall)
                .foregroundColor(.textPrimary)

            Text("Crea tu primer elemento")
                .font(.bodyMedium)
                .foregroundColor(.textSecondary)
        }
    }
}
```

---

## 🌐 API Integration

### Service Template

```swift
class ExampleService {
    static let shared = ExampleService()

    private let apiClient = APIClient.shared

    private init() {}

    /// Fetch list of items
    func fetchItems() async throws -> [Item] {
        let response: ItemsResponse = try await apiClient.request(
            endpoint: .items,
            method: .GET
        )
        return response.items
    }

    /// Fetch single item by ID
    func fetchItem(id: String) async throws -> Item {
        return try await apiClient.request(
            endpoint: .itemById(id),
            method: .GET
        )
    }

    /// Create new item
    func createItem(_ request: CreateItemRequest) async throws -> Item {
        return try await apiClient.request(
            endpoint: .createItem,
            method: .POST,
            body: request
        )
    }

    /// Update item
    func updateItem(id: String, request: CreateItemRequest) async throws -> Item {
        return try await apiClient.request(
            endpoint: .updateItem(id),
            method: .PUT,
            body: request
        )
    }

    /// Delete item
    func deleteItem(id: String) async throws {
        try await apiClient.requestWithoutResponse(
            endpoint: .deleteItem(id),
            method: .DELETE
        )
    }
}
```

### API Call Examples

```swift
// MARK: - GET Request
let stats: DashboardStats = try await apiClient.request(
    endpoint: .dashboardStats,
    method: .GET
)

// MARK: - POST Request with Body
let request = LoginRequest(email: email, password: password)
let response: LoginResponse = try await apiClient.request(
    endpoint: .login,
    method: .POST,
    body: request
)

// MARK: - GET with Query Parameters
let queryItems = [
    URLQueryItem(name: "page", value: "1"),
    URLQueryItem(name: "limit", value: "20"),
    URLQueryItem(name: "search", value: searchText)
]

let response: LotesListResponse = try await apiClient.request(
    endpoint: .lotes,
    method: .GET,
    queryItems: queryItems
)

// MARK: - PUT Request
let updateRequest = CreateLoteRequest(
    nombre: "Updated Name",
    ubicacion: "New Location",
    tipoCultivo: "Café",
    areaHectareas: 10.0,
    notas: nil
)

let updatedLote: Lote = try await apiClient.request(
    endpoint: .updateLote(loteId),
    method: .PUT,
    body: updateRequest
)

// MARK: - DELETE Request
try await apiClient.requestWithoutResponse(
    endpoint: .deleteLote(loteId),
    method: .DELETE
)
```

---

## 🧭 Navigation

### NavigationLink

```swift
// MARK: - Simple Navigation
NavigationLink(destination: DetailView()) {
    Text("Ver Detalle")
}

// MARK: - Navigation with Data
NavigationLink(destination: LoteDetailView(lote: lote)) {
    LoteCard(lote: lote)
}

// MARK: - Programmatic Navigation (iOS 16+)
@State private var path = NavigationPath()

NavigationStack(path: $path) {
    List(lotes) { lote in
        Button("Ver \(lote.nombre)") {
            path.append(lote)
        }
    }
    .navigationDestination(for: Lote.self) { lote in
        LoteDetailView(lote: lote)
    }
}
```

### Sheet (Modal)

```swift
// MARK: - Simple Sheet
@State private var showingSheet = false

Button("Crear Lote") {
    showingSheet = true
}
.sheet(isPresented: $showingSheet) {
    CreateLoteView()
}

// MARK: - Sheet with Data
@State private var selectedLote: Lote?

Button("Editar") {
    selectedLote = lote
}
.sheet(item: $selectedLote) { lote in
    EditLoteView(lote: lote)
}

// MARK: - Full Screen Cover
.fullScreenCover(isPresented: $showingFullScreen) {
    LoginView()
}
```

### Alert

```swift
// MARK: - Simple Alert
.alert("Título", isPresented: $showAlert) {
    Button("OK") { }
}

// MARK: - Alert with Message
.alert("Error", isPresented: $showError) {
    Button("Reintentar") {
        Task { await retry() }
    }
    Button("Cancelar", role: .cancel) { }
} message: {
    Text(errorMessage)
}

// MARK: - Destructive Confirmation
.alert("Eliminar Lote", isPresented: $showDeleteConfirmation) {
    Button("Eliminar", role: .destructive) {
        Task { await deleteLote() }
    }
    Button("Cancelar", role: .cancel) { }
} message: {
    Text("¿Estás seguro? Esta acción no se puede deshacer.")
}
```

---

## 📊 State Management

### @State (Local View State)

```swift
struct CounterView: View {
    @State private var count = 0

    var body: some View {
        VStack {
            Text("Count: \(count)")
            Button("Increment") {
                count += 1
            }
        }
    }
}
```

### @Binding (Pass State Down)

```swift
struct ParentView: View {
    @State private var text = ""

    var body: some View {
        ChildView(text: $text)
    }
}

struct ChildView: View {
    @Binding var text: String

    var body: some View {
        TextField("Enter text", text: $text)
    }
}
```

### @StateObject (ViewModel)

```swift
struct ListView: View {
    @StateObject private var viewModel = ListViewModel()

    var body: some View {
        List(viewModel.items) { item in
            Text(item.name)
        }
    }
}
```

### @ObservedObject (Shared State)

```swift
struct ProfileView: View {
    @ObservedObject var authService = AuthService.shared

    var body: some View {
        if let user = authService.currentUser {
            Text("Hello, \(user.nombre)")
        }
    }
}
```

### @EnvironmentObject (Global State)

```swift
// In App
@main
struct AgroBridgeApp: App {
    @StateObject private var authService = AuthService.shared

    var body: some Scene {
        WindowGroup {
            ContentView()
                .environmentObject(authService)
        }
    }
}

// In View
struct SomeView: View {
    @EnvironmentObject var authService: AuthService

    var body: some View {
        Text(authService.currentUser?.nombre ?? "Guest")
    }
}
```

---

## ⚠️ Error Handling

### Service Layer Error Handling

```swift
func fetchData() async throws -> Data {
    do {
        let data = try await apiClient.request(...)
        return data
    } catch {
        // Log error
        print("❌ Error fetching data: \(error)")
        // Propagate error to ViewModel
        throw error
    }
}
```

### ViewModel Layer Error Handling

```swift
@MainActor
func loadData() async {
    isLoading = true

    do {
        data = try await service.fetchData()
        isLoading = false

    } catch let error as NetworkError {
        // Handle specific network errors
        switch error {
        case .unauthorized:
            errorMessage = "Sesión expirada. Inicia sesión nuevamente."
            // Auto logout
            await AuthService.shared.logout()

        case .notFound:
            errorMessage = "Recurso no encontrado"

        case .serverError(let code):
            errorMessage = "Error del servidor (código \(code))"

        default:
            errorMessage = error.errorDescription ?? "Error desconocido"
        }

        showError = true
        isLoading = false

    } catch {
        // Handle unexpected errors
        errorMessage = "Error inesperado: \(error.localizedDescription)"
        showError = true
        isLoading = false
    }
}
```

### View Layer Error Display

```swift
.alert("Error", isPresented: $viewModel.showError) {
    Button("Reintentar") {
        Task {
            await viewModel.loadData()
        }
    }
    Button("Cancelar", role: .cancel) { }
} message: {
    Text(viewModel.errorMessage)
}
```

---

## 🔧 Common Patterns

### Pull-to-Refresh

```swift
List(items) { item in
    ItemRow(item: item)
}
.refreshable {
    await viewModel.refresh()
}
```

### Search Bar

```swift
@State private var searchText = ""

List {
    ForEach(filteredItems) { item in
        Text(item.name)
    }
}
.searchable(text: $searchText, prompt: "Buscar...")

var filteredItems: [Item] {
    if searchText.isEmpty {
        return items
    } else {
        return items.filter { $0.name.localizedCaseInsensitiveContains(searchText) }
    }
}
```

### Loading Skeleton

```swift
if isLoading {
    ForEach(0..<5) { _ in
        SkeletonLoader(type: .card)
    }
} else {
    ForEach(items) { item in
        ItemCard(item: item)
    }
}
```

### Empty State

```swift
if items.isEmpty {
    VStack(spacing: Spacing.lg) {
        Image(systemName: "tray")
            .font(.system(size: 80))
            .foregroundColor(.textSecondary)

        Text("No hay lotes")
            .font(.displaySmall)
            .foregroundColor(.textPrimary)

        Text("Crea tu primer lote para empezar")
            .font(.bodyMedium)
            .foregroundColor(.textSecondary)
            .multilineTextAlignment(.center)

        CustomButton(
            title: "Crear Lote",
            icon: "plus.circle.fill",
            style: .primary
        ) {
            showCreateSheet = true
        }
        .padding(.horizontal, Spacing.xl)
    }
    .padding(Spacing.xxl)
}
```

### Confirmation Dialog

```swift
.confirmationDialog("Eliminar Lote", isPresented: $showDeleteDialog) {
    Button("Eliminar", role: .destructive) {
        Task { await viewModel.deleteLote() }
    }
    Button("Cancelar", role: .cancel) { }
} message: {
    Text("¿Estás seguro de que quieres eliminar este lote?")
}
```

### Toast/Snackbar (Custom)

```swift
struct ToastView: View {
    let message: String
    let type: ToastType
    @Binding var isShowing: Bool

    enum ToastType {
        case success, error, info

        var color: Color {
            switch self {
            case .success: return .successGreen
            case .error: return .errorRed
            case .info: return .infoBlue
            }
        }

        var icon: String {
            switch self {
            case .success: return "checkmark.circle.fill"
            case .error: return "xmark.circle.fill"
            case .info: return "info.circle.fill"
            }
        }
    }

    var body: some View {
        HStack(spacing: Spacing.sm) {
            Image(systemName: type.icon)
                .foregroundColor(type.color)
            Text(message)
                .font(.bodyMedium)
                .foregroundColor(.textPrimary)
            Spacer()
        }
        .padding(Spacing.md)
        .background(Color.backgroundSecondary)
        .cornerRadius(CornerRadius.medium)
        .shadow(ShadowStyle.medium)
        .padding(.horizontal, Spacing.lg)
        .transition(.move(edge: .top).combined(with: .opacity))
        .onAppear {
            DispatchQueue.main.asyncAfter(deadline: .now() + 3) {
                withAnimation {
                    isShowing = false
                }
            }
        }
    }
}

// Usage
@State private var showToast = false
@State private var toastMessage = ""
@State private var toastType: ToastView.ToastType = .success

VStack {
    // Content
}
.overlay(alignment: .top) {
    if showToast {
        ToastView(
            message: toastMessage,
            type: toastType,
            isShowing: $showToast
        )
        .padding(.top, Spacing.xl)
    }
}
```

### Form Validation

```swift
class FormViewModel: ObservableObject {
    @Published var email = ""
    @Published var password = ""
    @Published var confirmPassword = ""

    var isEmailValid: Bool {
        let emailRegex = "[A-Z0-9a-z._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,64}"
        let emailPredicate = NSPredicate(format: "SELF MATCHES %@", emailRegex)
        return emailPredicate.evaluate(with: email)
    }

    var isPasswordValid: Bool {
        password.count >= 6
    }

    var doPasswordsMatch: Bool {
        password == confirmPassword
    }

    var isFormValid: Bool {
        isEmailValid && isPasswordValid && doPasswordsMatch
    }
}
```

### Async Image Loading

```swift
AsyncImage(url: URL(string: imageURL)) { phase in
    switch phase {
    case .empty:
        ProgressView()
    case .success(let image):
        image
            .resizable()
            .aspectRatio(contentMode: .fill)
    case .failure:
        Image(systemName: "photo")
            .foregroundColor(.textSecondary)
    @unknown default:
        EmptyView()
    }
}
.frame(width: 100, height: 100)
.cornerRadius(CornerRadius.medium)
```

---

## 🎯 Quick Copy-Paste Snippets

### Create MVVM Feature (Complete)

```swift
// MARK: - Model
struct Item: Codable, Identifiable {
    let id: String
    let name: String
}

// MARK: - Service
class ItemService {
    static let shared = ItemService()
    private let apiClient = APIClient.shared
    private init() {}

    func fetchItems() async throws -> [Item] {
        return try await apiClient.request(
            endpoint: .items,
            method: .GET
        )
    }
}

// MARK: - ViewModel
class ItemListViewModel: ObservableObject {
    @Published var items: [Item] = []
    @Published var isLoading = false
    @Published var showError = false
    @Published var errorMessage = ""

    private let service = ItemService.shared

    init() {
        Task { await loadItems() }
    }

    @MainActor
    func loadItems() async {
        isLoading = true
        do {
            items = try await service.fetchItems()
            isLoading = false
        } catch {
            errorMessage = error.localizedDescription
            showError = true
            isLoading = false
        }
    }
}

// MARK: - View
struct ItemListView: View {
    @StateObject private var viewModel = ItemListViewModel()

    var body: some View {
        NavigationView {
            List(viewModel.items) { item in
                Text(item.name)
            }
            .navigationTitle("Items")
            .refreshable {
                await viewModel.loadItems()
            }
        }
    }
}
```

---

## 📚 Additional Resources

- **DESIGN_SYSTEM_QUICK_REFERENCE.md** - All design tokens
- **API_ENDPOINTS_REFERENCE.md** - All API endpoints
- **INTERACTIVE_TUTORIALS.md** - Learning paths
- **ARCHITECTURE.md** - Complete architecture guide
- **COMPONENTS.md** - Component library reference

---

**Developed by:** Alejandro Navarro Ayala - CEO & Senior Developer
**For:** AgroBridge iOS Team
**Last Updated:** November 28, 2024
**Version:** 1.0.0
**Status:** Production Ready

---

**Happy Coding!** 🚀

Bookmark this page for quick access to copy-paste ready code snippets.
