//
//  LoteRepositoryImpl.swift
//  AgroBridge
//
//  Created by Alejandro Navarro Ayala - CEO & Senior Developer
//  Copyright © 2025 AgroBridge International. All rights reserved.
//
//  ANDROID EQUIVALENT: data/repository/LoteRepositoryImpl.kt
//

import Foundation
import Combine
import CoreData

/**
 * LoteRepositoryImpl - Repository de Lotes con arquitectura OFFLINE-FIRST
 *
 * ANDROID EQUIVALENT: class LoteRepositoryImpl @Inject constructor(...)
 *
 * Flujo de datos:
 * 1. API (URLSession) obtiene datos remotos
 * 2. Los datos se persisten en CoreData (SQLite local)
 * 3. La UI observa los datos desde CoreData (siempre tiene algo que mostrar)
 * 4. Si no hay internet, la UI muestra datos cacheados localmente
 *
 * Patrón: Single Source of Truth (SSOT) - La DB local es la verdad
 *
 * Upload Sync (Offline-First Write):
 * 1. Usuario crea/edita lote localmente → PENDING_CREATE/PENDING_UPDATE
 * 2. Se guarda en CoreData → UI se actualiza inmediatamente
 * 3. Background task detecta cambios y sube a servidor
 * 4. Task reintenta si falla, cuando haya conexión
 *
 * ANDROID PARITY: Matches LoteRepositoryImpl.kt architecture 100%
 * - Same offline-first pattern
 * - Same CRUD operations
 * - Same sync logic
 * - Same error handling
 */
@MainActor
class LoteRepositoryImpl: ObservableObject {

    // MARK: - Singleton

    static let shared = LoteRepositoryImpl()

    // MARK: - Dependencies

    private let coreDataManager = CoreDataManager.shared
    private let tokenManager = TokenManager.shared
    private let networkMonitor = NetworkMonitor.shared
    private let errorHandler = ErrorHandler.shared
    private let mapper = LoteMapper.shared

    // FIXED: L-012 - Use AppConfiguration instead of hardcoded URL
    private var baseURL: String {
        AppConfiguration.baseURL
    }

    // MARK: - Published Properties

    /// Indica si hay cambios pendientes de sincronizar
    @Published private(set) var hasPendingChanges = false

    /// Número de lotes pendientes de sincronizar
    @Published private(set) var pendingCount = 0

    /// Timestamp de última sincronización exitosa
    @Published private(set) var lastSyncTimestamp: Date?

    // MARK: - URLSession

    private let session: URLSession = {
        let config = URLSessionConfiguration.default
        config.timeoutIntervalForRequest = 30
        config.timeoutIntervalForResource = 60
        return URLSession(configuration: config)
    }()

    // MARK: - Initialization

    private init() {
        Task {
            await updatePendingCount()
        }
    }

    // MARK: - Fetch Lotes (OBSERVABLE)

    /**
     * Obtener lotes de un productor específico desde CoreData
     *
     * ANDROID EQUIVALENT: `fun getLotes(productorId: String, page: Int, pageSize: Int): Flow<List<Lote>>`
     *
     * VENTAJA OFFLINE-FIRST:
     * - Si la app se abre sin internet, se muestran lotes cacheados
     * - Cuando hay conexión, se actualiza automáticamente
     *
     * - Parameters:
     *   - productorId: ID del productor
     * - Returns: Array de Lote domain models
     */
    func getLotes(productorId: String) async throws -> [Lote] {
        let entities = try await coreDataManager.fetchLotes(forProductorId: productorId)
        return mapper.toDomain(from: entities)
    }

    /**
     * Obtener todos los lotes desde CoreData
     *
     * ANDROID EQUIVALENT: `fun getAllLotes(): Flow<List<Lote>>`
     */
    func getAllLotes() async throws -> [Lote] {
        let entities = try await coreDataManager.fetchAllLotes()
        return mapper.toDomain(from: entities)
    }

