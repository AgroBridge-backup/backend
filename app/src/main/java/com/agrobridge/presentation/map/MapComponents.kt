package com.agrobridge.presentation.map

import androidx.compose.animation.*
import androidx.compose.animation.core.*
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import com.agrobridge.presentation.model.LoteUIModel
import com.agrobridge.presentation.theme.*

// ========================================================================
// Map Controls
// ========================================================================

/**
 * Controles de zoom del mapa
 */
@Composable
fun MapZoomControls(
    onZoomIn: () -> Unit,
    onZoomOut: () -> Unit,
    modifier: Modifier = Modifier
) {
    Column(
        modifier = modifier
            .shadow(
                elevation = Elevations.medium,
                shape = RoundedCornerShape(CornerRadius.medium)
            )
            .background(
                color = Surface,
                shape = RoundedCornerShape(CornerRadius.medium)
            ),
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        // Zoom In
        MapControlButton(
            icon = Icons.Default.Add,
            contentDescription = "Zoom In",
            onClick = onZoomIn,
            isTop = true
        )

        HorizontalDivider(
            modifier = Modifier.padding(horizontal = Spacing.spacing8),
            color = OnSurface.copy(alpha = 0.1f)
        )

        // Zoom Out
        MapControlButton(
            icon = Icons.Default.Remove,
            contentDescription = "Zoom Out",
            onClick = onZoomOut,
            isBottom = true
        )
    }
}

/**
 * Botón individual de control
 */
@Composable
private fun MapControlButton(
    icon: ImageVector,
    contentDescription: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    isTop: Boolean = false,
    isBottom: Boolean = false
) {
    val shape = when {
        isTop -> RoundedCornerShape(
            topStart = CornerRadius.medium,
            topEnd = CornerRadius.medium
        )
        isBottom -> RoundedCornerShape(
            bottomStart = CornerRadius.medium,
            bottomEnd = CornerRadius.medium
        )
        else -> RoundedCornerShape(0.dp)
    }

    Box(
        modifier = modifier
            .size(48.dp)
            .clip(shape)
            .clickable(onClick = onClick)
            .background(Surface),
        contentAlignment = Alignment.Center
    ) {
        Icon(
            imageVector = icon,
            contentDescription = contentDescription,
            tint = OnSurface,
            modifier = Modifier.size(24.dp)
        )
    }
}

// ========================================================================
// Map Layer Selector
// ========================================================================

/**
 * Selector de tipo de mapa
 */
@Composable
fun MapLayerSelector(
    currentLayer: MapConfig.MapLayer,
    onLayerChanged: (MapConfig.MapLayer) -> Unit,
    modifier: Modifier = Modifier
) {
    var expanded by remember { mutableStateOf(false) }

    Box(modifier = modifier) {
        // Botón principal
        Surface(
            onClick = { expanded = !expanded },
            modifier = Modifier.size(48.dp),
            shape = RoundedCornerShape(CornerRadius.medium),
            shadowElevation = Elevations.medium,
            color = Surface
        ) {
            Box(contentAlignment = Alignment.Center) {
                Icon(
                    imageVector = Icons.Default.Layers,
                    contentDescription = "Capas del mapa",
                    tint = OnSurface
                )
            }
        }

        // Dropdown menu
        DropdownMenu(
            expanded = expanded,
            onDismissRequest = { expanded = false },
            modifier = Modifier
                .background(Surface)
                .border(
                    width = 1.dp,
                    color = OnSurface.copy(alpha = 0.1f),
                    shape = RoundedCornerShape(CornerRadius.small)
                )
        ) {
            MapConfig.MapLayer.values().forEach { layer ->
                DropdownMenuItem(
                    text = {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Text(
                                text = layer.displayName,
                                style = MaterialTheme.typography.bodyMedium
                            )
                            if (layer == currentLayer) {
                                Icon(
                                    imageVector = Icons.Default.Check,
                                    contentDescription = null,
                                    tint = AgroGreen,
                                    modifier = Modifier.size(20.dp)
                                )
                            }
                        }
                    },
                    onClick = {
                        onLayerChanged(layer)
                        expanded = false
                    }
                )
            }
        }
    }
}

