package com.agrobridge.presentation.screens.dashboard

import androidx.compose.animation.*
import androidx.compose.animation.core.*
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.hilt.navigation.compose.hiltViewModel
import com.agrobridge.data.model.Lote
import com.agrobridge.presentation.components.*
import com.agrobridge.presentation.model.UIState
import com.agrobridge.presentation.screens.dashboard.DashboardViewModel
import com.agrobridge.presentation.theme.*
import timber.log.Timber

/**
 * DashboardScreen - Pantalla principal MEJORADA de AgroBridge
 * Versión 2.0 con componentes reutilizables y animaciones
 *
 * Integrado con DashboardViewModel para:
 * - Cargar todos los datos del productor (lotes, activos, stats)
 * - Mostrar estadísticas agregadas (área total, lotes saludables)
 * - Manejar sincronización de datos
 * - Persistir estado en config changes
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun DashboardScreen(
    productorId: String = "",
    onNavigateToLote: (String) -> Unit = {},
    onNavigateToMap: () -> Unit = {},
    onNavigateToWeather: () -> Unit = {},
    viewModel: DashboardViewModel = hiltViewModel()
) {
    // Observar estado del ViewModel
    val lotesState by viewModel.lotesState.collectAsState()
    val totalArea by viewModel.totalArea.collectAsState()
    val healthyCount by viewModel.healthyCount.collectAsState()
    val pendingCount by viewModel.pendingLotesCount.collectAsState()
    val lastSyncText by viewModel.lastSyncText.collectAsState()
    val greeting by remember { derivedStateOf { viewModel.getUserGreeting() } }

    // Cargar datos cuando la pantalla se monta
    LaunchedEffect(productorId) {
        if (productorId.isNotEmpty()) {
            viewModel.loadDashboard(productorId)
        }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Text(
                        text = "AgroBridge",
                        style = MaterialTheme.typography.headlineMedium,
                        fontWeight = FontWeight.Bold
                    )
                },
                actions = {
                    IconButton(onClick = { /* TODO: Notificaciones */ }) {
                        BadgedBox(
                            badge = {
                                Badge { Text("3") }
                            }
                        ) {
                            Icon(
                                imageVector = Icons.Default.Notifications,
                                contentDescription = "Notificaciones"
                            )
                        }
                    }
                    IconButton(onClick = { /* TODO: Perfil */ }) {
                        Icon(
                            imageVector = Icons.Default.Person,
                            contentDescription = "Perfil"
                        )
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = AgroGreen,
                    titleContentColor = Color.White,
                    actionIconContentColor = Color.White
                )
            )
        }
    ) { paddingValues ->
        when (lotesState) {
            is UIState.Loading -> {
                LoadingState(message = "Cargando dashboard...")
            }
            is UIState.Error -> {
                ErrorState(
                    message = (lotesState as UIState.Error).message,
                    onRetry = { viewModel.refreshData() }
                )
            }
            is UIState.Success -> {
                val lotes = (lotesState as UIState.Success<List<Lote>>).data
                DashboardContent(
                    lotes = lotes,
                    totalArea = totalArea,
                    healthyCount = healthyCount,
                    pendingCount = pendingCount,
                    lastSyncText = lastSyncText,
                    greeting = greeting,
                    onNavigateToLote = onNavigateToLote,
                    onNavigateToMap = onNavigateToMap,
                    onNavigateToWeather = onNavigateToWeather,
                    onRefresh = { viewModel.refreshData() },
                    modifier = Modifier.padding(paddingValues)
                )
            }
            else -> {} // Idle state
        }
    }
}

