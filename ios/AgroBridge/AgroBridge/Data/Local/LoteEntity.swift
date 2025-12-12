//
//  LoteEntity.swift
//  AgroBridge
//
//  Created by Alejandro Navarro Ayala - CEO & Senior Developer
//  Copyright © 2025 AgroBridge International. All rights reserved.
//
//  ANDROID EQUIVALENT: data/local/entity/LoteEntity.kt
//

import Foundation
import CoreData

/**
 * LoteEntity - Core Data entity para persistencia local de Lotes
 *
 * ANDROID EQUIVALENT: @Entity(tableName = "lotes") data class LoteEntity
 *
 * Representa la tabla "lotes" en la base de datos Core Data
 * Esta es una capa de persistencia separada de:
 * - LoteDTO (capa de API/Remote)
 * - Lote (capa de Domain/Model)
 *
 * Mantiene desacoplamiento entre capas según Clean Architecture
 */
@objc(LoteEntity)
public class LoteEntity: NSManagedObject {

    // MARK: - Properties (matches Android LoteEntity fields exactly)

    @NSManaged public var id: String
    @NSManaged public var nombre: String
    @NSManaged public var cultivo: String
    @NSManaged public var area: Double
    @NSManaged public var estado: String  // Estado como String, se convierte a enum en mapper

    @NSManaged public var productorId: String
    @NSManaged public var productorNombre: String

    @NSManaged public var fechaCreacion: Date
    @NSManaged public var fechaActualizacion: Date

    // Coordenadas almacenadas como JSON (igual que Android TypeConverter)
    @NSManaged public var coordenadas: String?  // JSON string de [[lat, lon], ...]

    @NSManaged public var centroCampoLatitud: NSNumber?  // Optional Double
    @NSManaged public var centroCampoLongitud: NSNumber?  // Optional Double

    @NSManaged public var ubicacion: String?
    @NSManaged public var bloqueId: String?
    @NSManaged public var bloqueNombre: String?

    // Timestamp de sincronización local
    @NSManaged public var localSyncTimestamp: Date

    // Estado de sincronización con servidor (Offline-First Write)
    @NSManaged public var syncStatus: String  // "SYNCED", "PENDING_CREATE", "PENDING_UPDATE"

    // MARK: - Convenience Properties

    var centroCampo: (latitude: Double, longitude: Double)? {
        guard let lat = centroCampoLatitud?.doubleValue,
              let lon = centroCampoLongitud?.doubleValue else {
            return nil
        }
        return (lat, lon)
    }

    var syncStatusEnum: SyncStatus {
        get {
            return SyncStatus(rawValue: syncStatus) ?? .synced
        }
        set {
            syncStatus = newValue.rawValue
        }
    }
}

/**
 * SyncStatus - Estados de sincronización
 *
 * ANDROID EQUIVALENT: enum class SyncStatus
 */
enum SyncStatus: String, Codable {
    /// Datos están sincronizados con el servidor
    case synced = "SYNCED"

    /// Lote fue creado localmente, esperando primer upload
    case pendingCreate = "PENDING_CREATE"

    /// Lote fue actualizado localmente, esperando sync
    case pendingUpdate = "PENDING_UPDATE"
}

// MARK: - Core Data Entity Description

extension LoteEntity {

    /**
     * Descripción de la entidad Core Data (equivalente a @Entity annotation en Android)
     *
     * ANDROID EQUIVALENT: @Entity(tableName = "lotes") annotation
     */
    @nonobjc public class func fetchRequest() -> NSFetchRequest<LoteEntity> {
        return NSFetchRequest<LoteEntity>(entityName: "LoteEntity")
    }

