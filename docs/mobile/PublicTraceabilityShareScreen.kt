/**
 * AgroBridge Android - Public Traceability Share Screen
 * Jetpack Compose Implementation
 *
 * Features:
 * - Generate QR code for batch sharing
 * - View scan analytics dashboard
 * - Share via native share sheet
 * - Copy public link to clipboard
 * - Open public page in browser
 */

package io.agrobridge.app.ui.publictraceability

import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.content.Intent
import android.graphics.Bitmap
import android.net.Uri
import android.widget.Toast
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
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
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.google.accompanist.swiperefresh.SwipeRefresh
import com.google.accompanist.swiperefresh.rememberSwipeRefreshState
import com.google.zxing.BarcodeFormat
import com.google.zxing.EncodeHintType
import com.google.zxing.qrcode.QRCodeWriter
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.time.temporal.ChronoUnit
import javax.inject.Inject

// ============================================================================
// DATA MODELS
// ============================================================================

data class PublicLink(
    val id: String,
    val publicUrl: String,
    val shortCode: String,
    val qrImageUrl: String?,
    val viewCount: Int,
    val createdAt: Instant
)

data class ScanAnalytics(
    val shortCode: String,
    val batchId: String,
    val totalScans: Int,
    val uniqueCountries: Int,
    val scansByCountry: List<CountryScan>,
    val scansByDevice: List<DeviceScan>,
    val scansByDay: List<DailyScan>,
    val last30DaysScans: Int,
    val lastScanAt: Instant?
)

data class CountryScan(
    val country: String,
    val count: Int
)

data class DeviceScan(
    val device: String,
    val count: Int
)

data class DailyScan(
    val date: String,
    val count: Int
)

data class BatchInfo(
    val id: String,
    val product: String,
    val variety: String?,
    val farmerName: String,
    val region: String,
    val harvestDate: LocalDate,
    val status: String
)

data class PublicTraceabilityUiState(
    val isLoading: Boolean = false,
    val publicLink: PublicLink? = null,
    val analytics: ScanAnalytics? = null,
    val qrBitmap: Bitmap? = null,
    val error: String? = null
)

// ============================================================================
// QR CODE GENERATOR
// ============================================================================

object QRCodeGenerator {
    fun generate(content: String, size: Int = 512): Bitmap {
        val hints = mapOf(
            EncodeHintType.MARGIN to 1,
            EncodeHintType.ERROR_CORRECTION to com.google.zxing.qrcode.decoder.ErrorCorrectionLevel.M
        )

        val writer = QRCodeWriter()
        val bitMatrix = writer.encode(content, BarcodeFormat.QR_CODE, size, size, hints)

        val bitmap = Bitmap.createBitmap(size, size, Bitmap.Config.RGB_565)
        for (x in 0 until size) {
            for (y in 0 until size) {
                bitmap.setPixel(
                    x, y,
                    if (bitMatrix[x, y]) android.graphics.Color.BLACK else android.graphics.Color.WHITE
                )
            }
        }
        return bitmap
    }
}

// ============================================================================
// VIEW MODEL
// ============================================================================

@HiltViewModel
class PublicTraceabilityViewModel @Inject constructor(
    private val repository: PublicTraceabilityRepository
) : ViewModel() {

    private val _uiState = MutableStateFlow(PublicTraceabilityUiState())
    val uiState: StateFlow<PublicTraceabilityUiState> = _uiState

    fun loadOrGenerateLink(batchId: String) {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isLoading = true, error = null)

            try {
                val link = repository.generatePublicLink(batchId)
                val qrBitmap = QRCodeGenerator.generate(link.publicUrl)
                val analytics = repository.getScanAnalytics(batchId)

                _uiState.value = _uiState.value.copy(
                    isLoading = false,
                    publicLink = link,
                    qrBitmap = qrBitmap,
                    analytics = analytics
                )
            } catch (e: Exception) {
                _uiState.value = _uiState.value.copy(
                    isLoading = false,
                    error = e.message ?: "Error al generar enlace"
                )
            }
        }
    }

    fun refreshAnalytics(batchId: String) {
        viewModelScope.launch {
            try {
                val analytics = repository.getScanAnalytics(batchId)
                _uiState.value = _uiState.value.copy(analytics = analytics)
            } catch (e: Exception) {
                // Silently fail analytics refresh
            }
        }
    }

    fun dismissError() {
        _uiState.value = _uiState.value.copy(error = null)
    }
}

