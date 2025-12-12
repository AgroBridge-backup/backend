package com.agrobridge.presentation.map

import androidx.compose.animation.*
import androidx.compose.foundation.layout.*
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.viewmodel.compose.viewModel
import com.agrobridge.data.model.LoteEstado
import com.agrobridge.presentation.components.ErrorState
import com.agrobridge.presentation.components.LoadingState
import com.agrobridge.presentation.model.LoteUIModel
import com.agrobridge.presentation.model.UIState
import com.agrobridge.presentation.theme.Spacing
import com.google.android.gms.maps.model.CameraPosition
import com.google.android.gms.maps.model.LatLng
import com.google.maps.android.compose.*
import kotlinx.coroutines.launch

/**
 * Pantalla principal del Mapa
 * Muestra todos los lotes en Google Maps con polígonos, markers y controles
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun MapScreen(
    onLoteClick: (String) -> Unit,
    onBackClick: () -> Unit,
    modifier: Modifier = Modifier,
    viewModel: MapViewModel = hiltViewModel()  // FIXED: HIGH-7 Use hiltViewModel() for Hilt-injected ViewModels
) {
    val lotesState by viewModel.lotesState.collectAsState()
    val filteredLotes by viewModel.filteredLotes.collectAsState()
    val selectedLote by viewModel.selectedLote.collectAsState()
    val mapMode by viewModel.mapMode.collectAsState()
    val currentMapType by viewModel.currentMapType.collectAsState()
    val showLegend by viewModel.showLegend.collectAsState()
    val searchQuery by viewModel.searchQuery.collectAsState()
    val searchResults by viewModel.searchResults.collectAsState()
    val drawingPoints by viewModel.drawingPoints.collectAsState()
    val canCompleteDrawing by viewModel.canCompleteDrawing.collectAsState()
    val measurementResult by viewModel.measurementResult.collectAsState()

    Scaffold(
        topBar = {
            MapTopBar(
                title = when (mapMode) {
                    MapMode.VIEW -> "Mapa de Lotes"
                    MapMode.DRAWING -> "Dibujar Polígono"
                    MapMode.MEASURING -> "Medir Distancia"
                    MapMode.SELECTING -> "Seleccionar Lotes"
                },
                onBackClick = onBackClick,
                actions = {
                    // Leyenda
                    IconButton(onClick = { viewModel.toggleLegend() }) {
                        Icon(
                            imageVector = Icons.Default.Info,
                            contentDescription = "Leyenda"
                        )
                    }

                    // Centrar en todos los lotes
                    IconButton(onClick = { viewModel.centerOnAllLotes() }) {
                        Icon(
                            imageVector = Icons.Default.CenterFocusStrong,
                            contentDescription = "Centrar mapa"
                        )
                    }
                }
            )
        }
    ) { paddingValues ->
        Box(
            modifier = modifier
                .fillMaxSize()
                .padding(paddingValues)
        ) {
            when (lotesState) {
                UIState.Idle -> {}

                is UIState.Loading -> {
                    MapLoadingOverlay(
                        message = (lotesState as UIState.Loading).message ?: "Cargando..."
                    )
                }

                is UIState.Error -> {
                    ErrorState(
                        message = (lotesState as UIState.Error).message,
                        onRetry = { viewModel.retry() }
                    )
                }

                is UIState.Success, is UIState.Empty -> {
                    MapContent(
                        lotes = filteredLotes,
                        selectedLote = selectedLote,
                        mapType = currentMapType,
                        mapMode = mapMode,
                        drawingPoints = drawingPoints,
                        onLoteClick = { lote ->
                            viewModel.selectLote(lote)
                        },
                        onMapClick = { latLng ->
                            when (mapMode) {
                                MapMode.DRAWING -> viewModel.addDrawingPoint(latLng)
                                MapMode.MEASURING -> viewModel.addMeasurementPoint(latLng)
                                MapMode.VIEW -> viewModel.selectLote(null)
                                MapMode.SELECTING -> {}
                            }
                        },
                        viewModel = viewModel
                    )

                    // Controles flotantes
                    MapOverlayControls(
                        viewModel = viewModel,
                        currentMapType = currentMapType,
                        mapMode = mapMode,
                        modifier = Modifier.fillMaxSize()
                    )

                    // Info window del lote seleccionado
                    selectedLote?.let { lote ->
                        Box(
                            modifier = Modifier
                                .fillMaxSize()
                                .padding(Spacing.spacing16),
                            contentAlignment = Alignment.BottomCenter
                        ) {
                            LoteInfoWindow(
                                lote = lote,
                                onDismiss = { viewModel.selectLote(null) },
                                onNavigate = { onLoteClick(lote.id) },
                                compact = mapMode != MapMode.VIEW
                            )
                        }
                    }

                    // Barra de búsqueda
                    if (mapMode == MapMode.VIEW && selectedLote == null) {
                        Box(
                            modifier = Modifier
                                .fillMaxSize()
                                .padding(
                                    horizontal = Spacing.spacing16,
                                    vertical = Spacing.spacing16
                                ),
                            contentAlignment = Alignment.TopCenter
                        ) {
                            Column {
                                MapSearchBar(
                                    query = searchQuery,
                                    onQueryChange = { viewModel.setSearchQuery(it) },
                                    onSearch = { /* Implementar si necesario */ }
                                )

                                // Resultados de búsqueda
                                if (searchResults.isNotEmpty()) {
                                    Spacer(modifier = Modifier.height(Spacing.spacing8))
                                    SearchResultsList(
                                        results = searchResults,
                                        onResultClick = { lote ->
                                            viewModel.selectLote(lote)
                                            viewModel.centerOnLote(lote)
                                            viewModel.clearSearch()
                                        }
                                    )
                                }
                            }
                        }
                    }

                    // Controles de dibujo
                    if (mapMode == MapMode.DRAWING) {
                        Box(
                            modifier = Modifier
                                .fillMaxSize()
                                .padding(Spacing.spacing16),
                            contentAlignment = Alignment.BottomCenter
                        ) {
                            DrawingControls(
                                pointCount = drawingPoints.size,
                                canComplete = canCompleteDrawing,
                                onUndo = { viewModel.undoDrawingPoint() },
                                onComplete = {
                                    val points = viewModel.completeDrawing()
                                    points?.let {
                                        // TODO: Navegar a crear lote con coordenadas
                                    }
                                },
                                onCancel = { viewModel.cancelDrawing() }
                            )
                        }
                    }

                    // Display de medición
                    if (mapMode == MapMode.MEASURING && measurementResult != null) {
                        Box(
                            modifier = Modifier
                                .fillMaxSize()
                                .padding(Spacing.spacing16),
                            contentAlignment = Alignment.BottomCenter
                        ) {
                            MeasurementDisplay(
                                result = measurementResult!!,
                                onClear = { viewModel.cancelMeasurement() }
                            )
                        }
                    }

                    // Leyenda
                    if (showLegend) {
                        Box(
                            modifier = Modifier
                                .fillMaxSize()
                                .padding(Spacing.spacing16),
                            contentAlignment = Alignment.CenterEnd
                        ) {
                            MapLegend(
                                onDismiss = { viewModel.hideLegend() }
                            )
                        }
                    }
                }
            }
        }
    }
}

