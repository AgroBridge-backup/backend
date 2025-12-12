import Foundation
import Combine

// MARK: - CreateBloqueViewModel
/// ViewModel para crear un nuevo bloque
@MainActor
class CreateBloqueViewModel: ObservableObject {
    // MARK: - Published Properties
    @Published var nombre = ""
    @Published var descripcion = ""
    @Published var selectedLoteIds: [String] = []
    @Published var notas = ""

    @Published private(set) var isLoading = false
    @Published private(set) var errorMessage: String?
    @Published var showError = false
    @Published var showSuccess = false

    // MARK: - Available Data
    @Published var availableLotes: [Lote] = []

    // MARK: - Private Properties
    private let bloqueService: BloqueService
    private let loteService: LoteService

    // MARK: - Callbacks
    var onCreated: ((Bloque) -> Void)?

    // MARK: - Computed Properties
    /// Validación del formulario
    var isFormValid: Bool {
        return !nombre.isBlank
    }

    // MARK: - Inicialización
    init(bloqueService: BloqueService = .shared, loteService: LoteService = .shared) {
        self.bloqueService = bloqueService
        self.loteService = loteService

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

    /// Crea un nuevo bloque
    func createBloque() async -> Bool {
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
                productorId: nil, // TODO: Asociar con productor si es necesario
                loteIds: selectedLoteIds.isEmpty ? nil : selectedLoteIds,
                metadata: metadata
            )

            // Llamar al servicio
            let newBloque = try await bloqueService.createBloque(request)

            // Éxito
            showSuccess = true
            onCreated?(newBloque)
            return true

        } catch {
            // Manejar error
            errorMessage = (error as? NetworkError)?.errorDescription ?? error.localizedDescription
            showError = true
            return false
        }
    }

    /// Resetea el formulario
    func resetForm() {
        nombre = ""
        descripcion = ""
        selectedLoteIds = []
        notas = ""
        errorMessage = nil
        showError = false
        showSuccess = false
    }
}
