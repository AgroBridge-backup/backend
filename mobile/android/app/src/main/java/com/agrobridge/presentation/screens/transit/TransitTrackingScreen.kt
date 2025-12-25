/**
 * Traceability 2.0 - Real-Time Transit Tracking
 * Android Compose UI
 */

package com.agrobridge.presentation.screens.transit

import android.Manifest
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
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
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import com.google.accompanist.permissions.ExperimentalPermissionsApi
import com.google.accompanist.permissions.rememberMultiplePermissionsState
import java.text.SimpleDateFormat
import java.util.*

// MARK: - Models

enum class TransitStatus(
    val displayName: String,
    val color: Long,
    val icon: String
) {
    SCHEDULED("Programado", 0xFF9E9E9E, "schedule"),
    IN_TRANSIT("En tránsito", 0xFF2196F3, "local_shipping"),
    PAUSED("Pausado", 0xFFFF9800, "pause"),
    DELAYED("Retrasado", 0xFFF44336, "warning"),
    COMPLETED("Completado", 0xFF4CAF50, "check_circle"),
    CANCELLED("Cancelado", 0xFF795548, "cancel");

    fun getComposeColor(): Color = Color(color)
}

data class TransitSession(
    val id: String,
    val batchId: String,
    val status: TransitStatus,
    val driverId: String,
    val vehicleId: String?,
    val originName: String,
    val originLat: Double,
    val originLng: Double,
    val destinationName: String,
    val destinationLat: Double,
    val destinationLng: Double,
    val scheduledDeparture: Date?,
    val actualDeparture: Date?,
    val estimatedArrival: Date?,
    val totalDistanceKm: Double?,
    val distanceTraveledKm: Double?,
    val progressPercent: Int = 0
)

// MARK: - Screen

@OptIn(ExperimentalMaterial3Api::class, ExperimentalPermissionsApi::class)
@Composable
fun TransitTrackingScreen(
    viewModel: TransitTrackingViewModel = hiltViewModel(),
    onNavigateBack: () -> Unit = {}
) {
    val uiState by viewModel.uiState.collectAsState()

    val locationPermissions = rememberMultiplePermissionsState(
        permissions = listOf(
            Manifest.permission.ACCESS_FINE_LOCATION,
            Manifest.permission.ACCESS_COARSE_LOCATION
        )
    )

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Tránsito") },
                navigationIcon = {
                    IconButton(onClick = onNavigateBack) {
                        Icon(Icons.Default.ArrowBack, contentDescription = "Volver")
                    }
                },
                actions = {
                    if (uiState.activeSession != null) {
                        IconButton(onClick = { /* Open map */ }) {
                            Icon(Icons.Default.Map, contentDescription = "Ver mapa")
                        }
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
                uiState.isLoading -> {
                    CircularProgressIndicator(modifier = Modifier.align(Alignment.Center))
                }
                uiState.activeSession != null -> {
                    ActiveTransitContent(
                        session = uiState.activeSession!!,
                        isTracking = uiState.isTracking,
                        onStartTransit = {
                            if (locationPermissions.allPermissionsGranted) {
                                viewModel.startTransit()
                            } else {
                                locationPermissions.launchMultiplePermissionRequest()
                            }
                        },
                        onCompleteTransit = { viewModel.completeTransit() }
                    )
                }
                uiState.sessions.isEmpty() -> {
                    EmptyTransitContent(modifier = Modifier.align(Alignment.Center))
                }
                else -> {
                    TransitHistoryList(sessions = uiState.sessions)
                }
            }
        }
    }
}

@Composable
fun ActiveTransitContent(
    session: TransitSession,
    isTracking: Boolean,
    onStartTransit: () -> Unit,
    onCompleteTransit: () -> Unit
) {
    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        // Status Card
        item {
            TransitStatusCard(session = session)
        }

        // Progress
        item {
            if (session.totalDistanceKm != null && session.totalDistanceKm > 0) {
                ProgressCard(
                    progress = session.progressPercent,
                    distanceTraveled = session.distanceTraveledKm ?: 0.0,
                    totalDistance = session.totalDistanceKm
                )
            }
        }

        // Route Info
        item {
            RouteInfoCard(session = session)
        }

        // ETA
        item {
            session.estimatedArrival?.let { eta ->
                ETACard(eta = eta)
            }
        }

        // Actions
        item {
            TransitActionButtons(
                status = session.status,
                isTracking = isTracking,
                onStartTransit = onStartTransit,
                onCompleteTransit = onCompleteTransit
            )
        }
    }
}

