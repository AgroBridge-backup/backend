import SwiftUI

struct SmartDashboardView: View {
    @StateObject private var viewModel = SmartDashboardViewModel()

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 20) {
                    // Weather banner si hay datos
                    if let weather = viewModel.currentWeather {
                        WeatherWidgetView(weatherData: weather) {
                            // TODO: Mostrar detalle del clima
                        }
                    }

                    // Alertas urgentes
                    if !viewModel.alerts.isEmpty {
                        alertsSection
                    }

                    // Insights con ML
                    insightsSection

                    // Stats mejorados
                    enhancedStatsGrid

                    // Quick Actions
                    quickActionsSection
                }
                .padding()
            }
            .navigationTitle("Dashboard")
            .refreshable {
                await viewModel.refresh()
            }
        }
        .task {
            await viewModel.loadData()
        }
    }

    // MARK: - Alerts Section
    private var alertsSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Text("🚨 Alertas")
                    .font(.headline)

                Spacer()

                Text("\(viewModel.alerts.count)")
                    .font(.caption)
                    .fontWeight(.bold)
                    .padding(.horizontal, 8)
                    .padding(.vertical, 4)
                    .background(Color.red.opacity(0.2))
                    .foregroundColor(.red)
                    .cornerRadius(8)
            }

            ForEach(viewModel.alerts.prefix(3)) { alert in
                AlertCard(alert: alert) {
                    viewModel.handleAlert(alert)
                }
            }

            if viewModel.alerts.count > 3 {
                Button("Ver todas las alertas (\(viewModel.alerts.count))") {
                    // TODO: Navigate to all alerts
                }
                .font(.subheadline)
                .foregroundColor(.agroGreen)
            }
        }
    }

    // MARK: - Insights Section
    private var insightsSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("💡 Insights")
                .font(.headline)

            ForEach(viewModel.insights) { insight in
                InsightCard(insight: insight)
            }
        }
    }

    // MARK: - Enhanced Stats Grid
    private var enhancedStatsGrid: some View {
        LazyVGrid(columns: [
            GridItem(.flexible()),
            GridItem(.flexible())
        ], spacing: 16) {
            ForEach(viewModel.enhancedStats) { stat in
                EnhancedStatCard(stat: stat)
            }
        }
    }

    // MARK: - Quick Actions
    private var quickActionsSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("⚡ Acciones Rápidas")
                .font(.headline)

            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 12) {
                    QuickActionButton(
                        icon: "camera.fill",
                        title: "Escanear Plaga",
                        color: .agroGreen
                    ) {
                        // TODO: Navigate to scanner
                    }

                    QuickActionButton(
                        icon: "plus.circle.fill",
                        title: "Crear Lote",
                        color: .blue
                    ) {
                        // TODO: Navigate to create lote
                    }

                    QuickActionButton(
                        icon: "map.fill",
                        title: "Ver Mapa",
                        color: .orange
                    ) {
                        // TODO: Navigate to map
                    }

                    QuickActionButton(
                        icon: "chart.bar.fill",
                        title: "Analytics",
                        color: .purple
                    ) {
                        // TODO: Navigate to analytics
                    }
                }
            }
        }
    }
}

// MARK: - Alert Card
struct AlertCard: View {
    let alert: Alert
    let onTap: () -> Void

    var body: some View {
        Button(action: onTap) {
            HStack(spacing: 12) {
                Image(systemName: alert.type.icon)
                    .font(.title2)
                    .foregroundColor(alert.type.color)
                    .frame(width: 40)

                VStack(alignment: .leading, spacing: 4) {
                    Text(alert.title)
                        .font(.subheadline)
                        .fontWeight(.semibold)

                    Text(alert.message)
                        .font(.caption)
                        .foregroundColor(.secondary)
                        .lineLimit(2)
                }

                Spacer()

                if alert.actionable {
                    Image(systemName: "chevron.right")
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
            }
            .padding()
            .background(alert.type.color.opacity(0.1))
            .cornerRadius(12)
        }
        .buttonStyle(.plain)
    }
}

// MARK: - Insight Card
struct InsightCard: View {
    let insight: Insight

    var body: some View {
        HStack(spacing: 12) {
            Text(insight.emoji)
                .font(.title)

            VStack(alignment: .leading, spacing: 4) {
                Text(insight.title)
                    .font(.subheadline)
                    .fontWeight(.medium)

                Text(insight.description)
                    .font(.caption)
                    .foregroundColor(.secondary)
            }

            Spacer()
        }
        .padding()
        .background(Color.backgroundSecondary)
        .cornerRadius(12)
    }
}

// MARK: - Quick Action Button
struct QuickActionButton: View {
    let icon: String
    let title: String
    let color: Color
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            VStack(spacing: 8) {
                Image(systemName: icon)
                    .font(.title2)
                    .foregroundColor(.white)
                    .frame(width: 60, height: 60)
                    .background(color)
                    .clipShape(Circle())

                Text(title)
                    .font(.caption)
                    .fontWeight(.medium)
                    .multilineTextAlignment(.center)
            }
            .frame(width: 100)
        }
        .buttonStyle(.plain)
    }
}

// MARK: - Models
struct Insight: Identifiable {
    let id = UUID()
    let emoji: String
    let title: String
    let description: String
}

struct EnhancedStat: Identifiable {
    let id = UUID()
    let icon: String
    let label: String
    let value: String
    let color: Color
    let trend: Double?
    let comparison: String?
}

#Preview {
    SmartDashboardView()
}