// ========================================================================
// My Location Button
// ========================================================================

/**
 * Botón de mi ubicación
 */
@Composable
fun MyLocationButton(
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    enabled: Boolean = true
) {
    Surface(
        onClick = onClick,
        modifier = modifier.size(48.dp),
        shape = RoundedCornerShape(CornerRadius.medium),
        shadowElevation = Elevations.medium,
        color = if (enabled) Surface else Surface.copy(alpha = 0.5f)
    ) {
        Box(contentAlignment = Alignment.Center) {
            Icon(
                imageVector = Icons.Default.MyLocation,
                contentDescription = "Mi ubicación",
                tint = if (enabled) AgroGreen else OnSurface.copy(alpha = 0.5f)
            )
        }
    }
}

// ========================================================================
// Lote Info Window
// ========================================================================

/**
 * Info window para mostrar detalles de lote en el mapa
 */
@Composable
fun LoteInfoWindow(
    lote: LoteUIModel,
    onDismiss: () -> Unit,
    onNavigate: () -> Unit,
    modifier: Modifier = Modifier,
    compact: Boolean = false
) {
    AnimatedVisibility(
        visible = true,
        enter = fadeIn() + slideInVertically(),
        exit = fadeOut() + slideOutVertically()
    ) {
        Card(
            modifier = modifier
                .width(if (compact) 280.dp else 320.dp)
                .shadow(
                    elevation = Elevations.high,
                    shape = RoundedCornerShape(CornerRadius.large)
                ),
            shape = RoundedCornerShape(CornerRadius.large),
            colors = CardDefaults.cardColors(containerColor = Surface)
        ) {
            Column(
                modifier = Modifier.padding(Spacing.spacing16)
            ) {
                // Header
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        modifier = Modifier.weight(1f)
                    ) {
                        Text(
                            text = lote.cultivoEmoji,
                            style = MaterialTheme.typography.headlineMedium
                        )
                        Spacer(modifier = Modifier.width(Spacing.spacing8))
                        Column {
                            Text(
                                text = lote.nombre,
                                style = MaterialTheme.typography.titleMedium,
                                fontWeight = FontWeight.Bold,
                                maxLines = 1,
                                overflow = TextOverflow.Ellipsis
                            )
                            Text(
                                text = lote.cultivo,
                                style = MaterialTheme.typography.bodySmall,
                                color = OnSurface.copy(alpha = 0.6f)
                            )
                        }
                    }

                    IconButton(
                        onClick = onDismiss,
                        modifier = Modifier.size(32.dp)
                    ) {
                        Icon(
                            imageVector = Icons.Default.Close,
                            contentDescription = "Cerrar",
                            modifier = Modifier.size(20.dp)
                        )
                    }
                }

                Spacer(modifier = Modifier.height(Spacing.spacing12))

                // Info rápida
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    InfoChipCompact(
                        icon = "📏",
                        label = lote.area
                    )
                    InfoChipCompact(
                        icon = "👨‍🌾",
                        label = lote.productorNombre.split(" ").firstOrNull() ?: ""
                    )
                    InfoChipCompact(
                        icon = if (lote.hasGPS) "📍" else "❌",
                        label = if (lote.hasGPS) "${lote.numeroCoord} pts" else "Sin GPS"
                    )
                }

                if (!compact) {
                    Spacer(modifier = Modifier.height(Spacing.spacing12))

                    // Estado y score
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        // Estado badge
                        Surface(
                            shape = RoundedCornerShape(CornerRadius.small),
                            color = lote.estado.color.copy(alpha = 0.15f)
                        ) {
                            Row(
                                modifier = Modifier.padding(
                                    horizontal = Spacing.spacing8,
                                    vertical = Spacing.spacing4
                                ),
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Text(
                                    text = lote.estado.icono,
                                    style = MaterialTheme.typography.bodySmall
                                )
                                Spacer(modifier = Modifier.width(Spacing.spacing4))
                                Text(
                                    text = lote.estado.nombre,
                                    style = MaterialTheme.typography.bodySmall,
                                    fontWeight = FontWeight.Medium,
                                    color = lote.estado.color
                                )
                            }
                        }

                        // Score
                        HealthScoreChip(score = lote.scoreVisual)
                    }
                }

                Spacer(modifier = Modifier.height(Spacing.spacing16))

                // Botón ver detalles
                Button(
                    onClick = onNavigate,
                    modifier = Modifier.fillMaxWidth(),
                    colors = ButtonDefaults.buttonColors(
                        containerColor = AgroGreen
                    )
                ) {
                    Icon(
                        imageVector = Icons.Default.Visibility,
                        contentDescription = null,
                        modifier = Modifier.size(20.dp)
                    )
                    Spacer(modifier = Modifier.width(Spacing.spacing8))
                    Text("Ver Detalles")
                }
            }
        }
    }
}

