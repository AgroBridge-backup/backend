package com.agrobridge.data.mapper

import com.agrobridge.data.model.Lote
import com.agrobridge.data.model.LoteEstado
import com.agrobridge.data.model.Productor
import com.google.common.truth.Truth.assertThat
import org.junit.Test

/**
 * LoteMapperMediumTest - Tests for MEDIUM severity mapper fixes
 *
 * FIXED: MEDIUM-2 - Unsafe metadata cast with null coalescing
 * FIXED: MEDIUM-25 - Silent fallback to INACTIVO on unknown estado
 *
 * COVERAGE TARGET: 100% of edge cases
 * TESTS: 4
 * FOCUS: Metadata handling, enum validation, null safety
 */
class LoteMapperMediumTest {

    @Test
    fun toDto_handles_null_metadata_gracefully() {
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
            metadata = null
        )

        // Act
        val dto = LoteMapper.run { lote.toDto() }

        // Assert
        assertThat(dto.metadata).isNotNull()
        assertThat(dto.metadata).isEmpty()
    }

    @Test
    fun toDto_preserves_metadata_when_valid_map() {
        // Arrange
        val productor = Productor.mock()
        val metadata = mapOf<String, Any>("key1" to "value1", "key2" to 42)
        val lote = Lote(
            id = "lote-2",
            nombre = "Test Lote",
            cultivo = "Trigo",
            area = 50.0,
            estado = LoteEstado.EN_COSECHA,
            productor = productor,
            fechaCreacion = System.currentTimeMillis(),
            metadata = metadata
        )

        // Act
        val dto = LoteMapper.run { lote.toDto() }

        // Assert
        assertThat(dto.metadata).isNotNull()
        assertThat(dto.metadata).isNotEmpty()
    }

    @Test
    fun toLoteEstado_throws_on_unknown_estado() {
        // Act & Assert
        val exception = try {
            LoteMapper.run { "UNKNOWN_ESTADO".toLoteEstado() }
            null
        } catch (e: IllegalArgumentException) {
            e
        }

        assertThat(exception).isNotNull()
        assertThat(exception?.message).contains("Unknown LoteEstado")
        assertThat(exception?.message).contains("UNKNOWN_ESTADO")
    }

    @Test
    fun toLoteEstado_handles_all_valid_states() {
        // Arrange
        val validStates = listOf(
            "activo" to LoteEstado.ACTIVO,
            "inactivo" to LoteEstado.INACTIVO,
            "en_cosecha" to LoteEstado.EN_COSECHA,
            "en cosecha" to LoteEstado.EN_COSECHA,
            "cosechado" to LoteEstado.COSECHADO,
            "en_preparacion" to LoteEstado.EN_PREPARACION,
            "en preparacion" to LoteEstado.EN_PREPARACION
        )

        // Act & Assert
        for ((stateString, expectedEnum) in validStates) {
            val result = LoteMapper.run { stateString.toLoteEstado() }
            assertThat(result).isEqualTo(expectedEnum)
        }
    }
}
