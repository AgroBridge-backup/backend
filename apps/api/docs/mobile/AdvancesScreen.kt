/**
 * AgroBridge Android - My Advances Screen
 * Jetpack Compose Implementation
 *
 * Features:
 * - List of active advances with status
 * - Balance summary
 * - Payment actions
 * - Pull to refresh
 * - Offline caching
 */

package io.agrobridge.app.ui.advances

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.stringResource
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
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch
import java.text.NumberFormat
import java.time.LocalDate
import java.time.format.DateTimeFormatter
import java.time.temporal.ChronoUnit
import java.util.*
import javax.inject.Inject

// ============================================================================
// DATA MODELS
// ============================================================================

data class Advance(
    val id: String,
    val contractNumber: String,
    val amount: Double,
    val remaining: Double,
    val dueDate: LocalDate,
    val status: AdvanceStatus,
    val daysUntilDue: Int
)

enum class AdvanceStatus {
    ACTIVE,
    OVERDUE,
    COMPLETED,
    PENDING_APPROVAL
}

data class AdvancesSummary(
    val advances: List<Advance>,
    val totalOutstanding: Double
)

data class AdvancesUiState(
    val isLoading: Boolean = false,
    val advances: List<Advance> = emptyList(),
    val totalOutstanding: Double = 0.0,
    val error: String? = null
)

// ============================================================================
// VIEW MODEL
// ============================================================================

