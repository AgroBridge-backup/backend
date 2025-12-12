package com.agrobridge.presentation.map

import androidx.compose.ui.graphics.Color
import com.agrobridge.presentation.theme.*
import com.google.android.gms.maps.model.LatLng
import com.google.maps.android.compose.MapProperties
import com.google.maps.android.compose.MapType
import com.google.maps.android.compose.MapUiSettings

/**
 * Configuración centralizada para Google Maps
 * Define defaults, estilos y comportamientos del mapa
 */
object MapConfig {

    // ========================================================================
    // Configuración de Cámara
    // ========================================================================

    /**
     * Posición inicial del mapa (centro de México para AgroBridge)
     */
    val DEFAULT_CAMERA_POSITION = LatLng(23.6345, -102.5528)

    /**
     * Zoom por defecto
     */
    const val DEFAULT_ZOOM = 5f

    /**
     * Zoom para vista de lote individual
     */
    const val LOTE_DETAIL_ZOOM = 16f

    /**
     * Zoom para vista de región
     */
    const val REGION_ZOOM = 12f

    /**
     * Zoom mínimo permitido
     */
    const val MIN_ZOOM = 3f

    /**
     * Zoom máximo permitido
     */
    const val MAX_ZOOM = 20f

    // ========================================================================
    // Configuración de UI
    // ========================================================================

    /**
     * UI Settings por defecto
     */
    val defaultUiSettings = MapUiSettings(
        compassEnabled = true,
        indoorLevelPickerEnabled = false,
        mapToolbarEnabled = false,
        myLocationButtonEnabled = true,
        rotationGesturesEnabled = true,
        scrollGesturesEnabled = true,
        scrollGesturesEnabledDuringRotateOrZoom = true,
        tiltGesturesEnabled = true,
        zoomControlsEnabled = false, // Custom zoom controls
        zoomGesturesEnabled = true
    )

    /**
     * Properties por defecto
     */
    val defaultProperties = MapProperties(
        mapType = MapType.HYBRID, // Satellite + labels para agricultura
        isMyLocationEnabled = false, // Se maneja por permisos
        isBuildingEnabled = false,
        isIndoorEnabled = false,
        isTrafficEnabled = false,
        minZoomPreference = MIN_ZOOM,
        maxZoomPreference = MAX_ZOOM
    )

    // ========================================================================
    // Estilos de Polígonos
    // ========================================================================

    /**
     * Ancho de borde de polígono
     */
    const val POLYGON_STROKE_WIDTH = 4f

    /**
     * Ancho de borde cuando está seleccionado
     */
    const val POLYGON_STROKE_WIDTH_SELECTED = 6f

    /**
     * Opacidad del relleno del polígono
     */
    const val POLYGON_FILL_ALPHA = 0.35f

    /**
     * Opacidad del relleno cuando está seleccionado
     */
    const val POLYGON_FILL_ALPHA_SELECTED = 0.50f

    /**
     * Colores de polígonos por estado
     */
    object PolygonColors {
        val ACTIVO = Color(0xFF4CAF50)          // Verde
        val EN_COSECHA = Color(0xFFFF6D00)      // Naranja
        val COSECHADO = Color(0xFF8D6E63)       // Marrón
        val EN_PREPARACION = Color(0xFFFFC107)  // Amarillo
        val INACTIVO = Color(0xFF9E9E9E)        // Gris
        val SELECTED = Color(0xFF2196F3)        // Azul brillante
        val DEFAULT = Color(0xFF2D5016)         // Verde oscuro
    }

    // ========================================================================
    // Markers
    // ========================================================================

    /**
     * Tamaño del marker personalizado
     */
    const val MARKER_SIZE = 48f

    /**
     * Escala de marker cuando está seleccionado
     */
    const val MARKER_SCALE_SELECTED = 1.3f

    /**
     * Z-Index de markers
     */
    const val MARKER_Z_INDEX = 10f

    /**
     * Z-Index de marker seleccionado
     */
    const val MARKER_Z_INDEX_SELECTED = 100f