@Composable
fun TransitStatusCard(session: TransitSession) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(
            containerColor = session.status.getComposeColor().copy(alpha = 0.1f)
        )
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(24.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Box(
                modifier = Modifier
                    .size(80.dp)
                    .clip(CircleShape)
                    .background(session.status.getComposeColor().copy(alpha = 0.2f)),
                contentAlignment = Alignment.Center
            ) {
                Icon(
                    imageVector = when (session.status) {
                        TransitStatus.SCHEDULED -> Icons.Default.Schedule
                        TransitStatus.IN_TRANSIT -> Icons.Default.LocalShipping
                        TransitStatus.PAUSED -> Icons.Default.Pause
                        TransitStatus.DELAYED -> Icons.Default.Warning
                        TransitStatus.COMPLETED -> Icons.Default.CheckCircle
                        TransitStatus.CANCELLED -> Icons.Default.Cancel
                    },
                    contentDescription = null,
                    tint = session.status.getComposeColor(),
                    modifier = Modifier.size(40.dp)
                )
            }

            Spacer(modifier = Modifier.height(16.dp))

            Text(
                text = session.status.displayName,
                style = MaterialTheme.typography.headlineSmall,
                fontWeight = FontWeight.Bold
            )
        }
    }
}

@Composable
fun ProgressCard(
    progress: Int,
    distanceTraveled: Double,
    totalDistance: Double
) {
    Card(modifier = Modifier.fillMaxWidth()) {
        Column(modifier = Modifier.padding(16.dp)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                Text(
                    text = "$progress% completado",
                    style = MaterialTheme.typography.bodyMedium,
                    fontWeight = FontWeight.Medium
                )
                Text(
                    text = String.format("%.1f / %.1f km", distanceTraveled, totalDistance),
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }

            Spacer(modifier = Modifier.height(8.dp))

            LinearProgressIndicator(
                progress = { progress / 100f },
                modifier = Modifier
                    .fillMaxWidth()
                    .height(8.dp)
                    .clip(RoundedCornerShape(4.dp)),
            )
        }
    }
}

