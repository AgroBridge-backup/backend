package com.agrobridge.presentation.map

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.agrobridge.data.extensions.*
import com.agrobridge.data.model.Lote
import com.agrobridge.data.model.LoteEstado
import com.agrobridge.data.repository.LoteRepository
import com.agrobridge.data.sync.SyncManager
import com.agrobridge.presentation.model.LoteUIModel
import com.agrobridge.presentation.model.UIState
import com.agrobridge.util.ErrorHandler
import com.agrobridge.util.PermissionManager
import com.google.android.gms.maps.model.LatLng
import com.google.maps.android.compose.MapType
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.launch
import timber.log.Timber
import javax.inject.Inject

/**
 * ViewModel para MapScreen
 * Maneja el estado del mapa, lotes, filtros, y modos de interacción
 * Integra PermissionManager (para ubicación) y SyncManager (para sincronización en tiempo real)
 * Inyectado con Hilt para acceso a repositorio y servicios
 *
 * INTEGRACIÓN:
 * ✅ PermissionManager: Solicita ACCESS_FINE_LOCATION
 * ✅ SyncManager: Mantiene datos sincronizados en background
 * ✅ ErrorHandler: UX consistente en errores
 */
@HiltViewModel
class MapViewModel @Inject constructor(
    private val loteRepository: LoteRepository,
    private val permissionManager: PermissionManager,
    private val syncManager: SyncManager,
    private val errorHandler: ErrorHandler
) : ViewModel() {

    // ========================================================================
    // CONSTANTS - Geometry and Measurement
    // ========================================================================
    companion object {
        // FIXED: LOW-038 - Extract hardcoded polygon point counts to constants
        private const val MIN_SINGLE_POINT = 1           // Distance measurement requires at least 1 point
        private const val MIN_POLYGON_POINTS = 3         // Area and perimeter require at least 3 points
    }

    // ========================================================================
    // Estado de Lotes
    // ========================================================================

    private val _lotesState = MutableStateFlow<UIState<List<LoteUIModel>>>(UIState.Idle)
    val lotesState = _lotesState.asStateFlow()

    private val _allLotes = MutableStateFlow<List<Lote>>(emptyList())

    private val _lastSyncTimestamp = MutableStateFlow<Long?>(null)
    val lastSyncTimestamp = _lastSyncTimestamp.asStateFlow()

    /**
     * Lotes filtrados según criterios actuales
     */
    val filteredLotes: StateFlow<List<LoteUIModel>> = combine(
        _allLotes,
        _filterConfig
    ) { lotes, filter ->
        applyFilters(lotes, filter).map { LoteUIModel.from(it) }
    }.stateIn(viewModelScope, SharingStarted.Lazily, emptyList())

    // ========================================================================
    // Estado de Selección
    // ========================================================================

    private val _selectedLote = MutableStateFlow<LoteUIModel?>(null)
    val selectedLote = _selectedLote.asStateFlow()

    private val _selectedLotes = MutableStateFlow<Set<String>>(emptySet())
    val selectedLotes = _selectedLotes.asStateFlow()

    // ========================================================================
    // Configuración del Mapa
    // ========================================================================

    private val _viewConfig = MutableStateFlow(MapViewConfig())
    val viewConfig = _viewConfig.asStateFlow()

    private val _filterConfig = MutableStateFlow(MapFilterConfig())
    val filterConfig = _filterConfig.asStateFlow()

    private val _currentMapType = MutableStateFlow(MapConfig.DEFAULT_LAYER.mapType)
    val currentMapType = _currentMapType.asStateFlow()

    // ========================================================================
    // INTEGRACIÓN: PermissionManager (Location Permissions)
    // ========================================================================

    sealed class PermissionState {
        data object NotAsked : PermissionState()
        data object Granted : PermissionState()
        data object Denied : PermissionState()
        data class RationaleNeeded(val message: String) : PermissionState()
    }

    private val _permissionState = MutableStateFlow<PermissionState>(PermissionState.NotAsked)
    val permissionState: StateFlow<PermissionState> = _permissionState.asStateFlow()

    // ========================================================================
    // INTEGRACIÓN: SyncManager (Real-time Sync)
    // ========================================================================

    sealed class SyncUiState {
        data object Idle : SyncUiState()
        data class Syncing(val progress: Int) : SyncUiState()
        data class Success(val itemsSynced: Int) : SyncUiState()
        data class Error(val message: String, val canRetry: Boolean) : SyncUiState()
    }

    private val _syncState = MutableStateFlow<SyncUiState>(SyncUiState.Idle)
    val syncState: StateFlow<SyncUiState> = _syncState.asStateFlow()

    // ========================================================================
    // Modo del Mapa
    // ========================================================================

    private val _mapMode = MutableStateFlow(MapMode.VIEW)
    val mapMode = _mapMode.asStateFlow()

    // ========================================================================
    // Estado de Dibujo
    // ========================================================================

    private val _drawingPoints = MutableStateFlow<List<LatLng>>(emptyList())
    val drawingPoints = _drawingPoints.asStateFlow()

    val canCompleteDrawing: StateFlow<Boolean> = _drawingPoints.map { points ->
        points.size >= MapConfig.MIN_VERTICES_FOR_POLYGON
    }.stateIn(viewModelScope, SharingStarted.Lazily, false)

    // ========================================================================
    // Estado de Medición
    // ========================================================================

    private val _measurementPoints = MutableStateFlow<List<LatLng>>(emptyList())
    val measurementPoints = _measurementPoints.asStateFlow()

    val measurementResult: StateFlow<MeasurementResult?> = _measurementPoints.map { points ->
        if (points.isEmpty()) return@map null

        val distance = if (points.size == MIN_SINGLE_POINT) {
            0.0
        } else {
            points.zipWithNext().sumOf { (p1, p2) -> p1.distanceTo(p2) }
        }

        val area = if (points.size >= MIN_POLYGON_POINTS) {
            points.calculateArea()
        } else null

        val perimeter = if (points.size >= MIN_POLYGON_POINTS) {
            points.calculatePerimeter()
        } else null

        MeasurementResult(
            distance = distance,
            area = area,
            perimeter = perimeter,
            points = points
        )
    }.stateIn(viewModelScope, SharingStarted.Lazily, null)

    // ========================================================================
    // Búsqueda
    // ========================================================================

    private val _searchQuery = MutableStateFlow("")
    val searchQuery = _searchQuery.asStateFlow()

    val searchResults: StateFlow<List<LoteUIModel>> = combine(
        _searchQuery,
        filteredLotes
    ) { query, lotes ->
        if (query.isBlank()) {
            emptyList()
        } else {
            lotes.filter { lote ->
                lote.nombre.contains(query, ignoreCase = true) ||
                        lote.cultivo.contains(query, ignoreCase = true) ||
                        lote.productorNombre.contains(query, ignoreCase = true)
            }.take(MapConfig.MAX_SEARCH_RESULTS)
        }
    }.stateIn(viewModelScope, SharingStarted.Lazily, emptyList())

    // ========================================================================
    // UI States
    // ========================================================================

    private val _showLegend = MutableStateFlow(false)
    val showLegend = _showLegend.asStateFlow()

    private val _cameraPosition = MutableStateFlow<LatLng?>(null)
    val cameraPosition = _cameraPosition.asStateFlow()

    // ========================================================================
    // Estadísticas
    // ========================================================================

    val statistics: StateFlow<LoteStatistics?> = _allLotes.map { lotes ->
        if (lotes.isEmpty()) null else lotes.getStatistics()
    }.stateIn(viewModelScope, SharingStarted.Lazily, null)

    // ========================================================================
    // Inicialización
    // ========================================================================

    init {
        loadLotes()
    }

    // ========================================================================
    // Cargar Lotes (Offline-First Architecture)
    // ========================================================================

    fun loadLotes(productorId: String = "default-productor") {
        viewModelScope.launch {
            Timber.d("🔄 Iniciando carga de lotes para productor: $productorId")

            // PASO 1: Mostrar datos cacheados inmediatamente (desde Room)
            try {
                loteRepository.getLotes(productorId)
                    .collect { lotes ->
                        Timber.d("📱 Datos locales disponibles: ${lotes.size} lotes desde Room")
                        _allLotes.value = lotes
                        _lotesState.value = if (lotes.isEmpty()) {
                            UIState.Empty("No hay lotes disponibles")
                        } else {
                            UIState.Success(lotes.map { LoteUIModel.from(it) })
                        }
                    }
            } catch (e: Exception) {
                Timber.e(e, "❌ Error observando datos locales")
                _lotesState.value = UIState.Error(
                    e,
                    "Error al cargar lotes: ${e.message}"
                )
            }

            // PASO 2: Sincronizar con API en background (no bloquea UI)
            Timber.d("🌐 Sincronizando con API en background...")
            loteRepository.refreshLotes(productorId)
                .onSuccess {
                    Timber.d("✅ Sincronización exitosa desde API")
                    // Actualizar timestamp (Flow de getLotes se actualiza automáticamente)
                    _lastSyncTimestamp.value = loteRepository.getLastSyncTimestamp()
                }
                .onFailure { exception ->
                    Timber.w(exception, "⚠️ Error en sincronización, usando datos locales")
                    // La UI sigue mostrando los datos cacheados de Room
                }
        }
    }

    fun retry() {
        loadLotes()
    }

    // ========================================================================
    // INTEGRACIÓN: PermissionManager - Solicitar Ubicación
    // ========================================================================

    /**
     * Solicita permiso de ubicación
     *
     * FLUJO:
     * 1. Verificar si ya está otorgado
     * 2. Si no, mostrar rationale
     * 3. En activity, ejecutar request
     * 4. Actualizar estado cuando se recibe respuesta
     */
    fun requestLocationPermission() {
        val permission = PermissionManager.Permission.LOCATION_FINE

        when {
            permissionManager.isPermissionGranted(permission) -> {
                _permissionState.value = PermissionState.Granted
                onLocationPermissionGranted()
                Timber.d("Location permission already granted")
            }
            permissionManager.isDeniedPermanently(permission) -> {
                _permissionState.value = PermissionState.Denied
                Timber.d("Location permission denied permanently")
            }
            else -> {
                val rationale = permissionManager.getRationale(permission)
                _permissionState.value = PermissionState.RationaleNeeded(rationale)
                Timber.d("Location permission rationale shown: $rationale")
            }
        }
    }

    /**
     * Callback cuando permiso de ubicación es otorgado
     */
    fun onLocationPermissionGranted() {
        _permissionState.value = PermissionState.Granted
        Timber.d("✅ Location permission granted - enabling real-time location")
        // TODO: Iniciar LocationManager o FusedLocationProvider
    }

    /**
     * Callback cuando permiso de ubicación es denegado
     */
    fun onLocationPermissionDenied() {
        _permissionState.value = PermissionState.Denied
        Timber.d("❌ Location permission denied")
    }

    // ========================================================================
    // INTEGRACIÓN: SyncManager - Sincronización Real-time
    // ========================================================================

    /**
     * Sincroniza todos los lotes con el servidor
     *
     * FLUJO:
     * 1. Mostrar Loading con progreso
     * 2. Llamar a SyncManager.syncAll()
     * 3. Actualizar UI con progreso en tiempo real
     * 4. Mostrar Success o Error con opción de retry
     */
    fun syncAllLotes(productorId: String = "default-productor") {
        viewModelScope.launch {
            try {
                Timber.d("🔄 Iniciando sincronización bidireccional...")
                syncManager.syncAll(productorId)
                    .collect { syncState ->
                        _syncState.value = when (syncState) {
                            SyncManager.SyncState.Idle -> {
                                Timber.d("Sync: Idle")
                                SyncUiState.Idle
                            }
                            is SyncManager.SyncState.Syncing -> {
                                Timber.d("Sync: ${syncState.progress}%")
                                SyncUiState.Syncing(syncState.progress)
                            }
                            is SyncManager.SyncState.Success -> {
                                Timber.d("✅ Sync: ${syncState.itemsSynced} items sincronizados")
                                SyncUiState.Success(syncState.itemsSynced)
                            }
                            is SyncManager.SyncState.Error -> {
                                Timber.e("❌ Sync error: ${syncState.message}")
                                SyncUiState.Error(syncState.message, canRetry = true)
                            }
                        }
                    }
            } catch (e: Exception) {
                val message = errorHandler.handle(e, "syncAllLotes")
                _syncState.value = SyncUiState.Error(message, canRetry = true)
            }
        }
    }

    /**
     * Reintenta sincronización después de error
     */
    fun retrySyncLotes(productorId: String = "default-productor") {
        if (_syncState.value is SyncUiState.Error) {
            syncAllLotes(productorId)
        }
    }

    /**
     * Limpia estado de sincronización
     */
    fun clearSyncState() {
        _syncState.value = SyncUiState.Idle
    }

    // ========================================================================
    // Selección
    // ========================================================================

    fun selectLote(lote: LoteUIModel?) {
        _selectedLote.value = lote
    }

    fun toggleLoteSelection(loteId: String) {
        _selectedLotes.update { current ->
            if (current.contains(loteId)) {
                current - loteId
            } else {
                current + loteId
            }
        }
    }

    fun clearSelection() {
        _selectedLote.value = null
        _selectedLotes.value = emptySet()
    }

    // ========================================================================
    // Configuración de Vista
    // ========================================================================

    fun setMapType(mapType: MapType) {
        _currentMapType.value = mapType
        _viewConfig.update { it.copy(mapType = mapType) }
    }

    fun setMapLayer(layer: MapConfig.MapLayer) {
        setMapType(layer.mapType)
    }

    fun toggleMyLocation() {
        _viewConfig.update { it.copy(showMyLocation = !it.showMyLocation) }
    }

    fun toggleTraffic() {
        _viewConfig.update { it.copy(showTraffic = !it.showTraffic) }
    }

    fun toggleBuildings() {
        _viewConfig.update { it.copy(showBuildings = !it.showBuildings) }
    }

    // ========================================================================
    // Filtros
    // ========================================================================

    fun setFilter(config: MapFilterConfig) {
        _filterConfig.value = config
    }

    fun toggleActiveOnly() {
        _filterConfig.update { it.copy(showActiveOnly = !it.showActiveOnly) }
    }

    fun toggleGPSOnly() {
        _filterConfig.update { it.copy(showWithGPSOnly = !it.showWithGPSOnly) }
    }

    fun filterByCultivo(cultivo: String?) {
        _filterConfig.update {
            if (cultivo == null) {
                it.copy(selectedCultivos = emptySet())
            } else {
                val newCultivos = if (it.selectedCultivos.contains(cultivo)) {
                    it.selectedCultivos - cultivo
                } else {
                    it.selectedCultivos + cultivo
                }
                it.copy(selectedCultivos = newCultivos)
            }
        }
    }

    fun filterByEstado(estado: LoteEstado?) {
        _filterConfig.update {
            if (estado == null) {
                it.copy(selectedEstados = emptySet())
            } else {
                val newEstados = if (it.selectedEstados.contains(estado)) {
                    it.selectedEstados - estado
                } else {
                    it.selectedEstados + estado
                }
                it.copy(selectedEstados = newEstados)
            }
        }
    }

    fun clearFilters() {
        _filterConfig.value = MapFilterConfig()
    }

    private fun applyFilters(lotes: List<Lote>, filter: MapFilterConfig): List<Lote> {
        var filtered = lotes

        // Filtrar solo activos
        if (filter.showActiveOnly) {
            filtered = filtered.filterActivos()
        }

        // Filtrar solo con GPS
        if (filter.showWithGPSOnly) {
            filtered = filtered.filterWithGPS()
        }

        // Filtrar por cultivos seleccionados
        if (filter.selectedCultivos.isNotEmpty()) {
            filtered = filtered.filter { lote ->
                filter.selectedCultivos.contains(lote.cultivo)
            }
        }

        // Filtrar por estados seleccionados
        if (filter.selectedEstados.isNotEmpty()) {
            filtered = filtered.filter { lote ->
                filter.selectedEstados.contains(lote.estado)
            }
        }

        // Filtrar por área
        filter.minArea?.let { minArea ->
            filtered = filtered.filter { it.area >= minArea }
        }

        filter.maxArea?.let { maxArea ->
            filtered = filtered.filter { it.area <= maxArea }
        }

        return filtered
    }

    // ========================================================================
    // Modo del Mapa
    // ========================================================================

    fun setMapMode(mode: MapMode) {
        // Limpiar estados al cambiar de modo
        when (_mapMode.value) {
            MapMode.DRAWING -> clearDrawing()
            MapMode.MEASURING -> clearMeasurement()
            MapMode.SELECTING -> clearSelection()
            else -> {}
        }

        _mapMode.value = mode
        _viewConfig.update { it.copy(mode = mode) }
    }

    fun enterDrawingMode() {
        setMapMode(MapMode.DRAWING)
    }

    fun enterMeasuringMode() {
        setMapMode(MapMode.MEASURING)
    }

    fun enterSelectingMode() {
        setMapMode(MapMode.SELECTING)
    }

    fun exitSpecialMode() {
        setMapMode(MapMode.VIEW)
    }

    // ========================================================================
    // Modo Dibujo
    // ========================================================================

    fun addDrawingPoint(point: LatLng) {
        _drawingPoints.update { current ->
            // Verificar distancia mínima al último punto
            if (current.isNotEmpty()) {
                val lastPoint = current.last()
                val distance = lastPoint.distanceTo(point)
                if (distance < MapConfig.MIN_VERTEX_DISTANCE) {
                    return@update current // Demasiado cerca del último punto
                }
            }

            current + point
        }
    }

    fun undoDrawingPoint() {
        _drawingPoints.update { current ->
            if (current.isEmpty()) current else current.dropLast(1)
        }
    }

    fun completeDrawing(): List<LatLng>? {
        val points = _drawingPoints.value
        return if (points.size >= MapConfig.MIN_VERTICES_FOR_POLYGON) {
            val result = points.toList()
            clearDrawing()
            exitSpecialMode()
            result
        } else {
            null
        }
    }

    fun clearDrawing() {
        _drawingPoints.value = emptyList()
    }

    fun cancelDrawing() {
        clearDrawing()
        exitSpecialMode()
    }

    // ========================================================================
    // Modo Medición
    // ========================================================================

    fun addMeasurementPoint(point: LatLng) {
        _measurementPoints.update { it + point }
    }

    fun undoMeasurementPoint() {
        _measurementPoints.update { current ->
            if (current.isEmpty()) current else current.dropLast(1)
        }
    }

    fun clearMeasurement() {
        _measurementPoints.value = emptyList()
    }

    fun cancelMeasurement() {
        clearMeasurement()
        exitSpecialMode()
    }

    // ========================================================================
    // Búsqueda
    // ========================================================================

    fun setSearchQuery(query: String) {
        _searchQuery.value = query
    }

    fun clearSearch() {
        _searchQuery.value = ""
    }

    // ========================================================================
    // UI Controls
    // ========================================================================

    fun toggleLegend() {
        _showLegend.update { !it }
    }

    fun showLegend() {
        _showLegend.value = true
    }

    fun hideLegend() {
        _showLegend.value = false
    }

    // ========================================================================
    // Cámara
    // ========================================================================

    fun setCameraPosition(position: LatLng) {
        _cameraPosition.value = position
    }

    fun centerOnLote(lote: LoteUIModel) {
        val centro = lote.toDomain().centroCampo
        if (centro != null) {
            _cameraPosition.value = centro.toLatLng()
        }
    }

    fun centerOnAllLotes() {
        val lotes = _allLotes.value
        if (lotes.isNotEmpty()) {
            val bounds = lotes.getAllBounds()
            bounds?.let {
                _cameraPosition.value = it.getCenter()
            }
        }
    }

    // ========================================================================
    // Búsqueda Espacial
    // ========================================================================

    fun findLotesNearby(position: LatLng, radiusMeters: Double = MapConfig.SEARCH_RADIUS_METERS): List<LoteUIModel> {
        return _allLotes.value
            .findNearby(position, radiusMeters)
            .map { LoteUIModel.from(it) }
    }

    fun findLoteContaining(point: LatLng): LoteUIModel? {
        val lote = _allLotes.value.findContaining(point)
        return lote?.let { LoteUIModel.from(it) }
    }

    // ========================================================================
    // Clustering
    // ========================================================================

    fun shouldEnableClustering(): Boolean {
        val loteCount = _allLotes.value.size
        return MapConfig.ENABLE_CLUSTERING && loteCount >= MapConfig.MIN_ITEMS_FOR_CLUSTERING
    }

    fun getLoteClusters(): List<List<LoteUIModel>> {
        return _allLotes.value
            .groupByProximity()
            .map { cluster -> cluster.map { LoteUIModel.from(it) } }
    }

    // ========================================================================
    // Cultivos Disponibles
    // ========================================================================

    val availableCultivos: StateFlow<List<String>> = _allLotes.map { lotes ->
        lotes.map { it.cultivo }.distinct().sorted()
    }.stateIn(viewModelScope, SharingStarted.Lazily, emptyList())

    // ========================================================================
    // Área Total Visible
    // ========================================================================

    val totalVisibleArea: StateFlow<Double> = filteredLotes.map { lotes ->
        lotes.sumOf { it.toDomain().area }
    }.stateIn(viewModelScope, SharingStarted.Lazily, 0.0)

    // ========================================================================
    // Performance
    // ========================================================================

    /**
     * Simplificar polígonos para mejor performance
     */
    fun shouldSimplifyPolygons(): Boolean {
        val totalPoints = _allLotes.value.sumOf { lote ->
            lote.coordenadas?.size ?: 0
        }
        return totalPoints > MapConfig.SIMPLIFY_POLYGON_THRESHOLD
    }

    // ========================================================================
    // Timestamp Formatting (Offline-First)
    // ========================================================================

    /**
     * Obtener texto formateado del último sync para mostrar en UI
     * Ejemplo: "Última actualización: hace 5 minutos"
     */
    val lastSyncText: StateFlow<String> = _lastSyncTimestamp.map { timestamp ->
        if (timestamp == null) {
            "No sincronizado"
        } else {
            val minutesAgo = (System.currentTimeMillis() - timestamp) / 60000
            when {
                minutesAgo < 1 -> "Hace unos segundos"
                minutesAgo == 1L -> "Hace 1 minuto"
                minutesAgo < 60 -> "Hace $minutesAgo minutos"
                minutesAgo < 120 -> "Hace 1 hora"
                else -> "Hace ${minutesAgo / 60} horas"
            }
        }
    }.stateIn(viewModelScope, SharingStarted.Lazily, "No sincronizado")
}