    /**
     * Obtener un lote específico por ID
     *
     * ANDROID EQUIVALENT: `fun getLoteById(loteId: String): Flow<Lote?>`
     *
     * - Parameter loteId: ID del lote
     * - Returns: Lote domain model o nil si no existe
     */
    func getLoteById(_ loteId: String) async throws -> Lote? {
        guard let entity = try await coreDataManager.fetchLote(byId: loteId) else {
            return nil
        }

        return mapper.toDomain(from: entity)
    }

    /**
     * Obtener lotes por estado
     *
     * ANDROID EQUIVALENT: `fun getActiveLotes(productorId: String): Flow<List<Lote>>`
     */
    func getLotes(byEstado estado: LoteEstado) async throws -> [Lote] {
        let entities = try await coreDataManager.fetchLotes(withEstado: estado.rawValue)
        return mapper.toDomain(from: entities)
    }

    // MARK: - Refresh from API (SYNC DOWN)

    /**
     * SINCRONIZACIÓN: Descargar lotes desde API y guardar en CoreData
     *
     * ANDROID EQUIVALENT: `suspend fun refreshLotes(productorId: String): Result<Unit>`
     *
     * FLUJO:
     * 1. Intenta obtener datos de la API
     * 2. Si éxito, guarda en CoreData (transacción atómica)
     * 3. Los observadores se actualizan automáticamente
     * 4. La UI se refresca sin intervención manual
     *
     * - Parameter productorId: ID del productor
     * - Returns: Result<Void> indicando éxito o fallo
     */
    func refreshLotes(productorId: String) async -> Result<Void, Error> {
        do {
            print("🔄 LoteRepository: Iniciando sincronización de lotes para productor: \(productorId)")

            // Obtener datos de la API
            let endpoint = "/v1/lotes?productor_id=\(productorId)"
            let response: LotesResponse = try await get(endpoint: endpoint)

            if !response.lotes.isEmpty {
                // Convertir DTOs a Entities y guardar
                for loteDTO in response.lotes {
                    let entity = mapper.toEntity(
                        from: loteDTO,
                        context: coreDataManager.viewContext,
                        syncStatus: .synced
                    )
                    // Entity se crea en contexto, se guardará con save()
                }

                // Guardar transacción completa
                try await coreDataManager.save()

                // Actualizar timestamp de sincronización
                await MainActor.run {
                    lastSyncTimestamp = Date()
                }

                print("✅ LoteRepository: Sincronización exitosa: \(response.lotes.count) lotes guardados")
                return .success(())
            } else {
                print("⚠️ LoteRepository: API retornó respuesta vacía")
                // Los datos viejos en la DB se mantienen
                return .success(())
            }
        } catch {
            let message = await errorHandler.handle(error, context: "LoteRepository.refreshLotes")
            print("❌ LoteRepository: Error sincronizando lotes: \(message)")
            return .failure(error)
        }
    }

    // MARK: - Create Lote (OFFLINE-FIRST WRITE)