@Composable
fun RouteInfoCard(session: TransitSession) {
    Card(modifier = Modifier.fillMaxWidth()) {
        Column(modifier = Modifier.padding(16.dp)) {
            // Origin
            Row(verticalAlignment = Alignment.Top) {
                Icon(
                    imageVector = Icons.Default.Circle,
                    contentDescription = null,
                    tint = Color(0xFF4CAF50),
                    modifier = Modifier.size(12.dp)
                )
                Spacer(modifier = Modifier.width(12.dp))
                Column {
                    Text(
                        text = "Origen",
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                    Text(
                        text = session.originName,
                        style = MaterialTheme.typography.bodyMedium,
                        fontWeight = FontWeight.Medium
                    )
                }
            }

            // Connector line
            Box(
                modifier = Modifier
                    .padding(start = 5.dp, top = 4.dp, bottom = 4.dp)
                    .width(2.dp)
                    .height(24.dp)
                    .background(MaterialTheme.colorScheme.outline.copy(alpha = 0.3f))
            )

            // Destination
            Row(verticalAlignment = Alignment.Top) {
                Icon(
                    imageVector = Icons.Default.LocationOn,
                    contentDescription = null,
                    tint = Color(0xFFF44336),
                    modifier = Modifier.size(12.dp)
                )
                Spacer(modifier = Modifier.width(12.dp))
                Column {
                    Text(
                        text = "Destino",
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                    Text(
                        text = session.destinationName,
                        style = MaterialTheme.typography.bodyMedium,
                        fontWeight = FontWeight.Medium
                    )
                }
            }
        }
    }
}

@Composable
fun ETACard(eta: Date) {
    val timeFormat = remember { SimpleDateFormat("HH:mm", Locale.getDefault()) }

    Card(modifier = Modifier.fillMaxWidth()) {
        Row(
            modifier = Modifier.padding(16.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Icon(
                imageVector = Icons.Default.AccessTime,
                contentDescription = null,
                tint = MaterialTheme.colorScheme.primary
            )
            Spacer(modifier = Modifier.width(12.dp))
            Text(
                text = "Llegada estimada:",
                style = MaterialTheme.typography.bodyMedium
            )
            Spacer(modifier = Modifier.weight(1f))
            Text(
                text = timeFormat.format(eta),
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.Bold,
                color = MaterialTheme.colorScheme.primary
            )
        }
    }
}

@Composable
fun TransitActionButtons(
    status: TransitStatus,
    isTracking: Boolean,
    onStartTransit: () -> Unit,
    onCompleteTransit: () -> Unit
) {
    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
        when (status) {
            TransitStatus.SCHEDULED -> {
                Button(
                    onClick = onStartTransit,
                    modifier = Modifier.fillMaxWidth(),
                    colors = ButtonDefaults.buttonColors(
                        containerColor = MaterialTheme.colorScheme.primary
                    )
                ) {
                    Icon(Icons.Default.PlayArrow, contentDescription = null)
                    Spacer(modifier = Modifier.width(8.dp))
                    Text("Iniciar tránsito")
                }
            }
            TransitStatus.IN_TRANSIT -> {
                Button(
                    onClick = onCompleteTransit,
                    modifier = Modifier.fillMaxWidth(),
                    colors = ButtonDefaults.buttonColors(
                        containerColor = Color(0xFF4CAF50)
                    )
                ) {
                    Icon(Icons.Default.Check, contentDescription = null)
                    Spacer(modifier = Modifier.width(8.dp))
                    Text("Completar entrega")
                }

                if (isTracking) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.Center,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Icon(
                            imageVector = Icons.Default.GpsFixed,
                            contentDescription = null,
                            tint = MaterialTheme.colorScheme.primary,
                            modifier = Modifier.size(16.dp)
                        )
                        Spacer(modifier = Modifier.width(4.dp))
                        Text(
                            text = "Rastreo GPS activo",
                            style = MaterialTheme.typography.labelMedium,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                }
            }
            else -> { /* No actions for other states */ }
        }
    }
}

@Composable
fun EmptyTransitContent(modifier: Modifier = Modifier) {
    Column(
        modifier = modifier.padding(32.dp),
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Icon(
            imageVector = Icons.Default.LocalShipping,
            contentDescription = null,
            modifier = Modifier.size(80.dp),
            tint = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.5f)
        )
        Spacer(modifier = Modifier.height(16.dp))
        Text(
            text = "Sin sesiones de tránsito",
            style = MaterialTheme.typography.titleLarge,
            fontWeight = FontWeight.SemiBold
        )
        Spacer(modifier = Modifier.height(8.dp))
        Text(
            text = "Crea una sesión desde la app de administración",
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )
    }
}

@Composable
fun TransitHistoryList(sessions: List<TransitSession>) {
    LazyColumn(
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        items(sessions, key = { it.id }) { session ->
            TransitSessionRow(session = session)
        }
    }
}

@Composable
fun TransitSessionRow(session: TransitSession) {
    Card(modifier = Modifier.fillMaxWidth()) {
        Row(
            modifier = Modifier.padding(16.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Icon(
                imageVector = when (session.status) {
                    TransitStatus.COMPLETED -> Icons.Default.CheckCircle
                    TransitStatus.CANCELLED -> Icons.Default.Cancel
                    else -> Icons.Default.LocalShipping
                },
                contentDescription = null,
                tint = session.status.getComposeColor(),
                modifier = Modifier.size(32.dp)
            )

            Spacer(modifier = Modifier.width(12.dp))

            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = "${session.originName} → ${session.destinationName}",
                    style = MaterialTheme.typography.bodyMedium,
                    fontWeight = FontWeight.Medium,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis
                )
                Text(
                    text = session.status.displayName,
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }

            session.totalDistanceKm?.let { distance ->
                Text(
                    text = String.format("%.0f km", distance),
                    style = MaterialTheme.typography.labelMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
        }
    }
}
