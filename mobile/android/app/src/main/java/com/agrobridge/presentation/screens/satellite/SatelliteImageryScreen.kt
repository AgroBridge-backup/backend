/**
 * Traceability 2.0 - Satellite Imagery Time-Lapse
 * Android Kotlin/Compose Implementation
 */

package com.agrobridge.presentation.screens.satellite

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import coil.compose.AsyncImage
import java.text.SimpleDateFormat
import java.util.*

// MARK: - Models

enum class ImageryType(val displayName: String) {
    RGB("Color Real"),
    NDVI("NDVI"),
    NDWI("NDWI"),
    EVI("EVI"),
    FALSE_COLOR("Falso Color")
}

data class Field(
    val id: String,
    val producerId: String,
    val name: String,
    val description: String?,
    val cropType: String?,
    val areaHectares: Double,
    val centroidLatitude: Double,
    val centroidLongitude: Double
)

data class FieldImagery(
    val id: String,
    val fieldId: String,
    val imageType: ImageryType,
    val captureDate: Date,
    val cloudCoverPercent: Double,
    val imageUrl: String,
    val thumbnailUrl: String?,
    val ndviValue: Double?,
    val healthScore: Int?
)

data class TimeLapse(
    val fieldId: String,
    val startDate: Date,
    val endDate: Date,
    val imageType: ImageryType,
    val frames: List<TimeLapseFrame>,
    val frameCount: Int,
    val averageNdvi: Double?,
    val ndviTrend: String,
    val healthTrend: String
)

data class TimeLapseFrame(
    val date: Date,
    val imageUrl: String,
    val ndviValue: Double?,
    val healthScore: Int?,
    val cloudCoverPercent: Double
)

data class HealthAnalysis(
    val fieldId: String,
    val analysisDate: Date,
    val overallHealthScore: Int,
    val ndviAverage: Double,
    val ndviMin: Double,
    val ndviMax: Double,
    val recommendations: List<String>
)

data class NdviDataPoint(
    val date: Date,
    val ndviValue: Double
)

data class SatelliteUiState(
    val isLoading: Boolean = false,
    val fields: List<Field> = emptyList(),
    val selectedField: Field? = null,
    val imagery: List<FieldImagery> = emptyList(),
    val timeLapse: TimeLapse? = null,
    val healthAnalysis: HealthAnalysis? = null,
    val ndviSeries: List<NdviDataPoint> = emptyList(),
    val currentFrameIndex: Int = 0,
    val isPlayingTimeLapse: Boolean = false,
    val error: String? = null
)

