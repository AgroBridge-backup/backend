package com.agrobridge.presentation.map

import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.toArgb
import com.agrobridge.data.extensions.distanceTo
import com.agrobridge.data.model.Coordenada
import com.agrobridge.data.model.Lote
import com.agrobridge.data.model.LoteEstado
import com.agrobridge.presentation.model.LoteUIModel
import com.google.android.gms.maps.CameraUpdateFactory
import com.google.android.gms.maps.model.CameraPosition
import com.google.android.gms.maps.model.LatLng
import com.google.android.gms.maps.model.LatLngBounds
import com.google.maps.android.compose.CameraPositionState
import kotlin.math.*

// ========================================================================
// CONSTANTS - Compass and Bearing Thresholds
// ========================================================================
// FIXED: LOW-037 - Extract hardcoded compass bearing thresholds to constants
private const val BEARING_NORTH_MIN = 337.5
private const val BEARING_NORTH_MAX = 22.5
private const val BEARING_NE_MIN = 22.5
private const val BEARING_NE_MAX = 67.5
private const val BEARING_E_MIN = 67.5
private const val BEARING_E_MAX = 112.5
private const val BEARING_SE_MIN = 112.5
private const val BEARING_SE_MAX = 157.5
private const val BEARING_S_MIN = 157.5
private const val BEARING_S_MAX = 202.5
private const val BEARING_SW_MIN = 202.5
private const val BEARING_SW_MAX = 247.5
private const val BEARING_W_MIN = 247.5
private const val BEARING_W_MAX = 292.5

// ========================================================================
// Conversiones entre Coordenada y LatLng
// ========================================================================

/**
 * Convertir Coordenada a LatLng de Google Maps
 */
fun Coordenada.toLatLng(): LatLng {
    return LatLng(this.latitud, this.longitud)
}

/**
 * Convertir LatLng a Coordenada
 */
fun LatLng.toCoordenada(): Coordenada {
    return Coordenada(this.latitude, this.longitude)
}

/**
 * Convertir lista de Coordenadas a lista de LatLng
 */
fun List<Coordenada>.toLatLngList(): List<LatLng> {
    return this.map { it.toLatLng() }
}

/**
 * Convertir lista de LatLng a lista de Coordenadas
 */
fun List<LatLng>.toCoordenadasList(): List<Coordenada> {
    return this.map { it.toCoordenada() }
}

// ========================================================================
// Bounds y Cámara
// ========================================================================

/**
 * Calcular LatLngBounds desde lista de coordenadas
 */
fun List<Coordenada>.toLatLngBounds(): LatLngBounds? {
    if (isEmpty()) return null

    val builder = LatLngBounds.Builder()
    forEach { coordenada ->
        builder.include(coordenada.toLatLng())
    }
    return builder.build()
}

/**
 * Calcular LatLngBounds desde lista de LatLng
 */
fun List<LatLng>.toBounds(): LatLngBounds? {
    if (isEmpty()) return null

    val builder = LatLngBounds.Builder()
    forEach { latLng ->
        builder.include(latLng)
    }
    return builder.build()
}

/**
 * Obtener LatLngBounds de un lote
 */
fun Lote.getLatLngBounds(): LatLngBounds? {
    return coordenadas?.toLatLngBounds()
}

/**
 * Obtener LatLngBounds de un LoteUIModel
 */
fun LoteUIModel.getLatLngBounds(): LatLngBounds? {
    return toDomain().getLatLngBounds()
}

/**
 * Obtener LatLngBounds de lista de lotes
 */
fun List<Lote>.getAllBounds(): LatLngBounds? {
    val allCoords = flatMap { it.coordenadas ?: emptyList() }
    return allCoords.toLatLngBounds()
}

/**
 * Calcular centro de un bounds
 */
fun LatLngBounds.getCenter(): LatLng {
    return LatLng(
        (northeast.latitude + southwest.latitude) / 2,
        (northeast.longitude + southwest.longitude) / 2
    )
}

/**
 * Expandir bounds por un factor
 */
fun LatLngBounds.expand(factor: Double = 1.2): LatLngBounds {
    val center = getCenter()
    val latSpan = (northeast.latitude - southwest.latitude) * factor / 2
    val lngSpan = (northeast.longitude - southwest.longitude) * factor / 2

    return LatLngBounds(
        LatLng(center.latitude - latSpan, center.longitude - lngSpan),
        LatLng(center.latitude + latSpan, center.longitude + lngSpan)
    )
}

// ========================================================================
// Cámara
// ========================================================================

/**
 * Animar cámara a posición específica
 */
