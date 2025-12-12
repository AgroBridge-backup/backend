import Foundation

// MARK: - Dashboard Service
/// Servicio para obtener estadísticas del dashboard
@MainActor
class DashboardService: ObservableObject {
    // MARK: - Singleton
    static let shared = DashboardService()

    // MARK: - Published Properties
    @Published private(set) var stats: DashboardStats?
    @Published private(set) var isLoading = false
    @Published private(set) var errorMessage: String?

    // MARK: - Private Properties
    private let apiClient = APIClient.shared

    // MARK: - Inicialización
    private init() {}

    // MARK: - Fetch Stats
    /// Obtiene las estadísticas del dashboard
    func fetchStats() async throws {
        isLoading = true
        errorMessage = nil

        defer { isLoading = false }

        do {
            let stats: DashboardStats = try await apiClient.request(
                endpoint: .dashboardStats,
                method: .get
            )

            self.stats = stats
            print("✅ Dashboard stats cargadas")

        } catch {
            errorMessage = (error as? NetworkError)?.errorDescription ?? error.localizedDescription
            print("❌ Error cargando stats: \(error)")
            throw error
        }
    }

    // MARK: - Refresh
    /// Refresca las estadísticas
    func refresh() async {
        do {
            try await fetchStats()
        } catch {
            print("❌ Error en refresh: \(error)")
        }
    }
}
