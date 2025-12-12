import Foundation
import Combine

// MARK: - BloqueService
/// Servicio para gestionar operaciones CRUD de bloques
@MainActor
class BloqueService: ObservableObject {
    // MARK: - Singleton
    static let shared = BloqueService()

    // MARK: - Published Properties
    @Published private(set) var bloques: [Bloque] = []
    @Published private(set) var isLoading = false

    // MARK: - Dependencies
    private let apiClient: APIClient

    // MARK: - Inicialización
    private init(apiClient: APIClient = .shared) {
        self.apiClient = apiClient
    }

    // MARK: - CRUD Operations

    /// Obtiene la lista de todos los bloques
    func fetchBloques() async throws {
        isLoading = true
        defer { isLoading = false }

        do {
            let response: BloquesListResponse = try await apiClient.request(
                endpoint: .bloques,
                method: .get
            )

            bloques = response.bloques
        } catch {
            print("❌ Error fetching bloques: \(error)")
            throw error
        }
    }

    /// Obtiene un bloque específico por ID
    func fetchBloque(id: String) async throws -> Bloque {
        do {
            let response: BloqueResponse = try await apiClient.request(
                endpoint: .bloque(id: id),
                method: .get
            )

            return response.bloque
        } catch {
            print("❌ Error fetching bloque \(id): \(error)")
            throw error
        }
    }

    /// Obtiene las estadísticas de un bloque
    func fetchBloqueStats(id: String) async throws -> BloqueStats {
        do {
            let stats: BloqueStats = try await apiClient.request(
                endpoint: .bloqueStats(id: id),
                method: .get
            )

            return stats
        } catch {
            print("❌ Error fetching bloque stats \(id): \(error)")
            throw error
        }
    }

    /// Crea un nuevo bloque
    func createBloque(_ request: CreateBloqueRequest) async throws -> Bloque {
        do {
            let response: BloqueResponse = try await apiClient.request(
                endpoint: .createBloque,
                method: .post,
                body: request
            )

            // Actualizar lista local
            bloques.append(response.bloque)

            print("✅ Bloque creado: \(response.bloque.nombre)")
            return response.bloque

        } catch {
            print("❌ Error creating bloque: \(error)")
            throw error
        }
    }

    /// Actualiza un bloque existente
    func updateBloque(id: String, request: CreateBloqueRequest) async throws -> Bloque {
        do {
            let response: BloqueResponse = try await apiClient.request(
                endpoint: .updateBloque(id: id),
                method: .put,
                body: request
            )

            // Actualizar lista local
            if let index = bloques.firstIndex(where: { $0.id == id }) {
                bloques[index] = response.bloque
            }

            print("✅ Bloque actualizado: \(response.bloque.nombre)")
            return response.bloque

        } catch {
            print("❌ Error updating bloque \(id): \(error)")
            throw error
        }
    }

    /// Elimina un bloque
    func deleteBloque(id: String) async throws {
        do {
            try await apiClient.requestWithoutResponse(
                endpoint: .deleteBloque(id: id),
                method: .delete
            )

            // Actualizar lista local
            bloques.removeAll { $0.id == id }

            print("✅ Bloque eliminado: \(id)")

        } catch {
            print("❌ Error deleting bloque \(id): \(error)")
            throw error
        }
    }

    /// Busca bloques por nombre o descripción
    func searchBloques(query: String) -> [Bloque] {
        guard !query.isEmpty else { return bloques }

        return bloques.filter { bloque in
            bloque.nombre.localizedCaseInsensitiveContains(query) ||
            (bloque.descripcion?.localizedCaseInsensitiveContains(query) ?? false)
        }
    }

    /// Filtra bloques por estado
    func filterByEstado(_ estado: BloqueEstado) -> [Bloque] {
        return bloques.filter { $0.estado == estado }
    }

    /// Obtiene solo bloques certificados
    func getCertificados() -> [Bloque] {
        return bloques.filter { $0.certificado }
    }

    /// Obtiene bloques por productor
    func getByProductor(productorId: String) -> [Bloque] {
        return bloques.filter { $0.productorId == productorId }
    }

    /// Obtiene el total de bloques certificados
    func getTotalCertificados() -> Int {
        return bloques.filter { $0.certificado }.count
    }

    /// Limpia la caché de bloques
    func clearCache() {
        bloques = []
    }
}