    // ========================================================================
    // Clustering
    // ========================================================================

    /**
     * Habilitar clustering cuando hay muchos lotes
     */
    const val ENABLE_CLUSTERING = true

    /**
     * Número mínimo de items para activar clustering
     */
    const val MIN_ITEMS_FOR_CLUSTERING = 10

    /**
     * Radio del cluster en pixels
     */
    const val CLUSTER_RADIUS = 100

    // ========================================================================
    // Animaciones
    // ========================================================================

    /**
     * Duración de animación de cámara (ms)
     */
    const val CAMERA_ANIMATION_DURATION = 500

    /**
     * Duración de animación de zoom (ms)
     */
    const val ZOOM_ANIMATION_DURATION = 300

    /**
     * Duración de animación de marker (ms)
     */
    const val MARKER_ANIMATION_DURATION = 200

    // ========================================================================
    // Padding
    // ========================================================================

    /**
     * Padding alrededor del bounds cuando se ajusta la cámara
     */
    const val BOUNDS_PADDING = 100

    /**
     * Padding inferior cuando hay bottom sheet
     */
    const val BOTTOM_SHEET_PADDING = 350

    // ========================================================================
    // Performance
    // ========================================================================

    /**
     * Máximo número de polígonos a renderizar simultáneamente
     */
    const val MAX_POLYGONS_TO_RENDER = 500

    /**
     * Simplificar polígonos con más de N puntos
     */
    const val SIMPLIFY_POLYGON_THRESHOLD = 100

    /**
     * Factor de simplificación (Douglas-Peucker tolerance)
     */
    const val SIMPLIFICATION_TOLERANCE = 0.0001

    // ========================================================================
    // Capas del Mapa
    // ========================================================================

    /**
     * Tipos de mapa disponibles
     */
    enum class MapLayer(val displayName: String, val mapType: MapType) {
        NORMAL("Normal", MapType.NORMAL),
        SATELLITE("Satélite", MapType.SATELLITE),
        HYBRID("Híbrido", MapType.HYBRID),
        TERRAIN("Terreno", MapType.TERRAIN)
    }

    /**
     * Capa por defecto para agricultura
     */
    val DEFAULT_LAYER = MapLayer.HYBRID

    // ========================================================================
    // Info Window
    // ========================================================================

    /**
     * Ancho máximo del info window
     */
    const val INFO_WINDOW_MAX_WIDTH = 300

    /**
     * Altura del info window compacto
     */
    const val INFO_WINDOW_COMPACT_HEIGHT = 120

    /**
     * Altura del info window expandido
     */
    const val INFO_WINDOW_EXPANDED_HEIGHT = 200

    // ========================================================================
    // Gestos
    // ========================================================================

    /**
     * Distancia mínima de tap en pixels
     */
    const val TAP_THRESHOLD = 10f

    /**
     * Tiempo máximo para considerar un tap (ms)
     */
    const val TAP_TIME_THRESHOLD = 200L

    /**
     * Distancia para detectar long press
     */
    const val LONG_PRESS_THRESHOLD = 20f

    /**
     * Tiempo para long press (ms)
     */
    const val LONG_PRESS_TIME_THRESHOLD = 500L

    // ========================================================================
    // Búsqueda y Filtros
    // ========================================================================

    /**
     * Radio de búsqueda en metros
     */
    const val SEARCH_RADIUS_METERS = 5000.0

    /**
     * Máximo número de resultados de búsqueda
     */
    const val MAX_SEARCH_RESULTS = 20

    // ========================================================================
    // Ubicación
    // ========================================================================

    /**
     * Intervalo de actualización de ubicación (ms)
     */
    const val LOCATION_UPDATE_INTERVAL = 5000L

    /**
     * Intervalo más rápido de actualización (ms)
     */
    const val LOCATION_FASTEST_INTERVAL = 2000L

    /**
     * Prioridad de solicitud de ubicación
     */
    const val LOCATION_PRIORITY = com.google.android.gms.location.Priority.PRIORITY_HIGH_ACCURACY