// ============================================================================
// REPOSITORY
// ============================================================================

class PublicTraceabilityRepository @Inject constructor(
    private val api: PublicTraceabilityApi
) {
    suspend fun generatePublicLink(batchId: String): PublicLink {
        return api.generatePublicLink(batchId)
    }

    suspend fun getScanAnalytics(batchId: String): ScanAnalytics {
        return api.getScanAnalytics(batchId)
    }
}

// API Interface (would be implemented with Retrofit)
interface PublicTraceabilityApi {
    suspend fun generatePublicLink(batchId: String): PublicLink
    suspend fun getScanAnalytics(batchId: String): ScanAnalytics
}

// ============================================================================
// MAIN SCREEN
// ============================================================================

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun PublicTraceabilityShareScreen(
    batch: BatchInfo,
    viewModel: PublicTraceabilityViewModel = hiltViewModel(),
    onBack: () -> Unit
) {
    val uiState by viewModel.uiState.collectAsState()
    val context = LocalContext.current
    val swipeRefreshState = rememberSwipeRefreshState(uiState.isLoading)

    LaunchedEffect(batch.id) {
        viewModel.loadOrGenerateLink(batch.id)
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Compartir Trazabilidad") },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.Default.ArrowBack, contentDescription = "Volver")
                    }
                }
            )
        }
    ) { paddingValues ->
        SwipeRefresh(
            state = swipeRefreshState,
            onRefresh = { viewModel.refreshAnalytics(batch.id) },
            modifier = Modifier.padding(paddingValues)
        ) {
            LazyColumn(
                modifier = Modifier.fillMaxSize(),
                contentPadding = PaddingValues(16.dp),
                verticalArrangement = Arrangement.spacedBy(16.dp)
            ) {
                when {
                    uiState.isLoading && uiState.publicLink == null -> {
                        item { LoadingCard() }
                    }
                    uiState.error != null && uiState.publicLink == null -> {
                        item {
                            ErrorCard(
                                message = uiState.error!!,
                                onRetry = { viewModel.loadOrGenerateLink(batch.id) }
                            )
                        }
                    }
                    uiState.publicLink != null -> {
                        // QR Code Card
                        item {
                            QRCodeCard(
                                link = uiState.publicLink!!,
                                qrBitmap = uiState.qrBitmap,
                                batch = batch
                            )
                        }

                        // Analytics Card
                        uiState.analytics?.let { analytics ->
                            item { AnalyticsCard(analytics = analytics) }
                        }

                        // Action Buttons
                        item {
                            ActionButtonsCard(
                                publicUrl = uiState.publicLink!!.publicUrl,
                                qrBitmap = uiState.qrBitmap,
                                batch = batch,
                                context = context
                            )
                        }
                    }
                }
            }
        }

        // Error Snackbar
        uiState.error?.let { error ->
            Snackbar(
                modifier = Modifier.padding(16.dp),
                action = {
                    TextButton(onClick = { viewModel.dismissError() }) {
                        Text("OK")
                    }
                }
            ) {
                Text(error)
            }
        }
    }
}

// ============================================================================
// QR CODE CARD
// ============================================================================

