/**
 * Traceability 2.0 - Cold Chain Temperature Log
 * Android Kotlin/Compose Implementation
 */

package com.agrobridge.presentation.screens.temperature

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import java.text.SimpleDateFormat
import java.util.*

// MARK: - Models

enum class TemperatureSource(
    val displayName: String,
    val description: String
) {
    IOT_SENSOR("Sensor IoT", "Lectura automática de sensor conectado"),
    MANUAL("Manual", "Registro manual por operador"),
    DRIVER_APP("App Conductor", "Registro desde aplicación móvil")
}

data class TemperatureReading(
    val id: String,
    val batchId: String,
    val value: Double,
    val humidity: Double?,
    val source: TemperatureSource,
    val minThreshold: Double,
    val maxThreshold: Double,
    val isOutOfRange: Boolean,
    val sensorId: String?,
    val deviceId: String?,
    val latitude: Double?,
    val longitude: Double?,
    val recordedBy: String?,
    val timestamp: Date
)

data class TemperatureSummary(
    val batchId: String,
    val count: Int,
    val minValue: Double,
    val maxValue: Double,
    val avgValue: Double,
    val outOfRangeCount: Int,
    val outOfRangePercent: Int,
    val firstReading: Date?,
    val lastReading: Date?,
    val isCompliant: Boolean
)

data class TemperatureChartData(
    val labels: List<String>,
    val values: List<Double>,
    val thresholdMin: Double,
    val thresholdMax: Double,
    val outOfRangeIndices: List<Int>
)

data class ComplianceResult(
    val isCompliant: Boolean,
    val complianceScore: Int,
    val recommendations: List<String>
)

data class TemperatureUiState(
    val isLoading: Boolean = false,
    val readings: List<TemperatureReading> = emptyList(),
    val summary: TemperatureSummary? = null,
    val chartData: TemperatureChartData? = null,
    val compliance: ComplianceResult? = null,
    val latestReading: TemperatureReading? = null,
    val error: String? = null,
    val showManualEntry: Boolean = false
)

// MARK: - Screen

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun TemperatureMonitoringScreen(
    batchId: String,
    viewModel: TemperatureMonitoringViewModel = hiltViewModel(),
    onNavigateBack: () -> Unit = {}
) {
    val uiState by viewModel.uiState.collectAsState()

    LaunchedEffect(batchId) {
        viewModel.loadData(batchId)
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Temperatura") },
                navigationIcon = {
                    IconButton(onClick = onNavigateBack) {
                        Icon(Icons.Default.ArrowBack, contentDescription = "Volver")
                    }
                },
                actions = {
                    IconButton(onClick = { viewModel.loadCompliance(batchId) }) {
                        Icon(Icons.Default.VerifiedUser, contentDescription = "Verificar cumplimiento")
                    }
                    IconButton(onClick = { viewModel.showManualEntry() }) {
                        Icon(Icons.Default.Add, contentDescription = "Registrar temperatura")
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
                uiState.isLoading && uiState.summary == null -> {
                    CircularProgressIndicator(modifier = Modifier.align(Alignment.Center))
                }
                uiState.error != null -> {
                    ErrorContent(
                        message = uiState.error!!,
                        onRetry = { viewModel.loadData(batchId) },
                        modifier = Modifier.align(Alignment.Center)
                    )
                }
                else -> {
                    LazyColumn(
                        modifier = Modifier.fillMaxSize(),
                        contentPadding = PaddingValues(16.dp),
                        verticalArrangement = Arrangement.spacedBy(16.dp)
                    ) {
                        // Current Temperature Card
                        uiState.latestReading?.let { reading ->
                            item {
                                CurrentTemperatureCard(reading = reading)
                            }
                        }

                        // Summary Card
                        uiState.summary?.let { summary ->
                            item {
                                SummaryCard(summary = summary)
                            }
                        }

                        // Chart Card
                        uiState.chartData?.let { chartData ->
                            if (chartData.values.isNotEmpty()) {
                                item {
                                    TemperatureChartCard(data = chartData)
                                }
                            }
                        }

                        // Compliance Card
                        uiState.compliance?.let { compliance ->
                            item {
                                ComplianceCard(compliance = compliance)
                            }
                        }

                        // Recent Readings
                        if (uiState.readings.isNotEmpty()) {
                            item {
                                Text(
                                    text = "Lecturas Recientes",
                                    style = MaterialTheme.typography.titleMedium,
                                    fontWeight = FontWeight.Bold
                                )
                            }
                            items(uiState.readings.take(10), key = { it.id }) { reading ->
                                ReadingRow(reading = reading)
                            }
                        }
                    }
                }
            }

            // Manual Entry Dialog
            if (uiState.showManualEntry) {
                ManualEntryDialog(
                    onDismiss = { viewModel.hideManualEntry() },
                    onConfirm = { temp, humidity ->
                        viewModel.recordTemperature(batchId, temp, humidity)
                    }
                )
            }
        }
    }
}

