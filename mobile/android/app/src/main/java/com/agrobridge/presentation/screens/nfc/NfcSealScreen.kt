/**
 * Traceability 2.0 - Tamper-Evident NFC Seals
 * Android Kotlin/Compose Implementation with NFC
 */

package com.agrobridge.presentation.screens.nfc

import android.app.Activity
import android.nfc.NfcAdapter
import android.nfc.Tag
import android.nfc.tech.Ndef
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
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import java.util.*

// MARK: - Models

enum class NfcSealStatus(
    val displayName: String,
    val color: Long
) {
    PROVISIONED("Provisionado", 0xFF9E9E9E),
    ATTACHED("Adjunto", 0xFF2196F3),
    VERIFIED("Verificado", 0xFF4CAF50),
    TAMPERED("Alterado", 0xFFF44336),
    REMOVED("Removido", 0xFFFF9800),
    EXPIRED("Expirado", 0xFF795548);

    fun getComposeColor(): Color = Color(color)
}

enum class TamperIndicator(
    val displayName: String,
    val severity: String
) {
    NONE("Sin alteración", "none"),
    SIGNATURE_MISMATCH("Firma inválida", "critical"),
    COUNTER_ANOMALY("Anomalía de contador", "critical"),
    PHYSICAL_DAMAGE("Daño físico", "critical"),
    LOCATION_MISMATCH("Ubicación inesperada", "warning"),
    TIMING_ANOMALY("Anomalía temporal", "warning")
}

data class NfcSeal(
    val id: String,
    val serialNumber: String,
    val batchId: String?,
    val status: NfcSealStatus,
    val publicKey: String,
    val challenge: String?,
    val expectedReadCount: Int,
    val actualReadCount: Int,
    val attachedAt: Date?,
    val attachedBy: String?,
    val tamperIndicator: TamperIndicator,
    val tamperDetails: String?,
    val expiresAt: Date?
)

data class NfcSealVerification(
    val id: String,
    val sealId: String,
    val verifiedBy: String,
    val verifiedAt: Date,
    val readCounter: Int,
    val isValid: Boolean,
    val tamperIndicator: TamperIndicator
)

data class VerificationResult(
    val seal: NfcSeal,
    val verification: NfcSealVerification,
    val isValid: Boolean,
    val tamperIndicator: TamperIndicator,
    val integrityScore: Int,
    val nextChallenge: String
)

data class SealIntegritySummary(
    val sealId: String,
    val serialNumber: String,
    val status: NfcSealStatus,
    val integrityScore: Int,
    val verificationCount: Int,
    val lastVerification: Date?,
    val tamperIndicator: TamperIndicator
)

data class NfcSealUiState(
    val isLoading: Boolean = false,
    val isScanning: Boolean = false,
    val seals: List<NfcSeal> = emptyList(),
    val integritySummary: List<SealIntegritySummary> = emptyList(),
    val verificationResult: VerificationResult? = null,
    val showResultDialog: Boolean = false,
    val error: String? = null
)

// MARK: - Screen

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun NfcSealScreen(
    batchId: String,
    viewModel: NfcSealViewModel = hiltViewModel(),
    onNavigateBack: () -> Unit = {}
) {
    val uiState by viewModel.uiState.collectAsState()
    val context = LocalContext.current

    LaunchedEffect(batchId) {
        viewModel.loadBatchSeals(batchId)
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Sellos NFC") },
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
                uiState.isLoading -> {
                    CircularProgressIndicator(modifier = Modifier.align(Alignment.Center))
                }
                uiState.error != null -> {
                    ErrorContent(
                        message = uiState.error!!,
                        onRetry = { viewModel.loadBatchSeals(batchId) },
                        modifier = Modifier.align(Alignment.Center)
                    )
                }
                else -> {
                    LazyColumn(
                        modifier = Modifier.fillMaxSize(),
                        contentPadding = PaddingValues(16.dp),
                        verticalArrangement = Arrangement.spacedBy(16.dp)
                    ) {
                        // Scan Button
                        item {
                            ScanButtonCard(
                                isScanning = uiState.isScanning,
                                onScan = { viewModel.startNfcScan(context as Activity) }
                            )
                        }

                        // Integrity Summary
                        if (uiState.integritySummary.isNotEmpty()) {
                            item {
                                IntegritySummaryCard(summaries = uiState.integritySummary)
                            }
                        }

                        // Seals List
                        if (uiState.seals.isNotEmpty()) {
                            item {
                                Text(
                                    text = "Sellos (${uiState.seals.size})",
                                    style = MaterialTheme.typography.titleMedium,
                                    fontWeight = FontWeight.Bold
                                )
                            }
                            items(uiState.seals, key = { it.id }) { seal ->
                                SealCard(seal = seal)
                            }
                        } else {
                            item {
                                EmptySealsContent()
                            }
                        }
                    }
                }
            }

            // Result Dialog
            if (uiState.showResultDialog && uiState.verificationResult != null) {
                VerificationResultDialog(
                    result = uiState.verificationResult!!,
                    onDismiss = { viewModel.dismissResult() }
                )
            }
        }
    }
}

