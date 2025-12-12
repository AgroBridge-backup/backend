import Foundation
import Combine

// MARK: - CreateLoteViewModel
/// ViewModel para la pantalla de crear lote
@MainActor
class CreateLoteViewModel: ObservableObject {
    // MARK: - Published Properties
    @Published var nombre = ""
    @Published var ubicacion = ""
    @Published var tipoCultivo = ""
    @Published var areaHectareas = ""
    @Published var notas = ""

    @Published private(set) var isLoading = false
    @Published private(set) var errorMessage: String?
    @Published var showError = false
    @Published var showSuccess = false

    // MARK: - Dependencies
    private let loteService: LoteService

    // MARK: - Computed Properties
    /// Validación del formulario
    var isFormValid: Bool {
        return !nombre.isBlank &&
               !ubicacion.isBlank &&
               !tipoCultivo.isBlank
    }

    // MARK: - Inicialización
    init(loteService: LoteService = .shared) {
        self.loteService = loteService
    }

    // MARK: - Actions
    /// Crea un nuevo lote
    func createLote() async -> Bool {
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
                productorId: nil, // TODO: Obtener del usuario actual
                metadata: metadata
            )

            // Llamar al servicio
            _ = try await loteService.createLote(request)

            // Éxito
            showSuccess = true
            clearForm()
            return true

        } catch {
            // Manejar error
            errorMessage = (error as? NetworkError)?.errorDescription ?? error.localizedDescription
            showError = true
            return false
        }
    }

    /// Limpia el formulario
    func clearForm() {
        nombre = ""
        ubicacion = ""
        tipoCultivo = ""
        areaHectareas = ""
        notas = ""
    }
}
