import Foundation
import SwiftUI

// MARK: - Analytics ViewModel
/// ViewModel para gestionar el estado de la vista de Analytics
@MainActor
class AnalyticsViewModel: ObservableObject {

    // MARK: - Published Properties

    /// Datos de analytics actuales
    @Published var analyticsData: AnalyticsData?

    /// Response completo con metadata
    @Published var analyticsResponse: AnalyticsResponse?

    /// Período seleccionado actual
    @Published var periodoSeleccionado: PeriodoAnalytics = .mensual

    /// Indica si se están cargando datos
    @Published var isLoading = false

    /// Error actual si existe
    @Published var error: Error?

    /// Mensaje de error formateado para mostrar en UI
    @Published var errorMessage: String?

    // MARK: - Dependencies
    private let analyticsService = AnalyticsService.shared

    // MARK: - Computed Properties

    /// Indica si hay datos disponibles
    var hasData: Bool {
        analyticsData != nil
    }

    /// Indica si hay error
    var hasError: Bool {
        error != nil
    }

    /// Resumen de analytics
    var resumen: ResumenAnalytics? {
        analyticsData?.resumen
    }

    /// Producción analytics
    var produccion: ProduccionAnalytics? {
        analyticsData?.produccion
    }

    /// Calidad analytics
    var calidad: CalidadAnalytics? {
        analyticsData?.calidad
    }

    /// Certificación analytics
    var certificacion: CertificacionAnalytics? {
        analyticsData?.certificacion
    }

    /// Tendencias analytics
    var tendencias: TendenciasAnalytics? {
        analyticsData?.tendencias
    }

    /// Comparativas analytics (opcional)
    var comparativas: ComparativasAnalytics? {
        analyticsData?.comparativas
    }

    // MARK: - Initialization
    init() {
        print("📊 AnalyticsViewModel inicializado")
    }

    // MARK: - Fetch Analytics
    /// Obtiene analytics del backend para el período seleccionado
    func fetchAnalytics() async {
        print("📊 Iniciando fetch de analytics para período: \(periodoSeleccionado.displayName)")

        // Reset estado anterior
        isLoading = true
        error = nil
        errorMessage = nil

        do {
            // Request al backend
            let response = try await analyticsService.fetchAnalytics(periodo: periodoSeleccionado.rawValue)

            // Actualizar estado
            analyticsResponse = response
            analyticsData = response.analytics
            print("✅ Analytics cargados exitosamente")
            print("   - Generado en: \(response.generadoEn)")

        } catch let networkError as NetworkError {
            // Manejo específico de errores de red
            handleNetworkError(networkError)

        } catch {
            // Manejo genérico de errores
            self.error = error
            self.errorMessage = "Error al cargar analytics: \(error.localizedDescription)"
            print("❌ Error cargando analytics: \(error)")
        }

        isLoading = false
    }

    // MARK: - Change Period
    /// Cambia el período seleccionado y recarga datos
    /// - Parameter nuevoPeriodo: Nuevo período a seleccionar
    func changePeriodo(_ nuevoPeriodo: PeriodoAnalytics) async {
        guard nuevoPeriodo != periodoSeleccionado else {
            print("⚠️ Período ya seleccionado, skipping fetch")
            return
        }

        print("📊 Cambiando período de \(periodoSeleccionado.displayName) a \(nuevoPeriodo.displayName)")

        periodoSeleccionado = nuevoPeriodo
        await fetchAnalytics()
    }

    // MARK: - Refresh
    /// Refresca los datos actuales (para pull-to-refresh)
    func refresh() async {
        print("🔄 Refrescando analytics...")
        await fetchAnalytics()
    }

    // MARK: - Error Handling
    /// Maneja errores específicos de networking
    private func handleNetworkError(_ error: NetworkError) {
        self.error = error

        switch error {
        case .invalidURL:
            errorMessage = "URL inválida. Contacta soporte."
        case .invalidResponse:
            errorMessage = "Respuesta inválida del servidor."
        case .unauthorized:
            errorMessage = "Sesión expirada. Inicia sesión nuevamente."
        case .forbidden:
            errorMessage = "No tienes permisos para ver analytics."
        case .notFound:
            errorMessage = "Datos de analytics no encontrados."
        case .serverError(let statusCode):
            errorMessage = "Error del servidor (código \(statusCode)). Intenta más tarde."
        case .decodingError(let underlyingError):
            errorMessage = "Error procesando datos: \(underlyingError.localizedDescription)"
        case .encodingError:
            errorMessage = "Error preparando solicitud."
        case .noInternetConnection:
            errorMessage = "No hay conexión a internet. Verifica tu red."
        case .timeout:
            errorMessage = "La solicitud tardó demasiado. Intenta de nuevo."
        case .unknown(let description):
            errorMessage = "Error desconocido: \(description)"
        }

        print("❌ Network Error: \(errorMessage ?? "Sin mensaje")")
    }

    // MARK: - Clear Error
    /// Limpia el error actual
    func clearError() {
        error = nil
        errorMessage = nil
    }

    // MARK: - Helper: Format Date
    /// Formatea la fecha de generación para UI
    var fechaGeneracion: String? {
        guard let fecha = analyticsResponse?.generadoEn else { return nil }
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "es_ES")
        formatter.dateStyle = .medium
        formatter.timeStyle = .short
        return formatter.string(from: fecha)
    }

    // MARK: - Helper: Get Crecimiento Color
    /// Retorna color para indicador de crecimiento
    func colorForCrecimiento(_ valor: Double) -> Color {
        if valor > 0 {
            return .green
        } else if valor < 0 {
            return .red
        } else {
            return .gray
        }
    }

    // MARK: - Helper: Format Percentage
    /// Formatea porcentaje para UI
    func formatPercentage(_ valor: Double) -> String {
        let sign = valor > 0 ? "+" : ""
        return String(format: "%@%.1f%%", sign, valor)
    }
}
