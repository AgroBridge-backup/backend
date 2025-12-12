import Foundation
import SwiftUI

@MainActor
class SmartDashboardViewModel: ObservableObject {
    @Published var currentWeather: WeatherData?
    @Published var alerts: [Alert] = []
    @Published var insights: [Insight] = []
    @Published var enhancedStats: [EnhancedStat] = []
    @Published var lotes: [Lote] = []

    func loadData() async {
        // Cargar lotes (usar mock data por ahora)
        lotes = Lote.mockLotes

        // Cargar clima
        await loadWeather()

        // Generar alertas
        generateAlerts()

        // Generar insights
        generateInsights()

        // Calcular stats mejorados
        calculateEnhancedStats()
    }

    func refresh() async {
        await loadData()
    }

    private func loadWeather() async {
        guard let primerLote = lotes.first,
              let coordenada = primerLote.centroCampo else {
            return
        }

        do {
            currentWeather = try await WeatherService.shared.fetchCurrentWeather(for: coordenada)
        } catch {
            print("❌ Error cargando clima: \(error)")
        }
    }

    private func generateAlerts() {
        alerts = Alert.generateAlerts(for: lotes, weather: currentWeather)
    }

    private func generateInsights() {
        insights = []

        // Insight de producción
        let totalArea = lotes.reduce(0.0) { $0 + ($1.areaHectareas ?? 0) }
        let promedio = totalArea / Double(lotes.count)

        insights.append(Insight(
            emoji: "📊",
            title: "Área promedio: \(String(format: "%.1f", promedio)) ha",
            description: "Por encima del promedio regional"
        ))

        // Insight de salud
        let activosCount = lotes.filter { $0.estado == .activo }.count
        let percentage = (Double(activosCount) / Double(lotes.count)) * 100

        insights.append(Insight(
            emoji: "🌱",
            title: "\(Int(percentage))% de lotes activos",
            description: "Excelente nivel de productividad"
        ))

        // Insight de clima
        if let weather = currentWeather {
            insights.append(Insight(
                emoji: "🌤️",
                title: "Clima: \(Int(weather.temperatura))°C",
                description: weather.irrigationRecommendation
            ))
        }
    }

    private func calculateEnhancedStats() {
        let activosCount = lotes.filter { $0.estado == .activo }.count
        let totalArea = lotes.reduce(0.0) { $0 + ($1.areaHectareas ?? 0) }

        enhancedStats = [
            EnhancedStat(
                icon: "leaf.fill",
                label: "Lotes Activos",
                value: "\(activosCount)",
                color: .agroGreen,
                trend: 12.5,
                comparison: "vs mes anterior"
            ),
            EnhancedStat(
                icon: "chart.line.uptrend.xyaxis",
                label: "Área Total",
                value: String(format: "%.1f ha", totalArea),
                color: .blue,
                trend: 8.2,
                comparison: "en producción"
            ),
            EnhancedStat(
                icon: "checkmark.seal.fill",
                label: "Lotes",
                value: "\(lotes.count)",
                color: .purple,
                trend: nil,
                comparison: "registrados"
            ),
            EnhancedStat(
                icon: "dollarsign.circle.fill",
                label: "Rendimiento",
                value: "Alta",
                color: .orange,
                trend: 15.7,
                comparison: "eficiencia"
            )
        ]
    }

    func handleAlert(_ alert: Alert) {
        print("Handling alert: \(alert.title)")
        // TODO: Implementar navegación según tipo de alerta
    }
}
