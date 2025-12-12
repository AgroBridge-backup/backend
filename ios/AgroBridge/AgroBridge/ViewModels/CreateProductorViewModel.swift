import Foundation
import Combine

// MARK: - CreateProductorViewModel
/// ViewModel para crear un nuevo productor
@MainActor
class CreateProductorViewModel: ObservableObject {
    // MARK: - Published Properties
    @Published var nombre = ""
    @Published var email = ""
    @Published var telefono = ""
    @Published var direccion = ""
    @Published var ubicacion = ""
    @Published var documentoIdentidad = ""
    @Published var tipoDocumento: TipoDocumento = .dni
    @Published var notas = ""

    @Published private(set) var isLoading = false
    @Published private(set) var errorMessage: String?
    @Published var showError = false
    @Published var showSuccess = false

    // MARK: - Private Properties
    private let productorService: ProductorService

    // MARK: - Callbacks
    var onCreated: ((Productor) -> Void)?

    // MARK: - Computed Properties
    /// Validación del formulario
    var isFormValid: Bool {
        return !nombre.isBlank
    }

    /// Validación del email
    var isEmailValid: Bool {
        guard !email.isBlank else { return true } // Email es opcional
        return email.isValidEmail
    }

    // MARK: - Inicialización
    init(productorService: ProductorService = .shared) {
        self.productorService = productorService
    }

    // MARK: - Actions
    /// Crea un nuevo productor
    func createProductor() async -> Bool {
        isLoading = true
        errorMessage = nil
        showError = false

        defer { isLoading = false }

        // Validar email si está presente
        if !email.isBlank && !email.isValidEmail {
            errorMessage = "El email ingresado no es válido"
            showError = true
            return false
        }

        do {
            // Crear metadata si hay notas
            let metadata = notas.isBlank ? nil : ProductorMetadata(
                certificaciones: nil,
                experienciaAnos: nil,
                especialidades: nil,
                notas: notas,
                avatar: nil
            )

            // Crear request
            let request = CreateProductorRequest(
                nombre: nombre.trimmed,
                email: email.isBlank ? nil : email.trimmed,
                telefono: telefono.isBlank ? nil : telefono.trimmed,
                direccion: direccion.isBlank ? nil : direccion.trimmed,
                ubicacion: ubicacion.isBlank ? nil : ubicacion.trimmed,
                documentoIdentidad: documentoIdentidad.isBlank ? nil : documentoIdentidad.trimmed,
                tipoDocumento: documentoIdentidad.isBlank ? nil : tipoDocumento,
                metadata: metadata
            )

            // Llamar al servicio
            let newProductor = try await productorService.createProductor(request)

            // Éxito
            showSuccess = true
            onCreated?(newProductor)
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
        email = ""
        telefono = ""
        direccion = ""
        ubicacion = ""
        documentoIdentidad = ""
        tipoDocumento = .dni
        notas = ""
        errorMessage = nil
        showError = false
        showSuccess = false
    }
}
