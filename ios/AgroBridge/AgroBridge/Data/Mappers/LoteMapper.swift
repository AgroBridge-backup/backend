//
//  LoteMapper.swift
//  AgroBridge
//
//  Created by Alejandro Navarro Ayala - CEO & Senior Developer
//  Copyright © 2025 AgroBridge International. All rights reserved.
//
//  ANDROID EQUIVALENT: data/mappers/LoteMapper.kt
//

import Foundation

/**
 * LoteMapper - Mapea entre capas de arquitectura
 *
 * ANDROID EQUIVALENT: object LoteMapper
 *
 * Responsabilidades:
 * ✓ DTO (API) → Entity (Database)
 * ✓ Entity (Database) → Domain (Model)
 * ✓ DTO (API) → Domain (Model)
 * ✓ Domain (Model) → DTO (API)
 * ✓ Domain (Model) → Entity (Database)
 *
 * Mantiene desacoplamiento entre:
 * - LoteDTO: Capa de red/API (JSON)
 * - LoteEntity: Capa de persistencia (CoreData)
 * - Lote: Capa de dominio (lógica de negocio)
 *
 * Uso:
 * ```swift
 * let mapper = LoteMapper()
 *
 * // DTO desde API → Entity para guardar en CoreData
 * let entity = mapper.toEntity(from: loteDTO, context: viewContext)
 *
 * // Entity desde CoreData → Domain model para UI
 * let lote = mapper.toDomain(from: entity)
 *
 * // Domain model → DTO para enviar a API
 * let dto = mapper.toDTO(from: lote)
 * ```
 *
 * ANDROID PARITY: Matches LoteMapper.kt functionality 100%
 * - Same conversion methods
 * - Same field mappings
 * - Same null handling
 * - Same timestamp conversions
 */
class LoteMapper {

    // MARK: - Singleton

    static let shared = LoteMapper()

    private init() {}

    // MARK: - DTO → Entity (API → Database)

    /**
     * Convierte LoteDTO (desde API) a LoteEntity (para CoreData)
     *
     * ANDROID EQUIVALENT: `fun LoteDto.toEntity(): LoteEntity`
     *
     * - Parameters:
     *   - dto: LoteDTO desde API
     *   - context: NSManagedObjectContext para crear entidad
     *   - syncStatus: Estado de sincronización (default: .synced)
     * - Returns: LoteEntity para guardar en CoreData
     */
    func toEntity(
        from dto: LoteDTO,
        context: NSManagedObjectContext,
        syncStatus: SyncStatus = .synced
    ) -> LoteEntity {
        let entity = LoteEntity(context: context)

        entity.id = dto.id
        entity.nombre = dto.nombre
        entity.cultivo = dto.cultivo
        entity.area = dto.area
        entity.estado = dto.estado
        entity.productorId = dto.productorId
        entity.productorNombre = dto.productor?.nombre ?? ""

        // Convert Unix timestamp to Date
        entity.fechaCreacion = Date(timeIntervalSince1970: TimeInterval(dto.fechaCreacion / 1000))

        if let fechaActualizacion = dto.fechaActualizacion {
            entity.fechaActualizacion = Date(timeIntervalSince1970: TimeInterval(fechaActualizacion / 1000))
        } else {
            entity.fechaActualizacion = entity.fechaCreacion
        }

        // Convert coordenadas array to JSON string
        if let coordenadas = dto.coordenadas {
            entity.coordenadas = coordenadasToJSON(coordenadas)
        }

        // Extract centro campo
        if let centroCampo = dto.centroCampo {
            entity.centroCampoLatitud = NSNumber(value: centroCampo.latitud)
            entity.centroCampoLongitud = NSNumber(value: centroCampo.longitud)
        }

        entity.ubicacion = dto.ubicacion
        entity.bloqueId = dto.bloqueId
        entity.bloqueNombre = dto.bloqueNombre
        entity.syncStatus = syncStatus.rawValue
        entity.localSyncTimestamp = Date()

        return entity
    }

