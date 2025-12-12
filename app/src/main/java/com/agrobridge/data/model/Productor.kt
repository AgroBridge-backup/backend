package com.agrobridge.data.model

import com.google.gson.annotations.SerializedName

/**
 * Modelo de Productor
 * Representa un productor agrícola en el sistema
 */
data class Productor(
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

    @SerializedName("codigoPostal")
    val codigoPostal: String? = null,

    @SerializedName("pais")
    val pais: String? = null,

    @SerializedName("certificaciones")
    val certificaciones: List<String>? = null,

    @SerializedName("activo")
    val activo: Boolean = true,

    @SerializedName("fechaRegistro")
    val fechaRegistro: Long? = null
) {
    /**
     * Nombre completo del productor
     */
    val nombreCompleto: String
        get() = if (apellido != null) "$nombre $apellido" else nombre

    companion object {
        /**
         * Productor mock para testing
         */
        fun mock() = Productor(
            id = "prod-001",
            nombre = "Juan",
            apellido = "Pérez",
            email = "juan.perez@example.com",
            telefono = "+52 55 1234 5678",
            direccion = "Calle Principal 123",
            ciudad = "Ciudad de México",
            estado = "CDMX",
            codigoPostal = "01000",
            pais = "México",
            certificaciones = listOf("Orgánico", "Fair Trade"),
            activo = true,
            fechaRegistro = System.currentTimeMillis()
        )
    }
}