@Composable
fun QRCodeCard(
    link: PublicLink,
    qrBitmap: Bitmap?,
    batch: BatchInfo
) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(20.dp),
        elevation = CardDefaults.cardElevation(defaultElevation = 4.dp)
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(24.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            // Product Header
            Text(
                text = batch.product,
                style = MaterialTheme.typography.headlineSmall,
                fontWeight = FontWeight.Bold
            )

            batch.variety?.let { variety ->
                Text(
                    text = variety,
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }

            Spacer(modifier = Modifier.height(8.dp))

            // Farmer info
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.Center
            ) {
                Icon(
                    Icons.Default.Person,
                    contentDescription = null,
                    tint = Color(0xFF4CAF50),
                    modifier = Modifier.size(16.dp)
                )
                Spacer(modifier = Modifier.width(4.dp))
                Text(
                    text = batch.farmerName,
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
                Text(
                    text = " • ",
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
                Icon(
                    Icons.Default.LocationOn,
                    contentDescription = null,
                    tint = Color(0xFF4CAF50),
                    modifier = Modifier.size(16.dp)
                )
                Spacer(modifier = Modifier.width(4.dp))
                Text(
                    text = batch.region,
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }

            Spacer(modifier = Modifier.height(24.dp))

            // QR Code
            qrBitmap?.let { bitmap ->
                Card(
                    modifier = Modifier.size(220.dp),
                    shape = RoundedCornerShape(16.dp),
                    elevation = CardDefaults.cardElevation(defaultElevation = 8.dp)
                ) {
                    Image(
                        bitmap = bitmap.asImageBitmap(),
                        contentDescription = "Código QR",
                        modifier = Modifier
                            .fillMaxSize()
                            .padding(16.dp)
                    )
                }
            } ?: Box(
                modifier = Modifier
                    .size(220.dp)
                    .background(
                        MaterialTheme.colorScheme.surfaceVariant,
                        RoundedCornerShape(16.dp)
                    ),
                contentAlignment = Alignment.Center
            ) {
                CircularProgressIndicator()
            }

            Spacer(modifier = Modifier.height(16.dp))

            // Short code
            Text(
                text = "Código: ${link.shortCode}",
                style = MaterialTheme.typography.bodyMedium,
                fontFamily = FontFamily.Monospace
            )

            Text(
                text = "Escanea el código QR para ver la trazabilidad completa",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                textAlign = TextAlign.Center,
                modifier = Modifier.padding(horizontal = 16.dp)
            )

            Spacer(modifier = Modifier.height(12.dp))

            // View count badge
            Surface(
                shape = RoundedCornerShape(20.dp),
                color = Color(0xFF2196F3).copy(alpha = 0.1f)
            ) {
                Row(
                    modifier = Modifier.padding(horizontal = 16.dp, vertical = 8.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Icon(
                        Icons.Default.Visibility,
                        contentDescription = null,
                        tint = Color(0xFF2196F3),
                        modifier = Modifier.size(16.dp)
                    )
                    Spacer(modifier = Modifier.width(6.dp))
                    Text(
                        text = "${link.viewCount} visitas",
                        style = MaterialTheme.typography.bodySmall,
                        color = Color(0xFF2196F3)
                    )
                }
            }
        }
    }
}

// ============================================================================
// LOADING CARD
// ============================================================================

@Composable
fun LoadingCard() {
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .height(300.dp),
        shape = RoundedCornerShape(20.dp)
    ) {
        Box(
            modifier = Modifier.fillMaxSize(),
            contentAlignment = Alignment.Center
        ) {
            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                CircularProgressIndicator()
                Spacer(modifier = Modifier.height(16.dp))
                Text(
                    text = "Generando enlace público...",
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
        }
    }
}

// ============================================================================
// ERROR CARD
// ============================================================================

@Composable
fun ErrorCard(
    message: String,
    onRetry: () -> Unit
) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(20.dp)
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(24.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Icon(
                Icons.Default.Error,
                contentDescription = null,
                tint = MaterialTheme.colorScheme.error,
                modifier = Modifier.size(48.dp)
            )
            Spacer(modifier = Modifier.height(16.dp))
            Text(
                text = "Error",
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.SemiBold
            )
            Spacer(modifier = Modifier.height(8.dp))
            Text(
                text = message,
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                textAlign = TextAlign.Center
            )
            Spacer(modifier = Modifier.height(16.dp))
            Button(onClick = onRetry) {
                Text("Reintentar")
            }
        }
    }
}

// ============================================================================
// ANALYTICS CARD
// ============================================================================