@Composable
private fun InfoChipCompact(
    icon: String,
    label: String,
    modifier: Modifier = Modifier
) {
    Surface(
        modifier = modifier,
        shape = RoundedCornerShape(CornerRadius.small),
        color = OnSurface.copy(alpha = 0.05f)
    ) {
        Row(
            modifier = Modifier.padding(
                horizontal = Spacing.spacing8,
                vertical = Spacing.spacing4
            ),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text(
                text = icon,
                style = MaterialTheme.typography.bodySmall
            )
            Spacer(modifier = Modifier.width(Spacing.spacing4))
            Text(
                text = label,
                style = MaterialTheme.typography.bodySmall,
                fontWeight = FontWeight.Medium,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis
            )
        }
    }
}

@Composable
private fun HealthScoreChip(
    score: Int,
    modifier: Modifier = Modifier
) {
    val color = when {
        score >= 80 -> Success
        score >= 60 -> Warning
        else -> Error
    }

    Surface(
        modifier = modifier,
        shape = RoundedCornerShape(CornerRadius.small),
        color = color.copy(alpha = 0.15f)
    ) {
        Row(
            modifier = Modifier.padding(
                horizontal = Spacing.spacing8,
                vertical = Spacing.spacing4
            ),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Icon(
                imageVector = Icons.Default.LocalFlorist,
                contentDescription = null,
                tint = color,
                modifier = Modifier.size(16.dp)
            )
            Spacer(modifier = Modifier.width(Spacing.spacing4))
            Text(
                text = "$score%",
                style = MaterialTheme.typography.bodySmall,
                fontWeight = FontWeight.Bold,
                color = color
            )
        }
    }
}

// ========================================================================
// Search Bar
// ========================================================================

/**
 * Barra de búsqueda para el mapa
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun MapSearchBar(
    query: String,
    onQueryChange: (String) -> Unit,
    onSearch: () -> Unit,
    placeholder: String = "Buscar lotes...",
    modifier: Modifier = Modifier,
    leadingIcon: @Composable (() -> Unit)? = {
        Icon(
            imageVector = Icons.Default.Search,
            contentDescription = "Buscar"
        )
    },
    trailingIcon: @Composable (() -> Unit)? = null
) {
    TextField(
        value = query,
        onValueChange = onQueryChange,
        modifier = modifier
            .fillMaxWidth()
            .shadow(
                elevation = Elevations.medium,
                shape = RoundedCornerShape(CornerRadius.large)
            ),
        placeholder = { Text(placeholder) },
        leadingIcon = leadingIcon,
        trailingIcon = if (query.isNotEmpty()) {
            {
                IconButton(onClick = { onQueryChange("") }) {
                    Icon(
                        imageVector = Icons.Default.Clear,
                        contentDescription = "Limpiar"
                    )
                }
            }
        } else trailingIcon,
        singleLine = true,
        shape = RoundedCornerShape(CornerRadius.large),
        colors = TextFieldDefaults.textFieldColors(
            containerColor = Surface,
            focusedIndicatorColor = Color.Transparent,
            unfocusedIndicatorColor = Color.Transparent
        )
    )
}

// ========================================================================
// Measurement Display
// ========================================================================

/**
 * Display de medición en el mapa
 */