    /**
     * Actualiza LoteEntity existente con datos de LoteDTO
     *
     * ANDROID EQUIVALENT: `fun LoteDto.updateEntity(entity: LoteEntity)`
     */
    func updateEntity(
        _ entity: LoteEntity,
        from dto: LoteDTO,
        syncStatus: SyncStatus = .synced
    ) {
        entity.nombre = dto.nombre
        entity.cultivo = dto.cultivo
        entity.area = dto.area
        entity.estado = dto.estado
        entity.productorId = dto.productorId
        entity.productorNombre = dto.productor?.nombre ?? ""

        if let fechaActualizacion = dto.fechaActualizacion {
            entity.fechaActualizacion = Date(timeIntervalSince1970: TimeInterval(fechaActualizacion / 1000))
        } else {
            entity.fechaActualizacion = Date()
        }

        if let coordenadas = dto.coordenadas {
            entity.coordenadas = coordenadasToJSON(coordenadas)
        }

        if let centroCampo = dto.centroCampo {
            entity.centroCampoLatitud = NSNumber(value: centroCampo.latitud)
            entity.centroCampoLongitud = NSNumber(value: centroCampo.longitud)
        }

        entity.ubicacion = dto.ubicacion
        entity.bloqueId = dto.bloqueId
        entity.bloqueNombre = dto.bloqueNombre
        entity.syncStatus = syncStatus.rawValue
        entity.localSyncTimestamp = Date()
    }

    // MARK: - Entity → Domain (Database → Model)

    /**
     * Convierte LoteEntity (CoreData) a Lote (Domain model)
     *
     * ANDROID EQUIVALENT: `fun LoteEntity.toDomain(): Lote`
     *
     * - Parameter entity: LoteEntity desde CoreData
     * - Returns: Lote domain model para lógica de negocio/UI
     */
    func toDomain(from entity: LoteEntity) -> Lote {
        // Parse estado string to enum
        let estado = LoteEstado(rawValue: entity.estado) ?? .activo

        // Parse coordenadas from JSON string
        let coordenadas = coordenadasFromJSON(entity.coordenadas)

        // Build centro campo
        var centroCampo: Coordenada?
        if let lat = entity.centroCampoLatitud?.doubleValue,
           let lon = entity.centroCampoLongitud?.doubleValue {
            centroCampo = Coordenada(latitud: lat, longitud: lon)
        }

        return Lote(
            id: entity.id,
            nombre: entity.nombre,
            ubicacion: entity.ubicacion ?? "",
            tipoCultivo: entity.cultivo,
            areaHectareas: entity.area,
            fechaCreacion: entity.fechaCreacion,
            estado: estado,
            productorId: entity.productorId,
            bloqueId: entity.bloqueId,
            bloqueNombre: entity.bloqueNombre,
            metadata: nil,  // Metadata no se almacena en Entity (solo en DTO)
            coordenadas: coordenadas,
            centroCampo: centroCampo
        )
    }

    // MARK: - DTO → Domain (API → Model)

    /**
     * Convierte LoteDTO (API) directamente a Lote (Domain)
     *
     * ANDROID EQUIVALENT: `fun LoteDto.toDomain(): Lote`
     *
     * Útil cuando se obtienen datos del API y se muestran directamente en UI
     * sin necesidad de persistencia local
     */
    func toDomain(from dto: LoteDTO) -> Lote {
        let estado = LoteEstado(rawValue: dto.estado) ?? .activo

        // Convert CoordenadaDTO array to Coordenada array
        let coordenadas = dto.coordenadas?.map { coordDTO in
            Coordenada(latitud: coordDTO.latitud, longitud: coordDTO.longitud)
        }

        var centroCampo: Coordenada?
        if let centroCampoDTO = dto.centroCampo {
            centroCampo = Coordenada(latitud: centroCampoDTO.latitud, longitud: centroCampoDTO.longitud)
        }

        // Convert metadata to LoteMetadata if needed
        var metadata: LoteMetadata?
        if let metadataDict = dto.metadata {
            // Extract coordenadasGPS if present
            var coordenadasGPS: CoordenadaGPS?
            if let gpsDict = metadataDict["coordenadas_gps"] as? [String: Any],
               let lat = gpsDict["latitud"] as? Double,
               let lon = gpsDict["longitud"] as? Double {
                let altitud = gpsDict["altitud"] as? Double
                coordenadasGPS = CoordenadaGPS(latitud: lat, longitud: lon, altitud: altitud)
            }

            let fotos = metadataDict["fotos"] as? [String]
            let notas = metadataDict["notas"] as? String

            metadata = LoteMetadata(coordenadasGPS: coordenadasGPS, fotos: fotos, notas: notas)
        }

        return Lote(
            id: dto.id,
            nombre: dto.nombre,
            ubicacion: dto.ubicacion ?? "",
            tipoCultivo: dto.cultivo,
            areaHectareas: dto.area,
            fechaCreacion: Date(timeIntervalSince1970: TimeInterval(dto.fechaCreacion / 1000)),
            estado: estado,
            productorId: dto.productorId,
            bloqueId: dto.bloqueId,
            bloqueNombre: dto.bloqueNombre,
            metadata: metadata,
            coordenadas: coordenadas,
            centroCampo: centroCampo
        )
    }