@HiltViewModel
class AdvancesViewModel @Inject constructor(
    private val repository: AdvancesRepository
) : ViewModel() {

    private val _uiState = MutableStateFlow(AdvancesUiState())
    val uiState: StateFlow<AdvancesUiState> = _uiState

    init {
        loadAdvances()
    }

    fun loadAdvances() {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isLoading = true, error = null)

            try {
                val summary = repository.getAdvances()
                _uiState.value = _uiState.value.copy(
                    isLoading = false,
                    advances = summary.advances,
                    totalOutstanding = summary.totalOutstanding
                )
            } catch (e: Exception) {
                // Try loading cached data
                val cached = repository.getCachedAdvances()
                _uiState.value = _uiState.value.copy(
                    isLoading = false,
                    advances = cached?.advances ?: emptyList(),
                    totalOutstanding = cached?.totalOutstanding ?: 0.0,
                    error = e.message
                )
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

class AdvancesRepository @Inject constructor(
    private val api: AdvancesApi,
    private val cache: AdvancesCache
) {
    suspend fun getAdvances(): AdvancesSummary {
        val response = api.getUserAdvances()
        cache.save(response)
        return response
    }

    fun getCachedAdvances(): AdvancesSummary? = cache.load()
}

// API Interface (would be implemented with Retrofit)
interface AdvancesApi {
    suspend fun getUserAdvances(): AdvancesSummary
}

// Cache (would be implemented with Room or DataStore)
interface AdvancesCache {
    fun save(summary: AdvancesSummary)
    fun load(): AdvancesSummary?
}

// ============================================================================
// MAIN SCREEN
// ============================================================================

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AdvancesListScreen(
    viewModel: AdvancesViewModel = hiltViewModel(),
    onAdvanceClick: (String) -> Unit,
    onRequestAdvance: () -> Unit
) {
    val uiState by viewModel.uiState.collectAsState()
    val swipeRefreshState = rememberSwipeRefreshState(uiState.isLoading)

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text(stringResource(R.string.my_advances)) },
                actions = {
                    IconButton(onClick = onRequestAdvance) {
                        Icon(
                            Icons.Default.Add,
                            contentDescription = stringResource(R.string.request_new_advance),
                            tint = MaterialTheme.colorScheme.primary
                        )
                    }
                }
            )
        },
        floatingActionButton = {
            if (uiState.advances.isNotEmpty()) {
                FloatingActionButton(
                    onClick = onRequestAdvance,
                    containerColor = MaterialTheme.colorScheme.primary
                ) {
                    Icon(Icons.Default.Add, contentDescription = null)
                }
            }
        }
    ) { paddingValues ->
        SwipeRefresh(
            state = swipeRefreshState,
            onRefresh = { viewModel.loadAdvances() },
            modifier = Modifier.padding(paddingValues)
        ) {
            Column(modifier = Modifier.fillMaxSize()) {
                // Header Section
                HeaderSection(
                    totalOutstanding = uiState.totalOutstanding,
                    activeCount = uiState.advances.count { it.status == AdvanceStatus.ACTIVE },
                    onRequestAdvance = onRequestAdvance
                )

                // Content
                when {
                    uiState.isLoading && uiState.advances.isEmpty() -> {
                        LoadingView()
                    }
                    uiState.advances.isEmpty() -> {
                        EmptyStateView(onRequestAdvance = onRequestAdvance)
                    }
                    else -> {
                        AdvancesList(
                            advances = uiState.advances,
                            onAdvanceClick = onAdvanceClick
                        )
                    }
                }
            }
        }

        // Error Snackbar
        uiState.error?.let { error ->
            Snackbar(
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
// HEADER SECTION
// ============================================================================

@Composable
fun HeaderSection(
    totalOutstanding: Double,
    activeCount: Int,
    onRequestAdvance: () -> Unit
) {
    Surface(
        modifier = Modifier.fillMaxWidth(),
        color = MaterialTheme.colorScheme.surface,
        shadowElevation = 2.dp
    ) {
        Column(
            modifier = Modifier.padding(16.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            // Total Outstanding
            Text(
                text = stringResource(R.string.total_outstanding),
                style = MaterialTheme.typography.labelMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )

            Spacer(modifier = Modifier.height(4.dp))

            Text(
                text = totalOutstanding.formatAsCurrency(),
                style = MaterialTheme.typography.displaySmall.copy(
                    fontWeight = FontWeight.Bold
                )
            )

            Spacer(modifier = Modifier.height(8.dp))

            // Active Count
            Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(
                    Icons.Default.Schedule,
                    contentDescription = null,
                    tint = MaterialTheme.colorScheme.primary,
                    modifier = Modifier.size(16.dp)
                )
                Spacer(modifier = Modifier.width(4.dp))
                Text(
                    text = "$activeCount ${stringResource(R.string.active_advances)}",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }

            Spacer(modifier = Modifier.height(16.dp))

            // Request Button
            Button(
                onClick = onRequestAdvance,
                modifier = Modifier.fillMaxWidth()
            ) {
                Icon(Icons.Default.Add, contentDescription = null)
                Spacer(modifier = Modifier.width(8.dp))
                Text(stringResource(R.string.request_new_advance))
            }
        }
    }
}

// ============================================================================
// ADVANCES LIST
// ============================================================================

@Composable
fun AdvancesList(
    advances: List<Advance>,
    onAdvanceClick: (String) -> Unit
) {
    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        items(advances, key = { it.id }) { advance ->
            AdvanceCard(
                advance = advance,
                onClick = { onAdvanceClick(advance.id) }
            )
        }
    }
}

// ============================================================================
// ADVANCE CARD
// ============================================================================

@Composable
fun AdvanceCard(
    advance: Advance,
    onClick: () -> Unit
) {
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick),
        shape = RoundedCornerShape(12.dp)
    ) {
        Column(
            modifier = Modifier.padding(16.dp)
        ) {
            // Header Row
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = "#${advance.contractNumber}",
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.SemiBold
                )
                StatusBadge(status = advance.status)
            }

            Spacer(modifier = Modifier.height(12.dp))

            // Amount Row
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                Column {
                    Text(
                        text = stringResource(R.string.borrowed),
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                    Text(
                        text = advance.amount.formatAsCurrency(),
                        style = MaterialTheme.typography.bodyMedium
                    )
                }
                Column(horizontalAlignment = Alignment.End) {
                    Text(
                        text = stringResource(R.string.remaining),
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                    Text(
                        text = advance.remaining.formatAsCurrency(),
                        style = MaterialTheme.typography.bodyMedium,
                        fontWeight = FontWeight.Bold,
                        color = if (advance.remaining > 0)
                            MaterialTheme.colorScheme.onSurface
                        else
                            MaterialTheme.colorScheme.primary
                    )
                }
            }

            Spacer(modifier = Modifier.height(12.dp))

            // Due Date Row
            Row(
                verticalAlignment = Alignment.CenterVertically
            ) {
                Icon(
                    Icons.Default.CalendarToday,
                    contentDescription = null,
                    modifier = Modifier.size(16.dp),
                    tint = MaterialTheme.colorScheme.onSurfaceVariant
                )
                Spacer(modifier = Modifier.width(4.dp))

                val (text, color) = when {
                    advance.daysUntilDue > 0 -> {
                        "${advance.daysUntilDue} ${stringResource(R.string.days_left)}" to
                            MaterialTheme.colorScheme.onSurfaceVariant
                    }
                    advance.daysUntilDue == 0 -> {
                        stringResource(R.string.due_today) to Color(0xFFFF9800)
                    }
                    else -> {
                        "${-advance.daysUntilDue} ${stringResource(R.string.days_overdue)}" to
                            MaterialTheme.colorScheme.error
                    }
                }

                Text(
                    text = text,
                    style = MaterialTheme.typography.bodySmall,
                    color = color
                )

                Spacer(modifier = Modifier.weight(1f))

                Text(
                    text = advance.dueDate.format(DateTimeFormatter.ofPattern("MMM d, yyyy")),
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
        }
    }
}

// ============================================================================
// STATUS BADGE
// ============================================================================

@Composable
fun StatusBadge(status: AdvanceStatus) {
    val (text, backgroundColor, textColor) = when (status) {
        AdvanceStatus.ACTIVE -> Triple(
            stringResource(R.string.active),
            Color(0xFF2196F3).copy(alpha = 0.2f),
            Color(0xFF2196F3)
        )
        AdvanceStatus.OVERDUE -> Triple(
            stringResource(R.string.overdue),
            Color(0xFFF44336).copy(alpha = 0.2f),
            Color(0xFFF44336)
        )
        AdvanceStatus.COMPLETED -> Triple(
            stringResource(R.string.paid),
            Color(0xFF4CAF50).copy(alpha = 0.2f),
            Color(0xFF4CAF50)
        )
        AdvanceStatus.PENDING_APPROVAL -> Triple(
            stringResource(R.string.pending),
            Color(0xFFFF9800).copy(alpha = 0.2f),
            Color(0xFFFF9800)
        )
    }

    Surface(
        shape = RoundedCornerShape(4.dp),
        color = backgroundColor
    ) {
        Text(
            text = text,
            modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp),
            style = MaterialTheme.typography.labelSmall,
            color = textColor,
            fontWeight = FontWeight.Medium
        )
    }
}

// ============================================================================
// EMPTY STATE
// ============================================================================

@Composable
fun EmptyStateView(onRequestAdvance: () -> Unit) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(32.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center
    ) {
        Icon(
            Icons.Default.AccountBalanceWallet,
            contentDescription = null,
            modifier = Modifier.size(80.dp),
            tint = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.5f)
        )

        Spacer(modifier = Modifier.height(16.dp))

        Text(
            text = stringResource(R.string.no_active_advances),
            style = MaterialTheme.typography.titleMedium
        )

        Spacer(modifier = Modifier.height(8.dp))

        Text(
            text = stringResource(R.string.request_first_advance),
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            textAlign = TextAlign.Center
        )

        Spacer(modifier = Modifier.height(24.dp))

        Button(onClick = onRequestAdvance) {
            Text(stringResource(R.string.request_new_advance))
        }
    }
}

