import Foundation
import Combine

// MARK: - EditBloqueViewModel
/// ViewModel para editar un bloque existente
@MainActor
class EditBloqueViewModel: ObservableObject {
    // MARK: - Published Properties
    @Published var nombre: String
    @Published var descripcion: String
    @Published var selectedLoteIds: [String]
    @Published var notas: String

    @Published private(set) var isLoading = false
    @Published private(set) var errorMessage: String?
    @Published var showError = false
    @Published var showSuccess = false

    // MARK: - Available Data
    @Published var availableLotes: [Lote] = []

    // MARK: - Private Properties
    private let bloqueId: String
    private let bloqueService: BloqueService
    private let loteService: LoteService

    // MARK: - Callbacks
    var onUpdated: ((Bloque) -> Void)?

    // MARK: - Computed Properties
    /// Validación del formulario
    var isFormValid: Bool {
        return !nombre.isBlank
    }

    /// Verifica si hay cambios pendientes
    var hasChanges: Bool {
        // Simplificado por ahora
        return true
    }

    // MARK: - Inicialización
    init(bloque: Bloque, bloqueService: BloqueService = .shared, loteService: LoteService = .shared) {
        self.bloqueId = bloque.id
        self.bloqueService = bloqueService
        self.loteService = loteService

        // Pre-llenar campos con datos actuales
        self.nombre = bloque.nombre
        self.descripcion = bloque.descripcion ?? ""
        self.selectedLoteIds = bloque.loteIds ?? []
        self.notas = bloque.metadata?.notas ?? ""

        // Cargar lotes disponibles
        Task {
            await loadAvailableLotes()
        }
    }

    // MARK: - Actions
    /// Carga los lotes disponibles para asociar
    func loadAvailableLotes() async {
        do {
            try await loteService.fetchLotes()
            availableLotes = loteService.lotes
        } catch {
            print("❌ Error loading lotes: \(error)")
        }
    }

    /// Alterna la selección de un lote
    func toggleLoteSelection(_ loteId: String) {
        if selectedLoteIds.contains(loteId) {
            selectedLoteIds.removeAll { $0 == loteId }
        } else {
            selectedLoteIds.append(loteId)
        }
    }

    /// Verifica si un lote está seleccionado
    func isLoteSelected(_ loteId: String) -> Bool {
        return selectedLoteIds.contains(loteId)
    }

    /// Actualiza el bloque
    func updateBloque() async -> Bool {
        isLoading = true
        errorMessage = nil
        showError = false

        defer { isLoading = false }

        do {
            // Crear metadata si hay notas
            let metadata = notas.isBlank ? nil : BloqueMetadata(
                blockchainHash: nil,
                certificaciones: nil,
                auditorias: nil,
                calidadPromedio: nil,
                totalKilosProducidos: nil,
                documentos: nil,
                notas: notas
            )

            // Crear request
            let request = CreateBloqueRequest(
                nombre: nombre.trimmed,
                descripcion: descripcion.isBlank ? nil : descripcion.trimmed,
                productorId: nil,
                loteIds: selectedLoteIds.isEmpty ? nil : selectedLoteIds,
                metadata: metadata
            )

            // Llamar al servicio
            let updatedBloque = try await bloqueService.updateBloque(id: bloqueId, request: request)

            // Éxito
            showSuccess = true
            onUpdated?(updatedBloque)
            return true

        } catch {
            // Manejar error
            errorMessage = (error as? NetworkError)?.errorDescription ?? error.localizedDescription
            showError = true
            return false
        }
    }
}