    /**
     * Crea la descripción de entidad programáticamente (sin .xcdatamodeld visual)
     *
     * FIXED: BUG-001 - Removed context parameter to avoid temporary context issues
     */
    static func entityDescription() -> NSEntityDescription {
        let entity = NSEntityDescription()
        entity.name = "LoteEntity"
        entity.managedObjectClassName = NSStringFromClass(LoteEntity.self)

        // Define attributes
        var properties: [NSPropertyDescription] = []

        // id (String, primary key)
        let idAttr = NSAttributeDescription()
        idAttr.name = "id"
        idAttr.attributeType = .stringAttributeType
        idAttr.isOptional = false
        properties.append(idAttr)

        // nombre (String)
        let nombreAttr = NSAttributeDescription()
        nombreAttr.name = "nombre"
        nombreAttr.attributeType = .stringAttributeType
        nombreAttr.isOptional = false
        properties.append(nombreAttr)

        // cultivo (String)
        let cultivoAttr = NSAttributeDescription()
        cultivoAttr.name = "cultivo"
        cultivoAttr.attributeType = .stringAttributeType
        cultivoAttr.isOptional = false
        properties.append(cultivoAttr)

        // area (Double)
        let areaAttr = NSAttributeDescription()
        areaAttr.name = "area"
        areaAttr.attributeType = .doubleAttributeType
        areaAttr.isOptional = false
        properties.append(areaAttr)

        // estado (String)
        let estadoAttr = NSAttributeDescription()
        estadoAttr.name = "estado"
        estadoAttr.attributeType = .stringAttributeType
        estadoAttr.isOptional = false
        properties.append(estadoAttr)

        // productorId (String)
        let productorIdAttr = NSAttributeDescription()
        productorIdAttr.name = "productorId"
        productorIdAttr.attributeType = .stringAttributeType
        productorIdAttr.isOptional = false
        properties.append(productorIdAttr)

        // productorNombre (String)
        let productorNombreAttr = NSAttributeDescription()
        productorNombreAttr.name = "productorNombre"
        productorNombreAttr.attributeType = .stringAttributeType
        productorNombreAttr.isOptional = false
        properties.append(productorNombreAttr)

        // fechaCreacion (Date)
        let fechaCreacionAttr = NSAttributeDescription()
        fechaCreacionAttr.name = "fechaCreacion"
        fechaCreacionAttr.attributeType = .dateAttributeType
        fechaCreacionAttr.isOptional = false
        properties.append(fechaCreacionAttr)

        // fechaActualizacion (Date)
        let fechaActualizacionAttr = NSAttributeDescription()
        fechaActualizacionAttr.name = "fechaActualizacion"
        fechaActualizacionAttr.attributeType = .dateAttributeType
        fechaActualizacionAttr.isOptional = false
        properties.append(fechaActualizacionAttr)

        // coordenadas (String, JSON)
        let coordenadasAttr = NSAttributeDescription()
        coordenadasAttr.name = "coordenadas"
        coordenadasAttr.attributeType = .stringAttributeType
        coordenadasAttr.isOptional = true
        properties.append(coordenadasAttr)

        // centroCampoLatitud (Double, optional)
        let latAttr = NSAttributeDescription()
        latAttr.name = "centroCampoLatitud"
        latAttr.attributeType = .doubleAttributeType
        latAttr.isOptional = true
        properties.append(latAttr)

        // centroCampoLongitud (Double, optional)
        let lonAttr = NSAttributeDescription()
        lonAttr.name = "centroCampoLongitud"
        lonAttr.attributeType = .doubleAttributeType
        lonAttr.isOptional = true
        properties.append(lonAttr)

        // ubicacion (String, optional)
        let ubicacionAttr = NSAttributeDescription()
        ubicacionAttr.name = "ubicacion"
        ubicacionAttr.attributeType = .stringAttributeType
        ubicacionAttr.isOptional = true
        properties.append(ubicacionAttr)

        // bloqueId (String, optional)
        let bloqueIdAttr = NSAttributeDescription()
        bloqueIdAttr.name = "bloqueId"
        bloqueIdAttr.attributeType = .stringAttributeType
        bloqueIdAttr.isOptional = true
        properties.append(bloqueIdAttr)

        // bloqueNombre (String, optional)
        let bloqueNombreAttr = NSAttributeDescription()
        bloqueNombreAttr.name = "bloqueNombre"
        bloqueNombreAttr.attributeType = .stringAttributeType
        bloqueNombreAttr.isOptional = true
        properties.append(bloqueNombreAttr)

        // localSyncTimestamp (Date)
        let syncTimestampAttr = NSAttributeDescription()
        syncTimestampAttr.name = "localSyncTimestamp"
        syncTimestampAttr.attributeType = .dateAttributeType
        syncTimestampAttr.isOptional = false
        properties.append(syncTimestampAttr)

        // syncStatus (String)
        let syncStatusAttr = NSAttributeDescription()
        syncStatusAttr.name = "syncStatus"
        syncStatusAttr.attributeType = .stringAttributeType
        syncStatusAttr.isOptional = false
        syncStatusAttr.defaultValue = "SYNCED"
        properties.append(syncStatusAttr)

        entity.properties = properties

        return entity
    }
}
