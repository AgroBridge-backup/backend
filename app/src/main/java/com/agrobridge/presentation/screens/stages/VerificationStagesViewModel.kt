package com.agrobridge.presentation.screens.stages

import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.agrobridge.data.model.*
import com.agrobridge.presentation.model.UIState
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

/**
 * Traceability 2.0 - Multi-Stage Verification
 * ViewModel for managing verification stages
 *
 * Features:
 * - Load stages for a batch
 * - Create new stages
 * - Update stage status (approve/reject/flag)
 * - Track progress
 */
@HiltViewModel
class VerificationStagesViewModel @Inject constructor(
    savedStateHandle: SavedStateHandle
    // TODO: Inject VerificationStagesRepository when implemented
) : ViewModel() {

    // Batch ID from navigation arguments
    private val batchId: String = savedStateHandle.get<String>("batchId") ?: ""

    // UI State
    private val _uiState = MutableStateFlow<UIState<BatchStagesResponse>>(UIState.Idle)
    val uiState: StateFlow<UIState<BatchStagesResponse>> = _uiState.asStateFlow()

    // Operation states
    private val _isCreatingStage = MutableStateFlow(false)
    val isCreatingStage: StateFlow<Boolean> = _isCreatingStage.asStateFlow()

    private val _isUpdatingStage = MutableStateFlow(false)
    val isUpdatingStage: StateFlow<Boolean> = _isUpdatingStage.asStateFlow()

    // Error state for operations
    private val _operationError = MutableStateFlow<String?>(null)
    val operationError: StateFlow<String?> = _operationError.asStateFlow()

    // Stage creation dialog state
    private val _showCreateDialog = MutableStateFlow(false)
    val showCreateDialog: StateFlow<Boolean> = _showCreateDialog.asStateFlow()

    // Stage approval dialog state
    private val _selectedStageForApproval = MutableStateFlow<VerificationStage?>(null)
    val selectedStageForApproval: StateFlow<VerificationStage?> = _selectedStageForApproval.asStateFlow()

    init {
        if (batchId.isNotEmpty()) {
            loadStages()
        }
    }

    /**
     * Load all stages for the current batch
     */
    fun loadStages() {
        if (batchId.isEmpty()) {
            _uiState.value = UIState.Error(
                error = IllegalArgumentException("Batch ID is required"),
                message = "ID de lote no proporcionado"
            )
            return
        }

        viewModelScope.launch {
            _uiState.value = UIState.Loading()

            try {
                // TODO: Replace with actual API call
                // val response = repository.getStages(batchId)
                // For now, use mock data
                kotlinx.coroutines.delay(500) // Simulate network delay
                val response = BatchStagesResponse.mock()
                _uiState.value = UIState.Success(response)
            } catch (e: Exception) {
                _uiState.value = UIState.Error(
                    error = e,
                    message = "Error al cargar las etapas: ${e.message}"
                )
            }
        }
    }

    /**
     * Create the next stage in sequence
     */
    fun createNextStage(
        location: String? = null,
        notes: String? = null,
        evidenceUrl: String? = null,
        latitude: Double? = null,
        longitude: Double? = null
    ) {
        viewModelScope.launch {
            _isCreatingStage.value = true
            _operationError.value = null

            try {
                val request = CreateStageRequest(
                    location = location,
                    notes = notes,
                    evidenceUrl = evidenceUrl,
                    latitude = latitude,
                    longitude = longitude
                )

                // TODO: Replace with actual API call
                // val response = repository.createStage(batchId, request)
                kotlinx.coroutines.delay(500) // Simulate network delay

                // Reload stages after creation
                loadStages()
                _showCreateDialog.value = false
            } catch (e: Exception) {
                _operationError.value = "Error al crear la etapa: ${e.message}"
            } finally {
                _isCreatingStage.value = false
            }
        }
    }

    /**
     * Update a stage status
     */
    fun updateStage(
        stageId: String,
        status: StageStatus? = null,
        notes: String? = null
    ) {
        viewModelScope.launch {
            _isUpdatingStage.value = true
            _operationError.value = null

            try {
                val request = UpdateStageRequest(
                    status = status,
                    notes = notes
                )

                // TODO: Replace with actual API call
                // val response = repository.updateStage(batchId, stageId, request)
                kotlinx.coroutines.delay(500) // Simulate network delay

                // Reload stages after update
                loadStages()
                _selectedStageForApproval.value = null
            } catch (e: Exception) {
                _operationError.value = "Error al actualizar la etapa: ${e.message}"
            } finally {
                _isUpdatingStage.value = false
            }
        }
    }

    /**
     * Approve a stage
     */
    fun approveStage(stageId: String, notes: String? = null) {
        updateStage(stageId, StageStatus.APPROVED, notes)
    }

    /**
     * Reject a stage
     */
    fun rejectStage(stageId: String, notes: String) {
        updateStage(stageId, StageStatus.REJECTED, notes)
    }

    /**
     * Flag a stage for review
     */
    fun flagStage(stageId: String, notes: String) {
        updateStage(stageId, StageStatus.FLAGGED, notes)
    }

    /**
     * Show create stage dialog
     */
    fun showCreateStageDialog() {
        _showCreateDialog.value = true
    }

    /**
     * Hide create stage dialog
     */
    fun hideCreateStageDialog() {
        _showCreateDialog.value = false
    }

    /**
     * Show approval dialog for a stage
     */
    fun showApprovalDialog(stage: VerificationStage) {
        _selectedStageForApproval.value = stage
    }

    /**
     * Hide approval dialog
     */
    fun hideApprovalDialog() {
        _selectedStageForApproval.value = null
    }

    /**
     * Clear operation error
     */
    fun clearError() {
        _operationError.value = null
    }

    /**
     * Retry loading stages
     */
    fun retry() {
        loadStages()
    }

    /**
     * Get progress as a float (0.0 to 1.0) for progress indicator
     */
    fun getProgressFraction(): Float {
        val state = _uiState.value
        return if (state is UIState.Success) {
            state.data.progress / 100f
        } else {
            0f
        }
    }

    /**
     * Check if all stages are complete
     */
    fun isComplete(): Boolean {
        val state = _uiState.value
        return if (state is UIState.Success) {
            state.data.isComplete
        } else {
            false
        }
    }

    /**
     * Get the next stage type that can be created
     */
    fun getNextStageType(): StageType? {
        val state = _uiState.value
        return if (state is UIState.Success) {
            state.data.nextStage
        } else {
            null
        }
    }
}