// MARK: - Scan Button Card

@Composable
fun ScanButtonCard(
    isScanning: Boolean,
    onScan: () -> Unit
) {
    Card(
        onClick = onScan,
        enabled = !isScanning,
        modifier = Modifier.fillMaxWidth()
    ) {
        Row(
            modifier = Modifier.padding(16.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Box(
                modifier = Modifier
                    .size(60.dp)
                    .clip(CircleShape)
                    .background(MaterialTheme.colorScheme.primary.copy(alpha = 0.1f)),
                contentAlignment = Alignment.Center
            ) {
                if (isScanning) {
                    CircularProgressIndicator(
                        modifier = Modifier.size(24.dp),
                        strokeWidth = 2.dp
                    )
                } else {
                    Icon(
                        imageVector = Icons.Default.Nfc,
                        contentDescription = null,
                        tint = MaterialTheme.colorScheme.primary,
                        modifier = Modifier.size(32.dp)
                    )
                }
            }

            Spacer(modifier = Modifier.width(16.dp))

            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = if (isScanning) "Escaneando..." else "Escanear Sello NFC",
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Bold
                )
                Text(
                    text = "Acerque el dispositivo al sello para verificar",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }

            Icon(
                imageVector = Icons.Default.ChevronRight,
                contentDescription = null,
                tint = MaterialTheme.colorScheme.onSurfaceVariant
            )
        }
    }
}

// MARK: - Integrity Summary Card

@Composable
fun IntegritySummaryCard(summaries: List<SealIntegritySummary>) {
    val overallScore = if (summaries.isNotEmpty()) {
        summaries.sumOf { it.integrityScore } / summaries.size
    } else 100

    val scoreColor = when {
        overallScore >= 90 -> Color(0xFF4CAF50)
        overallScore >= 70 -> Color(0xFFFF9800)
        else -> Color(0xFFF44336)
    }

    Card(modifier = Modifier.fillMaxWidth()) {
        Column(modifier = Modifier.padding(16.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(
                    imageVector = Icons.Default.Shield,
                    contentDescription = null,
                    tint = Color(0xFF9C27B0)
                )
                Spacer(modifier = Modifier.width(8.dp))
                Text(
                    text = "Integridad de Sellos",
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
                        text = "$overallScore%",
                        fontSize = 36.sp,
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

                // Stats
                Column {
                    StatRow(
                        color = Color(0xFF4CAF50),
                        text = "${summaries.count { it.status == NfcSealStatus.VERIFIED }} verificados"
                    )
                    StatRow(
                        color = Color(0xFF2196F3),
                        text = "${summaries.count { it.status == NfcSealStatus.ATTACHED }} adjuntos"
                    )
                    if (summaries.any { it.status == NfcSealStatus.TAMPERED }) {
                        StatRow(
                            color = Color(0xFFF44336),
                            text = "${summaries.count { it.status == NfcSealStatus.TAMPERED }} alterados"
                        )
                    }
                }
            }
        }
    }
}

@Composable
fun StatRow(color: Color, text: String) {
    Row(
        verticalAlignment = Alignment.CenterVertically,
        modifier = Modifier.padding(vertical = 2.dp)
    ) {
        Box(
            modifier = Modifier
                .size(8.dp)
                .background(color, CircleShape)
        )
        Spacer(modifier = Modifier.width(8.dp))
        Text(
            text = text,
            style = MaterialTheme.typography.bodySmall
        )
    }
}

// MARK: - Seal Card

@Composable
fun SealCard(seal: NfcSeal) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f)
        )
    ) {
        Row(
            modifier = Modifier.padding(16.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Icon(
                imageVector = when (seal.status) {
                    NfcSealStatus.PROVISIONED -> Icons.Default.Inventory
                    NfcSealStatus.ATTACHED -> Icons.Default.Link
                    NfcSealStatus.VERIFIED -> Icons.Default.VerifiedUser
                    NfcSealStatus.TAMPERED -> Icons.Default.Warning
                    NfcSealStatus.REMOVED -> Icons.Default.LinkOff
                    NfcSealStatus.EXPIRED -> Icons.Default.Schedule
                },
                contentDescription = null,
                tint = seal.status.getComposeColor(),
                modifier = Modifier.size(32.dp)
            )

            Spacer(modifier = Modifier.width(12.dp))

            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = seal.serialNumber,
                    style = MaterialTheme.typography.bodyMedium,
                    fontFamily = FontFamily.Monospace,
                    fontWeight = FontWeight.Medium
                )
                Text(
                    text = seal.status.displayName,
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }

            if (seal.tamperIndicator != TamperIndicator.NONE) {
                Icon(
                    imageVector = Icons.Default.Warning,
                    contentDescription = null,
                    tint = Color(0xFFF44336),
                    modifier = Modifier.size(20.dp)
                )
            }
        }
    }
}