// MARK: - Current Temperature Card

@Composable
fun CurrentTemperatureCard(reading: TemperatureReading) {
    val temperatureColor = when {
        reading.isOutOfRange && reading.value < reading.minThreshold -> Color(0xFF2196F3)
        reading.isOutOfRange -> Color(0xFFF44336)
        else -> Color(0xFF4CAF50)
    }

    val timeFormat = remember { SimpleDateFormat("HH:mm", Locale.getDefault()) }

    Card(modifier = Modifier.fillMaxWidth()) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(24.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(
                        imageVector = Icons.Default.Thermostat,
                        contentDescription = null,
                        tint = MaterialTheme.colorScheme.primary
                    )
                    Spacer(modifier = Modifier.width(8.dp))
                    Text(
                        text = "Temperatura Actual",
                        style = MaterialTheme.typography.titleMedium
                    )
                }
                Text(
                    text = timeFormat.format(reading.timestamp),
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }

            Spacer(modifier = Modifier.height(24.dp))

            Row(
                verticalAlignment = Alignment.Top,
                horizontalArrangement = Arrangement.Center
            ) {
                Text(
                    text = String.format("%.1f", reading.value),
                    fontSize = 64.sp,
                    fontWeight = FontWeight.Bold,
                    color = temperatureColor
                )
                Text(
                    text = "°C",
                    fontSize = 24.sp,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.padding(top = 8.dp)
                )
            }

            if (reading.isOutOfRange) {
                Spacer(modifier = Modifier.height(12.dp))
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.Center
                ) {
                    Icon(
                        imageVector = Icons.Default.Warning,
                        contentDescription = null,
                        tint = Color(0xFFFF9800),
                        modifier = Modifier.size(16.dp)
                    )
                    Spacer(modifier = Modifier.width(4.dp))
                    Text(
                        text = "Fuera de rango (${reading.minThreshold.toInt()}°C - ${reading.maxThreshold.toInt()}°C)",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            }

            reading.humidity?.let { humidity ->
                Spacer(modifier = Modifier.height(8.dp))
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.Center
                ) {
                    Icon(
                        imageVector = Icons.Default.WaterDrop,
                        contentDescription = null,
                        tint = Color(0xFF00BCD4),
                        modifier = Modifier.size(16.dp)
                    )
                    Spacer(modifier = Modifier.width(4.dp))
                    Text(
                        text = "Humedad: ${humidity.toInt()}%",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            }

            Spacer(modifier = Modifier.height(16.dp))

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                Text(
                    text = reading.source.displayName,
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
                reading.sensorId?.let { sensorId ->
                    Text(
                        text = "Sensor: $sensorId",
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            }
        }
    }
}

// MARK: - Summary Card

@Composable
fun SummaryCard(summary: TemperatureSummary) {
    Card(modifier = Modifier.fillMaxWidth()) {
        Column(modifier = Modifier.padding(16.dp)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(
                        imageVector = Icons.Default.BarChart,
                        contentDescription = null,
                        tint = Color(0xFF2196F3)
                    )
                    Spacer(modifier = Modifier.width(8.dp))
                    Text(
                        text = "Resumen",
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.Bold
                    )
                }
                StatusBadge(isCompliant = summary.isCompliant)
            }

            Spacer(modifier = Modifier.height(16.dp))

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceEvenly
            ) {
                StatItem(title = "Mínima", value = "${String.format("%.1f", summary.minValue)}°C", color = Color(0xFF2196F3))
                StatItem(title = "Promedio", value = "${String.format("%.1f", summary.avgValue)}°C", color = Color(0xFF4CAF50))
                StatItem(title = "Máxima", value = "${String.format("%.1f", summary.maxValue)}°C", color = Color(0xFFF44336))
            }

            Spacer(modifier = Modifier.height(16.dp))
            HorizontalDivider()
            Spacer(modifier = Modifier.height(16.dp))

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                Column {
                    Text(
                        text = "${summary.count}",
                        style = MaterialTheme.typography.headlineSmall,
                        fontWeight = FontWeight.Bold
                    )
                    Text(
                        text = "Lecturas",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
                Column(horizontalAlignment = Alignment.End) {
                    Text(
                        text = "${summary.outOfRangeCount}",
                        style = MaterialTheme.typography.headlineSmall,
                        fontWeight = FontWeight.Bold,
                        color = if (summary.outOfRangeCount > 0) Color(0xFFF44336) else Color(0xFF4CAF50)
                    )
                    Text(
                        text = "Fuera de rango (${summary.outOfRangePercent}%)",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            }
        }
    }
}

@Composable
fun StatItem(title: String, value: String, color: Color) {
    Column(horizontalAlignment = Alignment.CenterHorizontally) {
        Text(
            text = value,
            style = MaterialTheme.typography.titleMedium,
            fontWeight = FontWeight.Bold,
            color = color
        )
        Text(
            text = title,
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )
    }
}

@Composable
fun StatusBadge(isCompliant: Boolean) {
    Surface(
        color = if (isCompliant) Color(0xFF4CAF50) else Color(0xFFF44336),
        shape = RoundedCornerShape(16.dp)
    ) {
        Row(
            modifier = Modifier.padding(horizontal = 12.dp, vertical = 6.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Icon(
                imageVector = if (isCompliant) Icons.Default.CheckCircle else Icons.Default.Cancel,
                contentDescription = null,
                tint = Color.White,
                modifier = Modifier.size(14.dp)
            )
            Spacer(modifier = Modifier.width(4.dp))
            Text(
                text = if (isCompliant) "Conforme" else "No Conforme",
                style = MaterialTheme.typography.labelSmall,
                fontWeight = FontWeight.Bold,
                color = Color.White
            )
        }
    }
}

// MARK: - Temperature Chart Card

@Composable
fun TemperatureChartCard(data: TemperatureChartData) {
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
                    text = "Últimas 24 horas",
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Bold
                )
            }

            Spacer(modifier = Modifier.height(16.dp))

            // Simple chart representation
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(120.dp)
                    .background(
                        color = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.3f),
                        shape = RoundedCornerShape(8.dp)
                    )
            ) {
                // Threshold zone
                val minPercent = ((data.thresholdMin + 10) / 40).coerceIn(0.0, 1.0)
                val maxPercent = ((data.thresholdMax + 10) / 40).coerceIn(0.0, 1.0)

                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .fillMaxHeight((maxPercent - minPercent).toFloat())
                        .align(Alignment.BottomStart)
                        .padding(bottom = (minPercent * 120).dp)
                        .background(Color(0xFF4CAF50).copy(alpha = 0.1f))
                )

                // Chart placeholder text
                Column(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(16.dp),
                    verticalArrangement = Arrangement.Center,
                    horizontalAlignment = Alignment.CenterHorizontally
                ) {
                    Text(
                        text = "${data.values.size} puntos de datos",
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                    if (data.outOfRangeIndices.isNotEmpty()) {
                        Text(
                            text = "${data.outOfRangeIndices.size} fuera de rango",
                            style = MaterialTheme.typography.bodySmall,
                            color = Color(0xFFF44336)
                        )
                    }
                }
            }

            Spacer(modifier = Modifier.height(12.dp))

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceEvenly
            ) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Box(
                        modifier = Modifier
                            .size(8.dp)
                            .background(Color(0xFF2196F3), CircleShape)
                    )
                    Spacer(modifier = Modifier.width(4.dp))
                    Text(
                        text = "Normal",
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Box(
                        modifier = Modifier
                            .size(8.dp)
                            .background(Color(0xFFF44336), CircleShape)
                    )
                    Spacer(modifier = Modifier.width(4.dp))
                    Text(
                        text = "Fuera de rango",
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Box(
                        modifier = Modifier
                            .size(width = 16.dp, height = 8.dp)
                            .background(Color(0xFF4CAF50).copy(alpha = 0.3f), RoundedCornerShape(2.dp))
                    )
                    Spacer(modifier = Modifier.width(4.dp))
                    Text(
                        text = "Rango aceptable",
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            }
        }
    }
}