suspend fun CameraPositionState.animateTo(
    latLng: LatLng,
    zoom: Float = MapConfig.DEFAULT_ZOOM,
    duration: Int = MapConfig.CAMERA_ANIMATION_DURATION
) {
    animate(
        update = CameraUpdateFactory.newLatLngZoom(latLng, zoom),
        durationMs = duration
    )
}

/**
 * Animar cámara a bounds
 */
suspend fun CameraPositionState.animateToBounds(
    bounds: LatLngBounds,
    padding: Int = MapConfig.BOUNDS_PADDING,
    duration: Int = MapConfig.CAMERA_ANIMATION_DURATION
) {
    animate(
        update = CameraUpdateFactory.newLatLngBounds(bounds, padding),
        durationMs = duration
    )
}

/**
 * Animar cámara a lote
 */
suspend fun CameraPositionState.animateToLote(
    lote: Lote,
    padding: Int = MapConfig.BOUNDS_PADDING
) {
    val bounds = lote.getLatLngBounds()
    if (bounds != null) {
        animateToBounds(bounds, padding)
    } else {
        // Si no tiene coordenadas, usar centro campo o posición por defecto
        lote.centroCampo?.let { centro ->
            animateTo(centro.toLatLng(), MapConfig.LOTE_DETAIL_ZOOM)
        }
    }
}

/**
 * Animar cámara a lista de lotes
 */
suspend fun CameraPositionState.animateToLotes(
    lotes: List<Lote>,
    padding: Int = MapConfig.BOUNDS_PADDING
) {
    val bounds = lotes.getAllBounds()
    if (bounds != null) {
        animateToBounds(bounds, padding)
    }
}

/**
 * Zoom in
 */
suspend fun CameraPositionState.zoomIn() {
    val newZoom = (position.zoom + 1f).coerceAtMost(MapConfig.MAX_ZOOM)
    animate(
        update = CameraUpdateFactory.zoomTo(newZoom),
        durationMs = MapConfig.ZOOM_ANIMATION_DURATION
    )
}

/**
 * Zoom out
 */
suspend fun CameraPositionState.zoomOut() {
    val newZoom = (position.zoom - 1f).coerceAtLeast(MapConfig.MIN_ZOOM)
    animate(
        update = CameraUpdateFactory.zoomTo(newZoom),
        durationMs = MapConfig.ZOOM_ANIMATION_DURATION
    )
}

// ========================================================================
// Distancias y Geometría
// ========================================================================

/**
 * Calcular distancia entre dos LatLng (Haversine)
 */
fun LatLng.distanceTo(other: LatLng): Double {
    return this.toCoordenada().distanceTo(other.toCoordenada())
}

/**
 * Calcular área de polígono en metros cuadrados
 */
fun List<LatLng>.calculateArea(): Double {
    if (size < 3) return 0.0

    val earthRadius = 6371000.0 // metros
    var area = 0.0

    for (i in indices) {
        val p1 = this[i]
        val p2 = this[(i + 1) % size]

        area += Math.toRadians(p2.longitude - p1.longitude) *
                (2 + sin(Math.toRadians(p1.latitude)) +
                        sin(Math.toRadians(p2.latitude)))
    }

    area = abs(area * earthRadius * earthRadius / 2.0)
    return area
}

/**
 * Calcular área en hectáreas
 */
fun List<LatLng>.calculateAreaInHectares(): Double {
    return calculateArea() / 10000.0
}

/**
 * Calcular perímetro en metros
 */
