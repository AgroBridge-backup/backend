package com.agrobridge.presentation.screens.satellite

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import java.time.LocalDate
import java.time.LocalDateTime
import java.time.format.DateTimeFormatter
import javax.inject.Inject

// ═══════════════════════════════════════════════════════════════════════════════
// TRACEABILITY 2.0 - SATELLITE IMAGERY TIME-LAPSE
// Android ViewModel for Field Monitoring and Health Analysis
// ═══════════════════════════════════════════════════════════════════════════════

@HiltViewModel
class SatelliteImageryViewModel @Inject constructor(
    // private val satelliteRepository: SatelliteRepository
) : ViewModel() {

    private val _uiState = MutableStateFlow(SatelliteUiState())
    val uiState: StateFlow<SatelliteUiState> = _uiState.asStateFlow()

    private val _selectedField = MutableStateFlow<Field?>(null)
    val selectedField: StateFlow<Field?> = _selectedField.asStateFlow()

    private val _timeLapseState = MutableStateFlow(TimeLapseState())
    val timeLapseState: StateFlow<TimeLapseState> = _timeLapseState.asStateFlow()

    init {
        loadFields()
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // FIELD MANAGEMENT
    // ═══════════════════════════════════════════════════════════════════════════

    fun loadFields() {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isLoading = true, error = null)
            try {
                // TODO: Replace with actual API call
                // val fields = satelliteRepository.getProducerFields(producerId)
                val fields = getMockFields()
                _uiState.value = _uiState.value.copy(
                    isLoading = false,
                    fields = fields
                )
                if (fields.isNotEmpty() && _selectedField.value == null) {
                    selectField(fields.first())
                }
            } catch (e: Exception) {
                _uiState.value = _uiState.value.copy(
                    isLoading = false,
                    error = e.message ?: "Failed to load fields"
                )
            }
        }
    }

    fun selectField(field: Field) {
        _selectedField.value = field
        loadFieldHealth(field.id)
        loadNdviSeries(field.id)
        loadLatestImagery(field.id)
    }

    fun createField(
        name: String,
        cropType: String,
        boundaryCoordinates: List<List<Double>>,
        plantingDate: LocalDate?,
        expectedHarvestDate: LocalDate?
    ) {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isLoading = true)
            try {
                // TODO: Replace with actual API call
                // val result = satelliteRepository.createField(CreateFieldRequest(...))
                val newField = Field(
                    id = java.util.UUID.randomUUID().toString(),
                    name = name,
                    cropType = cropType,
                    status = FieldStatus.ACTIVE,
                    areaHectares = 12.5,
                    plantingDate = plantingDate,
                    expectedHarvestDate = expectedHarvestDate,
                    centroidLatitude = boundaryCoordinates.firstOrNull()?.getOrNull(1) ?: 0.0,
                    centroidLongitude = boundaryCoordinates.firstOrNull()?.getOrNull(0) ?: 0.0,
                    createdAt = LocalDateTime.now()
                )
                val updatedFields = _uiState.value.fields + newField
                _uiState.value = _uiState.value.copy(
                    isLoading = false,
                    fields = updatedFields
                )
                selectField(newField)
            } catch (e: Exception) {
                _uiState.value = _uiState.value.copy(
                    isLoading = false,
                    error = e.message ?: "Failed to create field"
                )
            }
        }
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // HEALTH ANALYSIS
    // ═══════════════════════════════════════════════════════════════════════════

    private fun loadFieldHealth(fieldId: String) {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isLoadingHealth = true)
            try {
                // TODO: Replace with actual API call
                // val health = satelliteRepository.getFieldHealth(fieldId)
                delay(500) // Simulate network delay
                val health = getMockHealthAnalysis(fieldId)
                _uiState.value = _uiState.value.copy(
                    isLoadingHealth = false,
                    healthAnalysis = health
                )
            } catch (e: Exception) {
                _uiState.value = _uiState.value.copy(
                    isLoadingHealth = false,
                    error = e.message
                )
            }
        }
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // NDVI TIME SERIES
    // ═══════════════════════════════════════════════════════════════════════════

    private fun loadNdviSeries(fieldId: String, days: Int = 90) {
        viewModelScope.launch {
            try {
                // TODO: Replace with actual API call
                // val series = satelliteRepository.getNdviSeries(fieldId, days)
                delay(300)
                val series = getMockNdviSeries(days)
                _uiState.value = _uiState.value.copy(ndviSeries = series)
            } catch (e: Exception) {
                _uiState.value = _uiState.value.copy(
                    error = e.message
                )
            }
        }
    }

    fun refreshNdviSeries(days: Int) {
        _selectedField.value?.let { field ->
            loadNdviSeries(field.id, days)
        }
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // IMAGERY
    // ═══════════════════════════════════════════════════════════════════════════

    private fun loadLatestImagery(fieldId: String) {
        viewModelScope.launch {
            try {
                // TODO: Replace with actual API call
                // val imagery = satelliteRepository.getLatestImagery(fieldId)
                delay(200)
                val imagery = getMockImagery()
                _uiState.value = _uiState.value.copy(latestImagery = imagery)
            } catch (e: Exception) {
                _uiState.value = _uiState.value.copy(error = e.message)
            }
        }
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // TIME-LAPSE GENERATION
    // ═══════════════════════════════════════════════════════════════════════════

    fun generateTimeLapse(
        startDate: LocalDate,
        endDate: LocalDate,
        imageType: ImageryType = ImageryType.NDVI,
        maxCloudCover: Int = 30
    ) {
        val fieldId = _selectedField.value?.id ?: return

        viewModelScope.launch {
            _timeLapseState.value = _timeLapseState.value.copy(
                isGenerating = true,
                error = null
            )
            try {
                // TODO: Replace with actual API call
                // val timeLapse = satelliteRepository.generateTimeLapse(
                //     fieldId, startDate, endDate, imageType, maxCloudCover
                // )
                delay(1500) // Simulate processing time
                val timeLapse = getMockTimeLapse(fieldId, startDate, endDate, imageType)
                _timeLapseState.value = _timeLapseState.value.copy(
                    isGenerating = false,
                    timeLapse = timeLapse,
                    currentFrameIndex = 0,
                    isPlaying = false
                )
            } catch (e: Exception) {
                _timeLapseState.value = _timeLapseState.value.copy(
                    isGenerating = false,
                    error = e.message ?: "Failed to generate time-lapse"
                )
            }
        }
    }

    fun playTimeLapse() {
        val timeLapse = _timeLapseState.value.timeLapse ?: return
        if (timeLapse.frames.isEmpty()) return

        _timeLapseState.value = _timeLapseState.value.copy(isPlaying = true)

        viewModelScope.launch {
            while (_timeLapseState.value.isPlaying) {
                delay(_timeLapseState.value.playbackSpeed.toLong())
                val currentIndex = _timeLapseState.value.currentFrameIndex
                val nextIndex = (currentIndex + 1) % timeLapse.frames.size
                _timeLapseState.value = _timeLapseState.value.copy(
                    currentFrameIndex = nextIndex
                )
                if (nextIndex == 0 && !_timeLapseState.value.loopPlayback) {
                    pauseTimeLapse()
                }
            }
        }
    }

    fun pauseTimeLapse() {
        _timeLapseState.value = _timeLapseState.value.copy(isPlaying = false)
    }

    fun seekToFrame(index: Int) {
        val timeLapse = _timeLapseState.value.timeLapse ?: return
        if (index in timeLapse.frames.indices) {
            _timeLapseState.value = _timeLapseState.value.copy(currentFrameIndex = index)
        }
    }

    fun setPlaybackSpeed(speed: Int) {
        _timeLapseState.value = _timeLapseState.value.copy(playbackSpeed = speed)
    }

    fun toggleLoopPlayback() {
        _timeLapseState.value = _timeLapseState.value.copy(
            loopPlayback = !_timeLapseState.value.loopPlayback
        )
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // BATCH LINKING
    // ═══════════════════════════════════════════════════════════════════════════

    fun linkFieldToBatch(batchId: String) {
        val fieldId = _selectedField.value?.id ?: return

        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isLoading = true)
            try {
                // TODO: Replace with actual API call
                // satelliteRepository.linkFieldToBatch(fieldId, batchId)
                delay(500)
                _uiState.value = _uiState.value.copy(
                    isLoading = false,
                    successMessage = "Field linked to batch successfully"
                )
            } catch (e: Exception) {
                _uiState.value = _uiState.value.copy(
                    isLoading = false,
                    error = e.message ?: "Failed to link field to batch"
                )
            }
        }
    }

    fun clearError() {
        _uiState.value = _uiState.value.copy(error = null)
    }

    fun clearSuccessMessage() {
        _uiState.value = _uiState.value.copy(successMessage = null)
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // MOCK DATA (Replace with actual API integration)
    // ═══════════════════════════════════════════════════════════════════════════

    private fun getMockFields(): List<Field> = listOf(
        Field(
            id = "field-001",
            name = "North Coffee Plantation",
            cropType = "Arabica Coffee",
            status = FieldStatus.ACTIVE,
            areaHectares = 25.5,
            plantingDate = LocalDate.of(2024, 3, 15),
            expectedHarvestDate = LocalDate.of(2025, 9, 1),
            centroidLatitude = -3.7847,
            centroidLongitude = -38.5916,
            createdAt = LocalDateTime.now().minusMonths(9)
        ),
        Field(
            id = "field-002",
            name = "South Cacao Grove",
            cropType = "Cacao",
            status = FieldStatus.ACTIVE,
            areaHectares = 18.2,
            plantingDate = LocalDate.of(2024, 1, 10),
            expectedHarvestDate = LocalDate.of(2025, 6, 15),
            centroidLatitude = -3.7912,
            centroidLongitude = -38.5834,
            createdAt = LocalDateTime.now().minusMonths(11)
        ),
        Field(
            id = "field-003",
            name = "East Sugarcane Field",
            cropType = "Sugarcane",
            status = FieldStatus.HARVESTED,
            areaHectares = 42.0,
            plantingDate = LocalDate.of(2023, 9, 1),
            expectedHarvestDate = LocalDate.of(2024, 8, 15),
            centroidLatitude = -3.7756,
            centroidLongitude = -38.5748,
            createdAt = LocalDateTime.now().minusMonths(15)
        )
    )

    private fun getMockHealthAnalysis(fieldId: String) = HealthAnalysis(
        fieldId = fieldId,
        analysisDate = LocalDateTime.now(),
        overallHealthScore = 78,
        ndviAverage = 0.72,
        ndviMin = 0.45,
        ndviMax = 0.89,
        healthDistribution = HealthDistribution(
            excellent = 35.0,
            good = 42.0,
            fair = 18.0,
            poor = 4.0,
            critical = 1.0
        ),
        anomalies = listOf(
            Anomaly(
                type = AnomalyType.WATER_STRESS,
                severity = AnomalySeverity.MEDIUM,
                affectedAreaHectares = 2.3,
                affectedAreaPercent = 9.0,
                description = "Moderate water stress detected in northeast sector",
                detectedAt = LocalDateTime.now().minusDays(3)
            )
        ),
        recommendations = listOf(
            "Consider targeted irrigation in northeast sector",
            "Field health is generally within normal parameters",
            "Next satellite pass scheduled in 3 days"
        ),
        trend = NdviTrend.STABLE
    )

    private fun getMockNdviSeries(days: Int): List<NdviDataPoint> {
        val points = mutableListOf<NdviDataPoint>()
        var baseNdvi = 0.65
        for (i in days downTo 0 step 5) {
            val date = LocalDate.now().minusDays(i.toLong())
            val variation = (Math.random() - 0.5) * 0.1
            val ndvi = (baseNdvi + variation).coerceIn(0.3, 0.95)
            baseNdvi += 0.005 // Gradual improvement trend
            points.add(NdviDataPoint(date = date, ndviValue = ndvi))
        }
        return points
    }

    private fun getMockImagery() = FieldImagery(
        id = "img-latest",
        fieldId = "field-001",
        source = ImagerySource.SENTINEL_2,
        imageType = ImageryType.NDVI,
        captureDate = LocalDateTime.now().minusDays(2),
        imageUrl = "https://example.com/satellite/latest-ndvi.png",
        thumbnailUrl = "https://example.com/satellite/latest-ndvi-thumb.png",
        cloudCoverPercent = 12,
        ndviValue = 0.74,
        healthScore = 78,
        resolutionMeters = 10.0
    )

    private fun getMockTimeLapse(
        fieldId: String,
        startDate: LocalDate,
        endDate: LocalDate,
        imageType: ImageryType
    ): TimeLapse {
        val frames = mutableListOf<TimeLapseFrame>()
        var currentDate = startDate
        var frameIndex = 0
        var baseNdvi = 0.55

        while (!currentDate.isAfter(endDate)) {
            val variation = (Math.random() - 0.5) * 0.08
            val ndvi = (baseNdvi + variation).coerceIn(0.2, 0.95)
            baseNdvi += 0.01

            frames.add(
                TimeLapseFrame(
                    date = currentDate.atStartOfDay(),
                    imageUrl = "https://example.com/satellite/frame-$frameIndex.png",
                    ndviValue = ndvi,
                    healthScore = (ndvi * 100).toInt().coerceIn(0, 100),
                    cloudCoverPercent = (Math.random() * 25).toInt()
                )
            )
            currentDate = currentDate.plusDays(7) // Weekly intervals
            frameIndex++
        }

        val ndviValues = frames.map { it.ndviValue ?: 0.0 }
        return TimeLapse(
            fieldId = fieldId,
            startDate = startDate,
            endDate = endDate,
            imageType = imageType,
            frames = frames,
            frameCount = frames.size,
            averageNdvi = if (ndviValues.isNotEmpty()) ndviValues.average() else null,
            ndviTrend = NdviTrend.IMPROVING,
            healthTrend = NdviTrend.STABLE
        )
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
// UI STATE MODELS
// ═══════════════════════════════════════════════════════════════════════════════

data class SatelliteUiState(
    val isLoading: Boolean = false,
    val isLoadingHealth: Boolean = false,
    val fields: List<Field> = emptyList(),
    val healthAnalysis: HealthAnalysis? = null,
    val ndviSeries: List<NdviDataPoint> = emptyList(),
    val latestImagery: FieldImagery? = null,
    val error: String? = null,
    val successMessage: String? = null
)

data class TimeLapseState(
    val isGenerating: Boolean = false,
    val timeLapse: TimeLapse? = null,
    val currentFrameIndex: Int = 0,
    val isPlaying: Boolean = false,
    val playbackSpeed: Int = 1000, // milliseconds per frame
    val loopPlayback: Boolean = true,
    val error: String? = null
)

// ═══════════════════════════════════════════════════════════════════════════════
// DOMAIN MODELS
// ═══════════════════════════════════════════════════════════════════════════════

data class Field(
    val id: String,
    val name: String,
    val cropType: String?,
    val status: FieldStatus,
    val areaHectares: Double?,
    val plantingDate: LocalDate?,
    val expectedHarvestDate: LocalDate?,
    val centroidLatitude: Double,
    val centroidLongitude: Double,
    val createdAt: LocalDateTime
)

enum class FieldStatus {
    ACTIVE, FALLOW, HARVESTED, ARCHIVED
}

data class HealthAnalysis(
    val fieldId: String,
    val analysisDate: LocalDateTime,
    val overallHealthScore: Int,
    val ndviAverage: Double,
    val ndviMin: Double,
    val ndviMax: Double,
    val healthDistribution: HealthDistribution,
    val anomalies: List<Anomaly>,
    val recommendations: List<String>,
    val trend: NdviTrend
)

data class HealthDistribution(
    val excellent: Double,
    val good: Double,
    val fair: Double,
    val poor: Double,
    val critical: Double
)

data class Anomaly(
    val type: AnomalyType,
    val severity: AnomalySeverity,
    val affectedAreaHectares: Double,
    val affectedAreaPercent: Double,
    val description: String,
    val detectedAt: LocalDateTime
)

enum class AnomalyType {
    WATER_STRESS, NUTRIENT_DEFICIENCY, PEST_DAMAGE, DISEASE, DROUGHT, FLOODING, OTHER
}

enum class AnomalySeverity {
    LOW, MEDIUM, HIGH, CRITICAL
}

data class NdviDataPoint(
    val date: LocalDate,
    val ndviValue: Double
)

data class FieldImagery(
    val id: String,
    val fieldId: String,
    val source: ImagerySource,
    val imageType: ImageryType,
    val captureDate: LocalDateTime,
    val imageUrl: String,
    val thumbnailUrl: String?,
    val cloudCoverPercent: Int,
    val ndviValue: Double?,
    val healthScore: Int?,
    val resolutionMeters: Double?
)

enum class ImagerySource {
    SENTINEL_2, LANDSAT_8, PLANET, CUSTOM
}

enum class ImageryType {
    NDVI, NDWI, RGB, INFRARED, THERMAL
}

data class TimeLapse(
    val fieldId: String,
    val startDate: LocalDate,
    val endDate: LocalDate,
    val imageType: ImageryType,
    val frames: List<TimeLapseFrame>,
    val frameCount: Int,
    val averageNdvi: Double?,
    val ndviTrend: NdviTrend,
    val healthTrend: NdviTrend
)

data class TimeLapseFrame(
    val date: LocalDateTime,
    val imageUrl: String,
    val ndviValue: Double?,
    val healthScore: Int?,
    val cloudCoverPercent: Int
)

enum class NdviTrend {
    IMPROVING, STABLE, DECLINING
}
