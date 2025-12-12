package com.agrobridge.data.dto

import com.google.gson.annotations.SerializedName

/**
 * DTO de Lote para comunicación con API
 * Separado del modelo de dominio para desacoplar capas
 */
data class LoteDto(
    @SerializedName("id")
    val id: String,

    @SerializedName("nombre")
    val nombre: String,

    @SerializedName("cultivo")
    val cultivo: String,

    @SerializedName("area")
    val area: Double,

    @SerializedName("estado")
    val estado: String, // String en API, Enum en Domain

    @SerializedName("productor_id")
    val productorId: String,

    @SerializedName("productor")
    val productor: ProductorDto? = null,

    @SerializedName("fecha_creacion")
    val fechaCreacion: Long,

    @SerializedName("fecha_actualizacion")
    val fechaActualizacion: Long? = null,

    @SerializedName("coordenadas")
    val coordenadas: List<CoordenadaDto>? = null,

    @SerializedName("centro_campo")
    val centroCampo: CoordenadaDto? = null,

    @SerializedName("ubicacion")
    val ubicacion: String? = null,

    @SerializedName("bloque_id")
    val bloqueId: String? = null,

    @SerializedName("bloque_nombre")
    val bloqueNombre: String? = null,

    @SerializedName("metadata")
    val metadata: Map<String, Any>? = null
) {
    /**
     * Validar que el DTO tiene datos mínimos requeridos
     */
    fun isValid(): Boolean {
        return id.isNotBlank() &&
                nombre.isNotBlank() &&
                cultivo.isNotBlank() &&
                area > 0 &&
                estado.isNotBlank()
    }

    /**
     * Validar coordenadas GPS
     */
    fun hasValidGPS(): Boolean {
        return !coordenadas.isNullOrEmpty() &&
                coordenadas.size >= 3 &&
                coordenadas.all { it.isValid() }
    }
}

/**
 * DTO de Coordenada
 */
data class CoordenadaDto(
    @SerializedName("latitud")
    val latitud: Double,

    @SerializedName("longitud")
    val longitud: Double
) {
    /**
     * Validar coordenadas
     */
    fun isValid(): Boolean {
        return latitud in -90.0..90.0 && longitud in -180.0..180.0
    }
}

/**
 * DTO de Productor
 */
data class ProductorDto(
    @SerializedName("id")
    val id: String,

    @SerializedName("nombre")
    val nombre: String,

    @SerializedName("apellido")
    val apellido: String? = null,

    @SerializedName("email")
    val email: String? = null,

    @SerializedName("telefono")
    val telefono: String? = null,

    @SerializedName("direccion")
    val direccion: String? = null,

    @SerializedName("ciudad")
    val ciudad: String? = null,

    @SerializedName("estado")
    val estado: String? = null,

    @SerializedName("codigo_postal")
    val codigoPostal: String? = null,

    @SerializedName("pais")
    val pais: String? = null,

    @SerializedName("certificaciones")
    val certificaciones: List<String>? = null,

    @SerializedName("activo")
    val activo: Boolean = true,

    @SerializedName("fecha_registro")
    val fechaRegistro: Long? = null
) {
    /**
     * Validar datos mínimos
     */
    fun isValid(): Boolean {
        return id.isNotBlank() && nombre.isNotBlank()
    }

    /**
     * Validar email si existe
     */
    fun hasValidEmail(): Boolean {
        return email?.matches(Regex("^[A-Za-z0-9+_.-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}$")) ?: true
    }
}

/**
 * Request para crear/actualizar lote
 */
data class CreateLoteRequest(
    @SerializedName("nombre")
    val nombre: String,

    @SerializedName("cultivo")
    val cultivo: String,

    @SerializedName("area")
    val area: Double,

    @SerializedName("productor_id")
    val productorId: String,

    @SerializedName("coordenadas")
    val coordenadas: List<CoordenadaDto>? = null,

    @SerializedName("ubicacion")
    val ubicacion: String? = null,

    @SerializedName("bloque_id")
    val bloqueId: String? = null
) {
    /**
     * Validar request
     */
    fun validate(): ValidationResult {
        val errors = mutableListOf<String>()

        if (nombre.isBlank()) errors.add("Nombre es requerido")
        if (cultivo.isBlank()) errors.add("Cultivo es requerido")
        if (area <= 0) errors.add("Área debe ser mayor a 0")
        if (productorId.isBlank()) errors.add("Productor ID es requerido")

        coordenadas?.let { coords ->
            if (coords.size < 3) {
                errors.add("Se requieren al menos 3 coordenadas para formar un polígono")
            }
            coords.forEachIndexed { index, coord ->
                if (!coord.isValid()) {
                    errors.add("Coordenada $index es inválida")
                }
            }
        }

        return if (errors.isEmpty()) {
            ValidationResult.Valid
        } else {
            ValidationResult.Invalid(errors)
        }
    }
}

/**
 * Resultado de validación
 */
sealed class ValidationResult {
    object Valid : ValidationResult()
    data class Invalid(val errors: List<String>) : ValidationResult()

    fun isValid() = this is Valid
    fun getErrors() = if (this is Invalid) errors else emptyList()
}
