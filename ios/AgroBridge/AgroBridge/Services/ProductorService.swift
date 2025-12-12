import Foundation
import Combine

// MARK: - ProductorService
/// Servicio para gestionar operaciones CRUD de productores
@MainActor
class ProductorService: ObservableObject {
    // MARK: - Singleton
    static let shared = ProductorService()

    // MARK: - Published Properties
    @Published private(set) var productores: [Productor] = []
    @Published private(set) var isLoading = false

    // MARK: - Dependencies
    private let apiClient: APIClient

    // MARK: - Inicialización
    private init(apiClient: APIClient = .shared) {
        self.apiClient = apiClient
    }

    // MARK: - CRUD Operations

    /// Obtiene la lista de todos los productores
    func fetchProductores() async throws {
        isLoading = true
        defer { isLoading = false }

        do {
            let response: ProductoresListResponse = try await apiClient.request(
                endpoint: .productores,
                method: .get
            )

            productores = response.productores
        } catch {
            print("❌ Error fetching productores: \(error)")
            throw error
        }
    }

    /// Obtiene un productor específico por ID
    func fetchProductor(id: String) async throws -> Productor {
        do {
            let response: ProductorResponse = try await apiClient.request(
                endpoint: .productor(id: id),
                method: .get
            )

            return response.productor
        } catch {
            print("❌ Error fetching productor \(id): \(error)")
            throw error
        }
    }

    /// Crea un nuevo productor
    func createProductor(_ request: CreateProductorRequest) async throws -> Productor {
        do {
            let response: ProductorResponse = try await apiClient.request(
                endpoint: .createProductor,
                method: .post,
                body: request
            )

            // Actualizar lista local
            productores.append(response.productor)

            print("✅ Productor creado: \(response.productor.nombre)")
            return response.productor

        } catch {
            print("❌ Error creating productor: \(error)")
            throw error
        }
    }

    /// Actualiza un productor existente
    func updateProductor(id: String, request: CreateProductorRequest) async throws -> Productor {
        do {
            let response: ProductorResponse = try await apiClient.request(
                endpoint: .updateProductor(id: id),
                method: .put,
                body: request
            )

            // Actualizar lista local
            if let index = productores.firstIndex(where: { $0.id == id }) {
                productores[index] = response.productor
            }

            print("✅ Productor actualizado: \(response.productor.nombre)")
            return response.productor

        } catch {
            print("❌ Error updating productor \(id): \(error)")
            throw error
        }
    }

    /// Elimina un productor
    func deleteProductor(id: String) async throws {
        do {
            try await apiClient.requestWithoutResponse(
                endpoint: .deleteProductor(id: id),
                method: .delete
            )

            // Actualizar lista local
            productores.removeAll { $0.id == id }

            print("✅ Productor eliminado: \(id)")

        } catch {
            print("❌ Error deleting productor \(id): \(error)")
            throw error
        }
    }

    /// Busca productores por nombre, email o ubicación
    func searchProductores(query: String) -> [Productor] {
        guard !query.isEmpty else { return productores }

        return productores.filter { productor in
            productor.nombre.localizedCaseInsensitiveContains(query) ||
            (productor.email?.localizedCaseInsensitiveContains(query) ?? false) ||
            (productor.ubicacion?.localizedCaseInsensitiveContains(query) ?? false)
        }
    }

    /// Filtra productores por estado
    func filterByEstado(_ estado: ProductorEstado) -> [Productor] {
        return productores.filter { $0.estado == estado }
    }

    /// Obtiene el total de lotes de todos los productores
    func getTotalLotes() -> Int {
        return productores.compactMap { $0.totalLotes }.reduce(0, +)
    }

    /// Limpia la caché de productores
    func clearCache() {
        productores = []
    }
}
