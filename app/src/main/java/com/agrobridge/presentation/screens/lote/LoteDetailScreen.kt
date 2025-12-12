package com.agrobridge.presentation.screens.lote

import androidx.compose.animation.*
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import com.agrobridge.data.model.Lote
import com.agrobridge.data.model.Weather.WeatherData
import com.agrobridge.data.model.CropHealthAnalysis
import com.agrobridge.presentation.components.*
import com.agrobridge.presentation.model.UIState
import com.agrobridge.presentation.screens.lote.LoteDetailViewModel
import com.agrobridge.presentation.theme.*
import java.text.SimpleDateFormat
import java.util.*

/**
 * LoteDetailScreen - Detalle completo de un lote
 * Incluye info, clima, y análisis de salud
 *
 * Integrado con LoteDetailViewModel para:
 * - Cargar datos reales del lote desde repository
 * - Manejar edición con offline-first sync
 * - Persistir estado en config changes
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun LoteDetailScreen(
    loteId: String,
    onNavigateBack: () -> Unit = {},
    onNavigateToMap: () -> Unit = {},
    onNavigateToWeather: () -> Unit = {},
    onNavigateToScanner: () -> Unit = {},
    viewModel: LoteDetailViewModel = hiltViewModel()
) {
    // Observar estado del ViewModel
    val loteState by viewModel.loteState.collectAsState()

    // Datos simulados de clima y análisis (estos vendrían de su propio ViewModel)
    var weather by remember { mutableStateOf<WeatherData?>(null) }
    var healthAnalysis by remember { mutableStateOf<CropHealthAnalysis?>(null) }

    // Cargar datos cuando la pantalla se monta
    LaunchedEffect(loteId) {
        viewModel.loadLote(loteId)
        // Cargar datos complementarios (clima, salud)
        weather = WeatherData.mock()
        healthAnalysis = CropHealthAnalysis.mockSaludable()
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    val loteTitle = when (loteState) {
                        is UIState.Success -> (loteState as UIState.Success<Lote>).data.nombre
                        else -> "Cargando..."
                    }
                    Text(
                        text = loteTitle,
                        fontWeight = FontWeight.Bold
                    )
                },
                navigationIcon = {
                    IconButton(onClick = onNavigateBack) {
                        Icon(
                            imageVector = Icons.Default.ArrowBack,
                            contentDescription = "Volver"
                        )
                    }
                },
                actions = {
                    IconButton(onClick = { /* TODO: Editar */ }) {
                        Icon(
                            imageVector = Icons.Default.Edit,
                            contentDescription = "Editar"
                        )
                    }
                    IconButton(onClick = { /* TODO: Más opciones */ }) {
                        Icon(
                            imageVector = Icons.Default.MoreVert,
                            contentDescription = "Más opciones"
                        )
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = {
                        when (loteState) {
                            is UIState.Success -> (loteState as UIState.Success<Lote>).data.mapColor
                            else -> AgroGreen
                        }
                    }.invoke(),
                    titleContentColor = Color.White,
                    navigationIconContentColor = Color.White,
                    actionIconContentColor = Color.White
                )
            )
        }
    ) { paddingValues ->
        when (loteState) {
            is UIState.Loading -> {
                LoadingState(message = "Cargando detalles del lote...")
            }
            is UIState.Error -> {
                ErrorState(
                    message = (loteState as UIState.Error).message,
                    onRetry = { viewModel.retry(loteId) }
                )
            }
            is UIState.Success -> {
                val lote = (loteState as UIState.Success<Lote>).data
                LoteDetailContent(
                    lote = lote,
                    weather = weather,
                    healthAnalysis = healthAnalysis,
                    onNavigateToMap = onNavigateToMap,
                    onNavigateToWeather = onNavigateToWeather,
                    onNavigateToScanner = onNavigateToScanner,
                    modifier = Modifier.padding(paddingValues)
                )
            }
            else -> {} // Idle state
        }
    }
}

@Composable
private fun LoteDetailContent(
    lote: Lote,
    weather: WeatherData?,
    healthAnalysis: CropHealthAnalysis?,
    onNavigateToMap: () -> Unit,
    onNavigateToWeather: () -> Unit,
    onNavigateToScanner: () -> Unit,
    modifier: Modifier = Modifier
) {
    LazyColumn(
        modifier = modifier.fillMaxSize(),
        contentPadding = PaddingValues(vertical = Spacing.spacing16),
        verticalArrangement = Arrangement.spacedBy(Spacing.spacing16)
    ) {
        // Header con información principal
        item {
            LoteHeader(lote = lote)
        }

        // Métricas clave
        item {
            KeyMetrics(lote = lote)
        }

        // Información del productor
        item {
            ProductorSection(productor = lote.productor)
        }

        // Clima actual
        if (weather != null) {
            item {
                WeatherSection(
                    weather = weather,
                    onNavigateToWeather = onNavigateToWeather
                )
            }
        }

        // Salud del cultivo
        if (healthAnalysis != null) {
            item {
                HealthSection(
                    analysis = healthAnalysis,
                    onNavigateToScanner = onNavigateToScanner
                )
            }
        }

        // Acciones rápidas
        item {
            QuickActions(
                onNavigateToMap = onNavigateToMap,
                onNavigateToWeather = onNavigateToWeather,
                onNavigateToScanner = onNavigateToScanner
            )
        }
    }
}