@Composable
fun MeasurementDisplay(
    result: MeasurementResult,
    onClear: () -> Unit,
    modifier: Modifier = Modifier
) {
    Card(
        modifier = modifier
            .shadow(
                elevation = Elevations.high,
                shape = RoundedCornerShape(CornerRadius.medium)
            ),
        shape = RoundedCornerShape(CornerRadius.medium),
        colors = CardDefaults.cardColors(containerColor = Surface)
    ) {
        Column(
            modifier = Modifier.padding(Spacing.spacing16)
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = "Medición",
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Bold
                )
                IconButton(
                    onClick = onClear,
                    modifier = Modifier.size(32.dp)
                ) {
                    Icon(
                        imageVector = Icons.Default.Close,
                        contentDescription = "Cerrar",
                        modifier = Modifier.size(20.dp)
                    )
                }
            }

            Spacer(modifier = Modifier.height(Spacing.spacing12))

            // Distancia
            MeasurementItem(
                icon = Icons.Default.Straighten,
                label = "Distancia",
                value = result.distance.formatDistance()
            )

            // Área si existe
            result.area?.let { area ->
                Spacer(modifier = Modifier.height(Spacing.spacing8))
                MeasurementItem(
                    icon = Icons.Default.CropSquare,
                    label = "Área",
                    value = area.formatArea()
                )
            }

            // Perímetro si existe
            result.perimeter?.let { perimeter ->
                Spacer(modifier = Modifier.height(Spacing.spacing8))
                MeasurementItem(
                    icon = Icons.Default.Timeline,
                    label = "Perímetro",
                    value = perimeter.formatDistance()
                )
            }

            Spacer(modifier = Modifier.height(Spacing.spacing12))

            Text(
                text = "${result.points.size} puntos",
                style = MaterialTheme.typography.bodySmall,
                color = OnSurface.copy(alpha = 0.6f)
            )
        }
    }
}

@Composable
private fun MeasurementItem(
    icon: ImageVector,
    label: String,
    value: String
) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically
    ) {
        Row(
            verticalAlignment = Alignment.CenterVertically
        ) {
            Icon(
                imageVector = icon,
                contentDescription = null,
                modifier = Modifier.size(20.dp),
                tint = OnSurface.copy(alpha = 0.6f)
            )
            Spacer(modifier = Modifier.width(Spacing.spacing8))
            Text(
                text = label,
                style = MaterialTheme.typography.bodyMedium,
                color = OnSurface.copy(alpha = 0.8f)
            )
        }
        Text(
            text = value,
            style = MaterialTheme.typography.titleMedium,
            fontWeight = FontWeight.Bold,
            color = AgroGreen
        )
    }
}

// ========================================================================
// Loading Overlay
// ========================================================================

/**
 * Overlay de carga para el mapa
 */
@Composable
fun MapLoadingOverlay(
    message: String = "Cargando mapa...",
    modifier: Modifier = Modifier
) {
    Box(
        modifier = modifier
            .fillMaxSize()
            .background(Surface.copy(alpha = 0.9f)),
        contentAlignment = Alignment.Center
    ) {
        Column(
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            CircularProgressIndicator(
                color = AgroGreen,
                strokeWidth = 3.dp
            )
            Spacer(modifier = Modifier.height(Spacing.spacing16))
            Text(
                text = message,
                style = MaterialTheme.typography.bodyMedium,
                color = OnSurface.copy(alpha = 0.8f)
            )
        }
    }
}

// ========================================================================
// Cluster Marker
// ========================================================================

/**
 * Marker para cluster de lotes
 */
@Composable
fun ClusterMarker(
    count: Int,
    modifier: Modifier = Modifier
) {
    Box(
        modifier = modifier
            .size(48.dp)
            .background(
                color = AgroGreen,
                shape = CircleShape
            )
            .border(
                width = 3.dp,
                color = Surface,
                shape = CircleShape
            ),
        contentAlignment = Alignment.Center
    ) {
        Text(
            text = count.toString(),
            style = MaterialTheme.typography.titleMedium,
            fontWeight = FontWeight.Bold,
            color = Color.White
        )
    }
}