@Composable
fun AnalyticsCard(analytics: ScanAnalytics) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(16.dp)
    ) {
        Column(
            modifier = Modifier.padding(16.dp)
        ) {
            // Header
            Row(
                verticalAlignment = Alignment.CenterVertically
            ) {
                Icon(
                    Icons.Default.BarChart,
                    contentDescription = null,
                    tint = Color(0xFF2196F3)
                )
                Spacer(modifier = Modifier.width(8.dp))
                Text(
                    text = "Estadísticas de Escaneo",
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.SemiBold
                )
            }

            Spacer(modifier = Modifier.height(16.dp))

            // Stats grid
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceEvenly
            ) {
                StatItem(
                    value = analytics.totalScans.toString(),
                    label = "Total",
                    icon = Icons.Default.QrCode,
                    color = Color(0xFF2196F3)
                )
                StatItem(
                    value = analytics.last30DaysScans.toString(),
                    label = "Últimos 30 días",
                    icon = Icons.Default.DateRange,
                    color = Color(0xFF4CAF50)
                )
                StatItem(
                    value = analytics.uniqueCountries.toString(),
                    label = "Países",
                    icon = Icons.Default.Public,
                    color = Color(0xFF9C27B0)
                )
            }

            // Last scan
            analytics.lastScanAt?.let { lastScan ->
                Spacer(modifier = Modifier.height(16.dp))
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Icon(
                        Icons.Default.Schedule,
                        contentDescription = null,
                        tint = Color(0xFFFF9800),
                        modifier = Modifier.size(16.dp)
                    )
                    Spacer(modifier = Modifier.width(8.dp))
                    Text(
                        text = "Último escaneo: ${formatTimeAgo(lastScan)}",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            }

            // Top countries
            if (analytics.scansByCountry.isNotEmpty()) {
                Spacer(modifier = Modifier.height(16.dp))
                Text(
                    text = "Países principales",
                    style = MaterialTheme.typography.labelMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
                Spacer(modifier = Modifier.height(8.dp))

                analytics.scansByCountry.take(3).forEach { scan ->
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(vertical = 4.dp),
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        Row {
                            Text(text = countryFlag(scan.country))
                            Spacer(modifier = Modifier.width(8.dp))
                            Text(
                                text = scan.country,
                                style = MaterialTheme.typography.bodySmall
                            )
                        }
                        Text(
                            text = scan.count.toString(),
                            style = MaterialTheme.typography.bodySmall,
                            fontWeight = FontWeight.Medium
                        )
                    }
                }
            }
        }
    }
}

@Composable
fun StatItem(
    value: String,
    label: String,
    icon: androidx.compose.ui.graphics.vector.ImageVector,
    color: Color
) {
    Column(
        horizontalAlignment = Alignment.CenterHorizontally,
        modifier = Modifier
            .background(
                color.copy(alpha = 0.1f),
                RoundedCornerShape(12.dp)
            )
            .padding(16.dp)
    ) {
        Icon(
            icon,
            contentDescription = null,
            tint = color,
            modifier = Modifier.size(24.dp)
        )
        Spacer(modifier = Modifier.height(8.dp))
        Text(
            text = value,
            style = MaterialTheme.typography.titleLarge,
            fontWeight = FontWeight.Bold
        )
        Text(
            text = label,
            style = MaterialTheme.typography.labelSmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            textAlign = TextAlign.Center
        )
    }
}

// ============================================================================
// ACTION BUTTONS CARD
// ============================================================================

