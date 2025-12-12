package com.agrobridge.data.mapper

import com.agrobridge.data.local.converter.CoordenadaEntity
import com.agrobridge.data.local.entity.LoteEntity
import com.agrobridge.data.model.Coordenada
import com.agrobridge.data.model.Lote
import com.agrobridge.data.model.LoteEstado
import com.agrobridge.data.model.Productor
import com.google.gson.Gson
import com.google.gson.reflect.TypeToken

/**
 * Mapper para convertir LoteEntity (Persistencia) -> Lote (Domain)
 * Transforma datos persistidos en el dispositivo a modelos de dominio
 */
object LoteEntityToDomainMapper {

    private val gson = Gson()

    /**
     * Convertir LoteEntity a Lote (Domain Model)
     */
    fun LoteEntity.toDomain(): Lote {
        // Deserializar coordenadas desde JSON
        // FIXED: MEDIUM-8 - Fallback to emptyList() on JSON parse failure instead of null
        val coordenadas = this.coordenadas?.let { jsonString ->
            try {
                val type = object : TypeToken<List<CoordenadaEntity>>() {}.type
                val entities = gson.fromJson<List<CoordenadaEntity>>(jsonString, type)
                entities?.map { Coordenada(it.latitud, it.longitud) } ?: emptyList()
            } catch (e: Exception) {
                // Log error and fallback to empty list to prevent data loss
                Timber.w(e, "Failed to deserialize coordenadas JSON: $jsonString")
                emptyList()
            }
        }

        val centroCampo = if (this.centroCampoLatitud != null && this.centroCampoLongitud != null) {
            Coordenada(this.centroCampoLatitud, this.centroCampoLongitud)
        } else {
            null
        }

        return Lote(
            id = this.id,
            nombre = this.nombre,
            cultivo = this.cultivo,
            area = this.area,
            estado = stringToLoteEstado(this.estado),
            productor = Productor(
                id = this.productorId,
                nombre = this.productorNombre,
                apellido = null,
                email = null,
                telefono = null,
                direccion = null,
                ciudad = null,
                estado = null,
                codigoPostal = null,
                pais = null,
                certificaciones = null,
                activo = true,
                fechaRegistro = null
            ),
            fechaCreacion = this.fechaCreacion,
            coordenadas = coordenadas,
            centroCampo = centroCampo,
            ubicacion = this.ubicacion,
            bloqueId = this.bloqueId,
            bloqueNombre = this.bloqueNombre,
            metadata = null
        )
    }

    /**
     * Convertir lista de LoteEntity a lista de Lote
     */
    fun List<LoteEntity>.toDomain(): List<Lote> {
        return this.map { it.toDomain() }
    }

    /**
     * Helper: Convertir String a LoteEstado enum
     */
    private fun stringToLoteEstado(estado: String): LoteEstado {
        return when (estado.uppercase()) {
            "ACTIVO" -> LoteEstado.ACTIVO
            "INACTIVO" -> LoteEstado.INACTIVO
            "EN_COSECHA" -> LoteEstado.EN_COSECHA
            "COSECHADO" -> LoteEstado.COSECHADO
            "EN_PREPARACION" -> LoteEstado.EN_PREPARACION
            else -> LoteEstado.INACTIVO // Fallback
        }
    }
}