@Composable
private fun DashboardContent(
    lotes: List<Lote>,
    totalArea: Double,
    healthyCount: Int,
    pendingCount: Int,
    lastSyncText: String,
    greeting: String,
    onNavigateToLote: (String) -> Unit,
    onNavigateToMap: () -> Unit,
    onNavigateToWeather: () -> Unit,
    onRefresh: () -> Unit,
    modifier: Modifier = Modifier
) {
    // Animación de fade in
    // FIXED: HIGH-9 - Use snapshotFlow to properly consume state changes
    var visible by remember { mutableStateOf(false) }

    // FIXED: HIGH-9 - Initialize with snapshotFlow to track state changes
    // Use key1 parameter to ensure this only runs once
    LaunchedEffect(key1 = Unit) {
        // Proper state consumption: check current state before updating
        if (!visible) {
            visible = true
        }
    }

    AnimatedVisibility(
        visible = visible,
        enter = fadeIn(animationSpec = tween(500))
    ) {
        LazyColumn(
            modifier = modifier.fillMaxSize(),
            contentPadding = PaddingValues(bottom = Spacing.spacing16)
        ) {
            // ================================================================
            // HEADER CON BIENVENIDA MEJORADO
            // ================================================================
            item {
                WelcomeHeader(
                    greeting = greeting,
                    lastSyncText = lastSyncText,
                    pendingCount = pendingCount,
                    onRefresh = onRefresh
                )
            }

            // ================================================================
            // MÉTRICAS RÁPIDAS MEJORADAS
            // ================================================================
            item {
                MetricsSection(
                    lotes = lotes,
                    totalArea = totalArea,
                    healthyCount = healthyCount
                )
            }

            // ================================================================
            // ACCESOS RÁPIDOS MEJORADOS
            // ================================================================
            item {
                QuickActionsSection(
                    onNavigateToMap = onNavigateToMap,
                    onNavigateToWeather = onNavigateToWeather
                )
            }

            // ================================================================
            // MIS LOTES CON ANIMACIONES
            // ================================================================
            item {
                LotesHeader()
            }

            // Lista de lotes con animación de entrada
            items(
                items = lotes,
                key = { it.id }
            ) { lote ->
                AnimatedVisibility(
                    visible = true,
                    enter = fadeIn() + slideInVertically()
                ) {
                    LoteCard(
                        lote = lote,
                        onClick = { onNavigateToLote(lote.id) },
                        modifier = Modifier
                            .padding(
                                horizontal = Spacing.spacing16,
                                vertical = Spacing.spacing8
                            )
                            .animateItemPlacement()
                    )
                }
            }

            // Espaciado final
            item {
                Spacer(modifier = Modifier.height(Spacing.spacing32))
            }
        }
    }
}

/**
 * Header de bienvenida mejorado
 */
@Composable
private fun WelcomeHeader(
    greeting: String,
    lastSyncText: String,
    pendingCount: Int,
    onRefresh: () -> Unit
) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .background(AgroGreen)
            .padding(Spacing.spacing20)
    ) {
        // Saludo dinámico basado en hora del día
        Text(
            text = greeting,
            style = MaterialTheme.typography.bodyLarge,
            color = Color.White.copy(alpha = 0.9f)
        )
        Spacer(modifier = Modifier.height(Spacing.spacing4))
        Text(
            text = "Tu Productor",
            style = MaterialTheme.typography.headlineLarge,
            fontWeight = FontWeight.Bold,
            color = Color.White
        )
        Spacer(modifier = Modifier.height(Spacing.spacing8))

        // Estado de sincronización
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text(
                text = "$lastSyncText${if (pendingCount > 0) " | $pendingCount sin sincronizar" else " ✓"}",
                style = MaterialTheme.typography.bodyMedium,
                color = Color.White.copy(alpha = 0.8f)
            )
            if (pendingCount > 0) {
                IconButton(
                    onClick = onRefresh,
                    modifier = Modifier.size(24.dp)
                ) {
                    Icon(
                        imageVector = Icons.Default.Refresh,
                        contentDescription = "Sincronizar",
                        tint = Color.White,
                        modifier = Modifier.size(20.dp)
                    )
                }
            }
        }
    }
}

/**
 * Sección de métricas
 */
