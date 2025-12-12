import Foundation

// MARK: - Lote Service
/// Servicio para operaciones CRUD de lotes
@MainActor
class LoteService: ObservableObject {
    // MARK: - Singleton
    static let shared = LoteService()

    // MARK: - Published Properties
    @Published private(set) var lotes: [Lote] = []
    @Published private(set) var isLoading = false
    @Published private(set) var errorMessage: String?

    // MARK: - Private Properties
    private let apiClient = APIClient.shared

    // MARK: - Inicialización
    private init() {}

    // MARK: - Fetch Lotes
    /// Obtiene todos los lotes
    func fetchLotes() async throws {
        isLoading = true
        errorMessage = nil

        defer { isLoading = false }

        do {
            let response: LotesResponse = try await apiClient.request(
                endpoint: .lotes,
                method: .get
            )

            lotes = response.lotes
            print("✅ Lotes cargados: \(response.total)")

        } catch {
            errorMessage = (error as? NetworkError)?.errorDescription ?? error.localizedDescription
            print("❌ Error cargando lotes: \(error)")
            throw error
        }
    }

    // MARK: - Fetch Lote by ID
    /// Obtiene un lote específico por ID
    /// - Parameter id: ID del lote
    /// - Returns: Lote encontrado
    func fetchLote(id: String) async throws -> Lote {
        isLoading = true
        errorMessage = nil

        defer { isLoading = false }

        do {
            let lote: Lote = try await apiClient.request(
                endpoint: .lote(id: id),
                method: .get
            )

            print("✅ Lote cargado: \(lote.nombre)")
            return lote

        } catch {
            errorMessage = (error as? NetworkError)?.errorDescription ?? error.localizedDescription
            print("❌ Error cargando lote: \(error)")
            throw error
        }
    }

    // MARK: - Create Lote
    /// Crea un nuevo lote
    /// - Parameter request: Datos del lote a crear
    /// - Returns: Lote creado
    func createLote(_ request: CreateLoteRequest) async throws -> Lote {
        isLoading = true
        errorMessage = nil

        defer { isLoading = false }

        do {
            let lote: Lote = try await apiClient.request(
                endpoint: .createLote,
                method: .post,
                body: request
            )

            // Agregar a la lista local
            lotes.append(lote)

            // Log evento
            logEvent("lote_created", parameters: [
                "tipo_cultivo": request.tipoCultivo,
                "ubicacion": request.ubicacion
            ])

            print("✅ Lote creado: \(lote.nombre)")
            return lote

        } catch {
            errorMessage = (error as? NetworkError)?.errorDescription ?? error.localizedDescription
            print("❌ Error creando lote: \(error)")

            // Log error
            logEvent("lote_creation_failed", parameters: ["error": errorMessage ?? "unknown"])

            throw error
        }
    }

    // MARK: - Update Lote
    /// Actualiza un lote existente
    /// - Parameters:
    ///   - id: ID del lote
    ///   - request: Datos actualizados
    /// - Returns: Lote actualizado
    func updateLote(id: String, request: CreateLoteRequest) async throws -> Lote {
        isLoading = true
        errorMessage = nil

        defer { isLoading = false }

        do {
            let lote: Lote = try await apiClient.request(
                endpoint: .updateLote(id: id),
                method: .put,
                body: request
            )

            // Actualizar en la lista local
            if let index = lotes.firstIndex(where: { $0.id == id }) {
                lotes[index] = lote
            }

            print("✅ Lote actualizado: \(lote.nombre)")
            return lote

        } catch {
            errorMessage = (error as? NetworkError)?.errorDescription ?? error.localizedDescription
            print("❌ Error actualizando lote: \(error)")
            throw error
        }
    }

    // MARK: - Delete Lote
    /// Elimina un lote
    /// - Parameter id: ID del lote a eliminar
    func deleteLote(id: String) async throws {
        isLoading = true
        errorMessage = nil

        defer { isLoading = false }

        do {
            try await apiClient.requestWithoutResponse(
                endpoint: .deleteLote(id: id),
                method: .delete
            )

            // Eliminar de la lista local
            lotes.removeAll { $0.id == id }

            print("✅ Lote eliminado: \(id)")

        } catch {
            errorMessage = (error as? NetworkError)?.errorDescription ?? error.localizedDescription
            print("❌ Error eliminando lote: \(error)")
            throw error
        }
    }

    // MARK: - Helpers
    /// Log de eventos (Firebase Analytics)
    private func logEvent(_ name: String, parameters: [String: Any]?) {
        guard AppConfiguration.enableFirebaseAnalytics else { return }

        // TODO: Agregar cuando Firebase esté configurado
        // Analytics.logEvent(name, parameters: parameters)

        print("📊 Analytics Event: \(name) - \(parameters ?? [:])")
    }
}
