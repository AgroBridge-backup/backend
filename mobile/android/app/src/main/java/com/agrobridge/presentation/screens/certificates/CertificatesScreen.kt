/**
 * Traceability 2.0 - Blockchain Quality Certificates
 * Android Compose UI
 */

package com.agrobridge.presentation.screens.certificates

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material.icons.outlined.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import com.agrobridge.data.model.*
import java.text.SimpleDateFormat
import java.util.*

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun CertificatesScreen(
    viewModel: CertificatesViewModel = hiltViewModel(),
    onNavigateBack: () -> Unit = {}
) {
    val uiState by viewModel.uiState.collectAsState()
    var showIssueDialog by remember { mutableStateOf(false) }
    var showDetailSheet by remember { mutableStateOf(false) }

    LaunchedEffect(uiState.issueSuccess) {
        if (uiState.issueSuccess) {
            showIssueDialog = false
            viewModel.clearIssueSuccess()
        }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Certificados") },
                navigationIcon = {
                    IconButton(onClick = onNavigateBack) {
                        Icon(Icons.Default.ArrowBack, contentDescription = "Volver")
                    }
                },
                actions = {
                    IconButton(onClick = { viewModel.toggleValidOnly() }) {
                        Icon(
                            if (uiState.showValidOnly) Icons.Filled.FilterAlt else Icons.Outlined.FilterAlt,
                            contentDescription = "Filtrar válidos"
                        )
                    }
                    if (viewModel.canIssueCertificates) {
                        IconButton(onClick = { showIssueDialog = true }) {
                            Icon(Icons.Default.Add, contentDescription = "Emitir certificado")
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
                uiState.isLoading && uiState.certificates.isEmpty() -> {
                    CircularProgressIndicator(modifier = Modifier.align(Alignment.Center))
                }
                uiState.error != null && uiState.certificates.isEmpty() -> {
                    ErrorContent(
                        message = uiState.error!!,
                        onRetry = { viewModel.loadCertificates() },
                        modifier = Modifier.align(Alignment.Center)
                    )
                }
                uiState.certificates.isEmpty() -> {
                    EmptyContent(
                        canIssue = viewModel.canIssueCertificates,
                        onIssueTap = { showIssueDialog = true },
                        modifier = Modifier.align(Alignment.Center)
                    )
                }
                else -> {
                    CertificatesList(
                        certificates = uiState.certificates,
                        onCertificateClick = { certificate ->
                            viewModel.selectCertificate(certificate)
                            showDetailSheet = true
                        }
                    )
                }
            }

            // Snackbar for errors
            uiState.error?.let { error ->
                Snackbar(
                    modifier = Modifier
                        .align(Alignment.BottomCenter)
                        .padding(16.dp),
                    action = {
                        TextButton(onClick = { viewModel.clearError() }) {
                            Text("Cerrar")
                        }
                    }
                ) {
                    Text(error)
                }
            }
        }
    }

    // Issue Certificate Dialog
    if (showIssueDialog) {
        IssueCertificateDialog(
            eligibility = uiState.eligibility,
            isIssuing = uiState.isIssuing,
            onDismiss = { showIssueDialog = false },
            onIssue = { grade, certifyingBody, validityDays ->
                viewModel.issueCertificate(grade, certifyingBody, validityDays)
            }
        )
    }

    // Certificate Detail Sheet
    if (showDetailSheet && uiState.selectedCertificate != null) {
        CertificateDetailSheet(
            certificate = uiState.selectedCertificate!!,
            verification = uiState.verification,
            onDismiss = {
                showDetailSheet = false
                viewModel.clearSelectedCertificate()
            }
        )
    }
}

@Composable
fun CertificatesList(
    certificates: List<QualityCertificate>,
    onCertificateClick: (QualityCertificate) -> Unit
) {
    LazyColumn(
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        items(certificates, key = { it.id }) { certificate ->
            CertificateCard(
                certificate = certificate,
                onClick = { onCertificateClick(certificate) }
            )
        }
    }
}

@Composable
fun CertificateCard(
    certificate: QualityCertificate,
    onClick: () -> Unit
) {
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick),
        shape = RoundedCornerShape(12.dp)
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            // Grade icon
            Box(
                modifier = Modifier
                    .size(56.dp)
                    .clip(CircleShape)
                    .background(certificate.grade.getComposeColor().copy(alpha = 0.2f)),
                contentAlignment = Alignment.Center
            ) {
                Icon(
                    imageVector = when (certificate.grade) {
                        CertificateGrade.STANDARD -> Icons.Default.Verified
                        CertificateGrade.PREMIUM -> Icons.Default.Star
                        CertificateGrade.EXPORT -> Icons.Default.Flight
                        CertificateGrade.ORGANIC -> Icons.Default.Eco
                    },
                    contentDescription = null,
                    tint = certificate.grade.getComposeColor(),
                    modifier = Modifier.size(28.dp)
                )
            }

            Spacer(modifier = Modifier.width(16.dp))

            Column(modifier = Modifier.weight(1f)) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(
                        text = certificate.grade.displayName,
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.Bold
                    )
                    if (certificate.hashOnChain != null) {
                        Spacer(modifier = Modifier.width(8.dp))
                        Icon(
                            imageVector = Icons.Default.Link,
                            contentDescription = "En blockchain",
                            modifier = Modifier.size(16.dp),
                            tint = MaterialTheme.colorScheme.primary
                        )
                    }
                }

                Text(
                    text = certificate.certifyingBody,
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )

                Spacer(modifier = Modifier.height(4.dp))

                Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(
                        imageVector = if (certificate.isValid) Icons.Default.CheckCircle else Icons.Default.Warning,
                        contentDescription = null,
                        modifier = Modifier.size(14.dp),
                        tint = if (certificate.isValid) Color(0xFF4CAF50) else Color(0xFFFF5722)
                    )
                    Spacer(modifier = Modifier.width(4.dp))
                    Text(
                        text = if (certificate.isValid) {
                            "${certificate.daysUntilExpiry} días restantes"
                        } else {
                            "Expirado"
                        },
                        style = MaterialTheme.typography.labelSmall,
                        color = if (certificate.isValid) Color(0xFF4CAF50) else Color(0xFFFF5722)
                    )
                }
            }

            Icon(
                imageVector = Icons.Default.ChevronRight,
                contentDescription = null,
                tint = MaterialTheme.colorScheme.onSurfaceVariant
            )
        }
    }
}