// MARK: - Screen

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SatelliteImageryScreen(
    producerId: String,
    viewModel: SatelliteImageryViewModel = hiltViewModel(),
    onNavigateBack: () -> Unit = {}
) {
    val uiState by viewModel.uiState.collectAsState()

    LaunchedEffect(producerId) {
        viewModel.loadFields(producerId)
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Imágenes Satelitales") },
                navigationIcon = {
                    IconButton(onClick = onNavigateBack) {
                        Icon(Icons.Default.ArrowBack, contentDescription = "Volver")
                    }
                }
            )
        }
    ) { paddingValues ->
        Box(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues)
        ) {
            when {
                uiState.isLoading && uiState.fields.isEmpty() -> {
                    CircularProgressIndicator(modifier = Modifier.align(Alignment.Center))
                }
                uiState.error != null -> {
                    ErrorContent(
                        message = uiState.error!!,
                        onRetry = { viewModel.loadFields(producerId) },
                        modifier = Modifier.align(Alignment.Center)
                    )
                }
                else -> {
                    LazyColumn(
                        modifier = Modifier.fillMaxSize(),
                        contentPadding = PaddingValues(16.dp),
                        verticalArrangement = Arrangement.spacedBy(16.dp)
                    ) {
                        // Field Selector
                        item {
                            FieldSelectorCard(
                                fields = uiState.fields,
                                selectedField = uiState.selectedField,
                                onFieldSelected = { viewModel.selectField(it) }
                            )
                        }

                        if (uiState.selectedField != null) {
                            // Health Overview
                            uiState.healthAnalysis?.let { analysis ->
                                item {
                                    HealthOverviewCard(analysis = analysis)
                                }
                            }

                            // NDVI Chart
                            if (uiState.ndviSeries.isNotEmpty()) {
                                item {
                                    NdviChartCard(series = uiState.ndviSeries)
                                }
                            }

                            // Time-Lapse Player
                            uiState.timeLapse?.let { timeLapse ->
                                if (timeLapse.frames.isNotEmpty()) {
                                    item {
                                        TimeLapseCard(
                                            timeLapse = timeLapse,
                                            currentIndex = uiState.currentFrameIndex,
                                            isPlaying = uiState.isPlayingTimeLapse,
                                            onPlay = { viewModel.playTimeLapse() },
                                            onStop = { viewModel.stopTimeLapse() },
                                            onSeek = { viewModel.seekToFrame(it) }
                                        )
                                    }
                                }
                            }

                            // Recent Imagery
                            if (uiState.imagery.isNotEmpty()) {
                                item {
                                    RecentImageryCard(imagery = uiState.imagery)
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}

// MARK: - Field Selector Card

@Composable
fun FieldSelectorCard(
    fields: List<Field>,
    selectedField: Field?,
    onFieldSelected: (Field) -> Unit
) {
    Card(modifier = Modifier.fillMaxWidth()) {
        Column(modifier = Modifier.padding(16.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(
                    imageVector = Icons.Default.Map,
                    contentDescription = null,
                    tint = Color(0xFF4CAF50)
                )
                Spacer(modifier = Modifier.width(8.dp))
                Text(
                    text = "Seleccionar Campo",
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Bold
                )
            }

            Spacer(modifier = Modifier.height(12.dp))

            if (fields.isEmpty()) {
                Text(
                    text = "No hay campos registrados",
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            } else {
                fields.forEach { field ->
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clickable { onFieldSelected(field) }
                            .padding(vertical = 8.dp),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Column {
                            Text(
                                text = field.name,
                                style = MaterialTheme.typography.bodyMedium,
                                fontWeight = FontWeight.Medium
                            )
                            Text(
                                text = "${String.format("%.1f", field.areaHectares)} ha",
                                style = MaterialTheme.typography.bodySmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant
                            )
                        }
                        if (selectedField?.id == field.id) {
                            Icon(
                                imageVector = Icons.Default.CheckCircle,
                                contentDescription = null,
                                tint = Color(0xFF4CAF50)
                            )
                        }
                    }
                }
            }
        }
    }
}

// MARK: - Health Overview Card

@Composable
fun HealthOverviewCard(analysis: HealthAnalysis) {
    val scoreColor = when {
        analysis.overallHealthScore >= 80 -> Color(0xFF4CAF50)
        analysis.overallHealthScore >= 60 -> Color(0xFFFF9800)
        analysis.overallHealthScore >= 40 -> Color(0xFFFF5722)
        else -> Color(0xFFF44336)
    }

    Card(modifier = Modifier.fillMaxWidth()) {
        Column(modifier = Modifier.padding(16.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(
                    imageVector = Icons.Default.Eco,
                    contentDescription = null,
                    tint = Color(0xFF4CAF50)
                )
                Spacer(modifier = Modifier.width(8.dp))
                Text(
                    text = "Salud del Cultivo",
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Bold
                )
            }

            Spacer(modifier = Modifier.height(16.dp))

            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically
            ) {
                // Score
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Text(
                        text = "${analysis.overallHealthScore}",
                        fontSize = 48.sp,
                        fontWeight = FontWeight.Bold,
                        color = scoreColor
                    )
                    Text(
                        text = "Puntuación",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }

                Spacer(modifier = Modifier.width(24.dp))
                VerticalDivider(modifier = Modifier.height(60.dp))
                Spacer(modifier = Modifier.width(24.dp))

                // NDVI Stats
                Column {
                    StatRow(label = "NDVI Promedio", value = String.format("%.3f", analysis.ndviAverage))
                    StatRow(label = "NDVI Mín", value = String.format("%.3f", analysis.ndviMin))
                    StatRow(label = "NDVI Máx", value = String.format("%.3f", analysis.ndviMax))
                }
            }

            if (analysis.recommendations.isNotEmpty()) {
                Spacer(modifier = Modifier.height(16.dp))
                HorizontalDivider()
                Spacer(modifier = Modifier.height(12.dp))

                analysis.recommendations.forEach { rec ->
                    Row(
                        modifier = Modifier.padding(vertical = 4.dp),
                        verticalAlignment = Alignment.Top
                    ) {
                        Icon(
                            imageVector = Icons.Default.Lightbulb,
                            contentDescription = null,
                            tint = Color(0xFFFFEB3B),
                            modifier = Modifier.size(16.dp)
                        )
                        Spacer(modifier = Modifier.width(8.dp))
                        Text(
                            text = rec,
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                }
            }
        }
    }
}

@Composable
fun StatRow(label: String, value: String) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 2.dp),
        horizontalArrangement = Arrangement.SpaceBetween
    ) {
        Text(
            text = label,
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )
        Text(
            text = value,
            style = MaterialTheme.typography.bodySmall,
            fontWeight = FontWeight.Medium
        )
    }
}

// MARK: - NDVI Chart Card

@Composable
fun NdviChartCard(series: List<NdviDataPoint>) {
    Card(modifier = Modifier.fillMaxWidth()) {
        Column(modifier = Modifier.padding(16.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(
                    imageVector = Icons.Default.ShowChart,
                    contentDescription = null,
                    tint = Color(0xFF9C27B0)
                )
                Spacer(modifier = Modifier.width(8.dp))
                Text(
                    text = "Evolución NDVI",
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Bold
                )
            }

            Spacer(modifier = Modifier.height(16.dp))

            // Simplified chart representation
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(150.dp)
                    .background(
                        color = Color(0xFF4CAF50).copy(alpha = 0.1f),
                        shape = RoundedCornerShape(8.dp)
                    )
            ) {
                Column(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(16.dp),
                    verticalArrangement = Arrangement.Center,
                    horizontalAlignment = Alignment.CenterHorizontally
                ) {
                    Text(
                        text = "${series.size} puntos de datos",
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                    val avg = series.map { it.ndviValue }.average()
                    Text(
                        text = "Promedio: ${String.format("%.3f", avg)}",
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.Bold,
                        color = Color(0xFF4CAF50)
                    )
                }
            }
        }
    }
}

// MARK: - Time-Lapse Card

@Composable
fun TimeLapseCard(
    timeLapse: TimeLapse,
    currentIndex: Int,
    isPlaying: Boolean,
    onPlay: () -> Unit,
    onStop: () -> Unit,
    onSeek: (Int) -> Unit
) {
    val currentFrame = timeLapse.frames.getOrNull(currentIndex)
    val dateFormat = remember { SimpleDateFormat("dd/MM/yyyy", Locale.getDefault()) }

    Card(modifier = Modifier.fillMaxWidth()) {
        Column(modifier = Modifier.padding(16.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(
                    imageVector = Icons.Default.Movie,
                    contentDescription = null,
                    tint = Color(0xFF2196F3)
                )
                Spacer(modifier = Modifier.width(8.dp))
                Text(
                    text = "Time-Lapse",
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Bold
                )
                Spacer(modifier = Modifier.weight(1f))
                Text(
                    text = "${timeLapse.frameCount} imágenes",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }

            Spacer(modifier = Modifier.height(16.dp))

            // Image Display
            currentFrame?.let { frame ->
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(200.dp)
                        .clip(RoundedCornerShape(8.dp))
                ) {
                    AsyncImage(
                        model = frame.imageUrl,
                        contentDescription = null,
                        contentScale = ContentScale.Crop,
                        modifier = Modifier.fillMaxSize()
                    )

                    Row(
                        modifier = Modifier
                            .align(Alignment.BottomStart)
                            .fillMaxWidth()
                            .padding(8.dp),
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        Surface(
                            color = MaterialTheme.colorScheme.surface.copy(alpha = 0.8f),
                            shape = RoundedCornerShape(16.dp)
                        ) {
                            Text(
                                text = dateFormat.format(frame.date),
                                style = MaterialTheme.typography.labelSmall,
                                modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp)
                            )
                        }
                        frame.ndviValue?.let { ndvi ->
                            Surface(
                                color = MaterialTheme.colorScheme.surface.copy(alpha = 0.8f),
                                shape = RoundedCornerShape(16.dp)
                            ) {
                                Text(
                                    text = "NDVI: ${String.format("%.2f", ndvi)}",
                                    style = MaterialTheme.typography.labelSmall,
                                    modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp)
                                )
                            }
                        }
                    }
                }
            }

            Spacer(modifier = Modifier.height(16.dp))

            // Controls
            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically
            ) {
                IconButton(onClick = if (isPlaying) onStop else onPlay) {
                    Icon(
                        imageVector = if (isPlaying) Icons.Default.Pause else Icons.Default.PlayArrow,
                        contentDescription = null
                    )
                }

                Slider(
                    value = currentIndex.toFloat(),
                    onValueChange = { onSeek(it.toInt()) },
                    valueRange = 0f..(timeLapse.frames.size - 1).toFloat().coerceAtLeast(0f),
                    modifier = Modifier.weight(1f)
                )

                Text(
                    text = "${currentIndex + 1}/${timeLapse.frames.size}",
                    style = MaterialTheme.typography.labelMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }

            // Trend
            Row {
                Icon(
                    imageVector = when (timeLapse.ndviTrend) {
                        "IMPROVING" -> Icons.Default.TrendingUp
                        "DECLINING" -> Icons.Default.TrendingDown
                        else -> Icons.Default.TrendingFlat
                    },
                    contentDescription = null,
                    tint = when (timeLapse.ndviTrend) {
                        "IMPROVING" -> Color(0xFF4CAF50)
                        "DECLINING" -> Color(0xFFF44336)
                        else -> Color(0xFF2196F3)
                    },
                    modifier = Modifier.size(16.dp)
                )
                Spacer(modifier = Modifier.width(4.dp))
                Text(
                    text = timeLapse.ndviTrend,
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
        }
    }
}

// MARK: - Recent Imagery Card

@Composable
fun RecentImageryCard(imagery: List<FieldImagery>) {
    val dateFormat = remember { SimpleDateFormat("dd/MM", Locale.getDefault()) }

    Card(modifier = Modifier.fillMaxWidth()) {
        Column(modifier = Modifier.padding(16.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(
                    imageVector = Icons.Default.PhotoLibrary,
                    contentDescription = null,
                    tint = Color(0xFFFF9800)
                )
                Spacer(modifier = Modifier.width(8.dp))
                Text(
                    text = "Imágenes Recientes",
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Bold
                )
            }

            Spacer(modifier = Modifier.height(12.dp))

            Row(
                modifier = Modifier.horizontalScroll(rememberScrollState()),
                horizontalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                imagery.take(10).forEach { img ->
                    Column(
                        horizontalAlignment = Alignment.CenterHorizontally
                    ) {
                        AsyncImage(
                            model = img.thumbnailUrl ?: img.imageUrl,
                            contentDescription = null,
                            contentScale = ContentScale.Crop,
                            modifier = Modifier
                                .size(100.dp)
                                .clip(RoundedCornerShape(8.dp))
                        )
                        Text(
                            text = dateFormat.format(img.captureDate),
                            style = MaterialTheme.typography.labelSmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                        Text(
                            text = img.imageType.displayName,
                            style = MaterialTheme.typography.labelSmall,
                            fontWeight = FontWeight.Medium
                        )
                    }
                }
            }
        }
    }
}

// MARK: - Error Content

@Composable
fun ErrorContent(
    message: String,
    onRetry: () -> Unit,
    modifier: Modifier = Modifier
) {
    Column(
        modifier = modifier.padding(32.dp),
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Icon(
            imageVector = Icons.Default.Satellite,
            contentDescription = null,
            modifier = Modifier.size(48.dp),
            tint = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.5f)
        )
        Spacer(modifier = Modifier.height(16.dp))
        Text(
            text = message,
            style = MaterialTheme.typography.bodyMedium,
            textAlign = TextAlign.Center,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )
        Spacer(modifier = Modifier.height(16.dp))
        OutlinedButton(onClick = onRetry) {
            Text("Reintentar")
        }
    }
}