// MARK: - Compliance Card

@Composable
fun ComplianceCard(compliance: ComplianceResult) {
    val scoreColor = when {
        compliance.complianceScore >= 90 -> Color(0xFF4CAF50)
        compliance.complianceScore >= 70 -> Color(0xFFFF9800)
        else -> Color(0xFFF44336)
    }

    Card(modifier = Modifier.fillMaxWidth()) {
        Column(modifier = Modifier.padding(16.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(
                    imageVector = Icons.Default.VerifiedUser,
                    contentDescription = null,
                    tint = Color(0xFF9C27B0)
                )
                Spacer(modifier = Modifier.width(8.dp))
                Text(
                    text = "Cumplimiento Cadena de Frío",
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Bold
                )
            }

            Spacer(modifier = Modifier.height(16.dp))

            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically
            ) {
                // Circular progress
                Box(
                    modifier = Modifier.size(80.dp),
                    contentAlignment = Alignment.Center
                ) {
                    CircularProgressIndicator(
                        progress = { compliance.complianceScore / 100f },
                        modifier = Modifier.fillMaxSize(),
                        color = scoreColor,
                        trackColor = scoreColor.copy(alpha = 0.2f),
                        strokeWidth = 8.dp
                    )
                    Text(
                        text = "${compliance.complianceScore}",
                        style = MaterialTheme.typography.titleLarge,
                        fontWeight = FontWeight.Bold
                    )
                }

                Spacer(modifier = Modifier.width(16.dp))

                Column {
                    Text(
                        text = "${compliance.complianceScore}%",
                        style = MaterialTheme.typography.headlineMedium,
                        fontWeight = FontWeight.Bold,
                        color = scoreColor
                    )
                    Text(
                        text = if (compliance.isCompliant) "Cadena de frío intacta" else "Se detectaron problemas",
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            }

            if (compliance.recommendations.isNotEmpty()) {
                Spacer(modifier = Modifier.height(16.dp))
                HorizontalDivider()
                Spacer(modifier = Modifier.height(16.dp))

                Text(
                    text = "Recomendaciones",
                    style = MaterialTheme.typography.titleSmall,
                    fontWeight = FontWeight.Bold
                )

                Spacer(modifier = Modifier.height(8.dp))

                compliance.recommendations.forEach { recommendation ->
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
                            text = recommendation,
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                }
            }
        }
    }
}

// MARK: - Reading Row

@Composable
fun ReadingRow(reading: TemperatureReading) {
    val dateFormat = remember { SimpleDateFormat("dd/MM/yyyy", Locale.getDefault()) }
    val timeFormat = remember { SimpleDateFormat("HH:mm", Locale.getDefault()) }

    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f)
        )
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(12.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Column {
                Text(
                    text = dateFormat.format(reading.timestamp),
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
                Text(
                    text = timeFormat.format(reading.timestamp),
                    style = MaterialTheme.typography.bodyMedium
                )
            }

            Row(verticalAlignment = Alignment.CenterVertically) {
                reading.humidity?.let { humidity ->
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        modifier = Modifier.padding(end = 16.dp)
                    ) {
                        Icon(
                            imageVector = Icons.Default.WaterDrop,
                            contentDescription = null,
                            tint = Color(0xFF00BCD4),
                            modifier = Modifier.size(14.dp)
                        )
                        Text(
                            text = "${humidity.toInt()}%",
                            style = MaterialTheme.typography.bodySmall
                        )
                    }
                }

                Text(
                    text = "${String.format("%.1f", reading.value)}°C",
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Bold,
                    color = if (reading.isOutOfRange) Color(0xFFF44336) else MaterialTheme.colorScheme.onSurface
                )

                if (reading.isOutOfRange) {
                    Spacer(modifier = Modifier.width(8.dp))
                    Icon(
                        imageVector = Icons.Default.Warning,
                        contentDescription = null,
                        tint = Color(0xFFFF9800),
                        modifier = Modifier.size(16.dp)
                    )
                }
            }
        }
    }
}

// MARK: - Manual Entry Dialog

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ManualEntryDialog(
    onDismiss: () -> Unit,
    onConfirm: (temperature: Double, humidity: Double?) -> Unit
) {
    var temperature by remember { mutableStateOf("") }
    var humidity by remember { mutableStateOf("") }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Registrar Temperatura") },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(16.dp)) {
                OutlinedTextField(
                    value = temperature,
                    onValueChange = { temperature = it },
                    label = { Text("Temperatura (°C)") },
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth()
                )
                OutlinedTextField(
                    value = humidity,
                    onValueChange = { humidity = it },
                    label = { Text("Humedad (%) - Opcional") },
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth()
                )
            }
        },
        confirmButton = {
            TextButton(
                onClick = {
                    temperature.toDoubleOrNull()?.let { temp ->
                        onConfirm(temp, humidity.toDoubleOrNull())
                    }
                },
                enabled = temperature.toDoubleOrNull() != null
            ) {
                Text("Guardar")
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) {
                Text("Cancelar")
            }
        }
    )
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
            imageVector = Icons.Default.Error,
            contentDescription = null,
            modifier = Modifier.size(48.dp),
            tint = Color(0xFFF44336)
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