    /**
     * Crear un nuevo lote (Offline-First Write)
     *
     * ANDROID EQUIVALENT: `suspend fun createLote(lote: Lote): Result<Unit>`
     *
     * FLUJO:
     * 1. Convertir Lote (Domain) -> LoteEntity (Persistence)
     * 2. Marcar con syncStatus = PENDING_CREATE
     * 3. Guardar localmente en CoreData (INMEDIATO)
     * 4. Encolar sincronización en background
     * 5. UI se actualiza automáticamente
     *
     * Ventajas:
     * - Feedback inmediato al usuario (sin esperar red)
     * - Si no hay internet, se guarda y sube luego automáticamente
     * - Sin bloqueo de UI
     *
     * - Parameter lote: Lote domain model
     * - Returns: Result<Void> indicando éxito o fallo
     */
    func createLote(_ lote: Lote) async -> Result<Void, Error> {
        do {
            print("➕ LoteRepository: Creando lote: \(lote.nombre)")

            // 1. Convertir Lote (Domain) a LoteEntity con estado PENDING_CREATE
            let entity = mapper.toEntity(
                from: lote,
                context: coreDataManager.viewContext,
                syncStatus: .pendingCreate
            )

            // 2. Guardar localmente (INMEDIATO - no espera red)
            try await coreDataManager.save()
            print("✅ LoteRepository: Lote guardado localmente: \(lote.nombre)")

            // 3. Actualizar pending count
            await updatePendingCount()

            // 4. Intentar sincronizar si hay conexión
            if networkMonitor.isConnected {
                Task {
                    await syncPendingLotes()
                }
            }

            return .success(())
        } catch {
            let message = await errorHandler.handle(error, context: "LoteRepository.createLote")
            print("❌ LoteRepository: Error creando lote: \(message)")
            return .failure(error)
        }
    }

    // MARK: - Update Lote (OFFLINE-FIRST WRITE)

    /**
     * Actualizar un lote existente (Offline-First Write)
     *
     * ANDROID EQUIVALENT: `suspend fun updateLote(loteId: String, lote: Lote): Result<Unit>`
     *
     * Mismo flujo que createLote pero con PENDING_UPDATE
     *
     * - Parameters:
     *   - loteId: ID del lote a actualizar
     *   - lote: Lote domain model con datos actualizados
     * - Returns: Result<Void> indicando éxito o fallo
     */
    func updateLote(loteId: String, lote: Lote) async -> Result<Void, Error> {
        do {
            print("✏️ LoteRepository: Actualizando lote: \(lote.nombre)")

            // 1. Buscar entidad existente
            guard let entity = try await coreDataManager.fetchLote(byId: loteId) else {
                throw DatabaseError(message: "Lote no encontrado: \(loteId)")
            }

            // 2. Actualizar con datos del dominio y marcar como PENDING_UPDATE
            mapper.updateEntity(entity, from: lote, syncStatus: .pendingUpdate)

            // 3. Guardar localmente
            try await coreDataManager.save()
            print("✅ LoteRepository: Lote actualizado localmente: \(lote.nombre)")

            // 4. Actualizar pending count
            await updatePendingCount()

            // 5. Intentar sincronizar si hay conexión
            if networkMonitor.isConnected {
                Task {
                    await syncPendingLotes()
                }
            }

            return .success(())
        } catch {
            let message = await errorHandler.handle(error, context: "LoteRepository.updateLote")
            print("❌ LoteRepository: Error actualizando lote: \(message)")
            return .failure(error)
        }
    }

    // MARK: - Delete Lote

    /**
     * Eliminar un lote
     *
     * ANDROID EQUIVALENT: `suspend fun deleteLote(loteId: String): Result<Unit>`
     */
    func deleteLote(_ loteId: String) async -> Result<Void, Error> {
        do {
            print("🗑️ LoteRepository: Eliminando lote: \(loteId)")

            guard let entity = try await coreDataManager.fetchLote(byId: loteId) else {
                throw DatabaseError(message: "Lote no encontrado: \(loteId)")
            }

            coreDataManager.delete(entity)
            try await coreDataManager.save()

            print("✅ LoteRepository: Lote eliminado localmente")
            return .success(())
        } catch {
            let message = await errorHandler.handle(error, context: "LoteRepository.deleteLote")
            return .failure(error)
        }
    }

    // MARK: - Background Sync (SYNC UP)

