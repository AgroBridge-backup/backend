package com.agrobridge.data.model

import com.google.android.gms.maps.model.LatLng
import com.google.gson.annotations.SerializedName

/**
 * Modelo de coordenada GPS
 * Replica exactamente Coordenada.swift de iOS
 *
 * Uso:
 * - Representar puntos GPS (centroCampo de un lote)
 * - Construir polígonos (coordenadas de un lote)
 * - Integración con Google Maps
 */
data class Coordenada(
    @SerializedName("latitud")
    val latitud: Double,

    @SerializedName("longitud")
    val longitud: Double
) {
    /**
     * Convertir a LatLng de Google Maps
     */
    fun toLatLng(): LatLng = LatLng(latitud, longitud)

    /**
     * Validar que las coordenadas son válidas
     */
    fun isValid(): Boolean {
        return latitud in -90.0..90.0 && longitud in -180.0..180.0
    }

    /**
     * Calcular distancia a otra coordenada (en metros)
     * Usa fórmula Haversine
     */
    fun distanceTo(other: Coordenada): Double {
        val R = 6371000.0 // Radio de la Tierra en metros
        val lat1Rad = Math.toRadians(latitud)
        val lat2Rad = Math.toRadians(other.latitud)
        val deltaLat = Math.toRadians(other.latitud - latitud)
        val deltaLon = Math.toRadians(other.longitud - longitud)

        val a = Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
                Math.cos(lat1Rad) * Math.cos(lat2Rad) *
                Math.sin(deltaLon / 2) * Math.sin(deltaLon / 2)
        val c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))

        return R * c
    }

    companion object {
        /**
         * Crear desde LatLng de Google Maps
         */
        fun fromLatLng(latLng: LatLng) = Coordenada(
            latitud = latLng.latitude,
            longitud = latLng.longitude
        )

        /**
         * Coordenadas mock para testing (Ciudad de México)
         */
        fun mock() = Coordenada(
            latitud = 19.432608,
            longitud = -99.133209
        )

        /**
         * Lista de coordenadas mock para un polígono de prueba
         */
        fun mockPolygon() = listOf(
            Coordenada(19.432608, -99.133209),
            Coordenada(19.433608, -99.133209),
            Coordenada(19.433608, -99.134209),
            Coordenada(19.432608, -99.134209)
        )
    }
}
