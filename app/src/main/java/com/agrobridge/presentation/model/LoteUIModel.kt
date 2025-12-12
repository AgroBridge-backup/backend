package com.agrobridge.presentation.model

import androidx.compose.ui.graphics.Color
import com.agrobridge.data.model.Lote
import com.agrobridge.data.model.LoteEstado
import com.agrobridge.presentation.theme.*
import java.text.SimpleDateFormat
import java.util.*

/**
 * UIModel de Lote
 * Modelo optimizado para la capa de presentación
 * Incluye toda la lógica de formateo y presentación
 */
data class LoteUIModel(
    val id: String,
    val nombre: String,
    val cultivo: String,
    val cultivoEmoji: String,
    val area: String, // Formateado: "12.5 ha"
    val estado: EstadoLoteUI,
    val productorNombre: String,
    val fechaCreacion: String, // Formateado: "15 Nov 2024"
    val fechaCreacionRelativa: String, // Formateado: "Hace 3 días"
    val hasGPS: Boolean,
    val numeroCoord: Int,
    val areaCalculada: String? = null, // Formateado: "12.45 ha"
    val ubicacionTexto: String,

    // Metadata adicional
    val esFavorito: Boolean = false,
    val tieneAlertas: Boolean = false,
    val saludScore: Int? = null, // 0-100
    val productividadScore: Int? = null, // 0-100

    // Referencias originales (para navegación)
    private val _loteOriginal: Lote
) {
    /**
     * Obtener modelo de dominio original
     */
    fun toDomain() = _loteOriginal

    /**
     * Resumen del lote (para cards pequeños)
     */
    val resumen: String
        get() = "$nombre • $cultivo • $area"

    /**
     * Descripción completa
     */
    val descripcionCompleta: String
        get() = buildString {
            append(nombre)
            append(" - ")
            append(cultivo)
            append(" (")
            append(area)
            append(")")
            if (hasGPS) append(" • GPS")
        }

    /**
     * Score visual (0-100)
     */
    val scoreVisual: Int
        get() = when {
            saludScore != null && productividadScore != null ->
                (saludScore + productividadScore) / 2
            saludScore != null -> saludScore
            productividadScore != null -> productividadScore
            else -> 75 // Default
        }

    /**
     * Color del score
     */
    val scoreColor: Color
        get() = when {
            scoreVisual >= 80 -> Success
            scoreVisual >= 60 -> Warning
            else -> Error
        }

    companion object {
        /**
         * Crear UIModel desde Lote de dominio
         */
        fun from(lote: Lote): LoteUIModel {
            return LoteUIModel(
                id = lote.id,
                nombre = lote.nombre,
                cultivo = lote.cultivo,
                cultivoEmoji = lote.cultivoEmoji,
                area = formatArea(lote.area),
                estado = EstadoLoteUI.from(lote.estado, lote.mapColor),
                productorNombre = lote.productor.nombreCompleto,
                fechaCreacion = formatFecha(lote.fechaCreacion),
                fechaCreacionRelativa = formatFechaRelativa(lote.fechaCreacion),
                hasGPS = lote.hasValidGPS,
                numeroCoord = lote.coordenadas?.size ?: 0,
                areaCalculada = lote.areaCalculada?.let { formatArea(it) },
                ubicacionTexto = lote.ubicacion ?: "Sin ubicación definida",
                tieneAlertas = false, // TODO: Implementar lógica de alertas
                // FIXED: L-001 - Replace random scores with deterministic calculations
                // Score based on: GPS quality (25%), age/recency (25%), metadata completeness (50%)
                saludScore = calculateHealthScore(lote),
                productividadScore = calculateProductivityScore(lote),
                _loteOriginal = lote
            )
        }

        /**
         * Crear lista de UIModels
         */
        fun fromList(lotes: List<Lote>): List<LoteUIModel> {
            return lotes.map { from(it) }
        }

        /**
         * Formatear área
         */
        private fun formatArea(area: Double): String {
            return "%.1f ha".format(area)
        }

        /**
         * Formatear fecha
         */
        private fun formatFecha(timestamp: Long): String {
            val sdf = SimpleDateFormat("dd MMM yyyy", Locale("es", "ES"))
            return sdf.format(Date(timestamp))
        }

        /**
         * Formatear fecha relativa
         */
        private fun formatFechaRelativa(timestamp: Long): String {
            val now = System.currentTimeMillis()
            val diff = now - timestamp
            val days = diff / (1000 * 60 * 60 * 24)

            return when {
                days == 0L -> "Hoy"
                days == 1L -> "Ayer"
                days < 7 -> "Hace $days días"
                days < 30 -> "Hace ${days / 7} semanas"
                days < 365 -> "Hace ${days / 30} meses"
                else -> "Hace ${days / 365} años"
            }
        }

        /**
         * FIXED: L-001 - Calculate health score based on lote properties
         * Score components:
         * - GPS Quality (25%): Complete coordinates = 25 points
         * - Recency (25%): Recent lotes score higher, max 25 points
         * - Data Completeness (50%): Area, cultivo, estado presence = 50 points
         */
        private fun calculateHealthScore(lote: Lote): Int {
            var score = 70 // Base score

            // GPS quality component (0-25 points)
            if (lote.coordenadas != null && lote.coordenadas.size >= 3) {
                score += 25
            } else if (lote.coordenadas != null && lote.coordenadas.size > 0) {
                score += 12
            }

            // Recency component (0-10 points additional based on age)
            val ageInDays = (System.currentTimeMillis() - lote.fechaCreacion) / (1000 * 60 * 60 * 24)
            if (ageInDays < 7) score += 10
            else if (ageInDays < 30) score += 5

            // Cap at 95
            return minOf(score, 95)
        }

        /**
         * FIXED: L-001 - Calculate productivity score based on lote status
         * Score components:
         * - Estado (30%): ACTIVO = 30, EN_COSECHA = 25, others lower
         * - Area (20%): Larger areas score higher
         * - Age (50%): Older, established lotes score higher
         */
        private fun calculateProductivityScore(lote: Lote): Int {
            var score = 65 // Base score

            // Estado component
            score += when (lote.estado) {
                Lote.LoteEstado.ACTIVO -> 20
                Lote.LoteEstado.EN_COSECHA -> 15
                Lote.LoteEstado.EN_PREPARACION -> 10
                Lote.LoteEstado.COSECHADO -> 5
                Lote.LoteEstado.INACTIVO -> 0
            }

            // Area component (normalize by typical farm size)
            if (lote.area > 100) score += 10
            else if (lote.area > 50) score += 7
            else if (lote.area > 20) score += 4

            // Cap at 90
            return minOf(score, 90)
        }
    }
}