    /**
     * Sincronizar lotes pendientes con el servidor
     *
     * ANDROID EQUIVALENT: SyncLotesWorker (WorkManager background task)
     *
     * FLUJO:
     * 1. Obtener todos los lotes con PENDING_CREATE o PENDING_UPDATE
     * 2. Para cada lote:
     *    a. Subir a API
     *    b. Si éxito, marcar como SYNCED
     *    c. Si fallo, mantener PENDING y reintentar luego
     * 3. Actualizar pending count
     */
    func syncPendingLotes() async {
        do {
            print("📤 LoteRepository: Sincronizando lotes pendientes...")

            // 1. Obtener lotes pendientes
            let pendingEntities = try await coreDataManager.fetchPendingLotes()

            if pendingEntities.isEmpty {
                print("ℹ️ LoteRepository: No hay lotes pendientes de sincronizar")
                return
            }

            print("📋 LoteRepository: Encontrados \(pendingEntities.count) lotes pendientes")

            // 2. Sincronizar cada lote
            for entity in pendingEntities {
                let lote = mapper.toDomain(from: entity)

                switch entity.syncStatusEnum {
                case .pendingCreate:
                    await uploadNewLote(lote, entity: entity)

                case .pendingUpdate:
                    await uploadUpdatedLote(lote, entity: entity)

                case .synced:
                    break  // Ya está sincronizado
                }
            }

            // 3. Actualizar pending count
            await updatePendingCount()

            print("✅ LoteRepository: Sincronización completada")
        } catch {
            let message = await errorHandler.handle(error, context: "LoteRepository.syncPendingLotes")
            print("❌ LoteRepository: Error en sincronización: \(message)")
        }
    }

    /**
     * Subir nuevo lote a la API
     */
    private func uploadNewLote(_ lote: Lote, entity: LoteEntity) async {
        do {
            print("⬆️ LoteRepository: Subiendo nuevo lote: \(lote.nombre)")

            let request = mapper.toCreateRequest(from: lote)
            let endpoint = "/v1/lotes"

            let response: LoteDTO = try await post(endpoint: endpoint, body: request)

            // Actualizar entity con datos del servidor y marcar como SYNCED
            mapper.updateEntity(entity, from: response, syncStatus: .synced)
            try await coreDataManager.save()

            print("✅ LoteRepository: Lote subido exitosamente: \(lote.nombre)")
        } catch {
            let message = await errorHandler.handle(error, context: "LoteRepository.uploadNewLote")
            print("⚠️ LoteRepository: Fallo al subir lote (se reintentará): \(message)")
            // Mantener entity como PENDING_CREATE para reintentar
        }
    }

    /**
     * Subir lote actualizado a la API
     */
    private func uploadUpdatedLote(_ lote: Lote, entity: LoteEntity) async {
        do {
            print("⬆️ LoteRepository: Subiendo actualización de lote: \(lote.nombre)")

            let dto = mapper.toDTO(from: lote)
            let endpoint = "/v1/lotes/\(lote.id)"

            let response: LoteDTO = try await put(endpoint: endpoint, body: dto)

            // Actualizar entity y marcar como SYNCED
            mapper.updateEntity(entity, from: response, syncStatus: .synced)
            try await coreDataManager.save()

            print("✅ LoteRepository: Lote actualizado exitosamente: \(lote.nombre)")
        } catch {
            let message = await errorHandler.handle(error, context: "LoteRepository.uploadUpdatedLote")
            print("⚠️ LoteRepository: Fallo al actualizar lote (se reintentará): \(message)")
            // Mantener entity como PENDING_UPDATE para reintentar
        }
    }

    // MARK: - Pending Lotes Info

    /**
     * Actualizar el contador de lotes pendientes
     *
     * ANDROID EQUIVALENT: `fun getPendingLotesCount(): Flow<Int>`
     */
    private func updatePendingCount() async {
        do {
            let pending = try await coreDataManager.fetchPendingLotes()
            await MainActor.run {
                self.pendingCount = pending.count
                self.hasPendingChanges = pending.count > 0
            }
        } catch {
            print("⚠️ Error actualizando pending count: \(error)")
        }
    }