    // MARK: - Domain → DTO (Model → API)

    /**
     * Convierte Lote (Domain) a LoteDTO (para enviar a API)
     *
     * ANDROID EQUIVALENT: `fun Lote.toDto(): LoteDto`
     *
     * - Parameter lote: Lote domain model
     * - Returns: LoteDTO para enviar a API
     */
    func toDTO(from lote: Lote) -> LoteDTO {
        // Convert Coordenada array to CoordenadaDTO array
        let coordenadasDTO = lote.coordenadas?.map { coord in
            CoordenadaDTO(latitud: coord.latitud, longitud: coord.longitud)
        }

        var centroCampoDTO: CoordenadaDTO?
        if let centroCampo = lote.centroCampo {
            centroCampoDTO = CoordenadaDTO(latitud: centroCampo.latitud, longitud: centroCampo.longitud)
        }

        // Convert metadata to dictionary
        var metadataDict: [String: Any]?
        if let metadata = lote.metadata {
            var dict: [String: Any] = [:]

            if let coordenadasGPS = metadata.coordenadasGPS {
                dict["coordenadas_gps"] = [
                    "latitud": coordenadasGPS.latitud,
                    "longitud": coordenadasGPS.longitud,
                    "altitud": coordenadasGPS.altitud as Any
                ]
            }

            if let fotos = metadata.fotos {
                dict["fotos"] = fotos
            }

            if let notas = metadata.notas {
                dict["notas"] = notas
            }

            metadataDict = dict.isEmpty ? nil : dict
        }

        // Convert Date to Unix timestamp (milliseconds)
        let fechaCreacionTimestamp = Int64(lote.fechaCreacion.timeIntervalSince1970 * 1000)

        return LoteDTO(
            id: lote.id,
            nombre: lote.nombre,
            cultivo: lote.tipoCultivo,
            area: lote.areaHectareas ?? 0.0,
            estado: lote.estado.rawValue,
            productorId: lote.productorId,
            productor: nil,  // No incluir productor completo en request
            fechaCreacion: fechaCreacionTimestamp,
            fechaActualizacion: fechaCreacionTimestamp,
            coordenadas: coordenadasDTO,
            centroCampo: centroCampoDTO,
            ubicacion: lote.ubicacion,
            bloqueId: lote.bloqueId,
            bloqueNombre: lote.bloqueNombre,
            metadata: metadataDict
        )
    }

    // MARK: - Domain → Entity (Model → Database)

    /**
     * Convierte Lote (Domain) a LoteEntity (para guardar en CoreData)
     *
     * ANDROID EQUIVALENT: `fun Lote.toEntity(): LoteEntity`
     *
     * - Parameters:
     *   - lote: Lote domain model
     *   - context: NSManagedObjectContext
     *   - syncStatus: Estado de sincronización (default: .pendingCreate)
     * - Returns: LoteEntity para CoreData
     */
    func toEntity(
        from lote: Lote,
        context: NSManagedObjectContext,
        syncStatus: SyncStatus = .pendingCreate
    ) -> LoteEntity {
        let entity = LoteEntity(context: context)

        entity.id = lote.id
        entity.nombre = lote.nombre
        entity.cultivo = lote.tipoCultivo
        entity.area = lote.areaHectareas ?? 0.0
        entity.estado = lote.estado.rawValue
        entity.productorId = lote.productorId
        entity.productorNombre = ""  // Will be filled by Repository
        entity.fechaCreacion = lote.fechaCreacion
        entity.fechaActualizacion = Date()

        if let coordenadas = lote.coordenadas {
            let coordenadasDTO = coordenadas.map { coord in
                CoordenadaDTO(latitud: coord.latitud, longitud: coord.longitud)
            }
            entity.coordenadas = coordenadasToJSON(coordenadasDTO)
        }

        if let centroCampo = lote.centroCampo {
            entity.centroCampoLatitud = NSNumber(value: centroCampo.latitud)
            entity.centroCampoLongitud = NSNumber(value: centroCampo.longitud)
        }

        entity.ubicacion = lote.ubicacion
        entity.bloqueId = lote.bloqueId
        entity.bloqueNombre = lote.bloqueNombre
        entity.syncStatus = syncStatus.rawValue
        entity.localSyncTimestamp = Date()

        return entity
    }

