package com.agrobridge.presentation.screens.stages

import androidx.compose.animation.*
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
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
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import com.agrobridge.data.model.*
import com.agrobridge.presentation.components.*
import com.agrobridge.presentation.model.UIState
import com.agrobridge.presentation.theme.*

/**
 * Traceability 2.0 - Multi-Stage Verification
 * Main screen displaying verification stages timeline
 *
 * Features:
 * - Visual timeline of all stages
 * - Progress indicator
 * - Stage status colors
 * - Create and approve actions
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun VerificationStagesScreen(
    batchId: String,
    onNavigateBack: () -> Unit = {},
    viewModel: VerificationStagesViewModel = hiltViewModel()
) {
    val uiState by viewModel.uiState.collectAsState()
    val isCreatingStage by viewModel.isCreatingStage.collectAsState()
    val isUpdatingStage by viewModel.isUpdatingStage.collectAsState()
    val operationError by viewModel.operationError.collectAsState()
    val showCreateDialog by viewModel.showCreateDialog.collectAsState()
    val selectedStageForApproval by viewModel.selectedStageForApproval.collectAsState()

    // Load stages on first composition
    LaunchedEffect(batchId) {
        viewModel.loadStages()
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Text(
                        text = "Etapas de Verificación",
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
                    val nextStage = viewModel.getNextStageType()
                    if (nextStage != null) {
                        IconButton(
                            onClick = { viewModel.showCreateStageDialog() },
                            enabled = !isCreatingStage
                        ) {
                            Icon(
                                imageVector = Icons.Default.Add,
                                contentDescription = "Crear etapa"
                            )
                        }
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = AgroGreen,
                    titleContentColor = Color.White,
                    navigationIconContentColor = Color.White,
                    actionIconContentColor = Color.White
                )
            )
        },
        floatingActionButton = {
            val nextStage = viewModel.getNextStageType()
            if (nextStage != null && uiState is UIState.Success) {
                ExtendedFloatingActionButton(
                    onClick = { viewModel.showCreateStageDialog() },
                    icon = { Icon(Icons.Default.Add, contentDescription = null) },
                    text = { Text("Nueva Etapa") },
                    containerColor = AgroGreen,
                    contentColor = Color.White
                )
            }
        }
    ) { paddingValues ->
        Box(modifier = Modifier.padding(paddingValues)) {
            when (uiState) {
                is UIState.Loading -> {
                    LoadingState(message = "Cargando etapas...")
                }
                is UIState.Error -> {
                    ErrorState(
                        message = (uiState as UIState.Error).message,
                        onRetry = { viewModel.retry() }
                    )
                }
                is UIState.Success -> {
                    val data = (uiState as UIState.Success<BatchStagesResponse>).data
                    VerificationStagesContent(
                        stagesResponse = data,
                        onStageClick = { stage ->
                            if (stage.status == StageStatus.PENDING) {
                                viewModel.showApprovalDialog(stage)
                            }
                        }
                    )
                }
                else -> {
                    EmptyState(
                        message = "No hay datos disponibles",
                        actionLabel = "Cargar",
                        onAction = { viewModel.loadStages() }
                    )
                }
            }

            // Loading overlay for operations
            if (isCreatingStage || isUpdatingStage) {
                Box(
                    modifier = Modifier
                        .fillMaxSize()
                        .background(Color.Black.copy(alpha = 0.3f)),
                    contentAlignment = Alignment.Center
                ) {
                    CircularProgressIndicator(color = AgroGreen)
                }
            }
        }

        // Create Stage Dialog
        if (showCreateDialog) {
            val nextStage = viewModel.getNextStageType()
            if (nextStage != null) {
                CreateStageDialog(
                    stageType = nextStage,
                    onDismiss = { viewModel.hideCreateStageDialog() },
                    onCreate = { location, notes ->
                        viewModel.createNextStage(location = location, notes = notes)
                    }
                )
            }
        }

        // Approval Dialog
        selectedStageForApproval?.let { stage ->
            StageApprovalDialog(
                stage = stage,
                onDismiss = { viewModel.hideApprovalDialog() },
                onApprove = { notes -> viewModel.approveStage(stage.id, notes) },
                onReject = { notes -> viewModel.rejectStage(stage.id, notes) },
                onFlag = { notes -> viewModel.flagStage(stage.id, notes) }
            )
        }

        // Error Snackbar
        operationError?.let { error ->
            LaunchedEffect(error) {
                kotlinx.coroutines.delay(3000)
                viewModel.clearError()
            }
        }
    }
}

@Composable
private fun VerificationStagesContent(
    stagesResponse: BatchStagesResponse,
    onStageClick: (VerificationStage) -> Unit
) {
    Column(modifier = Modifier.fillMaxSize()) {
        // Progress Header
        ProgressHeader(
            progress = stagesResponse.progress,
            isComplete = stagesResponse.isComplete,
            nextStage = stagesResponse.nextStage
        )

        // Timeline
        LazyColumn(
            modifier = Modifier.fillMaxSize(),
            contentPadding = PaddingValues(16.dp)
        ) {
            items(StageType.allStages) { stageType ->
                val stage = stagesResponse.stages.find { it.stageType == stageType }
                val isNext = stageType == stagesResponse.nextStage
                val isLast = stageType == StageType.DELIVERY

                StageTimelineItem(
                    stageType = stageType,
                    stage = stage,
                    isNext = isNext,
                    isLast = isLast,
                    onClick = { stage?.let { onStageClick(it) } }
                )
            }
        }
    }
}

@Composable
private fun ProgressHeader(
    progress: Int,
    isComplete: Boolean,
    nextStage: StageType?
) {
    Surface(
        modifier = Modifier.fillMaxWidth(),
        color = MaterialTheme.colorScheme.surface,
        shadowElevation = 4.dp
    ) {
        Column(
            modifier = Modifier.padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            // Progress Bar
            LinearProgressIndicator(
                progress = { progress / 100f },
                modifier = Modifier
                    .fillMaxWidth()
                    .height(8.dp)
                    .clip(RoundedCornerShape(4.dp)),
                color = if (isComplete) StatusApproved else Info,
                trackColor = MaterialTheme.colorScheme.surfaceVariant
            )

            // Progress Text
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = "$progress% completado",
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )

                if (isComplete) {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(4.dp)
                    ) {
                        Icon(
                            imageVector = Icons.Default.CheckCircle,
                            contentDescription = null,
                            tint = StatusApproved,
                            modifier = Modifier.size(16.dp)
                        )
                        Text(
                            text = "Todas las etapas completas",
                            style = MaterialTheme.typography.bodySmall,
                            color = StatusApproved
                        )
                    }
                } else if (nextStage != null) {
                    Text(
                        text = "Siguiente: ${nextStage.displayName}",
                        style = MaterialTheme.typography.bodySmall,
                        color = Info
                    )
                }
            }
        }
    }
}

@Composable
private fun StageTimelineItem(
    stageType: StageType,
    stage: VerificationStage?,
    isNext: Boolean,
    isLast: Boolean,
    onClick: () -> Unit
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(enabled = stage?.status == StageStatus.PENDING) { onClick() }
            .padding(vertical = 8.dp),
        horizontalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        // Timeline indicator column
        Column(
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            // Circle indicator
            Box(
                modifier = Modifier
                    .size(44.dp)
                    .clip(CircleShape)
                    .background(
                        when {
                            stage != null -> stage.status.color
                            isNext -> Info
                            else -> MaterialTheme.colorScheme.surfaceVariant
                        }
                    ),
                contentAlignment = Alignment.Center
            ) {
                Text(
                    text = stageType.icon,
                    fontSize = 20.sp
                )
            }

            // Line connector
            if (!isLast) {
                Box(
                    modifier = Modifier
                        .width(2.dp)
                        .height(60.dp)
                        .background(
                            if (stage?.status == StageStatus.APPROVED)
                                StatusApproved
                            else
                                MaterialTheme.colorScheme.surfaceVariant
                        )
                )
            }
        }

        // Content column
        Column(
            modifier = Modifier
                .weight(1f)
                .padding(bottom = if (isLast) 0.dp else 16.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            // Header row
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = stageType.displayName,
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.SemiBold
                )

                when {
                    stage != null -> {
                        StageStatusChip(status = stage.status)
                    }
                    isNext -> {
                        Surface(
                            color = Info.copy(alpha = 0.1f),
                            shape = RoundedCornerShape(4.dp)
                        ) {
                            Text(
                                text = "Próximo",
                                modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp),
                                style = MaterialTheme.typography.labelSmall,
                                color = Info
                            )
                        }
                    }
                }
            }

            // Stage details (if exists)
            stage?.let { s ->
                // Timestamp
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(4.dp)
                ) {
                    Icon(
                        imageVector = Icons.Default.Schedule,
                        contentDescription = null,
                        modifier = Modifier.size(14.dp),
                        tint = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                    Text(
                        text = s.formattedTimestamp,
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }

                // Location (if available)
                s.location?.let { location ->
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(4.dp)
                    ) {
                        Icon(
                            imageVector = Icons.Default.LocationOn,
                            contentDescription = null,
                            modifier = Modifier.size(14.dp),
                            tint = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                        Text(
                            text = location,
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                }

                // Notes (if available)
                s.notes?.let { notes ->
                    Text(
                        text = notes,
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        maxLines = 2
                    )
                }

                // Action button for pending stages
                if (s.status == StageStatus.PENDING) {
                    TextButton(onClick = onClick) {
                        Icon(
                            imageVector = Icons.Default.CheckCircle,
                            contentDescription = null,
                            modifier = Modifier.size(16.dp)
                        )
                        Spacer(modifier = Modifier.width(4.dp))
                        Text("Revisar y Aprobar")
                    }
                }
            }
        }
    }
}

@Composable
private fun StageStatusChip(status: StageStatus) {
    Surface(
        color = status.color.copy(alpha = 0.2f),
        shape = RoundedCornerShape(4.dp)
    ) {
        Row(
            modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(4.dp)
        ) {
            Text(
                text = status.icon,
                fontSize = 12.sp
            )
            Text(
                text = status.displayName,
                style = MaterialTheme.typography.labelSmall,
                color = status.color,
                fontWeight = FontWeight.Medium
            )
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun CreateStageDialog(
    stageType: StageType,
    onDismiss: () -> Unit,
    onCreate: (location: String?, notes: String?) -> Unit
) {
    var location by remember { mutableStateOf("") }
    var notes by remember { mutableStateOf("") }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = {
            Text("Crear Etapa: ${stageType.displayName}")
        },
        text = {
            Column(
                verticalArrangement = Arrangement.spacedBy(16.dp)
            ) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    Text(
                        text = stageType.icon,
                        fontSize = 32.sp
                    )
                    Text(
                        text = stageType.displayName,
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.SemiBold
                    )
                }

                OutlinedTextField(
                    value = location,
                    onValueChange = { location = it },
                    label = { Text("Ubicación") },
                    placeholder = { Text("Ej: Campo A, Michoacán") },
                    modifier = Modifier.fillMaxWidth(),
                    leadingIcon = {
                        Icon(Icons.Default.LocationOn, contentDescription = null)
                    }
                )

                OutlinedTextField(
                    value = notes,
                    onValueChange = { notes = it },
                    label = { Text("Notas") },
                    placeholder = { Text("Notas adicionales...") },
                    modifier = Modifier.fillMaxWidth(),
                    minLines = 3,
                    maxLines = 5
                )
            }
        },
        confirmButton = {
            Button(
                onClick = {
                    onCreate(
                        location.ifBlank { null },
                        notes.ifBlank { null }
                    )
                },
                colors = ButtonDefaults.buttonColors(containerColor = AgroGreen)
            ) {
                Text("Crear")
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) {
                Text("Cancelar")
            }
        }
    )
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun StageApprovalDialog(
    stage: VerificationStage,
    onDismiss: () -> Unit,
    onApprove: (String?) -> Unit,
    onReject: (String) -> Unit,
    onFlag: (String) -> Unit
) {
    var notes by remember { mutableStateOf("") }
    var selectedAction by remember { mutableStateOf(ApprovalAction.APPROVE) }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = {
            Text("Revisar Etapa")
        },
        text = {
            Column(
                verticalArrangement = Arrangement.spacedBy(16.dp)
            ) {
                // Stage info
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    colors = CardDefaults.cardColors(
                        containerColor = MaterialTheme.colorScheme.surfaceVariant
                    )
                ) {
                    Column(
                        modifier = Modifier.padding(16.dp),
                        verticalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(8.dp)
                        ) {
                            Text(
                                text = stage.stageType.icon,
                                fontSize = 24.sp
                            )
                            Text(
                                text = stage.stageType.displayName,
                                style = MaterialTheme.typography.titleMedium,
                                fontWeight = FontWeight.SemiBold
                            )
                        }

                        stage.location?.let {
                            Row(
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.spacedBy(4.dp)
                            ) {
                                Icon(
                                    Icons.Default.LocationOn,
                                    contentDescription = null,
                                    modifier = Modifier.size(16.dp)
                                )
                                Text(
                                    text = it,
                                    style = MaterialTheme.typography.bodySmall
                                )
                            }
                        }

                        Text(
                            text = stage.formattedTimestamp,
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                }

                // Action selection
                Text(
                    text = "Acción",
                    style = MaterialTheme.typography.labelMedium
                )

                SingleChoiceSegmentedButtonRow(modifier = Modifier.fillMaxWidth()) {
                    ApprovalAction.values().forEachIndexed { index, action ->
                        SegmentedButton(
                            selected = selectedAction == action,
                            onClick = { selectedAction = action },
                            shape = SegmentedButtonDefaults.itemShape(
                                index = index,
                                count = ApprovalAction.values().size
                            )
                        ) {
                            Text(action.displayName)
                        }
                    }
                }

                // Notes field
                OutlinedTextField(
                    value = notes,
                    onValueChange = { notes = it },
                    label = { Text("Notas") },
                    modifier = Modifier.fillMaxWidth(),
                    minLines = 2,
                    maxLines = 4
                )

                if (selectedAction != ApprovalAction.APPROVE && notes.isBlank()) {
                    Text(
                        text = "Las notas son requeridas para esta acción",
                        style = MaterialTheme.typography.bodySmall,
                        color = Warning
                    )
                }
            }
        },
        confirmButton = {
            Button(
                onClick = {
                    when (selectedAction) {
                        ApprovalAction.APPROVE -> onApprove(notes.ifBlank { null })
                        ApprovalAction.REJECT -> onReject(notes)
                        ApprovalAction.FLAG -> onFlag(notes)
                    }
                },
                enabled = selectedAction == ApprovalAction.APPROVE || notes.isNotBlank(),
                colors = ButtonDefaults.buttonColors(
                    containerColor = when (selectedAction) {
                        ApprovalAction.APPROVE -> StatusApproved
                        ApprovalAction.REJECT -> StatusRejected
                        ApprovalAction.FLAG -> StatusFlagged
                    }
                )
            ) {
                Text(selectedAction.displayName)
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) {
                Text("Cancelar")
            }
        }
    )
}

private enum class ApprovalAction(val displayName: String) {
    APPROVE("Aprobar"),
    REJECT("Rechazar"),
    FLAG("Marcar")
}