// ========================================================================
// Drawing Mode Controls
// ========================================================================

/**
 * Controles para modo dibujo
 */
@Composable
fun DrawingControls(
    pointCount: Int,
    canComplete: Boolean,
    onUndo: () -> Unit,
    onComplete: () -> Unit,
    onCancel: () -> Unit,
    modifier: Modifier = Modifier
) {
    Card(
        modifier = modifier
            .shadow(
                elevation = Elevations.high,
                shape = RoundedCornerShape(CornerRadius.medium)
            ),
        shape = RoundedCornerShape(CornerRadius.medium),
        colors = CardDefaults.cardColors(containerColor = Surface)
    ) {
        Row(
            modifier = Modifier.padding(Spacing.spacing12),
            horizontalArrangement = Arrangement.spacedBy(Spacing.spacing8),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text(
                text = "$pointCount puntos",
                style = MaterialTheme.typography.bodyMedium,
                fontWeight = FontWeight.Medium
            )

            Spacer(modifier = Modifier.weight(1f))

            // Deshacer
            IconButton(
                onClick = onUndo,
                enabled = pointCount > 0
            ) {
                Icon(
                    imageVector = Icons.Default.Undo,
                    contentDescription = "Deshacer",
                    tint = if (pointCount > 0) OnSurface else OnSurface.copy(alpha = 0.3f)
                )
            }

            // Completar
            Button(
                onClick = onComplete,
                enabled = canComplete,
                colors = ButtonDefaults.buttonColors(
                    containerColor = Success
                )
            ) {
                Icon(
                    imageVector = Icons.Default.Check,
                    contentDescription = null,
                    modifier = Modifier.size(20.dp)
                )
                Spacer(modifier = Modifier.width(Spacing.spacing4))
                Text("Completar")
            }

            // Cancelar
            OutlinedButton(onClick = onCancel) {
                Text("Cancelar")
            }
        }
    }
}

// ========================================================================
// Legend
// ========================================================================

/**
 * Leyenda del mapa
 */
@Composable
fun MapLegend(
    modifier: Modifier = Modifier,
    onDismiss: () -> Unit
) {
    Card(
        modifier = modifier
            .shadow(
                elevation = Elevations.medium,
                shape = RoundedCornerShape(CornerRadius.medium)
            ),
        shape = RoundedCornerShape(CornerRadius.medium),
        colors = CardDefaults.cardColors(containerColor = Surface)
    ) {
        Column(
            modifier = Modifier.padding(Spacing.spacing16)
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = "Leyenda",
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Bold
                )
                IconButton(
                    onClick = onDismiss,
                    modifier = Modifier.size(32.dp)
                ) {
                    Icon(
                        imageVector = Icons.Default.Close,
                        contentDescription = "Cerrar",
                        modifier = Modifier.size(20.dp)
                    )
                }
            }

            Spacer(modifier = Modifier.height(Spacing.spacing12))

            LegendItem(
                color = MapConfig.PolygonColors.ACTIVO,
                label = "Activo"
            )
            LegendItem(
                color = MapConfig.PolygonColors.EN_COSECHA,
                label = "En Cosecha"
            )
            LegendItem(
                color = MapConfig.PolygonColors.COSECHADO,
                label = "Cosechado"
            )
            LegendItem(
                color = MapConfig.PolygonColors.EN_PREPARACION,
                label = "En Preparación"
            )
            LegendItem(
                color = MapConfig.PolygonColors.INACTIVO,
                label = "Inactivo"
            )
        }
    }
}

@Composable
private fun LegendItem(
    color: Color,
    label: String
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = Spacing.spacing4),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Box(
            modifier = Modifier
                .size(24.dp)
                .background(
                    color = color.copy(alpha = 0.5f),
                    shape = RoundedCornerShape(CornerRadius.small)
                )
                .border(
                    width = 2.dp,
                    color = color,
                    shape = RoundedCornerShape(CornerRadius.small)
                )
        )
        Spacer(modifier = Modifier.width(Spacing.spacing12))
        Text(
            text = label,
            style = MaterialTheme.typography.bodyMedium
        )
    }
}
