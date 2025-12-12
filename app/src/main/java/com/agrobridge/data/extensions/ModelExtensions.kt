package com.agrobridge.data.extensions

import com.agrobridge.data.model.*
import com.agrobridge.presentation.model.LoteUIModel
import com.agrobridge.presentation.model.UIState
import kotlin.math.*

// ========================================================================
// Coordenada Extensions
// ========================================================================

/**
 * Calcular distancia entre dos coordenadas usando fórmula Haversine
 * @return Distancia en metros
 */
fun Coordenada.distanceTo(other: Coordenada): Double {
    val earthRadius = 6371000.0 // Radio de la tierra en metros

    val lat1Rad = Math.toRadians(this.latitud)
    val lat2Rad = Math.toRadians(other.latitud)
    val deltaLat = Math.toRadians(other.latitud - this.latitud)
    val deltaLon = Math.toRadians(other.longitud - this.longitud)

    val a = sin(deltaLat / 2).pow(2) +
            cos(lat1Rad) * cos(lat2Rad) *
            sin(deltaLon / 2).pow(2)

    val c = 2 * atan2(sqrt(a), sqrt(1 - a))

    return earthRadius * c
}

/**
 * Calcular bearing (rumbo) hacia otra coordenada
 * @return Rumbo en grados (0-360)
 */
fun Coordenada.bearingTo(other: Coordenada): Double {
    val lat1Rad = Math.toRadians(this.latitud)
    val lat2Rad = Math.toRadians(other.latitud)
    val deltaLon = Math.toRadians(other.longitud - this.longitud)

    val y = sin(deltaLon) * cos(lat2Rad)
    val x = cos(lat1Rad) * sin(lat2Rad) -
            sin(lat1Rad) * cos(lat2Rad) * cos(deltaLon)

    val bearing = Math.toDegrees(atan2(y, x))
    return (bearing + 360) % 360
}

/**
 * Punto medio entre dos coordenadas
 */
fun Coordenada.midpoint(other: Coordenada): Coordenada {
    return Coordenada(
        latitud = (this.latitud + other.latitud) / 2,
        longitud = (this.longitud + other.longitud) / 2
    )
}

/**
 * Verificar si la coordenada está dentro de bounds
 */
fun Coordenada.isWithinBounds(
    minLat: Double,
    maxLat: Double,
    minLon: Double,
    maxLon: Double
): Boolean {
    return latitud in minLat..maxLat && longitud in minLon..maxLon
}

/**
 * Formatear coordenada para display
 * Ejemplo: "19.4326°N, -99.1332°W"
 */
fun Coordenada.toDisplayString(): String {
    val latDirection = if (latitud >= 0) "N" else "S"
    val lonDirection = if (longitud >= 0) "E" else "W"

    return "${abs(latitud).format(4)}°$latDirection, ${abs(longitud).format(4)}°$lonDirection"
}

/**
 * Formatear coordenada compacta
 * Ejemplo: "19.43, -99.13"
 */
fun Coordenada.toCompactString(): String {
    return "${latitud.format(2)}, ${longitud.format(2)}"
}

// ========================================================================
// List<Coordenada> Extensions
// ========================================================================

/**
 * Calcular centro geométrico de un polígono
 */
fun List<Coordenada>.calculateCentroid(): Coordenada? {
    if (isEmpty()) return null

    val latPromedio = map { it.latitud }.average()
    val lonPromedio = map { it.longitud }.average()

    return Coordenada(latPromedio, lonPromedio)
}

/**
 * Calcular área del polígono en metros cuadrados
 * Usa algoritmo de Shoelace
 */
fun List<Coordenada>.calculateArea(): Double {
    if (size < 3) return 0.0

    val earthRadius = 6371000.0 // metros
    var area = 0.0

    for (i in indices) {
        val p1 = this[i]
        val p2 = this[(i + 1) % size]

        area += Math.toRadians(p2.longitud - p1.longitud) *
                (2 + sin(Math.toRadians(p1.latitud)) +
                        sin(Math.toRadians(p2.latitud)))
    }

    area = abs(area * earthRadius * earthRadius / 2.0)
    return area
}

/**
 * Calcular área en hectáreas
 */
fun List<Coordenada>.calculateAreaInHectares(): Double {
    return calculateArea() / 10000.0
}

/**
 * Calcular perímetro del polígono en metros
 */
fun List<Coordenada>.calculatePerimeter(): Double {
    if (size < 2) return 0.0

    var perimeter = 0.0
    for (i in indices) {
        val p1 = this[i]
        val p2 = this[(i + 1) % size]
        perimeter += p1.distanceTo(p2)
    }

    return perimeter
}

