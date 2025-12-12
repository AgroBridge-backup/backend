import Foundation
import Combine

// MARK: - EditLoteViewModel
/// ViewModel para editar un lote existente
@MainActor
class EditLoteViewModel: ObservableObject {
    // MARK: - Published Properties
    @Published var nombre: String
    @Published var ubicacion: String
    @Published var tipoCultivo: String
    @Published var areaHectareas: String
    @Published var notas: String

    @Published private(set) var isLoading = false
    @Published private(set) var errorMessage: String?
    @Published var showError = false
    @Published var showSuccess = false

    // MARK: - Private Properties
    private let loteId: String
    private let loteService: LoteService

    // MARK: - Callbacks
    var onUpdated: ((Lote) -> Void)?

    // MARK: - Computed Properties
    /// Validación del formulario
    var isFormValid: Bool {
        return !nombre.isBlank &&
               !ubicacion.isBlank &&
               !tipoCultivo.isBlank
    }

    /// Verifica si hay cambios pendientes
    var hasChanges: Bool {
        // Compara con valores originales
        return true // Simplificado por ahora
    }

    // MARK: - Inicialización
    init(lote: Lote, loteService: LoteService = .shared) {
        self.loteId = lote.id
        self.loteService = loteService

        // Pre-llenar campos con datos actuales
        self.nombre = lote.nombre
        self.ubicacion = lote.ubicacion
        self.tipoCultivo = lote.tipoCultivo
        self.areaHectareas = lote.areaHectareas != nil ? String(lote.areaHectareas!) : ""
        self.notas = lote.metadata?.notas ?? ""
    }

    // MARK: - Actions
    /// Actualiza el lote
    func updateLote() async -> Bool {
        isLoading = true
        errorMessage = nil
        showError = false

        defer { isLoading = false }

        do {
            // Parsear área a Double si está presente
            let area = areaHectareas.isBlank ? nil : Double(areaHectareas)

            // Crear metadata si hay notas
            let metadata = notas.isBlank ? nil : LoteMetadata(
                coordenadasGPS: nil,
                fotos: nil,
                notas: notas
            )

            // Crear request
            let request = CreateLoteRequest(
                nombre: nombre.trimmed,
                ubicacion: ubicacion.trimmed,
                tipoCultivo: tipoCultivo.trimmed,
                areaHectareas: area,
                productorId: nil,
                metadata: metadata
            )

            // Llamar al servicio
            let updatedLote = try await loteService.updateLote(id: loteId, request: request)

            // Éxito
            showSuccess = true
            onUpdated?(updatedLote)
            return true

        } catch {
            // Manejar error
            errorMessage = (error as? NetworkError)?.errorDescription ?? error.localizedDescription
            showError = true
            return false
        }
    }
}
