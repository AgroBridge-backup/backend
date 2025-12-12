package com.agrobridge.data.mapper

import com.agrobridge.data.dto.*
import com.agrobridge.data.model.*

/**
 * Mapper entre DTOs y modelos de dominio
 * Separa la capa de datos de la capa de dominio
 */
object LoteMapper {

    /**
     * Convertir LoteDto a Lote (Domain Model)
     */
    fun LoteDto.toDomain(): Lote {
        return Lote(
            id = this.id,
            nombre = this.nombre,
            cultivo = this.cultivo,
            area = this.area,
            estado = this.estado.toLoteEstado(),
            productor = this.productor?.toDomain() ?: Productor.mock(),
            fechaCreacion = this.fechaCreacion,
            coordenadas = this.coordenadas?.map { it.toDomain() },
            centroCampo = this.centroCampo?.toDomain(),
            ubicacion = this.ubicacion,
            bloqueId = this.bloqueId,
            bloqueNombre = this.bloqueNombre,
            metadata = this.metadata
        )
    }

    /**
     * Convertir lista de LoteDto a lista de Lote
     */
    fun List<LoteDto>.toDomain(): List<Lote> {
        return this.map { it.toDomain() }
    }

    /**
     * Convertir Lote a LoteDto
     */
    fun Lote.toDto(): LoteDto {
        return LoteDto(
            id = this.id,
            nombre = this.nombre,
            cultivo = this.cultivo,
            area = this.area,
            estado = this.estado.name.lowercase(),
            productorId = this.productor.id,
            productor = this.productor.toDto(),
            fechaCreacion = this.fechaCreacion,
            fechaActualizacion = System.currentTimeMillis(),
            coordenadas = this.coordenadas?.map { it.toDto() },
            centroCampo = this.centroCampo?.toDto(),
            ubicacion = this.ubicacion,
            bloqueId = this.bloqueId,
            bloqueNombre = this.bloqueNombre,
            // FIXED: MEDIUM-2 - Use null-coalescing instead of unsafe cast
            metadata = (this.metadata as? Map<String, Any>) ?: emptyMap()
        )
    }

    /**
     * Convertir CoordenadaDto a Coordenada
     */
    fun CoordenadaDto.toDomain(): Coordenada {
        return Coordenada(
            latitud = this.latitud,
            longitud = this.longitud
        )
    }

    /**
     * Convertir Coordenada a CoordenadaDto
     */
    fun Coordenada.toDto(): CoordenadaDto {
        return CoordenadaDto(
            latitud = this.latitud,
            longitud = this.longitud
        )
    }

    /**
     * Convertir ProductorDto a Productor
     */
    fun ProductorDto.toDomain(): Productor {
        return Productor(
            id = this.id,
            nombre = this.nombre,
            apellido = this.apellido,
            email = this.email,
            telefono = this.telefono,
            direccion = this.direccion,
            ciudad = this.ciudad,
            estado = this.estado,
            codigoPostal = this.codigoPostal,
            pais = this.pais,
            certificaciones = this.certificaciones,
            activo = this.activo,
            fechaRegistro = this.fechaRegistro
        )
    }

    /**
     * Convertir Productor a ProductorDto
     */
    fun Productor.toDto(): ProductorDto {
        return ProductorDto(
            id = this.id,
            nombre = this.nombre,
            apellido = this.apellido,
            email = this.email,
            telefono = this.telefono,
            direccion = this.direccion,
            ciudad = this.ciudad,
            estado = this.estado,
            codigoPostal = this.codigoPostal,
            pais = this.pais,
            certificaciones = this.certificaciones,
            activo = this.activo,
            fechaRegistro = this.fechaRegistro
        )
    }

    /**
     * Convertir String a LoteEstado
     *
     * FIXED: MEDIUM-25 - Throw exception on unmapped state instead of silent fallback
     * Helps detect unexpected API responses or data corruption
     */
    private fun String.toLoteEstado(): LoteEstado {
        return when (this.lowercase()) {
            "activo" -> LoteEstado.ACTIVO
            "inactivo" -> LoteEstado.INACTIVO
            "en_cosecha", "en cosecha" -> LoteEstado.EN_COSECHA
            "cosechado" -> LoteEstado.COSECHADO
            "en_preparacion", "en preparacion" -> LoteEstado.EN_PREPARACION
            else -> throw IllegalArgumentException(
                "Unknown LoteEstado: '$this'. Valid values: activo, inactivo, en_cosecha, cosechado, en_preparacion"
            )
        }
    }

    /**
     * Convertir CreateLoteRequest a Lote (para preview)
     */
    fun CreateLoteRequest.toPreview(productor: Productor): Lote {
        return Lote(
            id = "temp-${System.currentTimeMillis()}",
            nombre = this.nombre,
            cultivo = this.cultivo,
            area = this.area,
            estado = LoteEstado.INACTIVO,
            productor = productor,
            fechaCreacion = System.currentTimeMillis(),
            coordenadas = this.coordenadas?.map { it.toDomain() },
            centroCampo = this.coordenadas?.let { coords ->
                if (coords.isNotEmpty()) {
                    val latPromedio = coords.map { it.latitud }.average()
                    val lonPromedio = coords.map { it.longitud }.average()
                    Coordenada(latPromedio, lonPromedio)
                } else null
            },
            ubicacion = this.ubicacion,
            bloqueId = this.bloqueId
        )
    }
}

/**
 * Extension functions para facilitar conversión
 */

/**
 * Convertir ApiResponse<LoteDto> a ApiResponse<Lote>
 */
fun ApiResponse<LoteDto>.toDomain(): ApiResponse<Lote> {
    return this.map { it.toDomain() }
}

/**
 * Convertir ApiResponse<List<LoteDto>> a ApiResponse<List<Lote>>
 */
fun ApiResponse<List<LoteDto>>.toDomainList(): ApiResponse<List<Lote>> {
    return this.map { dtos -> dtos.map { it.toDomain() } }
}

/**
 * Convertir PaginatedResponse<LoteDto> a PaginatedResponse<Lote>
 */
fun PaginatedResponse<LoteDto>.toDomain(): PaginatedResponse<Lote> {
    return PaginatedResponse(
        data = this.data.map { it.toDomain() },
        page = this.page,
        pageSize = this.pageSize,
        total = this.total,
        hasMore = this.hasMore
    )
}
