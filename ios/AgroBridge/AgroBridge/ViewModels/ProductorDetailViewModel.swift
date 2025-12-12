import Foundation
import Combine

// MARK: - ProductorDetailViewModel
/// ViewModel para la vista de detalle de un productor
@MainActor
class ProductorDetailViewModel: ObservableObject {
    // MARK: - Published Properties
    @Published private(set) var productor: Productor
    @Published private(set) var isLoading = false
    @Published private(set) var errorMessage: String?
    @Published var showError = false
    @Published var showDeleteConfirmation = false
    @Published var showEditProductor = false

    // MARK: - Dependencies
    private let productorService: ProductorService

    // MARK: - Callbacks
    var onDeleted: (() -> Void)?
    var onUpdated: ((Productor) -> Void)?

    // MARK: - Inicialización
    init(productor: Productor, productorService: ProductorService = .shared) {
        self.productor = productor
        self.productorService = productorService
    }

    // MARK: - Actions
    /// Refresca los datos del productor desde el servidor
    func refresh() async {
        isLoading = true
        errorMessage = nil
        showError = false

        defer { isLoading = false }

        do {
            let updatedProductor = try await productorService.fetchProductor(id: productor.id)
            productor = updatedProductor
            onUpdated?(updatedProductor)

        } catch {
            errorMessage = (error as? NetworkError)?.errorDescription ?? error.localizedDescription
            showError = true
        }
    }

    /// Elimina el productor
    func deleteProductor() async -> Bool {
        isLoading = true
        errorMessage = nil
        showError = false

        defer { isLoading = false }

        do {
            try await productorService.deleteProductor(id: productor.id)
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

    /// Actualiza el productor local después de editar
    func updateProductor(_ updatedProductor: Productor) {
        productor = updatedProductor
        onUpdated?(updatedProductor)
    }
}