// ============================================================================
// LOADING VIEW
// ============================================================================

@Composable
fun LoadingView() {
    Box(
        modifier = Modifier.fillMaxSize(),
        contentAlignment = Alignment.Center
    ) {
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            CircularProgressIndicator()
            Spacer(modifier = Modifier.height(16.dp))
            Text(
                text = stringResource(R.string.loading),
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
        }
    }
}

// ============================================================================
// DETAIL SCREEN
// ============================================================================

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AdvanceDetailScreen(
    advanceId: String,
    onBack: () -> Unit,
    onMakePayment: () -> Unit
) {
    // In real implementation, would fetch advance from ViewModel
    val advance = remember { mockAdvance() }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("#${advance.contractNumber}") },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.Default.ArrowBack, contentDescription = "Back")
                    }
                }
            )
        }
    ) { paddingValues ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues)
                .padding(16.dp)
        ) {
            // Balance Card
            Card(
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(16.dp)
            ) {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(24.dp),
                    horizontalAlignment = Alignment.CenterHorizontally
                ) {
                    Text(
                        text = stringResource(R.string.total_due),
                        style = MaterialTheme.typography.labelLarge,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                    Spacer(modifier = Modifier.height(8.dp))
                    Text(
                        text = advance.remaining.formatAsCurrency(),
                        style = MaterialTheme.typography.displayMedium.copy(
                            fontWeight = FontWeight.Bold
                        )
                    )
                    Spacer(modifier = Modifier.height(8.dp))
                    StatusBadge(status = advance.status)
                }
            }

            Spacer(modifier = Modifier.height(16.dp))

            // Breakdown Card
            Card(
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(16.dp)
            ) {
                Column(modifier = Modifier.padding(16.dp)) {
                    Text(
                        text = stringResource(R.string.breakdown),
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.SemiBold
                    )
                    Spacer(modifier = Modifier.height(12.dp))

                    BreakdownRow(stringResource(R.string.principal), advance.amount)
                    BreakdownRow(stringResource(R.string.interest), advance.amount * 0.025)
                    BreakdownRow(stringResource(R.string.late_fees), 0.0)

                    Divider(modifier = Modifier.padding(vertical = 8.dp))

                    BreakdownRow(
                        stringResource(R.string.total_due),
                        advance.remaining,
                        isTotal = true
                    )
                }
            }

            Spacer(modifier = Modifier.weight(1f))

            // Action Buttons
            Button(
                onClick = onMakePayment,
                modifier = Modifier.fillMaxWidth()
            ) {
                Icon(Icons.Default.CreditCard, contentDescription = null)
                Spacer(modifier = Modifier.width(8.dp))
                Text(stringResource(R.string.make_payment))
            }

            Spacer(modifier = Modifier.height(8.dp))

            OutlinedButton(
                onClick = { /* Report payment flow */ },
                modifier = Modifier.fillMaxWidth()
            ) {
                Icon(Icons.Default.Description, contentDescription = null)
                Spacer(modifier = Modifier.width(8.dp))
                Text(stringResource(R.string.report_payment))
            }
        }
    }
}

