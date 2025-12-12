import Foundation

// MARK: - Analytics Service
/// Servicio para manejar analytics y estadísticas del dashboard
/// Conecta con el endpoint GET /analytics del backend
class AnalyticsService {

    // MARK: - Singleton
    static let shared = AnalyticsService()

    // MARK: - Properties
    private let apiClient = APIClient.shared

    // MARK: - Initialization
    private init() {
        print("📊 AnalyticsService inicializado")
    }

    // MARK: - Fetch Analytics
    /// Obtiene analytics del backend para un período específico
    /// - Parameter periodo: Período de tiempo (7d, 30d, 90d, 365d)
    /// - Returns: AnalyticsResponse con todas las métricas
    /// - Throws: NetworkError si falla el request
    func fetchAnalytics(periodo: String? = nil) async throws -> AnalyticsResponse {
        print("📊 Fetching analytics para período: \(periodo ?? "default")")

        let endpoint = Endpoint.analytics(periodo: periodo)

        do {
            let response: AnalyticsResponse = try await apiClient.request(
                endpoint: endpoint,
                method: .get
            )

            print("✅ Analytics obtenidos exitosamente")
            print("   - Total Productores: \(response.analytics.resumen.totalProductores)")
            print("   - Total Lotes: \(response.analytics.resumen.totalLotes)")
            print("   - Bloques Certificados: \(response.analytics.resumen.bloquesCertificados)")

            return response

        } catch {
            print("❌ Error obteniendo analytics: \(error.localizedDescription)")
            throw error
        }
    }

    // MARK: - Fetch Analytics Data Only
    /// Obtiene solo los datos de analytics sin el wrapper
    /// - Parameter periodo: Período de tiempo
    /// - Returns: AnalyticsData con métricas
    /// - Throws: NetworkError si falla el request
    func fetchAnalyticsData(periodo: String? = nil) async throws -> AnalyticsData {
        let response = try await fetchAnalytics(periodo: periodo)
        return response.analytics
    }

    // MARK: - Fetch Resumen
    /// Obtiene solo el resumen de analytics
    func fetchResumen(periodo: String? = nil) async throws -> ResumenAnalytics {
        let analytics = try await fetchAnalyticsData(periodo: periodo)
        return analytics.resumen
    }

    // MARK: - Fetch Produccion Analytics
    /// Obtiene métricas específicas de producción
    func fetchProduccionAnalytics(periodo: String? = nil) async throws -> ProduccionAnalytics {
        let analytics = try await fetchAnalyticsData(periodo: periodo)
        return analytics.produccion
    }

    // MARK: - Fetch Calidad Analytics
    /// Obtiene métricas específicas de calidad
    func fetchCalidadAnalytics(periodo: String? = nil) async throws -> CalidadAnalytics {
        let analytics = try await fetchAnalyticsData(periodo: periodo)
        return analytics.calidad
    }

    // MARK: - Fetch Certificacion Analytics
    /// Obtiene métricas específicas de certificación
    func fetchCertificacionAnalytics(periodo: String? = nil) async throws -> CertificacionAnalytics {
        let analytics = try await fetchAnalyticsData(periodo: periodo)
        return analytics.certificacion
    }

    // MARK: - Fetch Tendencias
    /// Obtiene tendencias y proyecciones
    func fetchTendencias(periodo: String? = nil) async throws -> TendenciasAnalytics {
        let analytics = try await fetchAnalyticsData(periodo: periodo)
        return analytics.tendencias
    }
}

// MARK: - Periodo Analytics Enum
/// Enum para los períodos de tiempo disponibles en analytics
enum PeriodoAnalytics: String, CaseIterable, Identifiable {
    case semanal = "7d"
    case mensual = "30d"
    case trimestral = "90d"
    case anual = "365d"

    var id: String { rawValue }

    /// Nombre para mostrar en UI
    var displayName: String {
        switch self {
        case .semanal:
            return "Última Semana"
        case .mensual:
            return "Último Mes"
        case .trimestral:
            return "Último Trimestre"
        case .anual:
            return "Último Año"
        }
    }

    /// Descripción corta
    var shortName: String {
        switch self {
        case .semanal:
            return "7 días"
        case .mensual:
            return "30 días"
        case .trimestral:
            return "90 días"
        case .anual:
            return "365 días"
        }
    }

    /// Icono SF Symbol
    var icon: String {
        switch self {
        case .semanal:
            return "calendar"
        case .mensual:
            return "calendar.badge.clock"
        case .trimestral:
            return "calendar.circle"
        case .anual:
            return "calendar.badge.checkmark"
        }
    }
}
