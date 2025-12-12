package com.agrobridge.data.mapper

import com.agrobridge.data.dto.LoteDto
import com.agrobridge.data.local.converter.CoordenadaEntity
import com.agrobridge.data.local.entity.LoteEntity
import com.google.gson.Gson

/**
 * Mapper para convertir LoteDto (API) -> LoteEntity (Persistencia)
 * Maneja la transformación de datos que vienen de la API a formato para almacenar en DB
 */
object LoteEntityMapper {

    private val gson = Gson()

    /**
     * Convertir LoteDto a LoteEntity
     * Nota: Serializa coordenadas a JSON usando Gson
     */
    fun LoteDto.toEntity(): LoteEntity {
        // Convertir coordenadas a formato persistible
        val coordenadaJson = this.coordenadas?.let { coords ->
            val entities = coords.map { CoordenadaEntity(it.latitud, it.longitud) }
            gson.toJson(entities)
        }

        return LoteEntity(
            id = this.id,
            nombre = this.nombre,
            cultivo = this.cultivo,
            area = this.area,
            estado = this.estado,
            productorId = this.productorId,
            productorNombre = this.productor?.nombre ?: "Productor Desconocido",
            fechaCreacion = this.fechaCreacion,
            fechaActualizacion = this.fechaActualizacion ?: System.currentTimeMillis(),
            coordenadas = coordenadaJson,
            centroCampoLatitud = this.centroCampo?.latitud,
            centroCampoLongitud = this.centroCampo?.longitud,
            ubicacion = this.ubicacion,
            bloqueId = this.bloqueId,
            bloqueNombre = this.bloqueNombre,
            localSyncTimestamp = System.currentTimeMillis()
        )
    }

    /**
     * Convertir lista de LoteDto a lista de LoteEntity
     */
    fun List<LoteDto>.toEntities(): List<LoteEntity> {
        return this.map { it.toEntity() }
    }

    /**
     * Convertir Lote (Domain) a LoteEntity
     * FIXED: HIGH-13 - Missing mapper method for domain model to entity conversion
     * Necesario para createLote/updateLote que reciben modelos de dominio
     */
    fun com.agrobridge.data.model.Lote.toEntity(): LoteEntity {
        // Convertir coordenadas a formato persistible
        val coordenadaJson = this.coordenadas?.let { coords ->
            val entities = coords.map { CoordenadaEntity(it.latitud, it.longitud) }
            gson.toJson(entities)
        }

        return LoteEntity(
            id = this.id,
            nombre = this.nombre,
            cultivo = this.cultivo,
            area = this.area,
            estado = this.estado.name, // Convert enum to string
            productorId = this.productor.id,
            productorNombre = this.productor.nombre,
            fechaCreacion = this.fechaCreacion,
            fechaActualizacion = System.currentTimeMillis(),
            coordenadas = coordenadaJson,
            centroCampoLatitud = this.centroCampo?.latitud,
            centroCampoLongitud = this.centroCampo?.longitud,
            ubicacion = this.ubicacion,
            bloqueId = this.bloqueId,
            bloqueNombre = this.bloqueNombre,
            localSyncTimestamp = System.currentTimeMillis()
        )
    }

    /**
     * Convertir LoteEntity a LoteDto (operación inversa, menos común)
     */
    fun LoteEntity.toDto(): LoteDto {
        // Deserializar coordenadas desde JSON
        val coords = this.coordenadas?.let {
            try {
                gson.fromJson(it, Array<CoordenadaEntity>::class.java)
                    .map { entity ->
                        com.agrobridge.data.dto.CoordenadaDto(entity.latitud, entity.longitud)
                    }
            } catch (e: Exception) {
                emptyList()
            }
        }

        return LoteDto(
            id = this.id,
            nombre = this.nombre,
            cultivo = this.cultivo,
            area = this.area,
            estado = this.estado,
            productorId = this.productorId,
            productor = null, // Podría deserializarse si lo necesitas
            fechaCreacion = this.fechaCreacion,
            fechaActualizacion = this.fechaActualizacion,
            coordenadas = coords,
            centroCampo = if (this.centroCampoLatitud != null && this.centroCampoLongitud != null) {
                com.agrobridge.data.dto.CoordenadaDto(
                    this.centroCampoLatitud,
                    this.centroCampoLongitud
                )
            } else null,
            ubicacion = this.ubicacion,
            bloqueId = this.bloqueId,
            bloqueNombre = this.bloqueNombre,
            metadata = null
        )
    }
}