/**
 * Obtener bounds (min/max lat/lon) del polígono
 */
fun List<Coordenada>.getBounds(): CoordinateBounds? {
    if (isEmpty()) return null

    return CoordinateBounds(
        minLat = minOf { it.latitud },
        maxLat = maxOf { it.latitud },
        minLon = minOf { it.longitud },
        maxLon = maxOf { it.longitud }
    )
}

/**
 * Verificar si el polígono es válido (al menos 3 puntos no colineales)
 */
fun List<Coordenada>.isValidPolygon(): Boolean {
    if (size < 3) return false

    // Verificar que el área no sea cero (puntos colineales)
    val area = calculateArea()
    return area > 0.1 // Al menos 0.1 m²
}

// ========================================================================
// Lote Extensions
// ========================================================================

/**
 * Verificar si el lote tiene GPS válido
 */
fun Lote.hasValidGPS(): Boolean {
    return coordenadas != null &&
            coordenadas.size >= 3 &&
            coordenadas.isValidPolygon()
}

/**
 * Obtener área calculada desde GPS o área declarada
 */
fun Lote.getEffectiveArea(): Double {
    return areaCalculada ?: area
}

/**
 * Calcular diferencia entre área declarada y calculada
 * @return Porcentaje de diferencia (positivo = calculada mayor)
 */
fun Lote.getAreaDiscrepancy(): Double? {
    if (areaCalculada == null || area == 0.0) return null
    return ((areaCalculada - area) / area) * 100
}

/**
 * Verificar si hay discrepancia significativa en área
 */
fun Lote.hasSignificantAreaDiscrepancy(threshold: Double = 10.0): Boolean {
    val discrepancy = getAreaDiscrepancy() ?: return false
    return abs(discrepancy) > threshold
}

/**
 * Obtener emoji del cultivo
 */
val Lote.cultivoEmoji: String
    get() = when (cultivo.lowercase()) {
        "maíz", "maiz" -> "🌽"
        "trigo" -> "🌾"
        "arroz" -> "🌾"
        "café", "cafe" -> "☕"
        "papa" -> "🥔"
        "tomate" -> "🍅"
        "frijol" -> "🫘"
        "aguacate" -> "🥑"
        "plátano", "platano", "banano" -> "🍌"
        "naranja" -> "🍊"
        "limón", "limon" -> "🍋"
        "mango" -> "🥭"
        "caña de azúcar", "cana" -> "🎋"
        "algodón", "algodon" -> "🌸"
        "soja", "soya" -> "🫛"
        else -> "🌱"
    }

/**
 * Obtener color del mapa basado en estado
 */
val Lote.mapColor: androidx.compose.ui.graphics.Color
    get() = when (estado) {
        LoteEstado.ACTIVO -> com.agrobridge.presentation.theme.StatusActive
        LoteEstado.EN_COSECHA -> com.agrobridge.presentation.theme.StatusHarvest
        LoteEstado.COSECHADO -> com.agrobridge.presentation.theme.StatusHarvested
        LoteEstado.EN_PREPARACION -> com.agrobridge.presentation.theme.StatusPreparation
        LoteEstado.INACTIVO -> com.agrobridge.presentation.theme.StatusInactive
    }

/**
 * Verificar si el lote está activo
 */
fun Lote.isActive(): Boolean {
    return estado == LoteEstado.ACTIVO || estado == LoteEstado.EN_COSECHA
}

/**
 * Obtener edad del lote en días
 */
fun Lote.getAgeInDays(): Long {
    val now = System.currentTimeMillis()
    return (now - fechaCreacion) / (1000 * 60 * 60 * 24)
}

/**
 * Verificar si el lote es nuevo (menos de 7 días)
 */
fun Lote.isNew(): Boolean {
    return getAgeInDays() < 7
}

// ========================================================================
// List<Lote> Extensions
// ========================================================================

/**
 * Filtrar lotes por estado
 */
fun List<Lote>.filterByEstado(estado: LoteEstado): List<Lote> {
    return filter { it.estado == estado }
}

/**
 * Filtrar lotes activos
 */
fun List<Lote>.filterActivos(): List<Lote> {
    return filter { it.isActive() }
}

/**
 * Filtrar lotes con GPS
 */
fun List<Lote>.filterWithGPS(): List<Lote> {
    return filter { it.hasValidGPS() }
}

/**
 * Filtrar lotes por cultivo
 */