// MARK: - Verification Result Dialog

@Composable
fun VerificationResultDialog(
    result: VerificationResult,
    onDismiss: () -> Unit
) {
    val scoreColor = when {
        result.integrityScore >= 90 -> Color(0xFF4CAF50)
        result.integrityScore >= 70 -> Color(0xFFFF9800)
        else -> Color(0xFFF44336)
    }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = {
            Column(
                modifier = Modifier.fillMaxWidth(),
                horizontalAlignment = Alignment.CenterHorizontally
            ) {
                Box(
                    modifier = Modifier
                        .size(80.dp)
                        .clip(CircleShape)
                        .background(
                            if (result.isValid) Color(0xFF4CAF50).copy(alpha = 0.1f)
                            else Color(0xFFF44336).copy(alpha = 0.1f)
                        ),
                    contentAlignment = Alignment.Center
                ) {
                    Icon(
                        imageVector = if (result.isValid) Icons.Default.VerifiedUser else Icons.Default.GppBad,
                        contentDescription = null,
                        tint = if (result.isValid) Color(0xFF4CAF50) else Color(0xFFF44336),
                        modifier = Modifier.size(40.dp)
                    )
                }

                Spacer(modifier = Modifier.height(16.dp))

                Text(
                    text = if (result.isValid) "Sello Válido" else "Sello Inválido",
                    style = MaterialTheme.typography.headlineSmall,
                    fontWeight = FontWeight.Bold
                )
            }
        },
        text = {
            Column(
                modifier = Modifier.fillMaxWidth(),
                horizontalAlignment = Alignment.CenterHorizontally
            ) {
                Text(
                    text = if (result.isValid)
                        "La integridad del sello ha sido verificada"
                    else
                        "Se detectó una posible manipulación",
                    style = MaterialTheme.typography.bodyMedium,
                    textAlign = TextAlign.Center,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )

                Spacer(modifier = Modifier.height(24.dp))

                // Integrity Score
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    colors = CardDefaults.cardColors(
                        containerColor = MaterialTheme.colorScheme.surfaceVariant
                    )
                ) {
                    Column(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(16.dp),
                        horizontalAlignment = Alignment.CenterHorizontally
                    ) {
                        Text(
                            text = "Puntuación de Integridad",
                            style = MaterialTheme.typography.labelMedium,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                        Text(
                            text = "${result.integrityScore}%",
                            fontSize = 48.sp,
                            fontWeight = FontWeight.Bold,
                            color = scoreColor
                        )
                    }
                }

                Spacer(modifier = Modifier.height(16.dp))

                // Details
                Column(
                    modifier = Modifier.fillMaxWidth(),
                    verticalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    DetailRow(label = "Serial", value = result.seal.serialNumber)
                    DetailRow(label = "Estado", value = result.seal.status.displayName)
                    DetailRow(label = "Contador", value = "${result.verification.readCounter}")
                    if (result.tamperIndicator != TamperIndicator.NONE) {
                        DetailRow(
                            label = "Indicador",
                            value = result.tamperIndicator.displayName,
                            valueColor = Color(0xFFF44336)
                        )
                    }
                }
            }
        },
        confirmButton = {
            TextButton(onClick = onDismiss) {
                Text("Cerrar")
            }
        }
    )
}

@Composable
fun DetailRow(
    label: String,
    value: String,
    valueColor: Color = MaterialTheme.colorScheme.onSurface
) {
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
            fontWeight = FontWeight.Medium,
            color = valueColor
        )
    }
}

// MARK: - Empty State

@Composable
fun EmptySealsContent() {
    Card(modifier = Modifier.fillMaxWidth()) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(32.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Icon(
                imageVector = Icons.Default.Label,
                contentDescription = null,
                modifier = Modifier.size(48.dp),
                tint = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.5f)
            )
            Spacer(modifier = Modifier.height(16.dp))
            Text(
                text = "Sin sellos NFC",
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.SemiBold
            )
            Spacer(modifier = Modifier.height(8.dp))
            Text(
                text = "No hay sellos adjuntos a este lote",
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
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