@Composable
fun EmptyContent(
    canIssue: Boolean,
    onIssueTap: () -> Unit,
    modifier: Modifier = Modifier
) {
    Column(
        modifier = modifier.padding(32.dp),
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Icon(
            imageVector = Icons.Outlined.Verified,
            contentDescription = null,
            modifier = Modifier.size(80.dp),
            tint = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.5f)
        )

        Spacer(modifier = Modifier.height(16.dp))

        Text(
            text = "Sin certificados",
            style = MaterialTheme.typography.titleLarge,
            fontWeight = FontWeight.SemiBold
        )

        Spacer(modifier = Modifier.height(8.dp))

        Text(
            text = "Este lote aún no tiene certificados de calidad emitidos.",
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            textAlign = TextAlign.Center
        )

        if (canIssue) {
            Spacer(modifier = Modifier.height(24.dp))

            Button(onClick = onIssueTap) {
                Icon(Icons.Default.Add, contentDescription = null)
                Spacer(modifier = Modifier.width(8.dp))
                Text("Emitir certificado")
            }
        }
    }
}

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
            imageVector = Icons.Default.Warning,
            contentDescription = null,
            modifier = Modifier.size(60.dp),
            tint = MaterialTheme.colorScheme.error
        )

        Spacer(modifier = Modifier.height(16.dp))

        Text(
            text = "Error",
            style = MaterialTheme.typography.titleLarge,
            fontWeight = FontWeight.SemiBold
        )

        Spacer(modifier = Modifier.height(8.dp))

        Text(
            text = message,
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            textAlign = TextAlign.Center
        )

        Spacer(modifier = Modifier.height(24.dp))

        Button(onClick = onRetry) {
            Text("Reintentar")
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun IssueCertificateDialog(
    eligibility: Map<CertificateGrade, CertificateEligibility>,
    isIssuing: Boolean,
    onDismiss: () -> Unit,
    onIssue: (CertificateGrade, String, Int) -> Unit
) {
    var selectedGrade by remember { mutableStateOf(CertificateGrade.STANDARD) }
    var certifyingBody by remember { mutableStateOf("") }
    var validityDays by remember { mutableStateOf("365") }
    var gradeDropdownExpanded by remember { mutableStateOf(false) }

    val selectedEligibility = eligibility[selectedGrade]
    val canIssue = selectedEligibility?.canIssue == true && certifyingBody.isNotBlank()

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Emitir certificado") },
        text = {
            Column(
                modifier = Modifier.verticalScroll(rememberScrollState()),
                verticalArrangement = Arrangement.spacedBy(16.dp)
            ) {
                // Grade selector
                Text(
                    text = "Grado del certificado",
                    style = MaterialTheme.typography.labelMedium
                )

                ExposedDropdownMenuBox(
                    expanded = gradeDropdownExpanded,
                    onExpandedChange = { gradeDropdownExpanded = it }
                ) {
                    OutlinedTextField(
                        value = selectedGrade.displayName,
                        onValueChange = {},
                        readOnly = true,
                        trailingIcon = {
                            ExposedDropdownMenuDefaults.TrailingIcon(expanded = gradeDropdownExpanded)
                        },
                        modifier = Modifier
                            .fillMaxWidth()
                            .menuAnchor()
                    )

                    ExposedDropdownMenu(
                        expanded = gradeDropdownExpanded,
                        onDismissRequest = { gradeDropdownExpanded = false }
                    ) {
                        CertificateGrade.values().forEach { grade ->
                            DropdownMenuItem(
                                text = {
                                    Row(verticalAlignment = Alignment.CenterVertically) {
                                        Box(
                                            modifier = Modifier
                                                .size(8.dp)
                                                .clip(CircleShape)
                                                .background(grade.getComposeColor())
                                        )
                                        Spacer(modifier = Modifier.width(8.dp))
                                        Text(grade.displayName)
                                    }
                                },
                                onClick = {
                                    selectedGrade = grade
                                    gradeDropdownExpanded = false
                                }
                            )
                        }
                    }
                }

                // Eligibility status
                selectedEligibility?.let { elig ->
                    Card(
                        colors = CardDefaults.cardColors(
                            containerColor = if (elig.canIssue)
                                Color(0xFF4CAF50).copy(alpha = 0.1f)
                            else
                                Color(0xFFFF9800).copy(alpha = 0.1f)
                        )
                    ) {
                        Row(
                            modifier = Modifier.padding(12.dp),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Icon(
                                imageVector = if (elig.canIssue)
                                    Icons.Default.CheckCircle
                                else
                                    Icons.Default.Warning,
                                contentDescription = null,
                                tint = if (elig.canIssue) Color(0xFF4CAF50) else Color(0xFFFF9800)
                            )
                            Spacer(modifier = Modifier.width(8.dp))
                            Column {
                                Text(
                                    text = if (elig.canIssue)
                                        "Todos los requisitos cumplidos"
                                    else
                                        "Requisitos pendientes",
                                    style = MaterialTheme.typography.bodyMedium,
                                    fontWeight = FontWeight.Medium
                                )
                                if (!elig.canIssue && elig.missingStages.isNotEmpty()) {
                                    Text(
                                        text = elig.missingStages.joinToString(", "),
                                        style = MaterialTheme.typography.bodySmall,
                                        color = MaterialTheme.colorScheme.onSurfaceVariant
                                    )
                                }
                            }
                        }
                    }
                }

                // Certifying body
                OutlinedTextField(
                    value = certifyingBody,
                    onValueChange = { certifyingBody = it },
                    label = { Text("Organismo certificador") },
                    modifier = Modifier.fillMaxWidth(),
                    singleLine = true
                )

                // Validity days
                OutlinedTextField(
                    value = validityDays,
                    onValueChange = { validityDays = it.filter { c -> c.isDigit() } },
                    label = { Text("Vigencia (días)") },
                    modifier = Modifier.fillMaxWidth(),
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                    singleLine = true
                )

                // Grade description
                Text(
                    text = selectedGrade.description,
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
        },
        confirmButton = {
            Button(
                onClick = {
                    onIssue(selectedGrade, certifyingBody, validityDays.toIntOrNull() ?: 365)
                },
                enabled = canIssue && !isIssuing
            ) {
                if (isIssuing) {
                    CircularProgressIndicator(
                        modifier = Modifier.size(16.dp),
                        strokeWidth = 2.dp
                    )
                    Spacer(modifier = Modifier.width(8.dp))
                }
                Text("Emitir")
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss, enabled = !isIssuing) {
                Text("Cancelar")
            }
        }
    )
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun CertificateDetailSheet(
    certificate: QualityCertificate,
    verification: CertificateVerification?,
    onDismiss: () -> Unit
) {
    val dateFormat = remember { SimpleDateFormat("dd MMM yyyy, HH:mm", Locale.getDefault()) }

    ModalBottomSheet(onDismissRequest = onDismiss) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 24.dp)
                .padding(bottom = 32.dp)
                .verticalScroll(rememberScrollState()),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            // Grade badge
            Box(
                modifier = Modifier
                    .size(80.dp)
                    .clip(CircleShape)
                    .background(certificate.grade.getComposeColor().copy(alpha = 0.2f)),
                contentAlignment = Alignment.Center
            ) {
                Icon(
                    imageVector = when (certificate.grade) {
                        CertificateGrade.STANDARD -> Icons.Default.Verified
                        CertificateGrade.PREMIUM -> Icons.Default.Star
                        CertificateGrade.EXPORT -> Icons.Default.Flight
                        CertificateGrade.ORGANIC -> Icons.Default.Eco
                    },
                    contentDescription = null,
                    tint = certificate.grade.getComposeColor(),
                    modifier = Modifier.size(40.dp)
                )
            }

            Spacer(modifier = Modifier.height(16.dp))

            Text(
                text = certificate.grade.displayName,
                style = MaterialTheme.typography.headlineSmall,
                fontWeight = FontWeight.Bold
            )

            Text(
                text = certificate.grade.description,
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )

            Spacer(modifier = Modifier.height(24.dp))

            // Verification status
            if (verification != null) {
                VerificationCard(verification = verification)
            } else {
                CircularProgressIndicator(modifier = Modifier.size(24.dp))
                Spacer(modifier = Modifier.height(8.dp))
                Text(
                    text = "Verificando autenticidad...",
                    style = MaterialTheme.typography.bodySmall
                )
            }

            Spacer(modifier = Modifier.height(24.dp))

            // Details
            Card(modifier = Modifier.fillMaxWidth()) {
                Column(modifier = Modifier.padding(16.dp)) {
                    DetailRow("Organismo", certificate.certifyingBody)
                    HorizontalDivider(modifier = Modifier.padding(vertical = 8.dp))
                    DetailRow("Válido desde", dateFormat.format(certificate.validFrom))
                    HorizontalDivider(modifier = Modifier.padding(vertical = 8.dp))
                    DetailRow("Válido hasta", dateFormat.format(certificate.validTo))
                    HorizontalDivider(modifier = Modifier.padding(vertical = 8.dp))
                    DetailRow("Emitido", dateFormat.format(certificate.issuedAt))
                }
            }

            // Blockchain info
            certificate.hashOnChain?.let { hash ->
                Spacer(modifier = Modifier.height(16.dp))

                Card(modifier = Modifier.fillMaxWidth()) {
                    Column(modifier = Modifier.padding(16.dp)) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Icon(
                                imageVector = Icons.Default.Link,
                                contentDescription = null,
                                tint = MaterialTheme.colorScheme.primary
                            )
                            Spacer(modifier = Modifier.width(8.dp))
                            Text(
                                text = "Blockchain",
                                style = MaterialTheme.typography.titleSmall,
                                fontWeight = FontWeight.Medium
                            )
                        }
                        Spacer(modifier = Modifier.height(8.dp))
                        Text(
                            text = hash,
                            style = MaterialTheme.typography.bodySmall.copy(
                                fontFamily = FontFamily.Monospace
                            ),
                            color = MaterialTheme.colorScheme.primary,
                            maxLines = 2,
                            overflow = TextOverflow.Ellipsis
                        )
                    }
                }
            }

            Spacer(modifier = Modifier.height(24.dp))

            // Actions
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                OutlinedButton(
                    onClick = { /* Share */ },
                    modifier = Modifier.weight(1f)
                ) {
                    Icon(Icons.Default.Share, contentDescription = null)
                    Spacer(modifier = Modifier.width(8.dp))
                    Text("Compartir")
                }

                if (certificate.pdfUrl != null) {
                    Button(
                        onClick = { /* Download PDF */ },
                        modifier = Modifier.weight(1f)
                    ) {
                        Icon(Icons.Default.Download, contentDescription = null)
                        Spacer(modifier = Modifier.width(8.dp))
                        Text("PDF")
                    }
                }
            }
        }
    }
}

