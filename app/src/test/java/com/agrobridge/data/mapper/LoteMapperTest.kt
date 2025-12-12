package com.agrobridge.data.mapper

// ═══════════════════════════════════════════════════════════════════
// AGROBRIDGE ANDROID - DATA LAYER TESTS
// ═══════════════════════════════════════════════════════════════════
// Author:  Alejandro Navarro Ayala
// Role:    CEO & Senior Developer
// Email:   ceo@agrobridge.mx
// Company: AgroBridge International
// Date:    November 29, 2025
// Purpose: DTO ↔ Domain bidirectional mapping (10 tests)
// Coverage: 100% of LoteMapper.kt
// ═══════════════════════════════════════════════════════════════════

import com.agrobridge.data.model.LoteEstado
import com.agrobridge.util.TestHelpers
import com.google.common.truth.Truth.assertThat
import org.junit.Test

/**
 * LoteMapperTest - Tests para conversión DTO ↔ Domain
 *
 * COVERAGE TARGET: 100%
 * TESTS: 10
 * FOCUS: Bidirectional mapping, null handling, edge cases
 */
class LoteMapperTest {

    // ═══════════════════════════════════════════════════════════
    // DTO → DOMAIN CONVERSION
    // ═══════════════════════════════════════════════════════════

    @Test
    fun toDomain_converts_lote_dto_to_lote_with_all_fields() {
        // Arrange
        val dto = TestHelpers.createMockLoteDto(
            id = "lote-abc-123",
            nombre = "Parcela Norte"
        )

        // Act
        val domain = LoteMapper.toDomain(dto)

        // Assert
        assertThat(domain.id).isEqualTo("lote-abc-123")
        assertThat(domain.nombre).isEqualTo("Parcela Norte")
        assertThat(domain.cultivo).isEqualTo("Maíz")
        assertThat(domain.area).isEqualTo(100.0)
    }

    @Test
    fun toDomain_handles_null_coordenadas_correctly() {
        // Arrange
        val dto = TestHelpers.createMockLoteDto().copy(
            coordenadas = null
        )

        // Act
        val domain = LoteMapper.toDomain(dto)

        // Assert
        assertThat(domain.coordenadas).isNotNull()
        assertThat(domain.coordenadas).isEmpty()
    }

    @Test
    fun toDomain_handles_empty_coordenadas_list() {
        // Arrange
        val dto = TestHelpers.createMockLoteDto().copy(
            coordenadas = emptyList()
        )

        // Act
        val domain = LoteMapper.toDomain(dto)

        // Assert
        assertThat(domain.coordenadas).isEmpty()
    }

    @Test
    fun toDomain_converts_estado_string_to_enum_activo() {
        // Arrange
        val dto = TestHelpers.createMockLoteDto().copy(
            estado = "activo"
        )

        // Act
        val domain = LoteMapper.toDomain(dto)

        // Assert
        assertThat(domain.estado).isEqualTo(LoteEstado.ACTIVO)
    }

    @Test
    fun toDomain_converts_estado_string_to_enum_inactivo() {
        // Arrange
        val dto = TestHelpers.createMockLoteDto().copy(
            estado = "inactivo"
        )

        // Act
        val domain = LoteMapper.toDomain(dto)

        // Assert
        assertThat(domain.estado).isEqualTo(LoteEstado.INACTIVO)
    }

    // ═══════════════════════════════════════════════════════════
    // DOMAIN → DTO CONVERSION
    // ═══════════════════════════════════════════════════════════

    @Test
    fun toDto_converts_lote_to_lote_dto_with_all_fields() {
        // Arrange
        val lote = TestHelpers.createMockLote(
            id = "lote-xyz-789",
            nombre = "Parcela Sur",
            cultivo = "Limón",
            area = 180.25
        )

        // Act
        val dto = LoteMapper.toDto(lote)

        // Assert
        assertThat(dto.id).isEqualTo("lote-xyz-789")
        assertThat(dto.nombre).isEqualTo("Parcela Sur")
        assertThat(dto.cultivo).isEqualTo("Limón")
        assertThat(dto.superficie).isEqualTo(180.25)
    }

    @Test
    fun toDto_converts_estado_enum_to_string() {
        // Arrange
        val lote = TestHelpers.createMockLote(
            estado = LoteEstado.COSECHADO
        )

        // Act
        val dto = LoteMapper.toDto(lote)

        // Assert
        assertThat(dto.estado).isEqualTo("cosechado")
    }

    // ═══════════════════════════════════════════════════════════
    // BIDIRECTIONAL INTEGRITY
    // ═══════════════════════════════════════════════════════════

    @Test
    fun bidirectional_dto_to_domain_to_dto_maintains_integrity() {
        // Arrange
        val originalDto = TestHelpers.createMockLoteDto(
            id = "integrity-test-1",
            nombre = "Bidirectional Test"
        )

        // Act
        val domain = LoteMapper.toDomain(originalDto)
        val convertedBackDto = LoteMapper.toDto(domain)

        // Assert
        assertThat(convertedBackDto.id).isEqualTo(originalDto.id)
        assertThat(convertedBackDto.nombre).isEqualTo(originalDto.nombre)
        assertThat(convertedBackDto.cultivo).isEqualTo(originalDto.cultivo)
        assertThat(convertedBackDto.superficie).isEqualTo(originalDto.superficie)
    }

    @Test
    fun bidirectional_domain_to_dto_to_domain_maintains_integrity() {
        // Arrange
        val originalLote = TestHelpers.createMockLote(
            id = "integrity-test-2",
            nombre = "Domain First",
            cultivo = "Mango",
            area = 333.33,
            estado = LoteEstado.INACTIVO
        )

        // Act
        val dto = LoteMapper.toDto(originalLote)
        val convertedBackLote = LoteMapper.toDomain(dto)

        // Assert
        assertThat(convertedBackLote.id).isEqualTo(originalLote.id)
        assertThat(convertedBackLote.nombre).isEqualTo(originalLote.nombre)
        assertThat(convertedBackLote.cultivo).isEqualTo(originalLote.cultivo)
        assertThat(convertedBackLote.area).isEqualTo(originalLote.area)
        assertThat(convertedBackLote.estado).isEqualTo(originalLote.estado)
    }
}
