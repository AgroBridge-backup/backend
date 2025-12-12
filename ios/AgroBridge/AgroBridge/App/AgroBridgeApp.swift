import SwiftUI

// MARK: - Entry Point de la Aplicación AgroBridge iOS
@main
struct AgroBridgeApp: App {
    // MARK: - State Management
    @StateObject private var authService = AuthService.shared

    // MARK: - Inicialización
    init() {
        // Configurar Firebase (se inicializará cuando se agregue GoogleService-Info.plist)
        // FirebaseApp.configure()

        // Configurar apariencia global
        setupAppearance()

        // Log de inicio de aplicación
        print("🚀 AgroBridge iOS iniciada - Versión \(AppConfiguration.appVersion)")
    }

    // MARK: - Body
    var body: some Scene {
        WindowGroup {
            // Navegación condicional basada en estado de autenticación
            Group {
                if authService.isAuthenticated {
                    // Usuario autenticado - Mostrar dashboard principal
                    MainTabView()
                        .environmentObject(authService)
                } else {
                    // Usuario no autenticado - Mostrar login
                    LoginView()
                        .environmentObject(authService)
                }
            }
            .onAppear {
                // Verificar sesión existente al iniciar
                Task {
                    await authService.checkExistingSession()
                }
            }
        }
    }

    // MARK: - Configuración de Apariencia
    private func setupAppearance() {
        // Color primario de AgroBridge (verde agricultura)
        UINavigationBar.appearance().tintColor = UIColor(red: 0.34, green: 0.62, blue: 0.17, alpha: 1.0)

        // Configurar tab bar
        UITabBar.appearance().backgroundColor = UIColor.systemBackground
        UITabBar.appearance().tintColor = UIColor(red: 0.34, green: 0.62, blue: 0.17, alpha: 1.0)
    }
}

// MARK: - MainTabView (TabBar Principal)
struct MainTabView: View {
    @State private var selectedTab = 0

    var body: some View {
        TabView(selection: $selectedTab) {
            // Tab 1: Dashboard
            DashboardView()
                .tabItem {
                    Label("Dashboard", systemImage: "chart.bar.fill")
                }
                .tag(0)

            // Tab 2: Lotes
            LotesListView()
                .tabItem {
                    Label("Lotes", systemImage: "map.fill")
                }
                .tag(1)

            // Tab 3: Productores
            ProductoresListView()
                .tabItem {
                    Label("Productores", systemImage: "person.3.fill")
                }
                .tag(2)

            // Tab 4: Perfil
            ProfileView()
                .tabItem {
                    Label("Perfil", systemImage: "person.circle.fill")
                }
                .tag(3)
        }
        .accentColor(Color.agrobridgePrimary)
    }
}

// MARK: - Vista ProductoresListView (Placeholder temporal)
// LotesListView ya está implementada en Views/Lote/LotesListView.swift

struct ProductoresListView: View {
    var body: some View {
        NavigationView {
            Text("Lista de Productores")
                .navigationTitle("Productores")
        }
    }
}

struct ProfileView: View {
    @EnvironmentObject var authService: AuthService

    var body: some View {
        NavigationView {
            VStack(spacing: 20) {
                Text("Perfil de Usuario")
                    .font(.title)

                if let user = authService.currentUser {
                    Text("Email: \(user.email)")
                        .font(.body)
                }

                Button(action: {
                    Task {
                        await authService.logout()
                    }
                }) {
                    Text("Cerrar Sesión")
                        .font(.headline)
                        .foregroundColor(.white)
                        .frame(maxWidth: .infinity)
                        .padding()
                        .background(Color.red)
                        .cornerRadius(10)
                }
                .padding(.horizontal)
            }
            .navigationTitle("Perfil")
        }
    }
}