    /**
     * Obtener lotes pendientes de sincronización
     *
     * ANDROID EQUIVALENT: `fun getPendingLotes(): Flow<List<Lote>>`
     */
    func getPendingLotes() async throws -> [Lote] {
        let entities = try await coreDataManager.fetchPendingLotes()
        return mapper.toDomain(from: entities)
    }

    // MARK: - Database Management

    /**
     * Limpiar la base de datos local
     *
     * ANDROID EQUIVALENT: `suspend fun clearDatabase(): Result<Unit>`
     *
     * Útil después de logout o para testing
     */
    func clearDatabase() async -> Result<Void, Error> {
        do {
            print("🗑️ LoteRepository: Limpiando base de datos local")
            try await coreDataManager.deleteAllLotes()
            await updatePendingCount()
            print("✅ LoteRepository: Base de datos limpiada")
            return .success(())
        } catch {
            let message = await errorHandler.handle(error, context: "LoteRepository.clearDatabase")
            return .failure(error)
        }
    }

    // MARK: - Private Network Methods

    /**
     * Realiza GET request al API
     */
    private func get<R: Decodable>(endpoint: String) async throws -> R {
        guard let url = URL(string: baseURL + endpoint) else {
            throw HTTPError(statusCode: 0, message: "URL inválida")
        }

        var request = URLRequest(url: url)
        request.httpMethod = "GET"

        // Add access token
        if let accessToken = try await tokenManager.getAccessToken() {
            request.setValue("Bearer \(accessToken)", forHTTPHeaderField: "Authorization")
        }

        let (data, response) = try await session.data(for: request)

        guard let httpResponse = response as? HTTPURLResponse else {
            throw HTTPError(statusCode: 0, message: "Invalid response")
        }

        guard (200...299).contains(httpResponse.statusCode) else {
            throw HTTPError(statusCode: httpResponse.statusCode, message: "HTTP Error \(httpResponse.statusCode)")
        }

        return try JSONDecoder().decode(R.self, from: data)
    }

    /**
     * Realiza POST request al API
     */
    private func post<T: Encodable, R: Decodable>(endpoint: String, body: T) async throws -> R {
        guard let url = URL(string: baseURL + endpoint) else {
            throw HTTPError(statusCode: 0, message: "URL inválida")
        }

        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")

        if let accessToken = try await tokenManager.getAccessToken() {
            request.setValue("Bearer \(accessToken)", forHTTPHeaderField: "Authorization")
        }

        request.httpBody = try JSONEncoder().encode(body)

        let (data, response) = try await session.data(for: request)

        guard let httpResponse = response as? HTTPURLResponse else {
            throw HTTPError(statusCode: 0, message: "Invalid response")
        }

        guard (200...299).contains(httpResponse.statusCode) else {
            throw HTTPError(statusCode: httpResponse.statusCode, message: "HTTP Error \(httpResponse.statusCode)")
        }

        return try JSONDecoder().decode(R.self, from: data)
    }

    /**
     * Realiza PUT request al API
     */
    private func put<T: Encodable, R: Decodable>(endpoint: String, body: T) async throws -> R {
        guard let url = URL(string: baseURL + endpoint) else {
            throw HTTPError(statusCode: 0, message: "URL inválida")
        }

        var request = URLRequest(url: url)
        request.httpMethod = "PUT"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")

        if let accessToken = try await tokenManager.getAccessToken() {
            request.setValue("Bearer \(accessToken)", forHTTPHeaderField: "Authorization")
        }

        request.httpBody = try JSONEncoder().encode(body)

        let (data, response) = try await session.data(for: request)

        guard let httpResponse = response as? HTTPURLResponse else {
            throw HTTPError(statusCode: 0, message: "Invalid response")
        }

        guard (200...299).contains(httpResponse.statusCode) else {
            throw HTTPError(statusCode: httpResponse.statusCode, message: "HTTP Error \(httpResponse.statusCode)")
        }

        return try JSONDecoder().decode(R.self, from: data)
    }
}