@Composable
fun BreakdownRow(label: String, value: Double, isTotal: Boolean = false) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 4.dp),
        horizontalArrangement = Arrangement.SpaceBetween
    ) {
        Text(
            text = label,
            style = MaterialTheme.typography.bodyMedium,
            fontWeight = if (isTotal) FontWeight.Bold else FontWeight.Normal
        )
        Text(
            text = value.formatAsCurrency(),
            style = MaterialTheme.typography.bodyMedium,
            fontWeight = if (isTotal) FontWeight.Bold else FontWeight.Normal
        )
    }
}

// ============================================================================
// UTILITIES
// ============================================================================

fun Double.formatAsCurrency(): String {
    val format = NumberFormat.getCurrencyInstance(Locale("es", "MX"))
    return format.format(this)
}

// Mock data for preview
fun mockAdvance() = Advance(
    id = "1",
    contractNumber = "ACF-2025-00001",
    amount = 5000.0,
    remaining = 3200.0,
    dueDate = LocalDate.now().plusDays(6),
    status = AdvanceStatus.ACTIVE,
    daysUntilDue = 6
)

// ============================================================================
// STRING RESOURCES (would be in res/values/strings.xml)
// ============================================================================

object R {
    object string {
        const val my_advances = 0
        const val total_outstanding = 1
        const val active_advances = 2
        const val request_new_advance = 3
        const val no_active_advances = 4
        const val request_first_advance = 5
        const val loading = 6
        const val borrowed = 7
        const val remaining = 8
        const val days_left = 9
        const val days_overdue = 10
        const val due_today = 11
        const val active = 12
        const val overdue = 13
        const val paid = 14
        const val pending = 15
        const val total_due = 16
        const val breakdown = 17
        const val principal = 18
        const val interest = 19
        const val late_fees = 20
        const val make_payment = 21
        const val report_payment = 22
    }
}

// Placeholder for stringResource function
@Composable
fun stringResource(id: Int): String {
    return when (id) {
        R.string.my_advances -> "Mis Anticipos"
        R.string.total_outstanding -> "Saldo Pendiente"
        R.string.active_advances -> "Anticipos activos"
        R.string.request_new_advance -> "Solicitar Anticipo"
        R.string.no_active_advances -> "No tienes anticipos activos"
        R.string.request_first_advance -> "¡Solicita tu primer anticipo!"
        R.string.loading -> "Cargando..."
        R.string.borrowed -> "Prestado"
        R.string.remaining -> "Restante"
        R.string.days_left -> "días restantes"
        R.string.days_overdue -> "días vencido"
        R.string.due_today -> "Vence hoy"
        R.string.active -> "Activo"
        R.string.overdue -> "Vencido"
        R.string.paid -> "Pagado"
        R.string.pending -> "Pendiente"
        R.string.total_due -> "Total a Pagar"
        R.string.breakdown -> "Desglose"
        R.string.principal -> "Capital"
        R.string.interest -> "Interés"
        R.string.late_fees -> "Cargos por mora"
        R.string.make_payment -> "Realizar Pago"
        R.string.report_payment -> "Reportar Pago"
        else -> ""
    }
}

// ============================================================================
// PREVIEWS
// ============================================================================

@Preview(showBackground = true)
@Composable
fun AdvanceCardPreview() {
    MaterialTheme {
        AdvanceCard(
            advance = mockAdvance(),
            onClick = {}
        )
    }
}

@Preview(showBackground = true)
@Composable
fun StatusBadgePreview() {
    MaterialTheme {
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            StatusBadge(AdvanceStatus.ACTIVE)
            StatusBadge(AdvanceStatus.OVERDUE)
            StatusBadge(AdvanceStatus.COMPLETED)
            StatusBadge(AdvanceStatus.PENDING_APPROVAL)
        }
    }
}
