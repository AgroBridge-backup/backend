import Foundation
import Combine

// MARK: - LoteDetailViewModel
/// ViewModel para la vista de detalle de un lote
@MainActor
class LoteDetailViewModel: ObservableObject {
    // MARK: - Published Properties
    @Published private(set) var lote: Lote
    @Published private(set) var isLoading = false
    @Published private(set) var errorMessage: String?
    @Published var showError = false
    @Published var showDeleteConfirmation = false
    @Published var showEditLote = false

    // MARK: - Dependencies
    private let loteService: LoteService

    // MARK: - Callbacks
    var onDeleted: (() -> Void)?
    var onUpdated: ((Lote) -> Void)?

    // MARK: - Inicialización
    init(lote: Lote, loteService: LoteService = .shared) {
        self.lote = lote
        self.loteService = loteService
    }

    // MARK: - Actions
    /// Refresca los datos del lote desde el servidor
    func refresh() async {
        isLoading = true
        errorMessage = nil
        showError = false

        defer { isLoading = false }

        do {
            let updatedLote = try await loteService.fetchLote(id: lote.id)
            lote = updatedLote
            onUpdated?(updatedLote)

        } catch {
            errorMessage = (error as? NetworkError)?.errorDescription ?? error.localizedDescription
            showError = true
        }
    }

    /// Elimina el lote
    func deleteLote() async -> Bool {
        isLoading = true
        errorMessage = nil
        showError = false

        defer { isLoading = false }

        do {
            try await loteService.deleteLote(id: lote.id)
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

    /// Actualiza el lote local después de editar
    func updateLote(_ updatedLote: Lote) {
        lote = updatedLote
        onUpdated?(updatedLote)
    }
}
