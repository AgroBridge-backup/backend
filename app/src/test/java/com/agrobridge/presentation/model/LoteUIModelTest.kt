package com.agrobridge.presentation.model

import com.agrobridge.data.model.Coordenada
import com.agrobridge.data.model.Lote
import com.agrobridge.data.model.LoteEstado
import com.agrobridge.data.model.Productor
import com.google.common.truth.Truth.assertThat
import org.junit.Test

/**
 * LoteUIModelTest - Tests for UI model score calculations
 *
 * FIXED: L-001 - Replace random scores with deterministic calculations
 *
 * COVERAGE TARGET: 100% of score calculation logic
 * TESTS: 6
 * FOCUS: Health score, productivity score, edge cases
 */
class LoteUIModelTest {

    // FIXED: LOW-035 - Extract magic numbers to named constants for test readability
    companion object {
        private const val THIRTY_DAYS_IN_MS = 30L * 24 * 60 * 60 * 1000

        // Health score expected ranges
        private const val COMPLETE_LOTE_MIN_HEALTH = 90
        private const val COMPLETE_LOTE_MAX_HEALTH = 95
        private const val INCOMPLETE_LOTE_MIN_HEALTH = 70
        private const val INCOMPLETE_LOTE_MAX_HEALTH = 90
        private const val PARTIAL_COORDS_MIN_HEALTH = 80
        private const val PARTIAL_COORDS_MAX_HEALTH = 95

        // Productivity score expected ranges
        private const val ACTIVE_LOTE_MIN_PRODUCTIVITY = 85
        private const val ACTIVE_LOTE_MAX_PRODUCTIVITY = 90
    }

    @Test
    fun calculateHealthScore_returns_high_score_for_complete_lote() {
        // Arrange
        val productor = Productor.mock()
        val lote = Lote(
            id = "lote-1",
            nombre = "Test Lote",
            cultivo = "Maíz",
            area = 100.0,
            estado = LoteEstado.ACTIVO,
            productor = productor,
            fechaCreacion = System.currentTimeMillis(),
            coordenadas = listOf(
                Coordenada(25.0, -100.0),
                Coordenada(25.1, -100.0),
                Coordenada(25.1, -100.1)
            )
        )

        // Act
        val uiModel = LoteUIModel.Companion.from(lote)

        // Assert
        assertThat(uiModel.saludScore).isGreaterThanOrEqualTo(COMPLETE_LOTE_MIN_HEALTH)
        assertThat(uiModel.saludScore).isLessThanOrEqualTo(COMPLETE_LOTE_MAX_HEALTH)
    }

    @Test
    fun calculateHealthScore_returns_lower_score_for_incomplete_lote() {
        // Arrange
        val productor = Productor.mock()
        val lote = Lote(
            id = "lote-2",
            nombre = "Test Lote",
            cultivo = "Trigo",
            area = 50.0,
            estado = LoteEstado.INACTIVO,
            productor = productor,
            fechaCreacion = System.currentTimeMillis(),
            coordenadas = null
        )

        // Act
        val uiModel = LoteUIModel.Companion.from(lote)

        // Assert
        assertThat(uiModel.saludScore).isGreaterThanOrEqualTo(INCOMPLETE_LOTE_MIN_HEALTH)
        assertThat(uiModel.saludScore).isLessThan(INCOMPLETE_LOTE_MAX_HEALTH)
    }

    @Test
    fun calculateProductivityScore_returns_high_score_for_active_lote() {
        // Arrange
        val productor = Productor.mock()
        val lote = Lote(
            id = "lote-3",
            nombre = "Test Lote",
            cultivo = "Maíz",
            area = 150.0,
            estado = LoteEstado.ACTIVO,
            productor = productor,
            fechaCreacion = System.currentTimeMillis() - THIRTY_DAYS_IN_MS
        )

        // Act
        val uiModel = LoteUIModel.Companion.from(lote)

        // Assert
        assertThat(uiModel.productividadScore).isGreaterThanOrEqualTo(ACTIVE_LOTE_MIN_PRODUCTIVITY)
        assertThat(uiModel.productividadScore).isLessThanOrEqualTo(ACTIVE_LOTE_MAX_PRODUCTIVITY)
    }

    @Test
    fun calculateProductivityScore_reflects_lote_estado() {
        // Arrange
        val productor = Productor.mock()

        val estadoScores = mapOf(
            LoteEstado.ACTIVO to 85..90,
            LoteEstado.EN_COSECHA to 80..85,
            LoteEstado.EN_PREPARACION to 75..80,
            LoteEstado.COSECHADO to 70..75,
            LoteEstado.INACTIVO to 65..70
        )

        // Act & Assert
        for ((estado, expectedRange) in estadoScores) {
            val lote = Lote(
                id = "lote-$estado",
                nombre = "Test",
                cultivo = "Test",
                area = 100.0,
                estado = estado,
                productor = productor,
                fechaCreacion = System.currentTimeMillis()
            )

            val uiModel = LoteUIModel.Companion.from(lote)
            assertThat(uiModel.productividadScore).isIn(expectedRange)
        }
    }

    @Test
    fun calculateScores_are_deterministic_not_random() {
        // Arrange
        val productor = Productor.mock()
        val lote = Lote(
            id = "lote-det",
            nombre = "Test Lote",
            cultivo = "Maíz",
            area = 75.0,
            estado = LoteEstado.ACTIVO,
            productor = productor,
            fechaCreacion = System.currentTimeMillis()
        )

        // Act - Create multiple instances
        val uiModel1 = LoteUIModel.Companion.from(lote)
        val uiModel2 = LoteUIModel.Companion.from(lote)
        val uiModel3 = LoteUIModel.Companion.from(lote)

        // Assert - All should have same scores (deterministic, not random)
        assertThat(uiModel1.saludScore).isEqualTo(uiModel2.saludScore)
        assertThat(uiModel2.saludScore).isEqualTo(uiModel3.saludScore)
        assertThat(uiModel1.productividadScore).isEqualTo(uiModel2.productividadScore)
        assertThat(uiModel2.productividadScore).isEqualTo(uiModel3.productividadScore)
    }

    @Test
    fun calculateHealthScore_accounts_for_partial_coordinates() {
        // Arrange
        val productor = Productor.mock()
        val loteWithPartialCoords = Lote(
            id = "lote-partial",
            nombre = "Test",
            cultivo = "Maíz",
            area = 100.0,
            estado = LoteEstado.ACTIVO,
            productor = productor,
            fechaCreacion = System.currentTimeMillis(),
            coordenadas = listOf(
                Coordenada(25.0, -100.0),
                Coordenada(25.1, -100.1)
            )  // Only 2 coordinates instead of 3+
        )

        // Act
        val uiModel = LoteUIModel.Companion.from(loteWithPartialCoords)

        // Assert - Should have decent score but not max
        assertThat(uiModel.saludScore).isGreaterThanOrEqualTo(PARTIAL_COORDS_MIN_HEALTH)
        assertThat(uiModel.saludScore).isLessThan(PARTIAL_COORDS_MAX_HEALTH)
    }
}