/**
 * Contenido principal del mapa con Google Maps
 */
@Composable
private fun MapContent(
    lotes: List<LoteUIModel>,
    selectedLote: LoteUIModel?,
    mapType: com.google.maps.android.compose.MapType,
    mapMode: MapMode,
    drawingPoints: List<LatLng>,
    onLoteClick: (LoteUIModel) -> Unit,
    onMapClick: (LatLng) -> Unit,
    viewModel: MapViewModel,
    modifier: Modifier = Modifier
) {
    val cameraPositionState = rememberCameraPositionState {
        position = CameraPosition.fromLatLngZoom(
            MapConfig.DEFAULT_CAMERA_POSITION,
            MapConfig.DEFAULT_ZOOM
        )
    }

    val scope = rememberCoroutineScope()

    // Animar cámara cuando se selecciona lote
    LaunchedEffect(selectedLote) {
        selectedLote?.let { lote ->
            val bounds = lote.getLatLngBounds()
            if (bounds != null) {
                scope.launch {
                    cameraPositionState.animateToBounds(
                        bounds,
                        padding = if (mapMode == MapMode.VIEW) {
                            MapConfig.BOTTOM_SHEET_PADDING
                        } else {
                            MapConfig.BOUNDS_PADDING
                        }
                    )
                }
            }
        }
    }

    GoogleMap(
        modifier = modifier.fillMaxSize(),
        cameraPositionState = cameraPositionState,
        properties = MapProperties(
            mapType = mapType,
            isMyLocationEnabled = false,
            minZoomPreference = MapConfig.MIN_ZOOM,
            maxZoomPreference = MapConfig.MAX_ZOOM
        ),
        uiSettings = MapConfig.defaultUiSettings,
        onMapClick = { latLng ->
            // Verificar si se clickeó dentro de algún polígono
            val clickedLote = lotes.find { lote ->
                val coords = lote.toDomain().coordenadas?.toLatLngList()
                coords?.contains(latLng) == true
            }

            if (clickedLote != null) {
                onLoteClick(clickedLote)
            } else {
                onMapClick(latLng)
            }
        }
    ) {
        // Renderizar polígonos de lotes
        lotes.forEach { lote ->
            val coords = lote.toDomain().coordenadas?.toLatLngList()
            if (!coords.isNullOrEmpty() && coords.size >= 3) {
                val isSelected = selectedLote?.id == lote.id
                val estado = lote.toDomain().estado

                Polygon(
                    points = coords,
                    fillColor = estado.getPolygonColor().copy(
                        alpha = if (isSelected) {
                            MapConfig.POLYGON_FILL_ALPHA_SELECTED
                        } else {
                            MapConfig.POLYGON_FILL_ALPHA
                        }
                    ).toGoogleMapsColor(),
                    strokeColor = if (isSelected) {
                        MapConfig.PolygonColors.SELECTED.toGoogleMapsColor()
                    } else {
                        estado.getPolygonColor().toGoogleMapsColor()
                    },
                    strokeWidth = if (isSelected) {
                        MapConfig.POLYGON_STROKE_WIDTH_SELECTED
                    } else {
                        MapConfig.POLYGON_STROKE_WIDTH
                    },
                    clickable = true,
                    tag = lote.id
                )

                // Marker en el centro del lote
                lote.toDomain().centroCampo?.let { centro ->
                    Marker(
                        state = MarkerState(position = centro.toLatLng()),
                        title = lote.nombre,
                        snippet = "${lote.cultivo} • ${lote.area}",
                        onClick = {
                            onLoteClick(lote)
                            true
                        },
                        zIndex = if (isSelected) {
                            MapConfig.MARKER_Z_INDEX_SELECTED
                        } else {
                            MapConfig.MARKER_Z_INDEX
                        }
                    )
                }
            }
        }

        // Polígono en modo dibujo
        if (mapMode == MapMode.DRAWING && drawingPoints.isNotEmpty()) {
            if (drawingPoints.size >= 2) {
                Polyline(
                    points = drawingPoints,
                    color = MapConfig.DRAWING_POLYGON_COLOR.toGoogleMapsColor(),
                    width = MapConfig.DRAWING_STROKE_WIDTH
                )
            }

            // Markers de vértices
            drawingPoints.forEachIndexed { index, point ->
                val isFirst = index == 0

                Circle(
                    center = point,
                    radius = MapConfig.DRAWING_VERTEX_RADIUS.toDouble(),
                    fillColor = if (isFirst) {
                        MapConfig.DRAWING_FIRST_VERTEX_COLOR
                    } else {
                        MapConfig.DRAWING_VERTEX_COLOR
                    }.toGoogleMapsColor(),
                    strokeColor = Color.White.toGoogleMapsColor(),
                    strokeWidth = 2f
                )
            }
        }

        // Polyline en modo medición
        val measurementPoints by viewModel.measurementPoints.collectAsState()
        if (mapMode == MapMode.MEASURING && measurementPoints.isNotEmpty()) {
            if (measurementPoints.size >= 2) {
                Polyline(
                    points = measurementPoints,
                    color = MapConfig.MEASUREMENT_LINE_COLOR.toGoogleMapsColor(),
                    width = MapConfig.MEASUREMENT_STROKE_WIDTH
                )
            }

            // Markers de puntos de medición
            measurementPoints.forEach { point ->
                Circle(
                    center = point,
                    radius = MapConfig.DRAWING_VERTEX_RADIUS.toDouble(),
                    fillColor = MapConfig.MEASUREMENT_LINE_COLOR.toGoogleMapsColor(),
                    strokeColor = Color.White.toGoogleMapsColor(),
                    strokeWidth = 2f
                )
            }
        }
    }
}