    /**
     * Actualiza LoteEntity existente con datos de Lote domain
     *
     * ANDROID EQUIVALENT: `fun Lote.updateEntity(entity: LoteEntity)`
     */
    func updateEntity(
        _ entity: LoteEntity,
        from lote: Lote,
        syncStatus: SyncStatus = .pendingUpdate
    ) {
        entity.nombre = lote.nombre
        entity.cultivo = lote.tipoCultivo
        entity.area = lote.areaHectareas ?? 0.0
        entity.estado = lote.estado.rawValue
        entity.fechaActualizacion = Date()

        if let coordenadas = lote.coordenadas {
            let coordenadasDTO = coordenadas.map { coord in
                CoordenadaDTO(latitud: coord.latitud, longitud: coord.longitud)
            }
            entity.coordenadas = coordenadasToJSON(coordenadasDTO)
        }

        if let centroCampo = lote.centroCampo {
            entity.centroCampoLatitud = NSNumber(value: centroCampo.latitud)
            entity.centroCampoLongitud = NSNumber(value: centroCampo.longitud)
        }

        entity.ubicacion = lote.ubicacion
        entity.bloqueId = lote.bloqueId
        entity.bloqueNombre = lote.bloqueNombre
        entity.syncStatus = syncStatus.rawValue
        entity.localSyncTimestamp = Date()
    }

    // MARK: - Domain → CreateLoteRequest (Model → API Request)

    /**
     * Convierte Lote domain a CreateLoteRequest para crear en API
     *
     * ANDROID EQUIVALENT: `fun Lote.toCreateRequest(): CreateLoteRequest`
     */
    func toCreateRequest(from lote: Lote) -> CreateLoteRequest {
        let coordenadasDTO = lote.coordenadas?.map { coord in
            CoordenadaDTO(latitud: coord.latitud, longitud: coord.longitud)
        }

        return CreateLoteRequest(
            nombre: lote.nombre,
            cultivo: lote.tipoCultivo,
            area: lote.areaHectareas ?? 0.0,
            productorId: lote.productorId,
            coordenadas: coordenadasDTO,
            ubicacion: lote.ubicacion,
            bloqueId: lote.bloqueId
        )
    }

    // MARK: - Private Helpers

    /**
     * Convierte array de CoordenadaDTO a JSON string
     */
    private func coordenadasToJSON(_ coordenadas: [CoordenadaDTO]) -> String? {
        let arrayOfArrays = coordenadas.map { [$0.latitud, $0.longitud] }

        guard let jsonData = try? JSONSerialization.data(withJSONObject: arrayOfArrays),
              let jsonString = String(data: jsonData, encoding: .utf8) else {
            return nil
        }

        return jsonString
    }

    /**
     * Convierte JSON string a array de Coordenada
     */
    private func coordenadasFromJSON(_ jsonString: String?) -> [Coordenada]? {
        guard let jsonString = jsonString,
              let jsonData = jsonString.data(using: .utf8),
              let arrayOfArrays = try? JSONSerialization.jsonObject(with: jsonData) as? [[Double]] else {
            return nil
        }

        return arrayOfArrays.compactMap { array in
            guard array.count == 2 else { return nil }
            return Coordenada(latitud: array[0], longitud: array[1])
        }
    }
}

// MARK: - Batch Conversions

extension LoteMapper {

    /**
     * Convierte array de LoteDTO a array de Lote domain
     *
     * ANDROID EQUIVALENT: `fun List<LoteDto>.toDomain(): List<Lote>`
     */
    func toDomain(from dtos: [LoteDTO]) -> [Lote] {
        return dtos.map { toDomain(from: $0) }
    }

    /**
     * Convierte array de LoteEntity a array de Lote domain
     *
     * ANDROID EQUIVALENT: `fun List<LoteEntity>.toDomain(): List<Lote>`
     */
    func toDomain(from entities: [LoteEntity]) -> [Lote] {
        return entities.map { toDomain(from: $0) }
    }

    /**
     * Convierte array de Lote domain a array de LoteDTO
     *
     * ANDROID EQUIVALENT: `fun List<Lote>.toDto(): List<LoteDto>`
     */
    func toDTO(from lotes: [Lote]) -> [LoteDTO] {
        return lotes.map { toDTO(from: $0) }
    }
}