fun List<LatLng>.calculatePerimeter(): Double {
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
 * Calcular centro geométrico
 */
fun List<LatLng>.calculateCenter(): LatLng? {
    if (isEmpty()) return null

    val latAvg = map { it.latitude }.average()
    val lngAvg = map { it.longitude }.average()

    return LatLng(latAvg, lngAvg)
}

/**
 * Verificar si un punto está dentro del polígono (Ray casting algorithm)
 */
fun List<LatLng>.contains(point: LatLng): Boolean {
    if (size < 3) return false

    var inside = false
    var j = size - 1

    for (i in indices) {
        val xi = this[i].longitude
        val yi = this[i].latitude
        val xj = this[j].longitude
        val yj = this[j].latitude

        val intersect = ((yi > point.latitude) != (yj > point.latitude)) &&
                (point.longitude < (xj - xi) * (point.latitude - yi) / (yj - yi) + xi)

        if (intersect) inside = !inside
        j = i
    }

    return inside
}

// ========================================================================
// Simplificación de Polígonos (Douglas-Peucker)
// ========================================================================

/**
 * Simplificar polígono usando algoritmo Douglas-Peucker
 */
fun List<LatLng>.simplify(tolerance: Double = MapConfig.SIMPLIFICATION_TOLERANCE): List<LatLng> {
    if (size < 3) return this

    return douglasPeucker(this, tolerance)
}

private fun douglasPeucker(points: List<LatLng>, tolerance: Double): List<LatLng> {
    if (points.size < 3) return points

    // Encontrar punto con mayor distancia perpendicular
    var maxDistance = 0.0
    var maxIndex = 0

    val start = points.first()
    val end = points.last()

    for (i in 1 until points.size - 1) {
        val distance = perpendicularDistance(points[i], start, end)
        if (distance > maxDistance) {
            maxDistance = distance
            maxIndex = i
        }
    }

    // Si la distancia máxima es mayor que tolerancia, dividir recursivamente
    return if (maxDistance > tolerance) {
        val left = douglasPeucker(points.subList(0, maxIndex + 1), tolerance)
        val right = douglasPeucker(points.subList(maxIndex, points.size), tolerance)
        left.dropLast(1) + right
    } else {
        listOf(start, end)
    }
}

private fun perpendicularDistance(point: LatLng, lineStart: LatLng, lineEnd: LatLng): Double {
    val x = point.longitude
    val y = point.latitude
    val x1 = lineStart.longitude
    val y1 = lineStart.latitude
    val x2 = lineEnd.longitude
    val y2 = lineEnd.latitude

    val A = x - x1
    val B = y - y1
    val C = x2 - x1
    val D = y2 - y1

    val dot = A * C + B * D
    val lenSq = C * C + D * D

    val param = if (lenSq != 0.0) dot / lenSq else -1.0

    val xx: Double
    val yy: Double

    when {
        param < 0 -> {
            xx = x1
            yy = y1
        }
        param > 1 -> {
            xx = x2
            yy = y2
        }
        else -> {
            xx = x1 + param * C
            yy = y1 + param * D
        }
    }

    val dx = x - xx
    val dy = y - yy

    return sqrt(dx * dx + dy * dy)
}

// ========================================================================
// Colores para Polígonos
// ========================================================================

/**
 * Obtener color del polígono según estado del lote
 */
fun LoteEstado.getPolygonColor(): Color {
    return when (this) {
        LoteEstado.ACTIVO -> MapConfig.PolygonColors.ACTIVO
        LoteEstado.EN_COSECHA -> MapConfig.PolygonColors.EN_COSECHA
        LoteEstado.COSECHADO -> MapConfig.PolygonColors.COSECHADO
        LoteEstado.EN_PREPARACION -> MapConfig.PolygonColors.EN_PREPARACION
        LoteEstado.INACTIVO -> MapConfig.PolygonColors.INACTIVO
    }
}

/**
 * Obtener color Int para Google Maps
 */
fun Color.toGoogleMapsColor(): Int {
    return this.toArgb()
}

/**
 * Crear color con alpha específico
 */
fun Color.withAlpha(alpha: Float): Color {
    return this.copy(alpha = alpha)
}

// ========================================================================
// Formateo
// ========================================================================

/**
 * Formatear LatLng para display
 */
fun LatLng.toDisplayString(): String {
    val latDirection = if (latitude >= 0) "N" else "S"
    val lngDirection = if (longitude >= 0) "E" else "W"
    return "${abs(latitude).format(4)}°$latDirection, ${abs(longitude).format(4)}°$lngDirection"
}

/**
 * Formatear compacto
 */
fun LatLng.toCompactString(): String {
    return "${latitude.format(4)}, ${longitude.format(4)}"
}

/**
 * Formatear distancia
 */
fun Double.formatDistance(): String {
    return when {
        this < 1000 -> "${this.format(1)} m"
        else -> "${(this / 1000).format(2)} km"
    }
}

/**
 * Formatear área
 */
fun Double.formatArea(): String {
    return when {
        this < 10000 -> "${this.format(1)} m²"
        else -> "${(this / 10000).format(2)} ha"
    }
}

private fun Double.format(decimals: Int): String {
    return "%.${decimals}f".format(this)
}

// ========================================================================
// Validaciones
// ========================================================================

/**
 * Verificar si coordenadas forman polígono válido
 */
fun List<LatLng>.isValidPolygon(): Boolean {
    if (size < 3) return false

    // Verificar que el área no sea cero (puntos colineales)
    val area = calculateArea()
    return area > 0.1 // Al menos 0.1 m²
}

/**
 * Verificar si coordenadas están dentro de México
 * (bbox aproximado para validación)
 */
fun LatLng.isInMexico(): Boolean {
    return latitude in 14.5..32.7 && longitude in -118.4..-86.7
}

/**
 * Verificar si coordenadas son válidas
 */
fun LatLng.isValid(): Boolean {
    return latitude in -90.0..90.0 && longitude in -180.0..180.0
}

// ========================================================================
// Interpolación
// ========================================================================

/**
 * Interpolar entre dos LatLng
 */
fun LatLng.interpolate(other: LatLng, fraction: Float): LatLng {
    val lat = latitude + (other.latitude - latitude) * fraction
    val lng = longitude + (other.longitude - longitude) * fraction
    return LatLng(lat, lng)
}

/**
 * Obtener punto intermedio
 */
fun LatLng.midpoint(other: LatLng): LatLng {
    return interpolate(other, 0.5f)
}

// ========================================================================
// Búsqueda Espacial
// ========================================================================

/**
 * Encontrar lotes cercanos a una posición
 */
fun List<Lote>.findNearby(
    position: LatLng,
    radiusMeters: Double = MapConfig.SEARCH_RADIUS_METERS
): List<Lote> {
    return filter { lote ->
        val centro = lote.centroCampo ?: return@filter false
        val distance = position.distanceTo(centro.toLatLng())
        distance <= radiusMeters
    }.sortedBy { lote ->
        val centro = lote.centroCampo ?: return@sortedBy Double.MAX_VALUE
        position.distanceTo(centro.toLatLng())
    }
}

/**
 * Encontrar lote que contiene el punto
 */
fun List<Lote>.findContaining(point: LatLng): Lote? {
    return firstOrNull { lote ->
        val coords = lote.coordenadas?.toLatLngList() ?: return@firstOrNull false
        coords.contains(point)
    }
}

// ========================================================================
// Clustering Helpers
// ========================================================================

/**
 * Agrupar lotes cercanos para clustering
 */
fun List<Lote>.groupByProximity(
    distanceThreshold: Double = 1000.0 // 1 km
): List<List<Lote>> {
    if (isEmpty()) return emptyList()

    val clusters = mutableListOf<MutableList<Lote>>()
    val remaining = toMutableList()

    while (remaining.isNotEmpty()) {
        val current = remaining.removeAt(0)
        val cluster = mutableListOf(current)

        val currentCenter = current.centroCampo?.toLatLng()
        if (currentCenter != null) {
            remaining.removeAll { lote ->
                val center = lote.centroCampo?.toLatLng()
                if (center != null && currentCenter.distanceTo(center) <= distanceThreshold) {
                    cluster.add(lote)
                    true
                } else {
                    false
                }
            }
        }

        clusters.add(cluster)
    }

    return clusters
}

// ========================================================================
// Zoom Level Helpers
// ========================================================================

/**
 * Calcular zoom apropiado para mostrar cierta distancia
 */
fun calculateZoomLevel(distanceMeters: Double): Float {
    // Aproximación: zoom level basado en distancia
    val zoom = ln(40075016.686 / distanceMeters) / ln(2.0)
    return zoom.toFloat().coerceIn(MapConfig.MIN_ZOOM, MapConfig.MAX_ZOOM)
}

/**
 * Calcular zoom para área específica
 */
fun calculateZoomForArea(areaHectares: Double): Float {
    // Aproximación logarítmica
    val zoom = 20f - (ln(areaHectares) / ln(2.0)).toFloat()
    return zoom.coerceIn(MapConfig.MIN_ZOOM, MapConfig.MAX_ZOOM)
}

// ========================================================================
// Bearing
// ========================================================================

/**
 * Calcular bearing (rumbo) entre dos puntos
 */
fun LatLng.bearingTo(other: LatLng): Double {
    val lat1Rad = Math.toRadians(latitude)
    val lat2Rad = Math.toRadians(other.latitude)
    val deltaLon = Math.toRadians(other.longitude - longitude)

    val y = sin(deltaLon) * cos(lat2Rad)
    val x = cos(lat1Rad) * sin(lat2Rad) -
            sin(lat1Rad) * cos(lat2Rad) * cos(deltaLon)

    val bearing = Math.toDegrees(atan2(y, x))
    return (bearing + 360) % 360
}

/**
 * Obtener dirección cardinal desde bearing
 */
fun Double.toCardinalDirection(): String {
    return when {
        this >= BEARING_NORTH_MIN || this < BEARING_NORTH_MAX -> "N"
        this >= BEARING_NE_MIN && this < BEARING_NE_MAX -> "NE"
        this >= BEARING_E_MIN && this < BEARING_E_MAX -> "E"
        this >= BEARING_SE_MIN && this < BEARING_SE_MAX -> "SE"
        this >= BEARING_S_MIN && this < BEARING_S_MAX -> "S"
        this >= BEARING_SW_MIN && this < BEARING_SW_MAX -> "SW"
        this >= BEARING_W_MIN && this < BEARING_W_MAX -> "W"
        else -> "NW"
    }
}