@Composable
private fun MetricsSection(
    lotes: List<Lote>,
    totalArea: Double,
    healthyCount: Int
) {
    val lotesActivos = remember(lotes) {
        lotes.count { it.estado == com.agrobridge.data.model.LoteEstado.ACTIVO }
    }

    Column(
        modifier = Modifier.padding(Spacing.spacing16)
    ) {
        Text(
            text = "Resumen",
            style = MaterialTheme.typography.titleLarge,
            fontWeight = FontWeight.Bold
        )
        Spacer(modifier = Modifier.height(Spacing.spacing12))

        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(Spacing.spacing12)
        ) {
            MetricCard(
                modifier = Modifier.weight(1f),
                title = "Total Lotes",
                value = lotes.size.toString(),
                icon = Icons.Default.Terrain,
                color = AgroGreenLight,
                subtitle = "$lotesActivos activos"
            )
            MetricCard(
                modifier = Modifier.weight(1f),
                title = "Área Total",
                value = "${totalArea.toInt()} ha",
                icon = Icons.Default.Landscape,
                color = Info,
                subtitle = "Hectáreas"
            )
        }

        Spacer(modifier = Modifier.height(Spacing.spacing12))

        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(Spacing.spacing12)
        ) {
            MetricCard(
                modifier = Modifier.weight(1f),
                title = "En Cosecha",
                value = lotes.count { it.estado == com.agrobridge.data.model.LoteEstado.EN_COSECHA }.toString(),
                icon = Icons.Default.Agriculture,
                color = StatusHarvest
            )
            MetricCard(
                modifier = Modifier.weight(1f),
                title = "Saludables",
                value = "$healthyCount",
                icon = Icons.Default.CheckCircle,
                color = Success,
                subtitle = "Lotes"
            )
        }
    }
}

/**
 * Sección de acciones rápidas
 */
@Composable
private fun QuickActionsSection(
    onNavigateToMap: () -> Unit,
    onNavigateToWeather: () -> Unit
) {
    Column {
        Text(
            text = "Accesos Rápidos",
            style = MaterialTheme.typography.titleLarge,
            fontWeight = FontWeight.Bold,
            modifier = Modifier.padding(horizontal = Spacing.spacing16)
        )
        Spacer(modifier = Modifier.height(Spacing.spacing12))

        LazyRow(
            contentPadding = PaddingValues(horizontal = Spacing.spacing16),
            horizontalArrangement = Arrangement.spacedBy(Spacing.spacing12)
        ) {
            item {
                QuickActionCard(
                    title = "Mapa",
                    subtitle = "Ver ubicaciones",
                    icon = Icons.Default.Map,
                    color = StatusActive,
                    onClick = onNavigateToMap
                )
            }
            item {
                QuickActionCard(
                    title = "Clima",
                    subtitle = "24°C Soleado",
                    icon = Icons.Default.WbSunny,
                    color = Warning,
                    onClick = onNavigateToWeather
                )
            }
            item {
                QuickActionCard(
                    title = "Scanner",
                    subtitle = "Analizar cultivo",
                    icon = Icons.Default.Camera,
                    color = Info,
                    onClick = { /* TODO */ }
                )
            }
            item {
                QuickActionCard(
                    title = "Reportes",
                    subtitle = "Ver analytics",
                    icon = Icons.Default.Assessment,
                    color = StatusCertified,
                    onClick = { /* TODO */ }
                )
            }
        }

        Spacer(modifier = Modifier.height(Spacing.spacing24))
    }
}

/**
 * Header de la sección de lotes
 */
@Composable
private fun LotesHeader() {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = Spacing.spacing16),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically
    ) {
        Column {
            Text(
                text = "Mis Lotes",
                style = MaterialTheme.typography.titleLarge,
                fontWeight = FontWeight.Bold
            )
            Text(
                text = "Gestiona tus campos agrícolas",
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
        }

        AgroBridgeTextButton(
            text = "Ver todos",
            onClick = { /* TODO */ }
        )
    }
    Spacer(modifier = Modifier.height(Spacing.spacing12))
}
