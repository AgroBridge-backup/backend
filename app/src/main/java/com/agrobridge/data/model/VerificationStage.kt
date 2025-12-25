package com.agrobridge.data.model

import androidx.compose.ui.graphics.Color
import com.agrobridge.presentation.theme.*
import com.google.gson.annotations.SerializedName

/**
 * Traceability 2.0 - Multi-Stage Verification
 * Model for Verification Stages
 *
 * Represents a verification stage in the batch traceability workflow:
 * HARVEST → PACKING → COLD_CHAIN → EXPORT → DELIVERY
 */

enum class StageType(val displayName: String, val order: Int) {
    @SerializedName("HARVEST")
    HARVEST("Cosecha", 0),

    @SerializedName("PACKING")
    PACKING("Empaque", 1),

    @SerializedName("COLD_CHAIN")
    COLD_CHAIN("Cadena de Frío", 2),

    @SerializedName("EXPORT")
    EXPORT("Exportación", 3),

    @SerializedName("DELIVERY")
    DELIVERY("Entrega", 4);

    val icon: String
        get() = when (this) {
            HARVEST -> "🌾"
            PACKING -> "📦"
            COLD_CHAIN -> "❄️"
            EXPORT -> "✈️"
            DELIVERY -> "✅"
        }

    companion object {
        val allStages = listOf(HARVEST, PACKING, COLD_CHAIN, EXPORT, DELIVERY)

        fun fromString(value: String): StageType {
            return values().find { it.name == value } ?: HARVEST
        }
    }
}

enum class StageStatus(val displayName: String) {
    @SerializedName("PENDING")
    PENDING("Pendiente"),

    @SerializedName("APPROVED")
    APPROVED("Aprobado"),

    @SerializedName("REJECTED")
    REJECTED("Rechazado"),

    @SerializedName("FLAGGED")
    FLAGGED("Marcado");

    val color: Color
        get() = when (this) {
            PENDING -> StatusPending
            APPROVED -> StatusApproved
            REJECTED -> StatusRejected
            FLAGGED -> StatusFlagged
        }

    val icon: String
        get() = when (this) {
            PENDING -> "⏳"
            APPROVED -> "✓"
            REJECTED -> "✗"
            FLAGGED -> "⚑"
        }

    companion object {
        fun fromString(value: String): StageStatus {
            return values().find { it.name == value } ?: PENDING
        }
    }
}

data class VerificationStage(
    @SerializedName("id")
    val id: String,

    @SerializedName("batchId")
    val batchId: String,

    @SerializedName("stageType")
    val stageType: StageType,

    @SerializedName("status")
    val status: StageStatus,

    @SerializedName("actorId")
    val actorId: String,

    @SerializedName("timestamp")
    val timestamp: Long, // Unix timestamp in milliseconds

    @SerializedName("location")
    val location: String? = null,

    @SerializedName("latitude")
    val latitude: Double? = null,

    @SerializedName("longitude")
    val longitude: Double? = null,

    @SerializedName("notes")
    val notes: String? = null,

    @SerializedName("evidenceUrl")
    val evidenceUrl: String? = null,

    @SerializedName("createdAt")
    val createdAt: Long = System.currentTimeMillis(),

    @SerializedName("updatedAt")
    val updatedAt: Long = System.currentTimeMillis()
) {
    /**
     * Check if this stage has GPS coordinates
     */
    val hasCoordinates: Boolean
        get() = latitude != null && longitude != null

    /**
     * Get coordinates as Coordenada if available
     */
    val coordenada: Coordenada?
        get() = if (hasCoordinates) Coordenada(latitude!!, longitude!!) else null

    /**
     * Formatted timestamp for display
     */
    val formattedTimestamp: String
        get() {
            val sdf = java.text.SimpleDateFormat("dd MMM yyyy, HH:mm", java.util.Locale("es", "MX"))
            return sdf.format(java.util.Date(timestamp))
        }

    companion object {
        fun mock(stageType: StageType, status: StageStatus = StageStatus.PENDING): VerificationStage {
            return VerificationStage(
                id = "stage-${stageType.name.lowercase()}-${System.currentTimeMillis()}",
                batchId = "batch-mock-id",
                stageType = stageType,
                status = status,
                actorId = "user-mock-id",
                timestamp = System.currentTimeMillis(),
                location = "Campo de prueba, Michoacán",
                latitude = 19.7,
                longitude = -101.1,
                notes = "Etapa de prueba"
            )
        }
    }
}

/**
 * Response wrapper for batch stages API
 */
data class BatchStagesResponse(
    @SerializedName("stages")
    val stages: List<VerificationStage>,

    @SerializedName("currentStage")
    val currentStage: StageType?,

    @SerializedName("nextStage")
    val nextStage: StageType?,

    @SerializedName("isComplete")
    val isComplete: Boolean,

    @SerializedName("progress")
    val progress: Int // 0-100
) {
    companion object {
        fun empty() = BatchStagesResponse(
            stages = emptyList(),
            currentStage = null,
            nextStage = StageType.HARVEST,
            isComplete = false,
            progress = 0
        )

        fun mock(): BatchStagesResponse {
            val stages = listOf(
                VerificationStage.mock(StageType.HARVEST, StageStatus.APPROVED),
                VerificationStage.mock(StageType.PACKING, StageStatus.APPROVED),
                VerificationStage.mock(StageType.COLD_CHAIN, StageStatus.PENDING)
            )
            return BatchStagesResponse(
                stages = stages,
                currentStage = StageType.PACKING,
                nextStage = StageType.EXPORT,
                isComplete = false,
                progress = 40
            )
        }
    }
}

/**
 * Request body for creating a new stage
 */
data class CreateStageRequest(
    @SerializedName("stageType")
    val stageType: StageType? = null,

    @SerializedName("location")
    val location: String? = null,

    @SerializedName("latitude")
    val latitude: Double? = null,

    @SerializedName("longitude")
    val longitude: Double? = null,

    @SerializedName("notes")
    val notes: String? = null,

    @SerializedName("evidenceUrl")
    val evidenceUrl: String? = null
)

/**
 * Request body for updating a stage
 */
data class UpdateStageRequest(
    @SerializedName("status")
    val status: StageStatus? = null,

    @SerializedName("notes")
    val notes: String? = null,

    @SerializedName("location")
    val location: String? = null,

    @SerializedName("latitude")
    val latitude: Double? = null,

    @SerializedName("longitude")
    val longitude: Double? = null,

    @SerializedName("evidenceUrl")
    val evidenceUrl: String? = null
)

/**
 * Response wrapper for stage creation
 */
data class CreateStageResponse(
    @SerializedName("stage")
    val stage: VerificationStage,

    @SerializedName("isComplete")
    val isComplete: Boolean
)

/**
 * Response wrapper for stage update
 */
data class UpdateStageResponse(
    @SerializedName("stage")
    val stage: VerificationStage
)