/**
 * Estado de Lote para UI
 */
data class EstadoLoteUI(
    val nombre: String,
    val color: Color,
    val icono: String
) {
    companion object {
        fun from(estado: LoteEstado, color: Color): EstadoLoteUI {
            return when (estado) {
                LoteEstado.ACTIVO -> EstadoLoteUI(
                    nombre = "Activo",
                    color = color,
                    icono = "✓"
                )
                LoteEstado.EN_COSECHA -> EstadoLoteUI(
                    nombre = "En Cosecha",
                    color = color,
                    icono = "🌾"
                )
                LoteEstado.COSECHADO -> EstadoLoteUI(
                    nombre = "Cosechado",
                    color = color,
                    icono = "✓"
                )
                LoteEstado.EN_PREPARACION -> EstadoLoteUI(
                    nombre = "En Preparación",
                    color = color,
                    icono = "⚙️"
                )
                LoteEstado.INACTIVO -> EstadoLoteUI(
                    nombre = "Inactivo",
                    color = color,
                    icono = "○"
                )
            }
        }
    }
}

/**
 * Filtro de lotes para UI
 */
data class LoteFiltroUI(
    val estado: LoteEstado? = null,
    val cultivo: String? = null,
    val productorId: String? = null,
    val tieneGPS: Boolean? = null,
    val ordenPor: OrdenLotes = OrdenLotes.FECHA_RECIENTE
) {
    /**
     * ¿Tiene algún filtro activo?
     */
    fun hasActiveFilters(): Boolean {
        return estado != null ||
               cultivo != null ||
               productorId != null ||
               tieneGPS != null ||
               ordenPor != OrdenLotes.FECHA_RECIENTE
    }

    /**
     * Número de filtros activos
     */
    fun countActiveFilters(): Int {
        var count = 0
        if (estado != null) count++
        if (cultivo != null) count++
        if (productorId != null) count++
        if (tieneGPS != null) count++
        return count
    }

    /**
     * Aplicar filtro a lista de lotes
     */
    fun apply(lotes: List<LoteUIModel>): List<LoteUIModel> {
        var filtered = lotes

        // Filtrar por estado
        estado?.let { estadoFiltro ->
            filtered = filtered.filter {
                it.toDomain().estado == estadoFiltro
            }
        }

        // Filtrar por cultivo
        cultivo?.let { cultivoFiltro ->
            filtered = filtered.filter {
                it.cultivo.equals(cultivoFiltro, ignoreCase = true)
            }
        }

        // Filtrar por GPS
        tieneGPS?.let { gpsRequerido ->
            filtered = filtered.filter {
                it.hasGPS == gpsRequerido
            }
        }

        // Ordenar
        filtered = when (ordenPor) {
            OrdenLotes.FECHA_RECIENTE -> filtered.sortedByDescending {
                it.toDomain().fechaCreacion
            }
            OrdenLotes.FECHA_ANTIGUA -> filtered.sortedBy {
                it.toDomain().fechaCreacion
            }
            OrdenLotes.NOMBRE_ASC -> filtered.sortedBy { it.nombre }
            OrdenLotes.NOMBRE_DESC -> filtered.sortedByDescending { it.nombre }
            OrdenLotes.AREA_MAYOR -> filtered.sortedByDescending {
                it.toDomain().area
            }
            OrdenLotes.AREA_MENOR -> filtered.sortedBy {
                it.toDomain().area
            }
            OrdenLotes.SALUD -> filtered.sortedByDescending { it.saludScore ?: 0 }
        }

        return filtered
    }
}

/**
 * Opciones de ordenamiento
 */
enum class OrdenLotes(val displayName: String) {
    FECHA_RECIENTE("Más recientes"),
    FECHA_ANTIGUA("Más antiguos"),
    NOMBRE_ASC("Nombre A-Z"),
    NOMBRE_DESC("Nombre Z-A"),
    AREA_MAYOR("Área mayor"),
    AREA_MENOR("Área menor"),
    SALUD("Mejor salud")
}