/**
 * Header con info principal del lote
 */
@Composable
private fun LoteHeader(lote: Lote) {
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = Spacing.spacing16),
        colors = CardDefaults.cardColors(
            containerColor = lote.mapColor.copy(alpha = 0.1f)
        )
    ) {
        Row(
            modifier = Modifier.padding(Spacing.spacing20),
            verticalAlignment = Alignment.CenterVertically
        ) {
            // Emoji grande del cultivo
            Box(
                modifier = Modifier
                    .size(80.dp)
                    .clip(CircleShape)
                    .background(lote.mapColor.copy(alpha = 0.2f)),
                contentAlignment = Alignment.Center
            ) {
                Text(
                    text = lote.cultivoEmoji,
                    style = MaterialTheme.typography.displayLarge
                )
            }

            Spacer(modifier = Modifier.width(Spacing.spacing20))

            Column {
                Text(
                    text = lote.cultivo,
                    style = MaterialTheme.typography.headlineMedium,
                    fontWeight = FontWeight.Bold
                )
                Spacer(modifier = Modifier.height(Spacing.spacing4))
                StatusBadge(
                    text = lote.estado.displayName,
                    color = lote.mapColor
                )
            }
        }
    }
}

/**
 * Métricas clave
 */
@Composable
private fun KeyMetrics(lote: Lote) {
    Column(
        modifier = Modifier.padding(horizontal = Spacing.spacing16)
    ) {
        Text(
            text = "Información General",
            style = MaterialTheme.typography.titleLarge,
            fontWeight = FontWeight.Bold
        )
        Spacer(modifier = Modifier.height(Spacing.spacing12))

        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(Spacing.spacing12)
        ) {
            InfoCard(
                icon = Icons.Default.Landscape,
                label = "Área",
                value = "${lote.area} ha",
                modifier = Modifier.weight(1f)
            )
            InfoCard(
                icon = Icons.Default.LocationOn,
                label = "Ubicación",
                value = if (lote.hasValidGPS) "GPS" else "No definida",
                modifier = Modifier.weight(1f),
                color = if (lote.hasValidGPS) Success else Warning
            )
        }

        Spacer(modifier = Modifier.height(Spacing.spacing12))

        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(Spacing.spacing12)
        ) {
            InfoCard(
                icon = Icons.Default.CalendarToday,
                label = "Creado",
                value = SimpleDateFormat("dd MMM yyyy", Locale("es", "ES"))
                    .format(Date(lote.fechaCreacion)),
                modifier = Modifier.weight(1f)
            )
            lote.areaCalculada?.let { area ->
                InfoCard(
                    icon = Icons.Default.Calculate,
                    label = "Área calculada",
                    value = "%.2f ha".format(area),
                    modifier = Modifier.weight(1f),
                    color = Info
                )
            }
        }
    }
}

/**
 * Card de información
 */
@Composable
private fun InfoCard(
    icon: ImageVector,
    label: String,
    value: String,
    modifier: Modifier = Modifier,
    color: Color = AgroGreen
) {
    Card(
        modifier = modifier,
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.surfaceVariant
        )
    ) {
        Column(
            modifier = Modifier.padding(Spacing.spacing16)
        ) {
            Icon(
                imageVector = icon,
                contentDescription = null,
                tint = color,
                modifier = Modifier.size(IconSize.medium)
            )
            Spacer(modifier = Modifier.height(Spacing.spacing8))
            Text(
                text = label,
                style = MaterialTheme.typography.labelMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
            Text(
                text = value,
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.Bold
            )
        }
    }
}

/**
 * Sección del productor
 */
@Composable
private fun ProductorSection(productor: com.agrobridge.data.model.Productor) {
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = Spacing.spacing16)
    ) {
        Column(
            modifier = Modifier.padding(Spacing.spacing16)
        ) {
            Row(
                verticalAlignment = Alignment.CenterVertically
            ) {
                Icon(
                    imageVector = Icons.Default.Person,
                    contentDescription = null,
                    modifier = Modifier.size(IconSize.large),
                    tint = AgroGreen
                )
                Spacer(modifier = Modifier.width(Spacing.spacing12))
                Column {
                    Text(
                        text = "Productor",
                        style = MaterialTheme.typography.labelMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                    Text(
                        text = productor.nombreCompleto,
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.Bold
                    )
                }
            }

            if (productor.email != null) {
                Spacer(modifier = Modifier.height(Spacing.spacing12))
                Divider()
                Spacer(modifier = Modifier.height(Spacing.spacing12))
                DetailRow(label = "Email", value = productor.email)
            }
            if (productor.telefono != null) {
                Spacer(modifier = Modifier.height(Spacing.spacing8))
                DetailRow(label = "Teléfono", value = productor.telefono)
            }
        }
    }
}