fun List<Lote>.filterByCultivo(cultivo: String): List<Lote> {
    return filter { it.cultivo.equals(cultivo, ignoreCase = true) }
}

/**
 * Agrupar lotes por cultivo
 */
fun List<Lote>.groupByCultivo(): Map<String, List<Lote>> {
    return groupBy { it.cultivo }
}

/**
 * Agrupar lotes por estado
 */
fun List<Lote>.groupByEstado(): Map<LoteEstado, List<Lote>> {
    return groupBy { it.estado }
}

/**
 * Calcular área total
 */
fun List<Lote>.totalArea(): Double {
    return sumOf { it.area }
}

/**
 * Calcular área total efectiva (con GPS)
 */
fun List<Lote>.totalEffectiveArea(): Double {
    return sumOf { it.getEffectiveArea() }
}

/**
 * Obtener lotes ordenados por área (mayor a menor)
 */
fun List<Lote>.sortedByAreaDescending(): List<Lote> {
    return sortedByDescending { it.area }
}

/**
 * Obtener lotes más recientes
 */
fun List<Lote>.sortedByRecent(): List<Lote> {
    return sortedByDescending { it.fechaCreacion }
}

/**
 * Obtener estadísticas de lotes
 */
fun List<Lote>.getStatistics(): LoteStatistics {
    return LoteStatistics(
        total = size,
        totalArea = totalArea(),
        activos = count { it.isActive() },
        conGPS = count { it.hasValidGPS() },
        cultivosMasComunes = groupByCultivo()
            .map { it.key to it.value.size }
            .sortedByDescending { it.second }
            .take(5),
        areaPromedio = if (isNotEmpty()) totalArea() / size else 0.0
    )
}

// ========================================================================
// UIState Extensions
// ========================================================================

/**
 * Convertir a Loading con mensaje personalizado
 */
fun <T> UIState<T>.toLoading(message: String? = null): UIState<T> {
    return UIState.Loading(message, null)
}

/**
 * Transformar datos si es Success
 */
inline fun <T, R> UIState<T>.mapData(transform: (T) -> R): UIState<R> {
    return when (this) {
        is UIState.Success -> UIState.Success(transform(data), message)
        is UIState.Loading -> UIState.Loading(message, progress)
        is UIState.Error -> UIState.Error(error, message, code)
        is UIState.Empty -> UIState.Empty(message)
        UIState.Idle -> UIState.Idle
    }
}

/**
 * Ejecutar acción cuando cambia de Loading a Success
 */
inline fun <T> UIState<T>.onLoadComplete(action: (T) -> Unit): UIState<T> {
    if (this is UIState.Success) action(data)
    return this
}

// ========================================================================
// LoteUIModel Extensions
// ========================================================================

/**
 * Verificar si el score es bajo
 */
fun LoteUIModel.hasLowScore(threshold: Int = 60): Boolean {
    return scoreVisual < threshold
}

/**
 * Verificar si necesita atención
 */
fun LoteUIModel.needsAttention(): Boolean {
    return hasLowScore() || tieneAlertas
}

/**
 * Obtener prioridad (1 = alta, 3 = baja)
 */
fun LoteUIModel.getPriority(): Int {
    return when {
        scoreVisual < 50 -> 1
        scoreVisual < 70 -> 2
        else -> 3
    }
}

// ========================================================================
// Helper Functions
// ========================================================================

/**
 * Formatear Double con decimales específicos
 */
private fun Double.format(decimals: Int): String {
    return "%.${decimals}f".format(this)
}

// ========================================================================
// Data Classes
// ========================================================================

/**
 * Bounds de coordenadas
 */
data class CoordinateBounds(
    val minLat: Double,
    val maxLat: Double,
    val minLon: Double,
    val maxLon: Double
) {
    val centerLat: Double get() = (minLat + maxLat) / 2
    val centerLon: Double get() = (minLon + maxLon) / 2

    val center: Coordenada
        get() = Coordenada(centerLat, centerLon)
}

/**
 * Estadísticas de lotes
 */
data class LoteStatistics(
    val total: Int,
    val totalArea: Double,
    val activos: Int,
    val conGPS: Int,
    val cultivosMasComunes: List<Pair<String, Int>>,
    val areaPromedio: Double
) {
    val porcentajeActivos: Double
        get() = if (total > 0) (activos.toDouble() / total) * 100 else 0.0

    val porcentajeConGPS: Double
        get() = if (total > 0) (conGPS.toDouble() / total) * 100 else 0.0
}
