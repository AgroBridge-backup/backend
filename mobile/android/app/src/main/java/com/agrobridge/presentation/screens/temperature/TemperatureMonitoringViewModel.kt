/**
 * Traceability 2.0 - Cold Chain Temperature Log
 * Android ViewModel
 */

package com.agrobridge.presentation.screens.temperature

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import javax.inject.Inject

@HiltViewModel
class TemperatureMonitoringViewModel @Inject constructor(
    private val temperatureRepository: TemperatureRepository
) : ViewModel() {

    private val _uiState = MutableStateFlow(TemperatureUiState())
    val uiState: StateFlow<TemperatureUiState> = _uiState.asStateFlow()

    fun loadData(batchId: String) {
        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true, error = null) }

            try {
                // Load all data in parallel
                val summaryDeferred = temperatureRepository.getSummary(batchId)
                val readingsDeferred = temperatureRepository.getReadings(batchId, limit = 50)
                val chartDeferred = temperatureRepository.getChartData(batchId, hours = 24)
                val latestDeferred = temperatureRepository.getLatestReading(batchId)

                _uiState.update { state ->
                    state.copy(
                        isLoading = false,
                        summary = summaryDeferred,
                        readings = readingsDeferred,
                        chartData = chartDeferred,
                        latestReading = latestDeferred
                    )
                }
            } catch (e: Exception) {
                _uiState.update {
                    it.copy(isLoading = false, error = e.message ?: "Error al cargar datos")
                }
            }
        }
    }

    fun loadCompliance(batchId: String) {
        viewModelScope.launch {
            try {
                val compliance = temperatureRepository.checkCompliance(batchId)
                _uiState.update { it.copy(compliance = compliance) }
            } catch (e: Exception) {
                _uiState.update { it.copy(error = e.message ?: "Error al verificar cumplimiento") }
            }
        }
    }

    fun recordTemperature(batchId: String, value: Double, humidity: Double?) {
        viewModelScope.launch {
            try {
                temperatureRepository.recordTemperature(
                    batchId = batchId,
                    value = value,
                    humidity = humidity,
                    source = TemperatureSource.DRIVER_APP
                )
                hideManualEntry()
                loadData(batchId)
            } catch (e: Exception) {
                _uiState.update { it.copy(error = e.message ?: "Error al registrar temperatura") }
            }
        }
    }

    fun showManualEntry() {
        _uiState.update { it.copy(showManualEntry = true) }
    }

    fun hideManualEntry() {
        _uiState.update { it.copy(showManualEntry = false) }
    }

    fun clearError() {
        _uiState.update { it.copy(error = null) }
    }
}

// Repository interface for dependency injection
interface TemperatureRepository {
    suspend fun getSummary(batchId: String): TemperatureSummary?
    suspend fun getReadings(batchId: String, limit: Int): List<TemperatureReading>
    suspend fun getChartData(batchId: String, hours: Int): TemperatureChartData?
    suspend fun getLatestReading(batchId: String): TemperatureReading?
    suspend fun checkCompliance(batchId: String): ComplianceResult
    suspend fun recordTemperature(
        batchId: String,
        value: Double,
        humidity: Double?,
        source: TemperatureSource
    ): TemperatureReading
}