@Composable
fun ActionButtonsCard(
    publicUrl: String,
    qrBitmap: Bitmap?,
    batch: BatchInfo,
    context: Context
) {
    Column(
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        // Share button
        Button(
            onClick = {
                val shareIntent = Intent(Intent.ACTION_SEND).apply {
                    type = "text/plain"
                    putExtra(
                        Intent.EXTRA_TEXT,
                        "Conoce el origen de este ${batch.product} de ${batch.farmerName}: $publicUrl"
                    )
                }
                context.startActivity(Intent.createChooser(shareIntent, "Compartir"))
            },
            modifier = Modifier.fillMaxWidth(),
            colors = ButtonDefaults.buttonColors(
                containerColor = Color(0xFF4CAF50)
            )
        ) {
            Icon(Icons.Default.Share, contentDescription = null)
            Spacer(modifier = Modifier.width(8.dp))
            Text("Compartir", fontWeight = FontWeight.SemiBold)
        }

        // Copy link button
        OutlinedButton(
            onClick = {
                val clipboard = context.getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
                val clip = ClipData.newPlainText("AgroBridge Link", publicUrl)
                clipboard.setPrimaryClip(clip)
                Toast.makeText(context, "Enlace copiado", Toast.LENGTH_SHORT).show()
            },
            modifier = Modifier.fillMaxWidth()
        ) {
            Icon(Icons.Default.ContentCopy, contentDescription = null)
            Spacer(modifier = Modifier.width(8.dp))
            Text("Copiar enlace")
        }

        // Open in browser button
        OutlinedButton(
            onClick = {
                val intent = Intent(Intent.ACTION_VIEW, Uri.parse(publicUrl))
                context.startActivity(intent)
            },
            modifier = Modifier.fillMaxWidth()
        ) {
            Icon(Icons.Default.OpenInBrowser, contentDescription = null)
            Spacer(modifier = Modifier.width(8.dp))
            Text("Ver página pública")
        }
    }
}

// ============================================================================
// UTILITIES
// ============================================================================

fun formatTimeAgo(instant: Instant): String {
    val now = Instant.now()
    val hours = ChronoUnit.HOURS.between(instant, now)
    val days = ChronoUnit.DAYS.between(instant, now)

    return when {
        hours < 1 -> "Hace menos de una hora"
        hours < 24 -> "Hace $hours horas"
        days < 7 -> "Hace $days días"
        else -> DateTimeFormatter.ofPattern("MMM d, yyyy")
            .withZone(ZoneId.systemDefault())
            .format(instant)
    }
}

fun countryFlag(countryCode: String): String {
    val base = 0x1F1E6 - 'A'.code
    return countryCode.uppercase()
        .map { char -> Character.toChars(base + char.code).joinToString("") }
        .joinToString("")
        .takeIf { it.length == 4 } ?: "\uD83C\uDF0D" // Earth globe emoji fallback
}

// ============================================================================
// PREVIEWS
// ============================================================================

@Preview(showBackground = true)
@Composable
fun QRCodeCardPreview() {
    MaterialTheme {
        QRCodeCard(
            link = PublicLink(
                id = "1",
                publicUrl = "https://agrobridge.io/t/ABC123",
                shortCode = "ABC123",
                qrImageUrl = null,
                viewCount = 42,
                createdAt = Instant.now()
            ),
            qrBitmap = null,
            batch = BatchInfo(
                id = "1",
                product = "Aguacate Hass",
                variety = "Hass Premium",
                farmerName = "María García",
                region = "Michoacán",
                harvestDate = LocalDate.now(),
                status = "HARVESTED"
            )
        )
    }
}

@Preview(showBackground = true)
@Composable
fun AnalyticsCardPreview() {
    MaterialTheme {
        AnalyticsCard(
            analytics = ScanAnalytics(
                shortCode = "ABC123",
                batchId = "1",
                totalScans = 156,
                uniqueCountries = 5,
                scansByCountry = listOf(
                    CountryScan("US", 78),
                    CountryScan("MX", 45),
                    CountryScan("CA", 23)
                ),
                scansByDevice = listOf(
                    DeviceScan("MOBILE", 120),
                    DeviceScan("DESKTOP", 36)
                ),
                scansByDay = emptyList(),
                last30DaysScans = 89,
                lastScanAt = Instant.now().minus(2, ChronoUnit.HOURS)
            )
        )
    }
}

@Preview(showBackground = true)
@Composable
fun StatItemPreview() {
    MaterialTheme {
        Row(
            horizontalArrangement = Arrangement.spacedBy(8.dp),
            modifier = Modifier.padding(16.dp)
        ) {
            StatItem(
                value = "156",
                label = "Total",
                icon = Icons.Default.QrCode,
                color = Color(0xFF2196F3)
            )
            StatItem(
                value = "89",
                label = "30 días",
                icon = Icons.Default.DateRange,
                color = Color(0xFF4CAF50)
            )
        }
    }
}
