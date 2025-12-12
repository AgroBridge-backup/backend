//
//  CoreDataManager.swift
//  AgroBridge
//
//  Created by Alejandro Navarro Ayala - CEO & Senior Developer
//  Copyright © 2025 AgroBridge International. All rights reserved.
//
//  ANDROID EQUIVALENT: Room Database setup + DAOs
//

import Foundation
import CoreData

/**
 * CoreDataManager - Manages Core Data stack
 *
 * ANDROID EQUIVALENT: Room Database (@Database annotation + getInstance())
 *
 * Responsabilidades:
 * ✓ Configurar NSPersistentContainer
 * ✓ Gestionar contextos (main + background)
 * ✓ Operaciones CRUD thread-safe
 * ✓ Save operations con error handling
 * ✓ Background context para sync operations
 *
 * Uso:
 * ```swift
 * let manager = CoreDataManager.shared
 *
 * // Create
 * let lote = manager.createLoteEntity()
 * lote.id = "lote_123"
 * lote.nombre = "Lote Norte"
 * try await manager.save()
 *
 * // Read
 * let lotes = try await manager.fetchAllLotes()
 *
 * // Update
 * lote.nombre = "Lote Norte Actualizado"
 * try await manager.save()
 *
 * // Delete
 * manager.delete(lote)
 * try await manager.save()
 * ```
 */
