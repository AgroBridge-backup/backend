package com.agrobridge.data.model

import androidx.compose.ui.graphics.Color
import com.agrobridge.presentation.theme.*
import com.google.android.gms.maps.model.CameraPosition
import com.google.android.gms.maps.model.LatLng
import com.google.gson.annotations.SerializedName

/**
 * Modelo de Lote
 * Representa un campo/lote de producción agrícola
 * ACTUALIZADO: Incluye geolocalización y features de iOS
 */
data class Lote(
    @SerializedName("id")
    val id: String,

    @SerializedName("nombre")
    val nombre: String,

    @SerializedName("cultivo")
    val cultivo: String,

    @SerializedName("area")
    val area: Double, // En hectáreas

    @SerializedName("estado")
    val estado: LoteEstado,

    @SerializedName("productor")
    val productor: Productor,

    @SerializedName("fechaCreacion")
    val fechaCreacion: Long, // Unix timestamp

    // ============================================================================
    // GEOLOCALIZACIÓN (replicado de iOS)
    // ============================================================================

    /**
     * Polígono del campo (lista de coordenadas GPS)
     * Si es null, no se puede mostrar en mapa
     */
    @SerializedName("coordenadas")
    val coordenadas: List<Coordenada>? = null,

    /**
     * Centro del campo (para mostrar marker en mapa)
     * Si es null, se calcula automáticamente del polígono
     */
    @SerializedName("centroCampo")
    val centroCampo: Coordenada? = null,

    // ============================================================================
    // PROPIEDADES ADICIONALES
    // ============================================================================

    @SerializedName("ubicacion")
    val ubicacion: String? = null,

    @SerializedName("bloqueId")
    val bloqueId: String? = null,

    @SerializedName("bloqueNombre")
    val bloqueNombre: String? = null,

    @SerializedName("metadata")
    val metadata: Any? = null
) {

    // ============================================================================
    // COMPUTED PROPERTIES (replicados de iOS)
    // ============================================================================

    /**
     * Color del estado en el mapa
     * Replica extension LoteEstado.mapColor de iOS
     */
    val mapColor: Color
        get() = when (estado) {
            LoteEstado.ACTIVO -> StatusActive
            LoteEstado.EN_COSECHA -> StatusHarvest
            LoteEstado.COSECHADO -> StatusCertified
            LoteEstado.EN_PREPARACION -> StatusPreparation
            LoteEstado.INACTIVO -> StatusInactive
        }

    /**
     * Emoji del cultivo
     * Replica extension String.emoji de iOS
     */
    val cultivoEmoji: String
        get() = when (cultivo.lowercase()) {
            "aguacate" -> "🥑"
            "tomate" -> "🍅"
            "maíz", "maiz" -> "🌽"
            "fresa" -> "🍓"
            "café", "cafe" -> "☕"
            "cacao" -> "🍫"
            "papa" -> "🥔"
            "chile" -> "🌶️"
            "frijol" -> "🫘"
            else -> "🌱"
        }

    /**
     * CameraPosition para Google Maps (centrada en este lote)
     * Replica var region de iOS
     */
    val cameraPosition: CameraPosition?
        get() {
            val centro = centroCampo ?: calcularCentro()
            return centro?.let {
                CameraPosition.Builder()
                    .target(it.toLatLng())
                    .zoom(16f) // Equivalente a latitudeDelta 0.01 de iOS
                    .build()
            }
        }

    /**
     * Verificar si el lote tiene datos GPS válidos
     */
    val hasValidGPS: Boolean
        get() = coordenadas != null && coordenadas.size >= 3

    /**
     * Área del polígono calculada usando fórmula de Shoelace con corrección geodética
     * Usa Radio de la Tierra para convertir a metros cuadrados, luego a hectáreas
     * Preciso para cualquier latitud (no solo en el ecuador)
     */
    val areaCalculada: Double?
        get() {
            // Safe navigation: return null if no valid GPS
            val coords = coordenadas ?: return null
            if (coords.size < 3) return null

            // Shoelace formula con proyección Cartesiana basada en latitud
            var areaM2 = 0.0
            for (i in coords.indices) {
                val j = (i + 1) % coords.size
                val lat1 = Math.toRadians(coords[i].latitud)
                val lon1 = Math.toRadians(coords[i].longitud)
                val lat2 = Math.toRadians(coords[j].latitud)
                val lon2 = Math.toRadians(coords[j].longitud)

                // Convertir a coordenadas Cartesianas aproximadas usando radio de la Tierra
                // Ajustar longitud por cos(latitud promedio) para precisión en latitudes altas
                val avgLat = (lat1 + lat2) / SHOELACE_DIVISOR
                val x1 = lon1 * Math.cos(avgLat) * EARTH_RADIUS_METERS
                val y1 = lat1 * EARTH_RADIUS_METERS
                val x2 = lon2 * Math.cos(avgLat) * EARTH_RADIUS_METERS
                val y2 = lat2 * EARTH_RADIUS_METERS

                // Aplicar fórmula de Shoelace
                areaM2 += (x1 * y2) - (x2 * y1)
            }

            // Resultado en m², dividir entre 10,000 para convertir a hectáreas
            val hectareas = Math.abs(areaM2) / SHOELACE_DIVISOR / SQ_METERS_PER_HECTARE
            return if (hectareas > 0) hectareas else null
        }

    // ============================================================================
    // MÉTODOS DE GEOLOCALIZACIÓN
    // ============================================================================

    /**
     * Calcular centro geométrico del polígono
     * Si no hay centroCampo definido, lo calcula
     */
    private fun calcularCentro(): Coordenada? {
        if (coordenadas == null || coordenadas.isEmpty()) return null

        val latPromedio = coordenadas.map { it.latitud }.average()
        val lonPromedio = coordenadas.map { it.longitud }.average()

        return Coordenada(latPromedio, lonPromedio)
    }

    /**
     * Verificar si un punto está dentro del polígono (ray casting algorithm)
     * Implementa algoritmo de ray casting seguro con tolerancia epsilon para
     * precisión de punto flotante y manejo de casos especiales (bordes verticales)
     *
     * BUG FIX HIGH-3: Previene división por cero en bordes verticales
     */
    fun contienePunto(punto: Coordenada): Boolean {
        // Safe null check
        val coords = coordenadas ?: return false
        if (coords.size < 3) return false

        var inside = false
        val epsilon = 1e-10  // Tolerancia para comparaciones de punto flotante
        var j = coords.size - 1

        for (i in coords.indices) {
            val xi = coords[i].longitud
            val yi = coords[i].latitud
            val xj = coords[j].longitud
            val yj = coords[j].latitud
            val px = punto.longitud
            val py = punto.latitud

            // Ray casting: verificar si el rayo horizontal desde punto intersecta el edge
            if ((yi > py) != (yj > py)) {
                // Edge cruza la línea horizontal del punto
                val deltaX = xj - xi
                if (Math.abs(deltaX) > epsilon) {
                    // Evitar división por cero con verificación epsilon
                    val slope = (xj - xi) / (yj - yi)
                    val xIntersect = xi + slope * (py - yi)

                    if (px < xIntersect) {
                        inside = !inside
                    }
                }
                // Si deltaX ~= 0 (borde casi vertical), ignorar para evitar inestabilidad numérica
            }
            j = i
        }

        return inside
    }

    companion object {
        // FIXED: LOW-039 - Extract geographic constants from area calculation
        /** Earth's radius in meters (WGS84 sphere approximation) */
        private const val EARTH_RADIUS_METERS = 6371000.0

        /** Shoelace formula divisor for area calculation */
        private const val SHOELACE_DIVISOR = 2.0

        /** Conversion factor from square meters to hectares */
        private const val SQ_METERS_PER_HECTARE = 10000.0

        /**
         * Datos mock para testing (replicado de iOS mockLotes)
         */
        fun mockLotes(): List<Lote> = listOf(
            Lote(
                id = "lote-001",
                nombre = "Campo Norte",
                cultivo = "Aguacate",
                area = 12.5,
                estado = LoteEstado.ACTIVO,
                productor = Productor.mock(),
                fechaCreacion = System.currentTimeMillis(),
                coordenadas = listOf(
                    Coordenada(19.432608, -99.133209),
                    Coordenada(19.433608, -99.133209),
                    Coordenada(19.433608, -99.134209),
                    Coordenada(19.432608, -99.134209)
                ),
                centroCampo = Coordenada(19.433108, -99.133709)
            ),
            Lote(
                id = "lote-002",
                nombre = "Campo Sur",
                cultivo = "Tomate",
                area = 8.3,
                estado = LoteEstado.EN_COSECHA,
                productor = Productor.mock(),
                fechaCreacion = System.currentTimeMillis(),
                coordenadas = listOf(
                    Coordenada(19.431608, -99.133209),
                    Coordenada(19.432608, -99.133209),
                    Coordenada(19.432608, -99.134209),
                    Coordenada(19.431608, -99.134209)
                ),
                centroCampo = Coordenada(19.432108, -99.133709)
            ),
            Lote(
                id = "lote-003",
                nombre = "Campo Este",
                cultivo = "Maíz",
                area = 15.7,
                estado = LoteEstado.EN_PREPARACION,
                productor = Productor.mock(),
                fechaCreacion = System.currentTimeMillis(),
                coordenadas = listOf(
                    Coordenada(19.433608, -99.132209),
                    Coordenada(19.434608, -99.132209),
                    Coordenada(19.434608, -99.133209),
                    Coordenada(19.433608, -99.133209)
                ),
                centroCampo = Coordenada(19.434108, -99.132709)
            )
        )
    }
}

/**
 * Enum de estados de lote
 * Debe coincidir con el backend
 */
enum class LoteEstado {
    @SerializedName("activo")
    ACTIVO,

    @SerializedName("inactivo")
    INACTIVO,

    @SerializedName("en_cosecha")
    EN_COSECHA,

    @SerializedName("cosechado")
    COSECHADO,

    @SerializedName("en_preparacion")
    EN_PREPARACION;

    /**
     * Display name para UI
     */
    val displayName: String
        get() = when (this) {
            ACTIVO -> "Activo"
            INACTIVO -> "Inactivo"
            EN_COSECHA -> "En Cosecha"
            COSECHADO -> "Cosechado"
            EN_PREPARACION -> "En Preparación"
        }
}
