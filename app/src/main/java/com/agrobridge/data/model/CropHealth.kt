package com.agrobridge.data.model

import com.google.gson.annotations.SerializedName

/**
 * Modelo de análisis de salud de cultivos
 * Replica CropHealthService.swift de iOS
 * Integrado con TensorFlow Lite / ML Kit
 */
data class CropHealthAnalysis(
    @SerializedName("id")
    val id: String,

    @SerializedName("loteId")
    val loteId: String,

    @SerializedName("imagenUrl")
    val imagenUrl: String? = null,

    @SerializedName("timestamp")
    val timestamp: Long,

    @SerializedName("diagnostico")
    val diagnostico: CropDiagnostic,

    @SerializedName("confianza")
    val confianza: Float, // 0.0 - 1.0

    @SerializedName("enfermedadDetectada")
    val enfermedadDetectada: String? = null,

    @SerializedName("severidad")
    val severidad: Severidad,

    @SerializedName("recomendaciones")
    val recomendaciones: List<String>,

    @SerializedName("tratamientosSugeridos")
    val tratamientosSugeridos: List<String>? = null,

    @SerializedName("ubicacion")
    val ubicacion: Coordenada? = null,

    @SerializedName("metadata")
    val metadata: Map<String, Any>? = null
) {
    /**
     * Emoji del diagnóstico
     */
    val diagnosticoEmoji: String
        get() = when (diagnostico) {
            CropDiagnostic.SALUDABLE -> "✅"
            CropDiagnostic.ENFERMEDAD_DETECTADA -> "⚠️"
            CropDiagnostic.PLAGA_DETECTADA -> "🐛"
            CropDiagnostic.DEFICIT_NUTRICIONAL -> "🌿"
            CropDiagnostic.ESTRES_HIDRICO -> "💧"
            CropDiagnostic.DESCONOCIDO -> "❓"
        }

    /**
     * Color del diagnóstico para UI
     */
    val diagnosticoColor: androidx.compose.ui.graphics.Color
        get() = when (severidad) {
            Severidad.BAJA -> com.agrobridge.presentation.theme.Success
            Severidad.MEDIA -> com.agrobridge.presentation.theme.Warning
            Severidad.ALTA -> com.agrobridge.presentation.theme.Error
            Severidad.CRITICA -> com.agrobridge.presentation.theme.Error
        }

    /**
     * Confianza formateada
     */
    val confianzaFormatted: String
        get() = "${(confianza * 100).toInt()}%"

    /**
     * Resumen del análisis
     */
    val resumen: String
        get() = when (diagnostico) {
            CropDiagnostic.SALUDABLE ->
                "Planta saludable. No se detectaron problemas significativos."

            CropDiagnostic.ENFERMEDAD_DETECTADA ->
                "Enfermedad detectada: ${enfermedadDetectada ?: "No especificada"}. Severidad: ${severidad.displayName}."

            CropDiagnostic.PLAGA_DETECTADA ->
                "Plaga detectada: ${enfermedadDetectada ?: "No especificada"}. Severidad: ${severidad.displayName}."

            CropDiagnostic.DEFICIT_NUTRICIONAL ->
                "Déficit nutricional detectado. Se recomienda análisis de suelo."

            CropDiagnostic.ESTRES_HIDRICO ->
                "Estrés hídrico detectado. Revisar sistema de riego."

            CropDiagnostic.DESCONOCIDO ->
                "No se pudo determinar el estado de la planta. Confianza baja."
        }

    companion object {
        /**
         * Análisis mock saludable
         */
        fun mockSaludable() = CropHealthAnalysis(
            id = "analysis-001",
            loteId = "lote-001",
            imagenUrl = "https://example.com/crop-image.jpg",
            timestamp = System.currentTimeMillis(),
            diagnostico = CropDiagnostic.SALUDABLE,
            confianza = 0.95f,
            enfermedadDetectada = null,
            severidad = Severidad.BAJA,
            recomendaciones = listOf(
                "Continuar con el programa de nutrición actual",
                "Mantener monitoreo preventivo semanal",
                "Revisar sistema de riego periódicamente"
            ),
            tratamientosSugeridos = null,
            ubicacion = Coordenada.mock()
        )

        /**
         * Análisis mock con enfermedad
         */
        fun mockEnfermo() = CropHealthAnalysis(
            id = "analysis-002",
            loteId = "lote-001",
            imagenUrl = "https://example.com/crop-disease.jpg",
            timestamp = System.currentTimeMillis(),
            diagnostico = CropDiagnostic.ENFERMEDAD_DETECTADA,
            confianza = 0.87f,
            enfermedadDetectada = "Tizón Tardío",
            severidad = Severidad.MEDIA,
            recomendaciones = listOf(
                "Aplicar fungicida sistémico inmediatamente",
                "Mejorar ventilación del cultivo",
                "Reducir humedad relativa en el área afectada",
                "Remover plantas severamente afectadas"
            ),
            tratamientosSugeridos = listOf(
                "Mancozeb 80% WP - 2.5 kg/ha",
                "Metalaxil + Mancozeb - 2.0 kg/ha",
                "Azoxistrobina 25% SC - 1.0 L/ha"
            ),
            ubicacion = Coordenada.mock()
        )
    }
}

/**
 * Tipo de diagnóstico
 */
enum class CropDiagnostic {
    @SerializedName("saludable")
    SALUDABLE,

    @SerializedName("enfermedad_detectada")
    ENFERMEDAD_DETECTADA,

    @SerializedName("plaga_detectada")
    PLAGA_DETECTADA,

    @SerializedName("deficit_nutricional")
    DEFICIT_NUTRICIONAL,

    @SerializedName("estres_hidrico")
    ESTRES_HIDRICO,

    @SerializedName("desconocido")
    DESCONOCIDO;

    val displayName: String
        get() = when (this) {
            SALUDABLE -> "Saludable"
            ENFERMEDAD_DETECTADA -> "Enfermedad Detectada"
            PLAGA_DETECTADA -> "Plaga Detectada"
            DEFICIT_NUTRICIONAL -> "Déficit Nutricional"
            ESTRES_HIDRICO -> "Estrés Hídrico"
            DESCONOCIDO -> "Desconocido"
        }
}

/**
 * Nivel de severidad
 */
enum class Severidad {
    @SerializedName("baja")
    BAJA,

    @SerializedName("media")
    MEDIA,

    @SerializedName("alta")
    ALTA,

    @SerializedName("critica")
    CRITICA;

    val displayName: String
        get() = when (this) {
            BAJA -> "Baja"
            MEDIA -> "Media"
            ALTA -> "Alta"
            CRITICA -> "Crítica"
        }
}