/**
 * Controles flotantes del mapa
 */
@Composable
private fun MapOverlayControls(
    viewModel: MapViewModel,
    currentMapType: com.google.maps.android.compose.MapType,
    mapMode: MapMode,
    modifier: Modifier = Modifier
) {
    Box(modifier = modifier) {
        // Zoom controls (lado derecho)
        if (mapMode == MapMode.VIEW) {
            Column(
                modifier = Modifier
                    .align(Alignment.CenterEnd)
                    .padding(end = Spacing.spacing16),
                verticalArrangement = Arrangement.spacedBy(Spacing.spacing12)
            ) {
                val scope = rememberCoroutineScope()

                // TODO: Necesitaría acceso al CameraPositionState para implementar zoom
                // Por ahora dejamos los controles visuales

                MapZoomControls(
                    onZoomIn = { /* viewModel zoom in */ },
                    onZoomOut = { /* viewModel zoom out */ }
                )

                MapLayerSelector(
                    currentLayer = MapConfig.MapLayer.values().find { it.mapType == currentMapType }
                        ?: MapConfig.DEFAULT_LAYER,
                    onLayerChanged = { layer ->
                        viewModel.setMapLayer(layer)
                    }
                )

                MyLocationButton(
                    onClick = {
                        // TODO: Implementar obtener ubicación y centrar
                        viewModel.toggleMyLocation()
                    }
                )
            }
        }

        // FAB para modos especiales (esquina inferior derecha)
        if (mapMode == MapMode.VIEW) {
            Column(
                modifier = Modifier
                    .align(Alignment.BottomEnd)
                    .padding(Spacing.spacing16),
                verticalArrangement = Arrangement.spacedBy(Spacing.spacing12)
            ) {
                // Modo medición
                SmallFloatingActionButton(
                    onClick = { viewModel.enterMeasuringMode() },
                    containerColor = MaterialTheme.colorScheme.secondaryContainer
                ) {
                    Icon(
                        imageVector = Icons.Default.Straighten,
                        contentDescription = "Medir"
                    )
                }

                // Modo dibujo
                FloatingActionButton(
                    onClick = { viewModel.enterDrawingMode() }
                ) {
                    Icon(
                        imageVector = Icons.Default.Edit,
                        contentDescription = "Dibujar polígono"
                    )
                }
            }
        }
    }
}

