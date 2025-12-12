import Foundation
import Combine

// MARK: - DashboardViewModel
/// ViewModel para la pantalla de Dashboard
@MainActor
class DashboardViewModel: ObservableObject {
    // MARK: - Published Properties
    @Published private(set) var stats: DashboardStats?
    @Published private(set) var isLoading = false
    @Published private(set) var errorMessage: String?
    @Published var showError = false

    // MARK: - Dependencies
    private let dashboardService: DashboardService

    // MARK: - Inicialización
    init(dashboardService: DashboardService = .shared) {
        self.dashboardService = dashboardService
    }

    // MARK: - Actions
    /// Carga las estadísticas del dashboard
    func loadStats() async {
        isLoading = true
        errorMessage = nil
        showError = false

        defer { isLoading = false }

        do {
            try await dashboardService.fetchStats()
            stats = dashboardService.stats

        } catch {
            errorMessage = (error as? NetworkError)?.errorDescription ?? error.localizedDescription
            showError = true
        }
    }

    /// Refresca las estadísticas
    func refresh() async {
        await loadStats()
    }
}