@Composable
fun VerificationCard(verification: CertificateVerification) {
    Card(
        colors = CardDefaults.cardColors(
            containerColor = if (verification.isValid)
                Color(0xFF4CAF50).copy(alpha = 0.1f)
            else
                Color(0xFFFF5722).copy(alpha = 0.1f)
        ),
        modifier = Modifier.fillMaxWidth()
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(
                    imageVector = if (verification.isValid)
                        Icons.Default.VerifiedUser
                    else
                        Icons.Default.GppBad,
                    contentDescription = null,
                    tint = if (verification.isValid) Color(0xFF4CAF50) else Color(0xFFFF5722),
                    modifier = Modifier.size(32.dp)
                )
                Spacer(modifier = Modifier.width(12.dp))
                Column {
                    Text(
                        text = if (verification.isValid)
                            "Certificado válido"
                        else
                            "Certificado inválido",
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.Medium
                    )
                    Text(
                        text = verification.message,
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            }

            verification.verification?.let { hashVerification ->
                HorizontalDivider(modifier = Modifier.padding(vertical = 12.dp))
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(
                        imageVector = if (hashVerification.hashMatch)
                            Icons.Default.Lock
                        else
                            Icons.Default.LockOpen,
                        contentDescription = null,
                        tint = if (hashVerification.hashMatch)
                            Color(0xFF4CAF50)
                        else
                            Color(0xFFFF9800),
                        modifier = Modifier.size(20.dp)
                    )
                    Spacer(modifier = Modifier.width(8.dp))
                    Text(
                        text = if (hashVerification.hashMatch)
                            "Integridad verificada"
                        else
                            "Hash no coincide",
                        style = MaterialTheme.typography.bodyMedium
                    )
                }
            }

            if (verification.isExpired) {
                HorizontalDivider(modifier = Modifier.padding(vertical = 12.dp))
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(
                        imageVector = Icons.Default.EventBusy,
                        contentDescription = null,
                        tint = Color(0xFFFF9800),
                        modifier = Modifier.size(20.dp)
                    )
                    Spacer(modifier = Modifier.width(8.dp))
                    Text(
                        text = "El certificado ha expirado",
                        style = MaterialTheme.typography.bodyMedium
                    )
                }
            }
        }
    }
}

@Composable
fun DetailRow(label: String, value: String) {
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