/**
 * Top bar del mapa
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun MapTopBar(
    title: String,
    onBackClick: () -> Unit,
    actions: @Composable RowScope.() -> Unit
) {
    TopAppBar(
        title = { Text(title) },
        navigationIcon = {
            IconButton(onClick = onBackClick) {
                Icon(
                    imageVector = Icons.Default.ArrowBack,
                    contentDescription = "Volver"
                )
            }
        },
        actions = actions
    )
}

/**
 * Lista de resultados de búsqueda
 */
@Composable
private fun SearchResultsList(
    results: List<LoteUIModel>,
    onResultClick: (LoteUIModel) -> Unit,
    modifier: Modifier = Modifier
) {
    Card(
        modifier = modifier,
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.surface
        )
    ) {
        Column(
            modifier = Modifier.padding(Spacing.spacing8)
        ) {
            results.forEach { lote ->
                SearchResultItem(
                    lote = lote,
                    onClick = { onResultClick(lote) }
                )
                if (lote != results.last()) {
                    HorizontalDivider()
                }
            }
        }
    }
}

@Composable
private fun SearchResultItem(
    lote: LoteUIModel,
    onClick: () -> Unit
) {
    Surface(
        onClick = onClick,
        modifier = Modifier.fillMaxWidth()
    ) {
        Row(
            modifier = Modifier
                .padding(Spacing.spacing12),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text(
                text = lote.cultivoEmoji,
                style = MaterialTheme.typography.headlineSmall
            )
            Spacer(modifier = Modifier.width(Spacing.spacing12))
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = lote.nombre,
                    style = MaterialTheme.typography.titleSmall
                )
                Text(
                    text = "${lote.cultivo} • ${lote.area}",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.6f)
                )
            }
            Icon(
                imageVector = Icons.Default.ChevronRight,
                contentDescription = null,
                tint = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.4f)
            )
        }
    }
}
