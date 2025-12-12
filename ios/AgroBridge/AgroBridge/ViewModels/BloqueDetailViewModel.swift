import Foundation
import Combine

// MARK: - BloqueDetailViewModel
/// ViewModel para la vista de detalle de un bloque
@MainActor
class BloqueDetailViewModel: ObservableObject {
    // MARK: - Published Properties
    @Published private(set) var bloque: Bloque
    @Published private(set) var stats: BloqueStats?
    @Published private(set) var isLoading = false
    @Published private(set) var errorMessage: String?
    @Published var showError = false
    @Published var showDeleteConfirmation = false
    @Published var showEditBloque = false

    // MARK: - Dependencies
    private let bloqueService: BloqueService

    // MARK: - Callbacks
    var onDeleted: (() -> Void)?
    var onUpdated: ((Bloque) -> Void)?

    // MARK: - Inicialización
    init(bloque: Bloque, bloqueService: BloqueService = .shared) {
        self.bloque = bloque
        self.bloqueService = bloqueService

        // Cargar estadísticas al inicializar
        Task {
            await loadStats()
        }
    }

    // MARK: - Actions
    /// Carga las estadísticas del bloque
    func loadStats() async {
        do {
            let fetchedStats = try await bloqueService.fetchBloqueStats(id: bloque.id)
            stats = fetchedStats
        } catch {
            print("⚠️ Could not load stats: \(error)")
            // No mostrar error para stats, es opcional
        }
    }

    /// Refresca los datos del bloque desde el servidor
    func refresh() async {
        isLoading = true
        errorMessage = nil
        showError = false

        defer { isLoading = false }

        do {
            let updatedBloque = try await bloqueService.fetchBloque(id: bloque.id)
            bloque = updatedBloque
            onUpdated?(updatedBloque)

            // Recargar estadísticas
            await loadStats()

        } catch {
            errorMessage = (error as? NetworkError)?.errorDescription ?? error.localizedDescription
            showError = true
        }
    }

    /// Elimina el bloque
    func deleteBloque() async -> Bool {
        isLoading = true
        errorMessage = nil
        showError = false

        defer { isLoading = false }

        do {
            try await bloqueService.deleteBloque(id: bloque.id)
            onDeleted?()
            return true

        } catch {
            errorMessage = (error as? NetworkError)?.errorDescription ?? error.localizedDescription
            showError = true
            return false
        }
    }

    /// Muestra la confirmación de eliminación
    func confirmDelete() {
        showDeleteConfirmation = true
    }

    /// Actualiza el bloque local después de editar
    func updateBloque(_ updatedBloque: Bloque) {
        bloque = updatedBloque
        onUpdated?(updatedBloque)
    }
}