@Composable
private fun DetailRow(label: String, value: String) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.SpaceBetween
    ) {
        Text(
            text = label,
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )
        Text(
            text = value,
            style = MaterialTheme.typography.bodyMedium,
            fontWeight = FontWeight.Medium
        )
    }
}

/**
 * Sección de clima
 */
@Composable
private fun WeatherSection(
    weather: WeatherData,
    onNavigateToWeather: () -> Unit
) {
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = Spacing.spacing16)
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
                    text = "Clima Actual",
                    style = MaterialTheme.typography.titleLarge,
                    fontWeight = FontWeight.Bold
                )
                AgroBridgeTextButton(
                    text = "Ver más",
                    onClick = onNavigateToWeather
                )
            }

            Spacer(modifier = Modifier.height(Spacing.spacing16))

            Row(
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = weather.weatherEmoji,
                    style = MaterialTheme.typography.displayLarge
                )
                Spacer(modifier = Modifier.width(Spacing.spacing16))
                Column {
                    Text(
                        text = weather.temperaturaFormatted,
                        style = MaterialTheme.typography.headlineLarge,
                        fontWeight = FontWeight.Bold
                    )
                    Text(
                        text = weather.descripcion,
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            }

            Spacer(modifier = Modifier.height(Spacing.spacing16))
            Divider()
            Spacer(modifier = Modifier.height(Spacing.spacing16))

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceAround
            ) {
                WeatherMetric(
                    icon = Icons.Default.Air,
                    label = "Viento",
                    value = "${weather.velocidadViento} m/s"
                )
                WeatherMetric(
                    icon = Icons.Default.WaterDrop,
                    label = "Humedad",
                    value = "${weather.humedad}%"
                )
                WeatherMetric(
                    icon = Icons.Default.Visibility,
                    label = "Visibilidad",
                    value = "${weather.visibilidad / 1000} km"
                )
            }
        }
    }
}

@Composable
private fun WeatherMetric(
    icon: ImageVector,
    label: String,
    value: String
) {
    Column(
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Icon(
            imageVector = icon,
            contentDescription = null,
            tint = Info,
            modifier = Modifier.size(IconSize.medium)
        )
        Spacer(modifier = Modifier.height(Spacing.spacing4))
        Text(
            text = value,
            style = MaterialTheme.typography.titleMedium,
            fontWeight = FontWeight.Bold
        )
        Text(
            text = label,
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )
    }
}

/**
 * Sección de salud del cultivo
 */
@Composable
private fun HealthSection(
    analysis: CropHealthAnalysis,
    onNavigateToScanner: () -> Unit
) {
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = Spacing.spacing16),
        colors = CardDefaults.cardColors(
            containerColor = analysis.diagnosticoColor.copy(alpha = 0.1f)
        )
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
                    text = "Salud del Cultivo",
                    style = MaterialTheme.typography.titleLarge,
                    fontWeight = FontWeight.Bold
                )
                AgroBridgeTextButton(
                    text = "Escanear",
                    onClick = onNavigateToScanner
                )
            }

            Spacer(modifier = Modifier.height(Spacing.spacing16))

            Row(
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = analysis.diagnosticoEmoji,
                    style = MaterialTheme.typography.displayMedium
                )
                Spacer(modifier = Modifier.width(Spacing.spacing16))
                Column {
                    Text(
                        text = analysis.diagnostico.displayName,
                        style = MaterialTheme.typography.titleLarge,
                        fontWeight = FontWeight.Bold
                    )
                    Text(
                        text = "Confianza: ${analysis.confianzaFormatted}",
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            }

            Spacer(modifier = Modifier.height(Spacing.spacing12))

            Text(
                text = analysis.resumen,
                style = MaterialTheme.typography.bodyMedium
            )
        }
    }
}

/**
 * Acciones rápidas
 */
@Composable
private fun QuickActions(
    onNavigateToMap: () -> Unit,
    onNavigateToWeather: () -> Unit,
    onNavigateToScanner: () -> Unit
) {
    Column(
        modifier = Modifier.padding(horizontal = Spacing.spacing16)
    ) {
        Text(
            text = "Acciones",
            style = MaterialTheme.typography.titleLarge,
            fontWeight = FontWeight.Bold
        )
        Spacer(modifier = Modifier.height(Spacing.spacing12))

        AgroBridgePrimaryButton(
            text = "Ver en Mapa",
            onClick = onNavigateToMap,
            icon = Icons.Default.Map
        )

        Spacer(modifier = Modifier.height(Spacing.spacing8))

        AgroBridgeSecondaryButton(
            text = "Pronóstico Extendido",
            onClick = onNavigateToWeather,
            icon = Icons.Default.WbSunny
        )
    }
}