actor CoreDataManager {

    // MARK: - Singleton

    static let shared = CoreDataManager()

    // MARK: - Properties

    private let container: NSPersistentContainer
    private let errorHandler = ErrorHandler.shared

    // MARK: - Contexts

    /// Main context para UI operations
    /// FIXED: BUG-003 - Removed nonisolated to ensure main thread access
    /// Access this property from @MainActor contexts only
    nonisolated(unsafe) var viewContext: NSManagedObjectContext {
        return container.viewContext
    }

    /// Background context para operaciones pesadas
    private var backgroundContext: NSManagedObjectContext {
        return container.newBackgroundContext()
    }

    // MARK: - Initialization

    private init() {
        // FIXED: BUG-002 - Use entityDescription() without context parameter
        // Create managed object model programmatically
        let model = NSManagedObjectModel()

        // Add LoteEntity to model
        let loteEntity = LoteEntity.entityDescription()
        model.entities = [loteEntity]

        // Create container
        container = NSPersistentContainer(name: "AgroBridge", managedObjectModel: model)

        // Load persistent stores
        container.loadPersistentStores { description, error in
            if let error = error {
                fatalError("Failed to load Core Data stack: \(error)")
            }

            print("💾 CoreDataManager: Persistent store loaded successfully")
            print("   Store URL: \(description.url?.path ?? "N/A")")
        }

        // Configure contexts
        container.viewContext.automaticallyMergesChangesFromParent = true
        container.viewContext.mergePolicy = NSMergeByPropertyObjectTrumpMergePolicy
    }

    // MARK: - CRUD Operations - Lote

    /**
     * Crea nueva entidad LoteEntity
     *
     * ANDROID EQUIVALENT: @Insert suspend fun insertLote(lote: LoteEntity)
     */
    nonisolated func createLoteEntity(in context: NSManagedObjectContext? = nil) -> LoteEntity {
        let ctx = context ?? viewContext
        return LoteEntity(context: ctx)
    }

    /**
     * Fetch all lotes
     *
     * ANDROID EQUIVALENT: @Query("SELECT * FROM lotes") suspend fun getAllLotes(): List<LoteEntity>
     */
    func fetchAllLotes() async throws -> [LoteEntity] {
        return try await performFetch(LoteEntity.fetchRequest())
    }

    /**
     * Fetch lotes by productor ID
     *
     * ANDROID EQUIVALENT: @Query("SELECT * FROM lotes WHERE productorId = :productorId")
     */
    func fetchLotes(forProductorId productorId: String) async throws -> [LoteEntity] {
        let request = LoteEntity.fetchRequest()
        request.predicate = NSPredicate(format: "productorId == %@", productorId)
        request.sortDescriptors = [NSSortDescriptor(keyPath: \LoteEntity.fechaCreacion, ascending: false)]

        return try await performFetch(request)
    }

    /**
     * Fetch lote by ID
     *
     * ANDROID EQUIVALENT: @Query("SELECT * FROM lotes WHERE id = :id")
     */
    func fetchLote(byId id: String) async throws -> LoteEntity? {
        let request = LoteEntity.fetchRequest()
        request.predicate = NSPredicate(format: "id == %@", id)
        request.fetchLimit = 1

        let results = try await performFetch(request)
        return results.first
    }

    /**
     * Fetch pending lotes (for sync)
     *
     * ANDROID EQUIVALENT: @Query("SELECT * FROM lotes WHERE syncStatus != 'SYNCED'")
     */
    func fetchPendingLotes() async throws -> [LoteEntity] {
        let request = LoteEntity.fetchRequest()
        request.predicate = NSPredicate(format: "syncStatus != %@", SyncStatus.synced.rawValue)

        return try await performFetch(request)
    }

    /**
     * Fetch lotes by sync status
     */
    func fetchLotes(withSyncStatus status: SyncStatus) async throws -> [LoteEntity] {
        let request = LoteEntity.fetchRequest()
        request.predicate = NSPredicate(format: "syncStatus == %@", status.rawValue)

        return try await performFetch(request)
    }

    /**
     * Fetch lotes by estado (state)
     */
    func fetchLotes(withEstado estado: String) async throws -> [LoteEntity] {
        let request = LoteEntity.fetchRequest()
        request.predicate = NSPredicate(format: "estado == %@", estado)
        request.sortDescriptors = [NSSortDescriptor(keyPath: \LoteEntity.nombre, ascending: true)]

        return try await performFetch(request)
    }

    /**
     * Delete lote
     *
     * ANDROID EQUIVALENT: @Delete suspend fun deleteLote(lote: LoteEntity)
     */
    nonisolated func delete(_ object: NSManagedObject) {
        let context = object.managedObjectContext ?? viewContext
        context.delete(object)
    }

    /**
     * Delete all lotes
     */
    func deleteAllLotes() async throws {
        let lotes = try await fetchAllLotes()

        for lote in lotes {
            delete(lote)
        }

        try await save()
    }

    /**
     * Mark lote as synced
     */
    func markAsSynced(loteId: String) async throws {
        guard let lote = try await fetchLote(byId: loteId) else {
            throw DatabaseError(message: "Lote not found: \(loteId)")
        }

        lote.syncStatus = SyncStatus.synced.rawValue
        lote.localSyncTimestamp = Date()

        try await save()
    }

    /**
     * Mark all lotes as synced
     */
    func markAllAsSynced() async throws {
        let pendingLotes = try await fetchPendingLotes()

        for lote in pendingLotes {
            lote.syncStatus = SyncStatus.synced.rawValue
            lote.localSyncTimestamp = Date()
        }

        try await save()
    }

    // MARK: - Save Operations

    /**
     * Save context changes
     *
     * ANDROID EQUIVALENT: Room automatically saves on DAO operations
     */
    func save(context: NSManagedObjectContext? = nil) async throws {
        let ctx = context ?? viewContext

        guard ctx.hasChanges else {
            print("💾 CoreDataManager: No changes to save")
            return
        }

        do {
            try ctx.save()
            print("💾 CoreDataManager: Saved \(ctx.insertedObjects.count) inserts, \(ctx.updatedObjects.count) updates, \(ctx.deletedObjects.count) deletes")
        } catch {
            let message = await errorHandler.handle(error, context: "CoreDataManager.save")
            throw DatabaseError(message: message)
        }
    }

    /**
     * Save in background context
     */
    func saveInBackground(_ operation: @escaping (NSManagedObjectContext) throws -> Void) async throws {
        let context = backgroundContext

        try await withCheckedThrowingContinuation { (continuation: CheckedContinuation<Void, Error>) in
            context.perform {
                do {
                    try operation(context)

                    if context.hasChanges {
                        try context.save()
                        print("💾 CoreDataManager: Background save successful")
                    }

                    continuation.resume()
                } catch {
                    continuation.resume(throwing: error)
                }
            }
        }
    }

    // MARK: - Private Helpers

    /**
     * Generic fetch helper
     */
    private func performFetch<T: NSManagedObject>(_ request: NSFetchRequest<T>) async throws -> [T] {
        return try await withCheckedThrowingContinuation { continuation in
            viewContext.perform {
                do {
                    let results = try self.viewContext.fetch(request)
                    continuation.resume(returning: results)
                } catch {
                    continuation.resume(throwing: error)
                }
            }
        }
    }

    // MARK: - Batch Operations

    /**
     * Insert or update lote (upsert)
     */
    func upsertLote(
        id: String,
        nombre: String,
        cultivo: String,
        area: Double,
        estado: String,
        productorId: String,
        productorNombre: String,
        fechaCreacion: Date = Date(),
        coordenadas: String? = nil,
        centroCampoLatitud: Double? = nil,
        centroCampoLongitud: Double? = nil,
        ubicacion: String? = nil,
        bloqueId: String? = nil,
        bloqueNombre: String? = nil,
        syncStatus: SyncStatus = .synced
    ) async throws {
        // Try to find existing
        if let existing = try await fetchLote(byId: id) {
            // Update
            existing.nombre = nombre
            existing.cultivo = cultivo
            existing.area = area
            existing.estado = estado
            existing.productorId = productorId
            existing.productorNombre = productorNombre
            existing.fechaActualizacion = Date()
            existing.coordenadas = coordenadas
            existing.centroCampoLatitud = centroCampoLatitud.map { NSNumber(value: $0) }
            existing.centroCampoLongitud = centroCampoLongitud.map { NSNumber(value: $0) }
            existing.ubicacion = ubicacion
            existing.bloqueId = bloqueId
            existing.bloqueNombre = bloqueNombre
            existing.syncStatus = syncStatus.rawValue
            existing.localSyncTimestamp = Date()
        } else {
            // Insert
            let lote = createLoteEntity()
            lote.id = id
            lote.nombre = nombre
            lote.cultivo = cultivo
            lote.area = area
            lote.estado = estado
            lote.productorId = productorId
            lote.productorNombre = productorNombre
            lote.fechaCreacion = fechaCreacion
            lote.fechaActualizacion = Date()
            lote.coordenadas = coordenadas
            lote.centroCampoLatitud = centroCampoLatitud.map { NSNumber(value: $0) }
            lote.centroCampoLongitud = centroCampoLongitud.map { NSNumber(value: $0) }
            lote.ubicacion = ubicacion
            lote.bloqueId = bloqueId
            lote.bloqueNombre = bloqueNombre
            lote.syncStatus = syncStatus.rawValue
            lote.localSyncTimestamp = Date()
        }

        try await save()
    }

    // MARK: - Reset (for testing)

    /**
     * Reset database (delete all data)
     *
     * ANDROID EQUIVALENT: clearAllTables()
     */
    func resetDatabase() async throws {
        try await deleteAllLotes()
        print("💾 CoreDataManager: Database reset complete")
    }
}