    /**
     * Zoom cuando se centra en ubicación del usuario
     */
    const val MY_LOCATION_ZOOM = 15f

    // ========================================================================
    // Modo Dibujo
    // ========================================================================

    /**
     * Color del polígono en modo dibujo
     */
    val DRAWING_POLYGON_COLOR = Color(0xFF2196F3)

    /**
     * Ancho de línea en modo dibujo
     */
    const val DRAWING_STROKE_WIDTH = 4f

    /**
     * Radio del marker de vértice en modo dibujo
     */
    const val DRAWING_VERTEX_RADIUS = 12f

    /**
     * Color del marker de vértice
     */
    val DRAWING_VERTEX_COLOR = Color(0xFFFF5722)

    /**
     * Color del primer vértice (para cerrar polígono)
     */
    val DRAWING_FIRST_VERTEX_COLOR = Color(0xFF4CAF50)

    /**
     * Distancia mínima entre vértices en metros
     */
    const val MIN_VERTEX_DISTANCE = 5.0

    /**
     * Número mínimo de vértices para polígono válido
     */
    const val MIN_VERTICES_FOR_POLYGON = 3

    /**
     * Distancia para "snap" al primer punto (cerrar polígono) en pixels
     */
    const val SNAP_TO_FIRST_POINT_DISTANCE = 50f

    // ========================================================================
    // Modo Medición
    // ========================================================================

    /**
     * Color de línea de medición
     */
    val MEASUREMENT_LINE_COLOR = Color(0xFFFFEB3B)

    /**
     * Ancho de línea de medición
     */
    const val MEASUREMENT_STROKE_WIDTH = 3f

    /**
     * Patrón de línea punteada
     */
    val MEASUREMENT_DASH_PATTERN = listOf(20f, 10f)

    // ========================================================================
    // Offline
    // ========================================================================

    /**
     * Habilitar tiles offline
     */
    const val ENABLE_OFFLINE_TILES = true

    /**
     * Directorio de cache de tiles
     */
    const val TILE_CACHE_DIR = "map_tiles"

    /**
     * Tamaño máximo de cache en MB
     */
    const val MAX_CACHE_SIZE_MB = 100

    // ========================================================================
    // Debugging
    // ========================================================================

    /**
     * Mostrar coordenadas en tap
     */
    const val DEBUG_SHOW_COORDINATES = false

    /**
     * Mostrar bounds de polígonos
     */
    const val DEBUG_SHOW_BOUNDS = false

    /**
     * Log de eventos del mapa
     */
    const val DEBUG_LOG_EVENTS = false
}

/**
 * Estado del modo del mapa
 */
enum class MapMode {
    VIEW,           // Modo visualización normal
    DRAWING,        // Modo dibujo de polígono
    MEASURING,      // Modo medición de distancia
    SELECTING       // Modo selección múltiple
}

/**
 * Configuración de vista del mapa
 */
data class MapViewConfig(
    val showMyLocation: Boolean = false,
    val showTraffic: Boolean = false,
    val showBuildings: Boolean = false,
    val mapType: MapType = MapConfig.DEFAULT_LAYER.mapType,
    val mode: MapMode = MapMode.VIEW
)

/**
 * Configuración de filtros del mapa
 */
data class MapFilterConfig(
    val showActiveOnly: Boolean = false,
    val showWithGPSOnly: Boolean = false,
    val selectedCultivos: Set<String> = emptySet(),
    val selectedEstados: Set<com.agrobridge.data.model.LoteEstado> = emptySet(),
    val minArea: Double? = null,
    val maxArea: Double? = null
)

/**
 * Resultado de medición
 */
data class MeasurementResult(
    val distance: Double,          // metros
    val area: Double? = null,      // m² si es polígono cerrado
    val perimeter: Double? = null, // metros si es polígono
    val points: List<LatLng>
) {
    val distanceInKm: Double get() = distance / 1000.0
    val areaInHectares: Double? get() = area?.let { it / 10000.0 }
    val perimeterInKm: Double? get() = perimeter?.let { it / 1000.0 }
}
