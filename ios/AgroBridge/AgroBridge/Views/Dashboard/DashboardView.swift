import SwiftUI

// MARK: - DashboardView
/// Pantalla principal del dashboard
struct DashboardView: View {
    // MARK: - Properties
    @StateObject private var viewModel = DashboardViewModel()

    var body: some View {
        NavigationView {
            ZStack {
                Color.backgroundPrimary
                    .ignoresSafeArea()

                if viewModel.isLoading && viewModel.stats == nil {
                    // Loading inicial con skeleton
                    SkeletonLoadingView(type: .dashboard)
                } else {
                    // Contenido
                    ScrollView {
                        VStack(spacing: Spacing.xl) {
                            // Header
                            DashboardHeader()
                                .padding(.horizontal, Spacing.lg)
                                .padding(.top, Spacing.md)

                            // Stats Grid
                            if let stats = viewModel.stats {
                                DashboardStatsGrid(stats: stats)
                                    .padding(.horizontal, Spacing.lg)
                            }

                            // Acciones rápidas
                            QuickActionsSection()
                                .padding(.horizontal, Spacing.lg)

                            Spacer(minLength: 20)
                        }
                        .padding(.bottom)
                    }
                    .refreshable {
                        await viewModel.refresh()
                    }
                }
            }
            .navigationTitle("Dashboard")
            .navigationBarTitleDisplayMode(.large)
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button(action: {
                        Task {
                            await viewModel.refresh()
                        }
                    }) {
                        Image(systemName: "arrow.clockwise")
                            .foregroundColor(.agrobridgePrimary)
                    }
                    .disabled(viewModel.isLoading)
                }
            }
        }
        .task {
            await viewModel.loadStats()
        }
        .alert("Error", isPresented: $viewModel.showError) {
            Button("OK", role: .cancel) {}
            Button("Reintentar") {
                Task {
                    await viewModel.loadStats()
                }
            }
        } message: {
            Text(viewModel.errorMessage ?? MicroCopy.errorGeneric)
        }
    }
}

// MARK: - DashboardHeader
struct DashboardHeader: View {
    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.xs) {
            Text("Bienvenido a AgroBridge")
                .font(.displayMedium)
                .foregroundColor(.textPrimary)

            Text("Resumen de tu actividad")
                .font(.bodyMedium)
                .foregroundColor(.textSecondary)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

// MARK: - DashboardStatsGrid
struct DashboardStatsGrid: View {
    let stats: DashboardStats

    var body: some View {
        LazyVGrid(columns: [
            GridItem(.flexible(), spacing: Spacing.md),
            GridItem(.flexible(), spacing: Spacing.md)
        ], spacing: Spacing.md) {
            // Total Productores
            StatCard(
                title: "Productores",
                value: "\(stats.totalProductores)",
                icon: "person.3.fill",
                trend: .up("+8%"),
                color: .agroGreen
            )

            // Lotes Activos
            StatCard(
                title: "Lotes Activos",
                value: "\(stats.lotesActivos)",
                icon: "leaf.fill",
                trend: .up("+12%"),
                color: .successGreen
            )

            // Bloques Certificados
            StatCard(
                title: "Bloques",
                value: "\(stats.bloquesCertificados)",
                icon: "checkmark.seal.fill",
                trend: .neutral,
                color: .agroSky
            )

            // Estado Conexión
            StatCard(
                title: "Conexión",
                value: stats.estadoConexion.displayName,
                icon: stats.estadoConexion.icon,
                color: colorForEstado(stats.estadoConexion)
            )
        }
    }

    private func colorForEstado(_ estado: EstadoConexion) -> Color {
        switch estado {
        case .online:
            return .successGreen
        case .offline:
            return .errorRed
        case .sincronizando:
            return .warningAmber
        }
    }
}

// MARK: - QuickActionsSection
struct QuickActionsSection: View {
    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.md) {
            Text("Acciones Rápidas")
                .font(.displaySmall)
                .foregroundColor(.textPrimary)

            LazyVGrid(columns: [
                GridItem(.flexible(), spacing: Spacing.md),
                GridItem(.flexible(), spacing: Spacing.md)
            ], spacing: Spacing.md) {
                QuickActionCard(
                    title: "Crear Lote",
                    icon: "plus.circle.fill",
                    color: .agroGreen
                ) {
                    // TODO: Navegar a crear lote
                    print("Crear lote")
                }

                QuickActionCard(
                    title: "Ver Lotes",
                    icon: "list.bullet.rectangle",
                    color: .agroSky
                ) {
                    // TODO: Navegar a lista de lotes
                    print("Ver lotes")
                }

                QuickActionCard(
                    title: "Productores",
                    icon: "person.3.fill",
                    color: .warningAmber
                ) {
                    // TODO: Navegar a productores
                    print("Productores")
                }

                QuickActionCard(
                    title: "Analytics",
                    icon: "chart.bar.fill",
                    color: .agroEarth
                ) {
                    // TODO: Navegar a estadísticas
                    print("Analytics")
                }
            }
        }
    }
}

// MARK: - QuickActionCard
struct QuickActionCard: View {
    let title: String
    let icon: String
    let color: Color
    let action: () -> Void

    @State private var isPressed = false

    var body: some View {
        Button(action: {
            HapticFeedback.light()

            withAnimation(AnimationPreset.spring) {
                isPressed = true
            }

            DispatchQueue.main.asyncAfter(deadline: .now() + 0.1) {
                withAnimation(AnimationPreset.spring) {
                    isPressed = false
                }
                action()
            }
        }) {
            VStack(spacing: Spacing.sm) {
                ZStack {
                    Circle()
                        .fill(color.opacity(0.15))
                        .frame(width: 56, height: 56)

                    Image(systemName: icon)
                        .font(.system(size: 28, weight: .semibold))
                        .foregroundColor(color)
                }

                Text(title)
                    .font(.labelMedium)
                    .foregroundColor(.textPrimary)
                    .multilineTextAlignment(.center)
                    .lineLimit(2)
            }
            .frame(maxWidth: .infinity)
            .frame(height: 120)
            .background(Color.backgroundSecondary)
            .cornerRadius(CornerRadius.large)
            .shadow(ShadowStyle.soft)
        }
        .scaleEffect(isPressed ? 0.95 : 1.0)
        .animation(AnimationPreset.spring, value: isPressed)
        .accessibilityLabel(title)
        .accessibilityHint("Toca dos veces para abrir \(title)")
    }
}

// MARK: - ScaleButtonStyle
struct ScaleButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .scaleEffect(configuration.isPressed ? 0.95 : 1.0)
            .animation(.easeInOut(duration: 0.1), value: configuration.isPressed)
    }
}

// MARK: - Preview
struct DashboardView_Previews: PreviewProvider {
    static var previews: some View {
        DashboardView()
    }
}
